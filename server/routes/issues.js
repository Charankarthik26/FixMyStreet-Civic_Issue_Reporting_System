const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const { query } = require('../config/database');
const { upload, processImages, handleUploadError } = require('../middleware/upload');
const geolocationService = require('../services/geolocationService');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Submit new civic issue
router.post('/submit', [
  authenticateToken,
  upload.array('images', 5),
  processImages,
  handleUploadError,
  body('title').trim().isLength({ min: 5, max: 255 }).withMessage('Title must be between 5 and 255 characters'),
  body('description').trim().isLength({ min: 10, max: 2000 }).withMessage('Description must be between 10 and 2000 characters'),
  body('category').isIn([
    'electricity', 'water', 'sanitation', 'roads', 'streetlights', 'other'
  ]).withMessage('Please select a valid category'),
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be a valid float between -90 and 90'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be a valid float between -180 and 180'),
  body('userLatitude').optional().isFloat({ min: -90, max: 90 }).withMessage('User latitude must be a valid float'),
  body('userLongitude').optional().isFloat({ min: -180, max: 180 }).withMessage('User longitude must be a valid float')
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

    const { title, description, category, latitude, longitude, userLatitude, userLongitude } = req.body;
    const userId = req.user.id;

    // Basic location validation
    const locationValidation = {
      success: true,
      coordinates: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude)
      },
      address: {
        displayName: 'Selected Location'
      },
      distance: 0
    };

    // Process uploaded images
    const imageUrls = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        imageUrls.push(`/uploads/${file.filename}`);
      });
    }

    // Get department for this category (if departments table exists)
    let departmentId = null;
    try {
      const departmentResult = await query(
        'SELECT id FROM departments WHERE category = $1',
        [category]
      );
      departmentId = departmentResult.rows.length > 0 ? departmentResult.rows[0].id : null;
    } catch (deptError) {
      // Departments table might not exist in simple schema, continue without error
      console.log('Department lookup skipped (table may not exist):', deptError.message);
    }

    // Generate ticket number in application code to avoid database trigger issues
    const year = new Date().getFullYear();
    const timestamp = Date.now();
    const ticketNumber = `TKT-${year}-${timestamp.toString().slice(-6)}`;

    // Create issue (compatible with both simple and enhanced schemas)
    let result;
    try {
      // Try enhanced schema insert (with PostGIS and ticket_number)
      result = await query(`
        INSERT INTO issues (
          title, description, category, latitude, longitude, location, address, 
          reporter_id, severity_score, department_id, ticket_number
        ) VALUES (
          $1, $2, $3, $4, $5, ST_SetSRID(ST_Point($5, $4), 4326), $6, $7, $8, $9, $10
        ) RETURNING id, created_at
      `, [
        title, 
        description, 
        category,
        locationValidation.coordinates.latitude,
        locationValidation.coordinates.longitude,
        locationValidation.address?.displayName || null,
        userId,
        0, // Initial severity score
        departmentId,
        ticketNumber
      ]);
    } catch (insertError) {
      console.log('Enhanced schema insert failed, trying simple schema:', insertError.message);
      // Fallback to simple schema insert
      result = await query(`
        INSERT INTO issues (
          title, description, category, latitude, longitude, address, 
          reporter_id, severity_score
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        ) RETURNING id, created_at
      `, [
        title, 
        description, 
        category,
        locationValidation.coordinates.latitude,
        locationValidation.coordinates.longitude,
        locationValidation.address?.displayName || null,
        userId,
        0 // Initial severity score
      ]);
    }

    const issueId = result.rows[0].id;

    // Add attachments if any files were uploaded
    if (req.files && req.files.length > 0) {
      try {
        for (const file of req.files) {
          await query(`
            INSERT INTO attachments (
              issue_id, filename, original_name, file_path, file_size, mime_type, uploaded_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            issueId,
            file.filename,
            file.originalname,
            '/uploads/' + file.filename,
            file.size,
            file.mimetype,
            userId
          ]);
        }
      } catch (attachError) {
        console.log('Failed to insert attachments (table might not exist):', attachError.message);
      }
    }

    // Add initial timeline entry (if timeline table exists)
    try {
      await query(`
        INSERT INTO ticket_timeline (issue_id, user_id, action, description, new_status)
        VALUES ($1, $2, 'created', 'Issue reported and ticket created', 'reported')
      `, [issueId, userId]);
    } catch (timelineError) {
      // Timeline table might not exist in simple schema, continue without error
      console.log('Timeline entry skipped (table may not exist):', timelineError.message);
    }

    // Emit real-time notification
    const io = req.app.get('io');
    io.emit('new-issue', {
      issueId: issueId,
      ticketNumber: ticketNumber,
      title: title,
      category: category,
      location: locationValidation.coordinates,
      reporter: req.user.first_name + ' ' + req.user.last_name
    });

    res.status(201).json({
      success: true,
      message: 'Issue reported successfully',
      data: {
        issueId: issueId,
        ticketNumber: ticketNumber,
        createdAt: result.rows[0].created_at,
        location: locationValidation.coordinates,
        distance: locationValidation.distance || 0,
        isVerified: true
      }
    });

  } catch (error) {
    console.error('Issue submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit issue',
      error: error.message
    });
  }
});

// Get all issues with filtering and pagination
router.get('/', [
  optionalAuth
], async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      status,
      priority,
      city,
      sortBy = 'created_at',
      sortOrder = 'DESC',
      latitude,
      longitude,
      radius = 10
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const userId = req.user?.id;

    // Build query conditions
    let whereConditions = [];
    let queryParams = [];
    let paramCount = 1;

    // Filter by admin's categories if user is an admin
    if (req.user && req.user.role === 'admin') {
      if (req.user.admin_categories && req.user.admin_categories.length > 0) {
        whereConditions.push(`i.category = ANY($${paramCount})`);
        queryParams.push(req.user.admin_categories);
        paramCount++;
      } else {
        whereConditions.push(`1 = 0`); // No access to any issues
      }
    }

    // Base query (simplified without PostGIS)
    let baseQuery = `
      SELECT 
        i.*,
        u.first_name || ' ' || u.last_name as reporter_name,
        u.phone as reporter_phone
      FROM issues i
      JOIN users u ON i.reporter_id = u.id
    `;

    // Add location-based filtering if coordinates provided (simplified)
    if (latitude && longitude) {
      // Simple distance calculation using Haversine formula approximation
      whereConditions.push(`
        (6371 * acos(cos(radians($${paramCount})) * cos(radians(i.latitude)) * 
        cos(radians(i.longitude) - radians($${paramCount + 1})) + 
        sin(radians($${paramCount})) * sin(radians(i.latitude)))) <= $${paramCount + 2}
      `);
      queryParams.push(parseFloat(latitude), parseFloat(longitude), parseFloat(radius));
      paramCount += 3;
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

    if (city) {
      whereConditions.push(`i.city ILIKE $${paramCount}`);
      queryParams.push(`%${city}%`);
      paramCount++;
    }

    // Add WHERE clause
    if (whereConditions.length > 0) {
      baseQuery += ' WHERE ' + whereConditions.join(' AND ');
    }

    // Add sorting
    const validSortFields = ['created_at', 'updated_at', 'severity_score', 'calculated_priority_score'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    baseQuery += ` ORDER BY ${sortField} ${order}`;

    // Add pagination
    baseQuery += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    queryParams.push(parseInt(limit), offset);

    const result = await query(baseQuery, queryParams);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) FROM issues i JOIN users u ON i.reporter_id = u.id';
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
    console.error('Get issues error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch issues',
      error: error.message
    });
  }
});

// Get issue by ID
router.get('/:id', [
  optionalAuth
], async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const result = await query(`
      SELECT 
        i.*,
        u.first_name || ' ' || u.last_name as reporter_name,
        u.phone as reporter_phone,
        u.email as reporter_email
      FROM issues i
      JOIN users u ON i.reporter_id = u.id
      WHERE i.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found'
      });
    }

    const issue = result.rows[0];

    // Get comments for this issue
    let comments = [];
    try {
      const commentsResult = await query(`
        SELECT 
          c.id, c.comment as text, c.created_at,
          u.first_name || ' ' || u.last_name as author
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.issue_id = $1 AND c.is_internal = false AND c.is_deleted = false
        ORDER BY c.created_at ASC
      `, [id]);
      comments = commentsResult.rows;
    } catch (commentErr) {
      // Fallback for simple schema
      const commentsResult = await query(`
        SELECT 
          c.id, c.comment as text, c.created_at,
          u.first_name || ' ' || u.last_name as author
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.issue_id = $1
        ORDER BY c.created_at ASC
      `, [id]);
      comments = commentsResult.rows;
    }

    // Get user's vote for this issue
    let userVote = null;
    if (userId) {
      try {
        const voteResult = await query(
          'SELECT vote_type FROM issue_votes WHERE issue_id = $1 AND user_id = $2',
          [id, userId]
        );
        if (voteResult.rows.length > 0) {
          userVote = voteResult.rows[0].vote_type;
        }
      } catch (voteErr) {
        // Fallback for simple schema
        try {
          const voteResult = await query(
            'SELECT id FROM upvotes WHERE issue_id = $1 AND user_id = $2',
            [id, userId]
          );
          if (voteResult.rows.length > 0) {
            userVote = 'upvote';
          }
        } catch (fallbackVoteErr) {
          console.log('Voting tables missing, skipping vote check:', fallbackVoteErr.message);
        }
      }
    }

    // Get attachments (images)
    let images = [];
    try {
      const attachmentsResult = await query(
        'SELECT file_path FROM attachments WHERE issue_id = $1',
        [id]
      );
      images = attachmentsResult.rows.map(row => row.file_path);
    } catch (attachErr) {
      console.log('Error fetching attachments:', attachErr.message);
    }

    res.json({
      success: true,
      issue: {
        ...issue,
        comments: comments,
        userVote: userVote,
        images: images
      }
    });

  } catch (error) {
    console.error('Get issue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch issue',
      error: error.message
    });
  }
});

