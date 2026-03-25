/**
 * Vitals Routes
 * Session-based CV vitals (Redis Streams + fallback to consultation_vitals_log)
 */
const express = require('express');
const { param, query } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { requireRole, ROLES } = require('../middleware/rbac');
const vitalsService = require('../services/vitalsService');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Doctors, patients, hospital/clinic owners, and admins can view session vitals
const allowedRoles = [ROLES.DOCTOR, ROLES.PATIENT, ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HOSPITAL_OWNER, ROLES.CLINIC_OWNER];

/**
 * @route GET /api/vitals/session/:sessionId/latest
 * @desc Get latest vitals for a consultation session
 */
router.get('/session/:sessionId/latest',
  [param('sessionId').isUUID().withMessage('Invalid session ID')],
  validate,
  asyncHandler(async (req, res) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view session vitals' });
    }
    await vitalsService.verifySessionAccess(req.user.id, req.user.role, req.params.sessionId);
    const data = await vitalsService.getLatest(req.params.sessionId);
    res.json({ success: true, data: data || null });
  })
);

/**
 * @route GET /api/vitals/session/:sessionId/history
 * @desc Get vitals history for a consultation session
 */
router.get('/session/:sessionId/history',
  [
    param('sessionId').isUUID().withMessage('Invalid session ID'),
    query('limit').optional().isInt({ min: 1, max: 500 }).toInt(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view session vitals' });
    }
    await vitalsService.verifySessionAccess(req.user.id, req.user.role, req.params.sessionId);
    const limit = parseInt(req.query.limit, 10) || 100;
    const data = await vitalsService.getHistory(req.params.sessionId, limit);
    res.json({ success: true, data: data || [] });
  })
);

/**
 * @route GET /api/vitals/session/:sessionId/alerts
 * @desc Get alerts from vitals stream for a session
 */
router.get('/session/:sessionId/alerts',
  [param('sessionId').isUUID().withMessage('Invalid session ID')],
  validate,
  asyncHandler(async (req, res) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view session vitals' });
    }
    await vitalsService.verifySessionAccess(req.user.id, req.user.role, req.params.sessionId);
    const data = await vitalsService.getAlerts(req.params.sessionId);
    res.json({ success: true, data: data || [] });
  })
);

/**
 * @route GET /api/vitals/session/:sessionId/summary
 * @desc Get vitals summary for a session
 */
router.get('/session/:sessionId/summary',
  [param('sessionId').isUUID().withMessage('Invalid session ID')],
  validate,
  asyncHandler(async (req, res) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view session vitals' });
    }
    await vitalsService.verifySessionAccess(req.user.id, req.user.role, req.params.sessionId);
    const data = await vitalsService.getSummary(req.params.sessionId);
    res.json({ success: true, data });
  })
);

module.exports = router;
