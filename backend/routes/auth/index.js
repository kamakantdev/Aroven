const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const authService = require('../../services/authService');
const { asyncHandler } = require('../../middleware/errorHandler');

const router = express.Router();

// Fix #19: Redis-backed rate limiter for sensitive auth routes
const { cacheGet, cacheSet } = require('../../config/redis');
const authRateLimit = (maxAttempts, windowSeconds, keyPrefix) => {
  return asyncHandler(async (req, res, next) => {
    const identifier = req.body.email || req.ip;
    const key = `ratelimit:${keyPrefix}:${identifier}`;
    const current = parseInt(await cacheGet(key)) || 0;
    if (current >= maxAttempts) {
      return res.status(429).json({
        success: false,
        message: `Too many attempts. Please try again in ${Math.ceil(windowSeconds / 60)} minutes.`,
      });
    }
    await cacheSet(key, (current + 1).toString(), windowSeconds);
    next();
  });
};

// Register
router.post('/register',
  authRateLimit(5, 3600, 'register'), // 5 attempts per hour
  [
    body('email').trim().isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('phone').optional().trim().isMobilePhone().withMessage('Valid phone number is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('name').trim().notEmpty().escape().withMessage('Name is required'),
    body('role').optional().isIn([
      'patient',
      'doctor',
      'hospital_owner',
      'clinic_owner',
      'pharmacy_owner',
      'ambulance_operator',
      'diagnostic_center_owner'
    ]).withMessage('Invalid role'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: result,
    });
  })
);

// Login
router.post('/login',
  authRateLimit(10, 900, 'login'), // 10 attempts per 15 min
  [
    body('email').trim().isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    body('role').optional().isIn([
      'patient',
      'doctor',
      'hospital_owner',
      'hospital_manager',
      'clinic_owner',
      'pharmacy_owner',
      'ambulance_operator',
      'ambulance_driver',
      'diagnostic_center_owner',
      'admin',
      'super_admin',
    ]).withMessage('Invalid role'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { email, password, role } = req.body;
    const result = await authService.login(email, password, role);
    res.json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  })
);

// Verify email
router.get('/verify-email',
  asyncHandler(async (req, res) => {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification token is required' });
    }
    const result = await authService.verifyEmail(token);
    res.json({
      success: true,
      ...result,
    });
  })
);

// Resend verification email
router.post('/resend-verification',
  [
    body('email').trim().isEmail().normalizeEmail().withMessage('Valid email is required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const result = await authService.resendVerification(req.body.email);
    res.json({
      success: true,
      ...result,
    });
  })
);

// Refresh token
router.post('/refresh-token',
  [
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const result = await authService.refreshToken(req.body.refreshToken);
    res.json({
      success: true,
      data: result,
    });
  })
);

// Logout
router.post('/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const result = await authService.logout(req.user.id, refreshToken);
    res.json({
      success: true,
      ...result,
    });
  })
);

// Change password
router.post('/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
    res.json({
      success: true,
      ...result,
    });
  })
);

// Forgot password
router.post('/forgot-password',
  authRateLimit(3, 3600, 'forgot'), // 3 attempts per hour
  [
    body('email').trim().isEmail().normalizeEmail().withMessage('Valid email is required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const result = await authService.forgotPassword(req.body.email);
    res.json({
      success: true,
      ...result,
    });
  })
);

// Reset password
router.post('/reset-password',
  authRateLimit(5, 3600, 'reset'), // 5 attempts per hour
  [
    body('token').notEmpty().withMessage('Token is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { token, password } = req.body;
    const result = await authService.resetPassword(token, password);
    res.json({
      success: true,
      ...result,
    });
  })
);

// Get current user
router.get('/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: req.user,
    });
  })
);

// Update current user profile
router.put('/me',
  authenticate,
  [
    body('name').optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters'),
    body('phone').optional().isMobilePhone().withMessage('Valid phone number is required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const result = await authService.updateProfile(req.user.id, req.user.role, req.body);
    res.json({ success: true, ...result });
  })
);

module.exports = router;
