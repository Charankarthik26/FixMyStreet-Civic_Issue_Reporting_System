const { query } = require('../config/database');

class PriorityService {
  constructor() {
    this.weights = {
      basePriority: parseFloat(process.env.BASE_PRIORITY_WEIGHT) || 1,
      upvote: parseFloat(process.env.UPVOTE_WEIGHT) || 2,
      time: parseFloat(process.env.TIME_WEIGHT) || 0.5,
      category: parseFloat(process.env.CATEGORY_WEIGHT) || 3
    };

    this.categoryPriorities = {
      'public_safety': 50,
      'water_supply': 40,
      'street_lighting': 35,
      'road_infrastructure': 30,
      'waste_management': 25,
      'drainage': 20,
      'public_transport': 15,
      'healthcare': 45,
      'education': 35,
      'parks_gardens': 10,
      'other': 5
    };
  }

  // Calculate priority score for an issue
  async calculatePriorityScore(issueId) {
    try {
      const result = await query(`
        SELECT 
          i.*,
          EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - i.created_at))/3600 as hours_open,
          COUNT(iv.id) as total_votes,
          COUNT(CASE WHEN iv.vote_type = 'upvote' THEN 1 END) as upvotes,
          COUNT(CASE WHEN iv.vote_type = 'downvote' THEN 1 END) as downvotes
        FROM issues i
        LEFT JOIN issue_votes iv ON i.id = iv.issue_id
        WHERE i.id = $1
        GROUP BY i.id
      `, [issueId]);

      if (result.rows.length === 0) {
        throw new Error('Issue not found');
      }

      const issue = result.rows[0];
      return this.calculateScore(issue);
    } catch (error) {
      console.error('Priority calculation error:', error);
      throw error;
    }
  }

  // Calculate score based on issue data
  calculateScore(issue) {
    let score = 0;

    // Base category priority
    const categoryPriority = this.categoryPriorities[issue.category] || 5;
    score += categoryPriority * this.weights.category;

    // Upvote factor
    const netUpvotes = parseInt(issue.upvotes) - parseInt(issue.downvotes);
    score += netUpvotes * this.weights.upvote;

    // Time factor (older issues get higher priority)
    const hoursOpen = parseFloat(issue.hours_open) || 0;
    score += hoursOpen * this.weights.time;

    // Status factor
    switch (issue.status) {
      case 'reported':
        score += 10;
        break;
      case 'acknowledged':
        score += 5;
        break;
      case 'in_progress':
        score += 0;
        break;
      case 'resolved':
        score = 0; // Resolved issues have no priority
        break;
      case 'rejected':
        score = -10; // Rejected issues have negative priority
        break;
    }

    // Severity factor
    score += parseInt(issue.severity_score) || 0;

    // Verification factor
    if (issue.is_verified) {
      score += 5;
    }

    // Distance factor (issues closer to user get slight priority boost)
    if (issue.verification_distance && issue.verification_distance < 1) {
      score += 3;
    }

    return Math.max(0, Math.round(score)); // Ensure non-negative score
  }

  // Update priority for all issues
  async updateAllPriorities() {
    try {
      const result = await query(`
        SELECT 
          i.id,
          i.category,
          i.status,
          i.severity_score,
          i.is_verified,
          i.verification_distance,
          EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - i.created_at))/3600 as hours_open,
          COUNT(iv.id) as total_votes,
          COUNT(CASE WHEN iv.vote_type = 'upvote' THEN 1 END) as upvotes,
          COUNT(CASE WHEN iv.vote_type = 'downvote' THEN 1 END) as downvotes
        FROM issues i
        LEFT JOIN issue_votes iv ON i.id = iv.issue_id
        WHERE i.status NOT IN ('resolved', 'rejected')
        GROUP BY i.id
      `);

      const updates = [];
      for (const issue of result.rows) {
        const priorityScore = this.calculateScore(issue);
        const priorityLevel = this.getPriorityLevel(priorityScore);
        
        updates.push({
          id: issue.id,
          score: priorityScore,
          level: priorityLevel
        });
      }

      // Batch update priorities
      for (const update of updates) {
        await query(
          'UPDATE issues SET severity_score = $1, priority = $2 WHERE id = $3',
          [update.score, update.level, update.id]
        );
      }

      return {
        success: true,
        updated: updates.length,
        message: `Updated priorities for ${updates.length} issues`
      };
    } catch (error) {
      console.error('Update all priorities error:', error);
      throw error;
    }
  }

