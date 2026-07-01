const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
// const { v4: uuidv4 } = require('uuid'); // Not needed - using auto-generated IDs

const { query } = require('../config/database');
const aadharService = require('../services/aadharService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Register user
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('phone').isLength({ min: 10, max: 15 }).isNumeric(),
  body('password').isLength({ min: 6 }),
  body('firstName').trim().isLength({ min: 1 }),
  body('lastName').trim().isLength({ min: 1 }),
  body('aadharNumber').isLength({ min: 12, max: 12 }).isNumeric(),
  body('otp').isLength({ min: 6, max: 6 }).isNumeric(),
  body('role').optional().isIn(['user', 'admin']),
  body('adminCategories').optional().isArray()
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

    const { email, phone, password, firstName, lastName, aadharNumber, otp, confirmPassword, role, adminCategories } = req.body;
    
    // Remove confirmPassword from validation (frontend only field)
    delete req.body.confirmPassword;

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1 OR phone = $2',
      [email, phone]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'User already exists with this email or phone'
      });
    }

    // Verify Aadhar
    const aadharVerification = await aadharService.verifyAadhar(aadharNumber, otp);
    
    if (!aadharVerification.success) {
      return res.status(400).json({
        success: false,
        message: aadharVerification.error || 'Aadhar verification failed'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate Aadhar hash for storage
    const aadharHash = aadharService.generateAadharHash(aadharNumber);
    const aadharLastFour = aadharService.getLastFourDigits(aadharNumber);

    // Create user (let database auto-generate ID)
    const userRole = role || 'user';
    const categories = (userRole === 'admin' && adminCategories) ? adminCategories : null;
    
    let userId;
    try {
      const result = await query(
        `INSERT INTO users (email, phone, password_hash, first_name, last_name, 
         aadhar_hash, aadhar_last_four, status, role, admin_categories) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text[]) RETURNING id`,
        [email, phone, passwordHash, firstName, lastName, aadharHash, aadharLastFour, 'verified', userRole, categories]
      );
      userId = result.rows[0].id;
    } catch (insertError) {
      console.error('User insert failed:', insertError.message);
      throw insertError;
    }

    // Generate token
    const token = generateToken(userId);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        token,
        user: {
          id: userId,
          email,
          firstName,
          lastName,
          status: 'verified'
        }
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
});

// Login user
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
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

    const { email, password, role } = req.body;

    // Find user
    let userResult;
    try {
      userResult = await query(
        'SELECT id, email, password_hash, first_name, last_name, status, role, admin_categories FROM users WHERE email = $1',
        [email]
      );
    } catch (dbError) {
      // Fallback for simple schema
      userResult = await query(
        'SELECT id, email, password_hash, first_name, last_name, status, is_admin FROM users WHERE email = $1',
        [email]
      );
      if (userResult.rows.length > 0) {
        userResult.rows[0].role = userResult.rows[0].is_admin ? 'admin' : 'user';
        userResult.rows[0].admin_categories = [];
      }
    }

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = userResult.rows[0];

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Enforce strict role matching
    if (role) {
      if (role === 'admin' && !['admin', 'super_admin'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You do not have admin privileges.'
        });
      } else if (role === 'user' && user.role !== 'user') {
        return res.status(403).json({
          success: false,
          message: 'Please select Admin login for your account.'
        });
      }
    }

    // Check user status
    if (user.status !== 'verified') {
      return res.status(403).json({
        success: false,
        message: 'Account not verified. Please complete Aadhar verification.'
      });
    }

    // Note: last_login column not available in simplified schema

    // Generate token
    const token = generateToken(user.id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          status: user.status,
          role: user.role,
          adminCategories: user.admin_categories
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// Verify Aadhar (for existing users)
router.post('/verify-aadhar', [
  authenticateToken,
  body('aadharNumber').isLength({ min: 12, max: 12 }).isNumeric(),
  body('otp').isLength({ min: 6, max: 6 }).isNumeric()
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

    const { aadharNumber, otp } = req.body;
    const userId = req.user.id;

    // Verify Aadhar
    const verification = await aadharService.verifyAadhar(aadharNumber, otp, userId);
    
    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.error || 'Aadhar verification failed'
      });
    }

    res.json({
      success: true,
      message: 'Aadhar verification successful'
    });

  } catch (error) {
    console.error('Aadhar verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed',
      error: error.message
    });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    let userResult;
    try {
      userResult = await query(
        `SELECT id, email, phone, first_name, last_name, status, role, admin_categories, 
         created_at
         FROM users WHERE id = $1`,
        [req.user.id]
      );
    } catch (dbError) {
      // Fallback for simple schema
      userResult = await query(
        `SELECT id, email, phone, first_name, last_name, status, is_admin, 
         created_at
         FROM users WHERE id = $1`,
        [req.user.id]
      );
      if (userResult.rows.length > 0) {
        userResult.rows[0].role = userResult.rows[0].is_admin ? 'admin' : 'user';
        userResult.rows[0].admin_categories = [];
      }
    }

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.first_name,
        lastName: user.last_name,
        status: user.status,
        role: user.role,
        adminCategories: user.admin_categories,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
});

// Update user profile
router.put('/profile', [
  authenticateToken,
  body('firstName').optional().trim().isLength({ min: 2 }),
  body('lastName').optional().trim().isLength({ min: 2 }),
  body('phone').optional().isMobilePhone('en-IN'),
  body('preferredLanguage').optional().isIn(['en', 'hi', 'sat', 'bn'])
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

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Profile update failed',
      error: error.message
    });
  }
});

// Change password
router.put('/change-password', [
  authenticateToken,
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
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

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Get current password hash
    const userResult = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, userId]
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      success: false,
      message: 'Password change failed',
      error: error.message
    });
  }
});

// Refresh token
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const newToken = generateToken(req.user.id);
    
    res.json({
      success: true,
      data: {
        token: newToken
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Token refresh failed',
      error: error.message
    });
  }
});

module.exports = router;
