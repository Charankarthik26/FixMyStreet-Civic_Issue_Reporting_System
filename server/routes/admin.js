const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken, requireAdmin, requireCategoryAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all issues for admin dashboard
router.get('/issues', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      status,
      priority,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const userId = req.user.id;

    // Build query conditions
    let whereConditions = [];
    let queryParams = [];
    let paramCount = 1;

    // Base query
    let baseQuery = `
      SELECT 
        i.*,
        u.first_name || ' ' || u.last_name as reporter_name,
        u.phone as reporter_phone,
        u.email as reporter_email,
        d.name as department_name
      FROM issues i
      JOIN users u ON i.reporter_id = u.id
      LEFT JOIN departments d ON i.department_id = d.id
    `;

    // Filter by admin's categories if not super admin
    if (req.user.role === 'admin') {
      if (req.user.admin_categories && req.user.admin_categories.length > 0) {
        whereConditions.push(`i.category = ANY($${paramCount})`);
        queryParams.push(req.user.admin_categories);
        paramCount++;
      } else {
        whereConditions.push(`1 = 0`); // No access to any issues
      }
    }

    // Add other filters
    if (category) {
      whereConditions.push(`i.category = $${paramCount}`);
      queryParams.push(category);
      paramCount++;
    }

    if (status) {
      whereConditions.push(`i.status = $${paramCount}`);
      queryParams.push(status);
      paramCount++;
    }

    if (priority) {
      whereConditions.push(`i.priority = $${paramCount}`);
      queryParams.push(priority);
      paramCount++;
    }

    // Add WHERE clause
    if (whereConditions.length > 0) {
      baseQuery += ' WHERE ' + whereConditions.join(' AND ');
    }

    // Add sorting
    const validSortFields = ['created_at', 'updated_at', 'severity_score', 'priority'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    baseQuery += ` ORDER BY ${sortField} ${order}`;

    // Add pagination
    baseQuery += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    queryParams.push(parseInt(limit), offset);

    const result = await query(baseQuery, queryParams);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) 
      FROM issues i
      JOIN users u ON i.reporter_id = u.id
      LEFT JOIN departments d ON i.department_id = d.id
    `;
    if (whereConditions.length > 0) {
      countQuery += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    const countParams = queryParams.slice(0, -2); // Remove limit and offset
    const countResult = await query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      issues: result.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount: totalCount,
        hasNext: offset + parseInt(limit) < totalCount,
        hasPrev: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error('Get admin issues error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch issues',
      error: error.message
    });
  }
});

// Get issue details for admin
router.get('/issues/:id', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT 
        i.*,
        u.first_name || ' ' || u.last_name as reporter_name,
        u.phone as reporter_phone,
        u.email as reporter_email,
        d.name as department_name
      FROM issues i
      JOIN users u ON i.reporter_id = u.id
      LEFT JOIN departments d ON i.department_id = d.id
      WHERE i.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found'
      });
    }

    const issue = result.rows[0];

    // Check if admin has access to this category
    if (req.user.role === 'admin' && req.user.admin_categories && !req.user.admin_categories.includes(issue.category)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You don\'t have permission to view this issue.'
      });
    }

    // Get timeline for this issue
    const timelineResult = await query(`
      SELECT 
        tt.*,
        u.first_name || ' ' || u.last_name as user_name
      FROM ticket_timeline tt
      JOIN users u ON tt.user_id = u.id
      WHERE tt.issue_id = $1
      ORDER BY tt.created_at ASC
    `, [id]);

    // Get comments for this issue
    const commentsResult = await query(`
      SELECT 
        c.*,
        u.first_name || ' ' || u.last_name as commenter_name
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.issue_id = $1
      ORDER BY c.created_at ASC
    `, [id]);

    res.json({
      success: true,
      issue: {
        ...issue,
        timeline: timelineResult.rows,
        comments: commentsResult.rows
      }
    });

  } catch (error) {
    console.error('Get admin issue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch issue',
      error: error.message
    });
  }
});

// Update issue status
router.patch('/issues/:id/status', [
  authenticateToken,
  requireAdmin,
  body('status').isIn(['reported', 'acknowledged', 'in_progress', 'resolved', 'rejected']),
  body('comment').optional().trim().isLength({ min: 5, max: 1000 })
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
    const { status, comment } = req.body;
    const userId = req.user.id;

    if (status === 'rejected' && (!comment || comment.trim().length < 5)) {
      return res.status(400).json({
        success: false,
        message: 'A rejection reason (at least 5 characters) is required when rejecting an issue.'
      });
    }

    // Check if issue exists and get current status
    const issueResult = await query(
      'SELECT id, status, category, reporter_id, ticket_number FROM issues WHERE id = $1',
      [id]
    );

    if (issueResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found'
      });
    }

    const issue = issueResult.rows[0];

    // Check if admin has access to this category
    if (req.user.role === 'admin' && req.user.admin_categories && !req.user.admin_categories.includes(issue.category)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You don\'t have permission to update this issue.'
      });
    }

    // Update issue status
    let updateResult;
    if (status === 'rejected') {
      updateResult = await query(`
        UPDATE issues 
        SET status = $1, updated_at = CURRENT_TIMESTAMP, assigned_admin_id = $2, rejection_reason = $3
        WHERE id = $4
        RETURNING *
      `, [status, userId, comment, id]);
    } else {
      updateResult = await query(`
        UPDATE issues 
        SET status = $1, updated_at = CURRENT_TIMESTAMP, assigned_admin_id = $2
        WHERE id = $3
        RETURNING *
      `, [status, userId, id]);
    }

    // Add comment if provided
    if (comment) {
      const isInternal = (status !== 'rejected'); // Rejection reason is public, other status comments are internal
      await query(`
        INSERT INTO comments (issue_id, user_id, comment, is_internal)
        VALUES ($1, $2, $3, $4)
      `, [id, userId, comment, isInternal]);
    }

    // Create notification for user
    await query(`
      INSERT INTO notifications (user_id, issue_id, type, title, message)
      VALUES ($1, $2, 'status_update', 'Issue Status Updated', 
              'Your issue #${issue.ticket_number} status has been updated to ${status}')
    `, [issue.reporter_id, id]);

    res.json({
      success: true,
      message: 'Issue status updated successfully',
      issue: updateResult.rows[0]
    });

  } catch (error) {
    console.error('Update issue status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update issue status',
      error: error.message
    });
  }
});

// Assign issue to admin
router.patch('/issues/:id/assign', [
  authenticateToken,
  requireAdmin,
  body('assignedAdminId').isUUID()
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
    const { assignedAdminId } = req.body;

    // Check if issue exists
    const issueResult = await query(
      'SELECT id, category, reporter_id FROM issues WHERE id = $1',
      [id]
    );

    if (issueResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found'
      });
    }

    const issue = issueResult.rows[0];

    // Check if assigned admin exists and has access to this category
    const adminResult = await query(
      'SELECT id, role, admin_categories FROM users WHERE id = $1 AND role IN ($2, $3)',
      [assignedAdminId, 'admin', 'super_admin']
    );

    if (adminResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid admin user'
      });
    }

    const admin = adminResult.rows[0];
    if (admin.role === 'admin' && admin.admin_categories && !admin.admin_categories.includes(issue.category)) {
      return res.status(400).json({
        success: false,
        message: 'Admin does not have access to this category'
      });
    }

    // Update issue assignment
    const updateResult = await query(`
      UPDATE issues 
      SET assigned_admin_id = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [assignedAdminId, id]);

    // Add timeline entry
    await query(`
      INSERT INTO ticket_timeline (issue_id, user_id, action, description, new_status)
      VALUES ($1, $2, 'assigned', 'Issue assigned to admin', 'reported')
    `, [id, req.user.id]);

    res.json({
      success: true,
      message: 'Issue assigned successfully',
      issue: updateResult.rows[0]
    });

  } catch (error) {
    console.error('Assign issue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign issue',
      error: error.message
    });
  }
});