  // Determine priority level based on score
  getPriorityLevel(score) {
    if (score >= 100) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 20) return 'medium';
    return 'low';
  }

  // Get priority distribution
  async getPriorityDistribution() {
    try {
      const result = await query(`
        SELECT 
          priority,
          COUNT(*) as count,
          AVG(severity_score) as avg_score
        FROM issues 
        WHERE status NOT IN ('resolved', 'rejected')
        GROUP BY priority
        ORDER BY 
          CASE priority 
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
          END
      `);

      return {
        success: true,
        distribution: result.rows
      };
    } catch (error) {
      console.error('Priority distribution error:', error);
      throw error;
    }
  }

  // Get top priority issues
  async getTopPriorityIssues(limit = 10, department = null) {
    try {
      let queryStr = `
        SELECT 
          i.*,
          u.first_name || ' ' || u.last_name as reporter_name,
          calculate_priority_score(i.id) as calculated_score
        FROM issues i
        JOIN users u ON i.reporter_id = u.id
        WHERE i.status NOT IN ('resolved', 'rejected')
      `;

      const params = [];
      let paramCount = 1;

      if (department) {
        queryStr += ` AND i.assigned_department = $${paramCount}`;
        params.push(department);
        paramCount++;
      }

      queryStr += ` ORDER BY calculated_score DESC LIMIT $${paramCount}`;
      params.push(limit);

      const result = await query(queryStr, params);

      return {
        success: true,
        issues: result.rows
      };
    } catch (error) {
      console.error('Top priority issues error:', error);
      throw error;
    }
  }

  // Auto-assign issues to departments based on category
  async autoAssignIssues() {
    try {
      const departmentMapping = {
        'road_infrastructure': 'public_works',
        'street_lighting': 'electricity',
        'water_supply': 'water_board',
        'drainage': 'public_works',
        'waste_management': 'sanitation',
        'public_transport': 'transport',
        'parks_gardens': 'municipal_corporation',
        'public_safety': 'police',
        'healthcare': 'health',
        'education': 'education',
        'other': 'municipal_corporation'
      };

      const result = await query(`
        SELECT id, category 
        FROM issues 
        WHERE assigned_department IS NULL 
        AND status NOT IN ('resolved', 'rejected')
      `);

      const assignments = [];
      for (const issue of result.rows) {
        const department = departmentMapping[issue.category];
        if (department) {
          await query(
            'UPDATE issues SET assigned_department = $1 WHERE id = $2',
            [department, issue.id]
          );
          assignments.push({
            issueId: issue.id,
            category: issue.category,
            department: department
          });
        }
      }

      return {
        success: true,
        assigned: assignments.length,
        assignments: assignments
      };
    } catch (error) {
      console.error('Auto-assign error:', error);
      throw error;
    }
  }

  // Get department workload
  async getDepartmentWorkload() {
    try {
      const result = await query(`
        SELECT 
          assigned_department,
          COUNT(*) as total_issues,
          COUNT(CASE WHEN status = 'reported' THEN 1 END) as reported_count,
          COUNT(CASE WHEN status = 'acknowledged' THEN 1 END) as acknowledged_count,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_count,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count,
          AVG(CASE WHEN resolved_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/3600 
            END) as avg_resolution_hours,
          AVG(severity_score) as avg_severity
        FROM issues
        WHERE assigned_department IS NOT NULL
        GROUP BY assigned_department
        ORDER BY total_issues DESC
      `);

      return {
        success: true,
        workload: result.rows
      };
    } catch (error) {
      console.error('Department workload error:', error);
      throw error;
    }
  }

  // Calculate resolution time trends
  async getResolutionTrends(days = 30) {
    try {
      const result = await query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as reported_count,
          COUNT(CASE WHEN resolved_at IS NOT NULL THEN 1 END) as resolved_count,
          AVG(CASE WHEN resolved_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/3600 
            END) as avg_resolution_hours
        FROM issues
        WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `);

      return {
        success: true,
        trends: result.rows
      };
    } catch (error) {
      console.error('Resolution trends error:', error);
      throw error;
    }
  }

  // Get category performance metrics
  async getCategoryPerformance() {
    try {
      const result = await query(`
        SELECT 
          category,
          COUNT(*) as total_issues,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count,
          AVG(CASE WHEN resolved_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/3600 
            END) as avg_resolution_hours,
          AVG(severity_score) as avg_severity,
          ROUND(
            COUNT(CASE WHEN status = 'resolved' THEN 1 END) * 100.0 / COUNT(*), 2
          ) as resolution_rate
        FROM issues
        GROUP BY category
        ORDER BY total_issues DESC
      `);

      return {
        success: true,
        performance: result.rows
      };
    } catch (error) {
      console.error('Category performance error:', error);
      throw error;
    }
  }
}

module.exports = new PriorityService();
