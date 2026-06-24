const express = require('express');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get user's issues with timeline
router.get('/my-issues', [
  authenticateToken
], async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const userId = req.user.id;

    // Build query conditions
    let whereConditions = ['i.reporter_id = $1'];
    let queryParams = [userId];
    let paramCount = 2;

    // Base query
    let baseQuery = `
      SELECT 
        i.*,
        d.name as department_name,
        u.first_name || ' ' || u.last_name as assigned_admin_name
      FROM issues i
      LEFT JOIN departments d ON i.department_id = d.id
      LEFT JOIN users u ON i.assigned_admin_id = u.id
    `;

    // Add status filter
    if (status) {
      whereConditions.push(`i.status = $${paramCount}`);
      queryParams.push(status);
      paramCount++;
    }

    // Add WHERE clause
    baseQuery += ' WHERE ' + whereConditions.join(' AND ');

    // Add sorting
    const validSortFields = ['created_at', 'updated_at', 'status', 'priority'];
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
      LEFT JOIN departments d ON i.department_id = d.id
      LEFT JOIN users u ON i.assigned_admin_id = u.id
    `;
    countQuery += ' WHERE ' + whereConditions.join(' AND ');
    
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
    console.error('Get user issues error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch issues',
      error: error.message
    });
  }
});

// Get detailed timeline for a specific issue
router.get('/issues/:id/timeline', [
  authenticateToken
], async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // First check if user owns this issue
    const issueResult = await query(
      'SELECT id, reporter_id FROM issues WHERE id = $1',
      [id]
    );

    if (issueResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found'
      });
    }

    if (issueResult.rows[0].reporter_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own issues.'
      });
    }

    // Get issue details
    const issueDetails = await query(`
      SELECT 
        i.*,
        d.name as department_name,
        u.first_name || ' ' || u.last_name as assigned_admin_name
      FROM issues i
      LEFT JOIN departments d ON i.department_id = d.id
      LEFT JOIN users u ON i.assigned_admin_id = u.id
      WHERE i.id = $1
    `, [id]);

    // Get timeline
    const timelineResult = await query(`
      SELECT 
        tt.*,
        u.first_name || ' ' || u.last_name as user_name,
        u.role as user_role
      FROM ticket_timeline tt
      JOIN users u ON tt.user_id = u.id
      WHERE tt.issue_id = $1
      ORDER BY tt.created_at ASC
    `, [id]);

    // Get comments
    const commentsResult = await query(`
      SELECT 
        c.*,
        u.first_name || ' ' || u.last_name as commenter_name,
        u.role as commenter_role
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.issue_id = $1 AND c.is_internal = false
      ORDER BY c.created_at ASC
    `, [id]);

    res.json({
      success: true,
      issue: issueDetails.rows[0],
      timeline: timelineResult.rows,
      comments: commentsResult.rows
    });

  } catch (error) {
    console.error('Get issue timeline error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch issue timeline',
      error: error.message
    });
  }
});

// Add comment to user's issue
router.post('/issues/:id/comments', [
  authenticateToken
], async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const userId = req.user.id;

    if (!comment || comment.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Comment must be at least 5 characters long'
      });
    }

    // Check if user owns this issue
    const issueResult = await query(
      'SELECT id, reporter_id FROM issues WHERE id = $1',
      [id]
    );

    if (issueResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found'
      });
    }

    if (issueResult.rows[0].reporter_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only comment on your own issues.'
      });
    }

    // Add comment
    const result = await query(`
      INSERT INTO comments (issue_id, user_id, comment, is_internal)
      VALUES ($1, $2, $3, false)
      RETURNING id, created_at
    `, [id, userId, comment.trim()]);

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      comment: {
        id: result.rows[0].id,
        comment: comment.trim(),
        created_at: result.rows[0].created_at,
        commenter_name: req.user.first_name + ' ' + req.user.last_name,
        commenter_role: 'user'
      }
    });

  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment',
      error: error.message
    });
  }
});

// Get user dashboard statistics
router.get('/dashboard/stats', [
  authenticateToken
], async (req, res) => {
  try {
    const userId = req.user.id;

    // Get total issues
    const totalIssues = await query(
      'SELECT COUNT(*) as total FROM issues WHERE reporter_id = $1',
      [userId]
    );

    // Get issues by status
    const statusResult = await query(`
      SELECT status, COUNT(*) as count
      FROM issues
      WHERE reporter_id = $1
      GROUP BY status
    `, [userId]);

    // Get issues by category
    const categoryResult = await query(`
      SELECT category, COUNT(*) as count
      FROM issues
      WHERE reporter_id = $1
      GROUP BY category
    `, [userId]);

    // Get recent issues
    const recentIssues = await query(`
      SELECT id, title, status, category, created_at
      FROM issues
      WHERE reporter_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [userId]);

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
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
});

module.exports = router;
