const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { query } = require('../config/database');
const priorityService = require('../services/priorityService');

const router = express.Router();

// Get overall analytics dashboard
router.get('/dashboard', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const department = req.user.department;

    // Build department filter
    const deptFilter = department ? 'WHERE assigned_department = $1' : '';
    const params = department ? [department] : [];

    // Get basic statistics
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total_issues,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '${days} days' THEN 1 END) as recent_issues,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_issues,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_issues,
        COUNT(CASE WHEN status = 'reported' THEN 1 END) as reported_issues,
        COUNT(CASE WHEN priority = 'critical' THEN 1 END) as critical_issues,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_issues,
        AVG(CASE WHEN resolved_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/3600 
          END) as avg_resolution_hours,
        COUNT(DISTINCT reporter_id) as unique_reporters
      FROM issues
      ${deptFilter}
    `, params);

    // Get daily trends for the specified period
    const trendsResult = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as reported_count,
        COUNT(CASE WHEN resolved_at IS NOT NULL THEN 1 END) as resolved_count,
        AVG(CASE WHEN resolved_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/3600 
          END) as avg_resolution_hours
      FROM issues
      WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
      ${department ? 'AND assigned_department = $1' : ''}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, params);

    // Get category breakdown
    const categoryResult = await query(`
      SELECT 
        category,
        COUNT(*) as total_count,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count,
        AVG(CASE WHEN resolved_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/3600 
          END) as avg_resolution_hours,
        ROUND(
          COUNT(CASE WHEN status = 'resolved' THEN 1 END) * 100.0 / COUNT(*), 2
        ) as resolution_rate
      FROM issues
      ${deptFilter}
      GROUP BY category
      ORDER BY total_count DESC
    `, params);

    // Get top performing admins
    const adminResult = await query(`
      SELECT 
        u.first_name || ' ' || u.last_name as admin_name,
        u.department,
        COUNT(i.id) as assigned_issues,
        COUNT(CASE WHEN i.status = 'resolved' THEN 1 END) as resolved_issues,
        AVG(CASE WHEN i.resolved_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (i.resolved_at - i.created_at))/3600 
          END) as avg_resolution_hours,
        ROUND(
          COUNT(CASE WHEN i.status = 'resolved' THEN 1 END) * 100.0 / COUNT(i.id), 2
        ) as resolution_rate
      FROM users u
      LEFT JOIN issues i ON u.id = i.assigned_admin_id
      WHERE u.is_admin = true
      ${department ? 'AND u.department = $1' : ''}
      GROUP BY u.id, u.first_name, u.last_name, u.department
      HAVING COUNT(i.id) > 0
      ORDER BY resolved_issues DESC
      LIMIT 10
    `, params);

    res.json({
      success: true,
      data: {
        statistics: statsResult.rows[0],
        trends: trendsResult.rows,
        categoryBreakdown: categoryResult.rows,
        topAdmins: adminResult.rows,
        period: `${days} days`
      }
    });

  } catch (error) {
    console.error('Analytics dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics data',
      error: error.message
    });
  }
});

// Get resolution time analytics
router.get('/resolution-times', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const { days = 30, category, department } = req.query;
    const userDepartment = req.user.department;

    let whereConditions = ['resolved_at IS NOT NULL'];
    let params = [];
    let paramCount = 1;

    if (days) {
      whereConditions.push(`resolved_at >= CURRENT_DATE - INTERVAL '${days} days'`);
    }

    if (category) {
      whereConditions.push(`category = $${paramCount}`);
      params.push(category);
      paramCount++;
    }

    if (department || userDepartment) {
      const dept = department || userDepartment;
      whereConditions.push(`assigned_department = $${paramCount}`);
      params.push(dept);
      paramCount++;
    }

    const result = await query(`
      SELECT 
        category,
        assigned_department,
        COUNT(*) as resolved_count,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_resolution_hours,
        MIN(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as min_resolution_hours,
        MAX(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as max_resolution_hours,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as median_resolution_hours,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as q1_resolution_hours,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as q3_resolution_hours
      FROM issues
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY category, assigned_department
      ORDER BY avg_resolution_hours ASC
    `, params);

    res.json({
      success: true,
      data: {
        resolutionTimes: result.rows,
        period: `${days} days`
      }
    });

  } catch (error) {
    console.error('Resolution times analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resolution time data',
      error: error.message
    });
  }
});

// Get geographic distribution
router.get('/geographic', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const { days = 30, department } = req.query;
    const userDepartment = req.user.department;

    let whereConditions = [];
    let params = [];
    let paramCount = 1;

    if (days) {
      whereConditions.push(`created_at >= CURRENT_DATE - INTERVAL '${days} days'`);
    }

    if (department || userDepartment) {
      const dept = department || userDepartment;
      whereConditions.push(`assigned_department = $${paramCount}`);
      params.push(dept);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const result = await query(`
      SELECT 
        city,
        state,
        COUNT(*) as issue_count,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count,
        COUNT(CASE WHEN priority = 'critical' THEN 1 END) as critical_count,
        AVG(severity_score) as avg_severity,
        ST_X(ST_Centroid(ST_Collect(location))) as center_longitude,
        ST_Y(ST_Centroid(ST_Collect(location))) as center_latitude
      FROM issues
      ${whereClause}
      GROUP BY city, state
      ORDER BY issue_count DESC
    `, params);

    res.json({
      success: true,
      data: {
        geographicDistribution: result.rows,
        period: `${days} days`
      }
    });

  } catch (error) {
    console.error('Geographic analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch geographic data',
      error: error.message
    });
  }
});

// Get user engagement analytics
router.get('/engagement', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const { days = 30 } = req.query;

    // Get user registration trends
    const registrationResult = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as new_users
      FROM users
      WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    // Get most active users
    const activeUsersResult = await query(`
      SELECT 
        u.first_name || ' ' || u.last_name as user_name,
        u.email,
        COUNT(i.id) as issues_reported,
        COUNT(iv.id) as votes_cast,
        COUNT(ic.id) as comments_made,
        MAX(i.created_at) as last_activity
      FROM users u
      LEFT JOIN issues i ON u.id = i.reporter_id
      LEFT JOIN issue_votes iv ON u.id = iv.user_id
      LEFT JOIN comments ic ON u.id = ic.user_id
      WHERE u.created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY u.id, u.first_name, u.last_name, u.email
      HAVING COUNT(i.id) > 0 OR COUNT(iv.id) > 0 OR COUNT(ic.id) > 0
      ORDER BY (COUNT(i.id) + COUNT(iv.id) + COUNT(ic.id)) DESC
      LIMIT 20
    `);

    // Get voting patterns
    const votingResult = await query(`
      SELECT 
        DATE(iv.created_at) as date,
        COUNT(CASE WHEN iv.vote_type = 'upvote' THEN 1 END) as upvotes,
        COUNT(CASE WHEN iv.vote_type = 'downvote' THEN 1 END) as downvotes,
        COUNT(*) as total_votes
      FROM issue_votes iv
      WHERE iv.created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY DATE(iv.created_at)
      ORDER BY date ASC
    `);

    res.json({
      success: true,
      data: {
        registrationTrends: registrationResult.rows,
        activeUsers: activeUsersResult.rows,
        votingPatterns: votingResult.rows,
        period: `${days} days`
      }
    });

  } catch (error) {
    console.error('Engagement analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch engagement data',
      error: error.message
    });
  }
});

// Get department performance comparison
router.get('/department-performance', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const result = await query(`
      SELECT 
        assigned_department,
        COUNT(*) as total_issues,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_issues,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_issues,
        COUNT(CASE WHEN status = 'reported' THEN 1 END) as reported_issues,
        AVG(CASE WHEN resolved_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/3600 
          END) as avg_resolution_hours,
        AVG(severity_score) as avg_severity,
        ROUND(
          COUNT(CASE WHEN status = 'resolved' THEN 1 END) * 100.0 / COUNT(*), 2
        ) as resolution_rate,
        COUNT(DISTINCT assigned_admin_id) as active_admins
      FROM issues
      WHERE assigned_department IS NOT NULL
      AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY assigned_department
      ORDER BY resolution_rate DESC, avg_resolution_hours ASC
    `);

    res.json({
      success: true,
      data: {
        departmentPerformance: result.rows,
        period: `${days} days`
      }
    });

  } catch (error) {
    console.error('Department performance analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch department performance data',
      error: error.message
    });
  }
});

// Get priority distribution over time
router.get('/priority-trends', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const { days = 30, department } = req.query;
    const userDepartment = req.user.department;

    let whereConditions = [];
    let params = [];
    let paramCount = 1;

    if (days) {
      whereConditions.push(`created_at >= CURRENT_DATE - INTERVAL '${days} days'`);
    }

    if (department || userDepartment) {
      const dept = department || userDepartment;
      whereConditions.push(`assigned_department = $${paramCount}`);
      params.push(dept);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const result = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(CASE WHEN priority = 'critical' THEN 1 END) as critical_count,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_count,
        COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium_count,
        COUNT(CASE WHEN priority = 'low' THEN 1 END) as low_count,
        COUNT(*) as total_count
      FROM issues
      ${whereClause}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, params);

    res.json({
      success: true,
      data: {
        priorityTrends: result.rows,
        period: `${days} days`
      }
    });

  } catch (error) {
    console.error('Priority trends analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch priority trends data',
      error: error.message
    });
  }
});

// Export analytics data
router.get('/export', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const { type = 'issues', format = 'json', days = 30 } = req.query;
    const department = req.user.department;

    let whereConditions = [];
    let params = [];
    let paramCount = 1;

    if (days) {
      whereConditions.push(`created_at >= CURRENT_DATE - INTERVAL '${days} days'`);
    }

    if (department) {
      whereConditions.push(`assigned_department = $${paramCount}`);
      params.push(department);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    let queryStr = '';
    let filename = '';

    switch (type) {
      case 'issues':
        queryStr = `
          SELECT 
            i.id,
            i.title,
            i.description,
            i.category,
            i.status,
            i.priority,
            i.severity_score,
            i.created_at,
            i.acknowledged_at,
            i.resolved_at,
            i.assigned_department,
            i.assigned_admin_id,
            u.first_name || ' ' || u.last_name as reporter_name,
            u.email as reporter_email,
            u.phone as reporter_phone,
            ST_X(i.location) as longitude,
            ST_Y(i.location) as latitude,
            i.address,
            i.city,
            i.state,
            i.pincode
          FROM issues i
          JOIN users u ON i.reporter_id = u.id
          ${whereClause}
          ORDER BY i.created_at DESC
        `;
        filename = `issues_export_${new Date().toISOString().split('T')[0]}`;
        break;

      case 'users':
        queryStr = `
          SELECT 
            u.id,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            u.status,
            u.is_admin,
            u.department,
            u.created_at,
            u.last_login,
            COUNT(i.id) as issues_reported,
            COUNT(iv.id) as votes_cast,
            COUNT(ic.id) as comments_made
          FROM users u
          LEFT JOIN issues i ON u.id = i.reporter_id
          LEFT JOIN issue_votes iv ON u.id = iv.user_id
          LEFT JOIN comments ic ON u.id = ic.user_id
          ${whereClause.replace('created_at', 'u.created_at')}
          GROUP BY u.id
          ORDER BY u.created_at DESC
        `;
        filename = `users_export_${new Date().toISOString().split('T')[0]}`;
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid export type'
        });
    }

    const result = await query(queryStr, params);

    if (format === 'csv') {
      // Convert to CSV format
      const csv = this.convertToCSV(result.rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csv);
    } else {
      // Return as JSON
      res.json({
        success: true,
        data: {
          type: type,
          format: format,
          count: result.rows.length,
          period: `${days} days`,
          exportedAt: new Date().toISOString(),
          data: result.rows
        }
      });
    }

  } catch (error) {
    console.error('Export analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export data',
      error: error.message
    });
  }
});

// Helper function to convert data to CSV
function convertToCSV(data) {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      return typeof value === 'string' && value.includes(',') 
        ? `"${value}"` 
        : value;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

module.exports = router;