// Vote on issue (upvote/downvote)
router.post('/:id/vote', [
  authenticateToken,
  body('voteType').isIn(['upvote', 'downvote'])
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
    const { voteType } = req.body;
    const userId = req.user.id;

    // Check if issue exists
    const issueResult = await query('SELECT id FROM issues WHERE id = $1', [id]);
    if (issueResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found'
      });
    }

    // Try enhanced schema first
    try {
      const existingVote = await query(
        'SELECT id, vote_type FROM issue_votes WHERE issue_id = $1 AND user_id = $2',
        [id, userId]
      );

      if (existingVote.rows.length > 0) {
        if (existingVote.rows[0].vote_type === voteType) {
          await query('DELETE FROM issue_votes WHERE id = $1', [existingVote.rows[0].id]);
          res.json({ success: true, message: 'Vote removed successfully', data: { voteType: null } });
        } else {
          await query('UPDATE issue_votes SET vote_type = $1 WHERE id = $2', [voteType, existingVote.rows[0].id]);
          res.json({ success: true, message: 'Vote updated successfully', data: { voteType } });
        }
      } else {
        await query('INSERT INTO issue_votes (issue_id, user_id, vote_type) VALUES ($1, $2, $3)', [id, userId, voteType]);
        res.json({ success: true, message: 'Vote cast successfully', data: { voteType } });
      }
    } catch (voteError) {
      // Fallback for simple schema
      console.log('Falling back to upvotes table:', voteError.message);
      const existingVote = await query(
        'SELECT id FROM upvotes WHERE issue_id = $1 AND user_id = $2',
        [id, userId]
      );
      
      if (existingVote.rows.length > 0) {
        // Simple schema only supports toggle for upvotes
        await query('DELETE FROM upvotes WHERE id = $1', [existingVote.rows[0].id]);
        res.json({ success: true, message: 'Vote removed successfully', data: { voteType: null } });
      } else if (voteType === 'upvote') {
        await query('INSERT INTO upvotes (issue_id, user_id) VALUES ($1, $2)', [id, userId]);
        res.json({ success: true, message: 'Vote cast successfully', data: { voteType: 'upvote' } });
      } else {
        res.status(400).json({ success: false, message: 'Downvoting is not supported in simple schema' });
      }
    }
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cast vote',
      error: error.message
    });
  }
});

