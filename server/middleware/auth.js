const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access token required' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user still exists and is active
    const userResult = await query(
      'SELECT id, email, status, role, admin_categories FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const user = userResult.rows[0];
    
    if (user.status !== 'verified' && user.status !== 'pending') {
      return res.status(403).json({ 
        success: false, 
        message: 'Account not verified' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired' 
      });
    }
    
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Authentication error' 
    });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }
  next();
};

const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Super admin access required' 
    });
  }
  next();
};

const requireCategoryAdmin = (category) => {
  return (req, res, next) => {
    if (!req.user || req.user.role === 'user') {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    // Super admin can access all categories
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Check if admin has access to this category
    if (req.user.role === 'admin' && req.user.admin_categories && req.user.admin_categories.includes(category)) {
      return next();
    }

    return res.status(403).json({ 
      success: false, 
      message: `Access denied. You don't have permission to manage ${category} issues.` 
    });
  };
};

const requireDepartment = (department) => {
  return (req, res, next) => {
    // For now, allow all admin users to access any department
    // TODO: Implement proper department-based access control
    if (!req.user || req.user.role === 'user') {
      return res.status(403).json({ 
        success: false, 
        message: `Access restricted to ${department} department` 
      });
    }
    next();
  };
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userResult = await query(
        'SELECT id, email, status, role, admin_categories FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (userResult.rows.length > 0 && userResult.rows[0].status === 'verified') {
        req.user = userResult.rows[0];
      }
    }
    
    next();
  } catch (error) {
    // For optional auth, we don't fail on token errors
    next();
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireSuperAdmin,
  requireCategoryAdmin,
  requireDepartment,
  optionalAuth
};
