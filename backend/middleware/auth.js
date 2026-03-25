/**
 * Authentication Middleware
 * JWT-based authentication for all API routes
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const { supabaseAdmin } = require('../config/supabase');
const { cacheGet, cacheSet } = require('../config/redis');

/**
 * Authenticate middleware - verifies JWT token and attaches user to request
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify JWT — I12: use accessSecret for access tokens
    const decoded = jwt.verify(token, config.jwt.accessSecret);

    // Reject non-access tokens (email_verification, password_reset, refresh)
    if (decoded.type && decoded.type !== 'access') {
      return res.status(401).json({ success: false, message: 'Invalid token type.' });
    }

    // Try Redis cache first, then Supabase
    const cacheKey = `auth_user:${decoded.userId || decoded.id}`;
    let user = await cacheGet(cacheKey);

    if (!user) {
      const { data: dbUser, error } = await supabaseAdmin
        .from('users')
        .select('id, email, name, phone, role, is_active, is_verified, profile_image_url')
        .eq('id', decoded.userId || decoded.id)
        .single();

      if (error || !dbUser) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. User not found.',
        });
      }
      user = dbUser;
      // Cache for 60 seconds (reduced from 5 minutes to limit stale data after deactivation)
      await cacheSet(cacheKey, user, 60);
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated. Contact support.',
      });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      is_active: user.is_active,
      is_verified: user.is_verified,
      profile_image_url: user.profile_image_url,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired.',
        code: 'TOKEN_EXPIRED',
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.',
      });
    }
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed.',
    });
  }
};

/**
 * Optional authentication - attaches user if token exists, continues otherwise
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.accessSecret);

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email, name, phone, role, is_active')
      .eq('id', decoded.userId || decoded.id)
      .single();

    // Don't attach deactivated users even in optional auth
    req.user = (user && user.is_active) ? user : null;
    next();
  } catch {
    req.user = null;
    next();
  }
};

/**
 * Authorize by role - simple role check, use after authenticate
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this resource.',
      });
    }
    next();
  };
};

module.exports = { authenticate, optionalAuth, authorize };
