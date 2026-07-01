const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');

const { query } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(`
      SELECT 
        id, email, phone, first_name, last_name, status, is_admin, 
        department, created_at, last_login, preferred_language, profile_image,
        aadhar_last_four
      FROM users 
      WHERE id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = result.rows[0];

    // Get user's reported issues count
    const issuesResult = await query(
      'SELECT COUNT(*) as total_issues FROM issues WHERE reporter_id = $1',
      [userId]
    );

    // Get user's votes count
    const votesResult = await query(
      'SELECT COUNT(*) as total_votes FROM issue_votes WHERE user_id = $1',
      [userId]
    );

    // Get user's comments count
    const commentsResult = await query(
      'SELECT COUNT(*) as total_comments FROM comments WHERE user_id = $1',
      [userId]
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          firstName: user.first_name,
          lastName: user.last_name,
          status: user.status,
          isAdmin: user.is_admin,
          department: user.department,
          createdAt: user.created_at,
          lastLogin: user.last_login,
          preferredLanguage: user.preferred_language,
          profileImage: user.profile_image,
          aadharLastFour: user.aadhar_last_four
        },
        stats: {
          totalIssues: parseInt(issuesResult.rows[0].total_issues),
          totalVotes: parseInt(votesResult.rows[0].total_votes),
          totalComments: parseInt(commentsResult.rows[0].total_comments)
        }
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
});

const { upload, handleUploadError } = require('../middleware/upload');

// Update user profile
router.put('/profile', 
  upload.single('profileImage'),
  [
    body('firstName').optional().trim().isLength({ min: 1, max: 50 }).withMessage('First Name must be between 1 and 50 characters'),
    body('lastName').optional().trim().isLength({ min: 1, max: 50 }).withMessage('Last Name must be between 1 and 50 characters'),
    body('phone').optional().isLength({ min: 10, max: 15 }).isNumeric().withMessage('Phone number must be a valid numeric value of 10 to 15 digits'),
    body('preferredLanguage').optional().isIn(['en', 'hi', 'sat', 'bn', 'or', 'ur', 'sa']).withMessage('Invalid language selected')
  ], 
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { firstName, lastName, phone, preferredLanguage } = req.body;
      const userId = req.user.id;

      // Build update query dynamically
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (firstName) {
        updates.push(`first_name = $${paramCount++}`);
        values.push(firstName);
      }
      if (lastName) {
        updates.push(`last_name = $${paramCount++}`);
        values.push(lastName);
      }
      if (phone) {
        updates.push(`phone = $${paramCount++}`);
        values.push(phone);
      }
      if (preferredLanguage) {
        updates.push(`preferred_language = $${paramCount++}`);
        values.push(preferredLanguage);
      }
      if (req.file) {
        const imageUrl = `/uploads/${req.file.filename}`;
        updates.push(`profile_image = $${paramCount++}`);
        values.push(imageUrl);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(userId);

      await query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount}`,
        values
      );

      // Fetch the updated user profile
      const updatedUserResult = await query(
        `SELECT id, email, phone, first_name, last_name, status, is_admin, 
                department, created_at, last_login, preferred_language, profile_image,
                aadhar_last_four FROM users WHERE id = $1`,
        [userId]
      );
      const updatedUser = updatedUserResult.rows[0];

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            phone: updatedUser.phone,
            firstName: updatedUser.first_name,
            lastName: updatedUser.last_name,
            status: updatedUser.status,
            isAdmin: updatedUser.is_admin,
            department: updatedUser.department,
            createdAt: updatedUser.created_at,
            lastLogin: updatedUser.last_login,
            preferredLanguage: updatedUser.preferred_language,
            profileImage: updatedUser.profile_image,
            aadharLastFour: updatedUser.aadhar_last_four
          }
        }
      });

    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({
        success: false,
        message: 'Profile update failed',
        error: error.message
      });
    }
  },
  handleUploadError
);

// Get user's reported issues
router.get('/issues', [
  authenticateToken
], async (req, res) => {
  try {
    const { page = 1, limit = 20, status, category } = req.query;
    const userId = req.user.id;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build query conditions
    let whereConditions = ['i.reporter_id = $1'];
    let queryParams = [userId];
    let paramCount = 2;

    if (status) {
      whereConditions.push(`i.status = $${paramCount++}`);
      queryParams.push(status);
    }

    if (category) {
      whereConditions.push(`i.category = $${paramCount++}`);
      queryParams.push(category);
    }

    // Get issues
    const result = await query(`
      SELECT 
        i.*,
        calculate_priority_score(i.id) as calculated_priority_score,
        ST_X(i.location) as longitude,
        ST_Y(i.location) as latitude,
        COUNT(iv.id) as total_votes,
        COUNT(CASE WHEN iv.vote_type = 'upvote' THEN 1 END) as upvotes,
        COUNT(CASE WHEN iv.vote_type = 'downvote' THEN 1 END) as downvotes
      FROM issues i
      LEFT JOIN issue_votes iv ON i.id = iv.issue_id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY i.id
      ORDER BY i.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `, [...queryParams, parseInt(limit), offset]);

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) FROM issues i 
      WHERE ${whereConditions.join(' AND ')}
    `, queryParams);

    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        issues: result.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount: totalCount,
          hasNext: offset + parseInt(limit) < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Get user issues error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user issues',
      error: error.message
    });
  }
});

// Get user's voting history
router.get('/votes', [
  authenticateToken
], async (req, res) => {
  try {
    const { page = 1, limit = 20, voteType } = req.query;
    const userId = req.user.id;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereConditions = ['iv.user_id = $1'];
    let queryParams = [userId];
    let paramCount = 2;

    if (voteType) {
      whereConditions.push(`iv.vote_type = $${paramCount++}`);
      queryParams.push(voteType);
    }

    const result = await query(`
      SELECT 
        iv.*,
        i.title as issue_title,
        i.category as issue_category,
        i.status as issue_status,
        i.created_at as issue_created_at
      FROM issue_votes iv
      JOIN issues i ON iv.issue_id = i.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY iv.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `, [...queryParams, parseInt(limit), offset]);

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) FROM issue_votes iv 
      WHERE ${whereConditions.join(' AND ')}
    `, queryParams);

    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        votes: result.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount: totalCount,
          hasNext: offset + parseInt(limit) < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Get user votes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user votes',
      error: error.message
    });
  }
});