// Get admin dashboard statistics
router.get('/dashboard/stats', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const userId = req.user.id;
    let categoryFilter = '';

    // Filter by admin's categories if not super admin
    if (req.user.role === 'admin') {
      if (req.user.admin_categories && req.user.admin_categories.length > 0) {
        categoryFilter = `AND category = ANY($1)`;
      } else {
        categoryFilter = `AND 1 = 0`; // No access to any issues
      }
    }

    // Get total issues
    const totalIssuesQuery = `
      SELECT COUNT(*) as total
      FROM issues
      WHERE 1=1 ${categoryFilter}
    `;
    const totalIssuesParams = categoryFilter ? [req.user.admin_categories] : [];
    const totalIssues = await query(totalIssuesQuery, totalIssuesParams);

    // Get issues by status
    const statusQuery = `
      SELECT status, COUNT(*) as count
      FROM issues
      WHERE 1=1 ${categoryFilter}
      GROUP BY status
    `;
    const statusResult = await query(statusQuery, totalIssuesParams);

    // Get issues by category
    const categoryQuery = `
      SELECT category, COUNT(*) as count
      FROM issues
      WHERE 1=1 ${categoryFilter}
      GROUP BY category
    `;
    const categoryResult = await query(categoryQuery, totalIssuesParams);

    // Get recent issues
    const recentIssuesQuery = `
      SELECT 
        i.*,
        u.first_name || ' ' || u.last_name as reporter_name
      FROM issues i
      JOIN users u ON i.reporter_id = u.id
      WHERE 1=1 ${categoryFilter}
      ORDER BY i.created_at DESC
      LIMIT 5
    `;
    const recentIssues = await query(recentIssuesQuery, totalIssuesParams);

    res.json({
      success: true,
      stats: {
        totalIssues: parseInt(totalIssues.rows[0].total),
        byStatus: statusResult.rows,
        byCategory: categoryResult.rows,
        recentIssues: recentIssues.rows
      }
    });

  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
});

// Get all admins (for super admin)
router.get('/admins', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    // Only super admin can see all admins
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Super admin required.'
      });
    }

    const result = await query(`
      SELECT 
        id, first_name, last_name, email, phone, role, admin_categories, 
        status, created_at
      FROM users 
      WHERE role IN ('admin', 'super_admin')
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      admins: result.rows
    });

  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admins',
      error: error.message
    });
  }
});

module.exports = router;