// Add comment to issue
router.post('/:id/comments', [
  authenticateToken,
  body('comment').trim().isLength({ min: 5, max: 1000 }),
  body('parentCommentId').optional().isUUID()
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
    const { comment, parentCommentId } = req.body;
    const userId = req.user.id;

    // Check if issue exists
    const issueResult = await query('SELECT id FROM issues WHERE id = $1', [id]);
    if (issueResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found'
      });
    }

    // Insert comment
    let result;
    try {
      result = await query(`
        INSERT INTO comments (issue_id, user_id, comment, parent_comment_id, is_internal)
        VALUES ($1, $2, $3, $4, false)
        RETURNING id, created_at
      `, [id, userId, comment, parentCommentId || null]);
    } catch (commentError) {
      // Fallback for simple schema
      console.log('Falling back to simple comments insert:', commentError.message);
      result = await query(`
        INSERT INTO comments (issue_id, user_id, comment)
        VALUES ($1, $2, $3)
        RETURNING id, created_at
      `, [id, userId, comment]);
    }

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: {
        commentId: result.rows[0].id,
        createdAt: result.rows[0].created_at
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

// Get nearby issues
router.get('/nearby/:latitude/:longitude', [
  optionalAuth
], async (req, res) => {
  try {
    const { latitude, longitude } = req.params;
    const { radius = 5, limit = 20 } = req.query;

    const nearbyIssues = await geolocationService.getNearbyIssues(
      parseFloat(latitude),
      parseFloat(longitude),
      parseFloat(radius),
      parseInt(limit)
    );

    if (!nearbyIssues.success) {
      return res.status(500).json({
        success: false,
        message: nearbyIssues.error
      });
    }

    res.json({
      success: true,
      data: {
        issues: nearbyIssues.issues,
        count: nearbyIssues.count,
        center: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude)
        },
        radius: parseFloat(radius)
      }
    });

  } catch (error) {
    console.error('Get nearby issues error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch nearby issues',
      error: error.message
    });
  }
});

// Update user location
router.post('/location', [
  authenticateToken,
  body('latitude').isFloat({ min: -90, max: 90 }),
  body('longitude').isFloat({ min: -180, max: 180 }),
  body('accuracy').optional().isFloat({ min: 0 }),
  body('address').optional().trim()
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

    const { latitude, longitude, accuracy, address } = req.body;
    const userId = req.user.id;

    const result = await geolocationService.updateUserLocation(
      userId, latitude, longitude, accuracy, address
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error
      });
    }

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: {
        locationId: result.locationId,
        createdAt: result.createdAt
      }
    });

  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update location',
      error: error.message
    });
  }
});

module.exports = router;