// Get user's comments
router.get('/comments', [
  authenticateToken
], async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user.id;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const result = await query(`
      SELECT 
        ic.*,
        i.title as issue_title,
        i.category as issue_category,
        i.status as issue_status
      FROM comments ic
      JOIN issues i ON ic.issue_id = i.id
      WHERE ic.user_id = $1 AND ic.is_deleted = false
      ORDER BY ic.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, parseInt(limit), offset]);

    // Get total count
    const countResult = await query(
      'SELECT COUNT(*) FROM comments WHERE user_id = $1 AND is_deleted = false',
      [userId]
    );

    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        comments: result.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount: totalCount,
          hasNext: offset + parseInt(limit) < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Get user comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user comments',
      error: error.message
    });
  }
});

// Delete user's comment
router.delete('/comments/:id', [
  authenticateToken
], async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if comment exists and belongs to user
    const commentResult = await query(
      'SELECT id FROM issue_comments WHERE id = $1 AND user_id = $2 AND is_deleted = false',
      [id, userId]
    );

    if (commentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found or access denied'
      });
    }

    // Soft delete comment
    await query(
      'UPDATE comments SET is_deleted = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });

  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete comment',
      error: error.message
    });
  }
});

// Get all users (admin only)
router.get('/', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const { page = 1, limit = 20, status, isAdmin, department, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build query conditions
    let whereConditions = [];
    let queryParams = [];
    let paramCount = 1;

    if (status) {
      whereConditions.push(`status = $${paramCount++}`);
      queryParams.push(status);
    }

    if (isAdmin !== undefined) {
      whereConditions.push(`is_admin = $${paramCount++}`);
      queryParams.push(isAdmin === 'true');
    }

    if (department) {
      whereConditions.push(`department = $${paramCount++}`);
      queryParams.push(department);
    }

    if (search) {
      whereConditions.push(`(first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount} OR email ILIKE $${paramCount})`);
      queryParams.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const result = await query(`
      SELECT 
        id, email, phone, first_name, last_name, status, is_admin, 
        department, created_at, last_login, preferred_language
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `, [...queryParams, parseInt(limit), offset]);

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM users ${whereClause}`,
      queryParams
    );

    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        users: result.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount: totalCount,
          hasNext: offset + parseInt(limit) < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// Update user status (admin only)
router.put('/:id/status', [
  authenticateToken,
  requireAdmin,
  body('status').isIn(['pending', 'verified', 'suspended', 'rejected']),
  body('reason').optional().trim().isLength({ max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { status, reason } = req.body;

    // Check if user exists
    const userResult = await query(
      'SELECT id, email, first_name, last_name FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user status
    await query(
      'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, id]
    );

    // Create notification for user
    await query(`
      INSERT INTO notifications (user_id, issue_id, type, title, message)
      VALUES ($1, NULL, 'account_status', $2, $3)
    `, [
      id,
      `Account Status Updated to ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      `Your account status has been updated to ${status}. ${reason ? 'Reason: ' + reason : ''}`
    ]);

    res.json({
      success: true,
      message: 'User status updated successfully',
      data: {
        userId: id,
        newStatus: status,
        updatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: error.message
    });
  }
});

// Promote user to admin (super admin only)
router.put('/:id/promote', [
  authenticateToken,
  requireAdmin,
  body('department').isIn([
    'public_works', 'electricity', 'water_board', 'sanitation', 
    'transport', 'health', 'education', 'police', 'municipal_corporation'
  ])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { department } = req.body;

    // Check if user exists and is verified
    const userResult = await query(
      'SELECT id, email, first_name, last_name, status FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (userResult.rows[0].status !== 'verified') {
      return res.status(400).json({
        success: false,
        message: 'User must be verified before promotion'
      });
    }

    // Update user to admin
    await query(
      'UPDATE users SET is_admin = true, department = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [department, id]
    );

    // Create notification for user
    await query(`
      INSERT INTO notifications (user_id, issue_id, type, title, message)
      VALUES ($1, NULL, 'admin_promotion', 'Admin Access Granted', $2)
    `, [
      id,
      `Congratulations! You have been promoted to admin for the ${department.replace('_', ' ')} department.`
    ]);

    res.json({
      success: true,
      message: 'User promoted to admin successfully',
      data: {
        userId: id,
        department: department,
        promotedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Promote user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to promote user',
      error: error.message
    });
  }
});

module.exports = router;
