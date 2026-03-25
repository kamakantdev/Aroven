/**
 * Enhanced Admin Routes
 * Complete admin management with approval workflows for all provider types
 */
const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validate');
const enhancedAdminService = require('../services/enhancedAdminService');
const { authenticate } = require('../middleware/auth');
const { requireRole, ROLES } = require('../middleware/rbac');
const { asyncHandler } = require('../middleware/errorHandler');

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN));

// ==================== DASHBOARD ====================

/**
 * @route GET /api/admin/dashboard
 * @desc Get admin dashboard with all stats
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
    const dashboard = await enhancedAdminService.getDashboard();
    res.json({ success: true, data: dashboard });
}));

// ==================== APPROVAL WORKFLOW ====================

/**
 * @route GET /api/admin/approvals/pending
 * @desc Get all pending approvals (or by type)
 */
router.get('/approvals/pending', asyncHandler(async (req, res) => {
    const { type = 'all', page = 1, limit = 20 } = req.query;
    const result = await enhancedAdminService.getPendingApprovals(
        type,
        parseInt(page),
        parseInt(limit)
    );
    res.json({ success: true, ...result });
}));

/**
 * @route GET /api/admin/providers/:type/:id
 * @desc Get provider details for review
 */
router.get('/providers/:type/:id', [
    param('type').isIn(['hospital', 'pharmacy', 'clinic', 'diagnostic_center', 'doctor', 'ambulance']).withMessage('Invalid provider type'),
    param('id').isUUID('loose').withMessage('Invalid provider ID'),
    validate,
], asyncHandler(async (req, res) => {
    const { type, id } = req.params;
    const provider = await enhancedAdminService.getProviderDetails(type, id);
    res.json({ success: true, data: provider });
}));

/**
 * @route POST /api/admin/providers/:type/:id/approve
 * @desc Approve a provider
 */
router.post('/providers/:type/:id/approve', [
    param('type').isIn(['hospital', 'pharmacy', 'clinic', 'diagnostic_center', 'doctor', 'ambulance']).withMessage('Invalid provider type'),
    param('id').isUUID('loose').withMessage('Invalid provider ID'),
    body('notes').optional().isString().trim(),
    validate,
], asyncHandler(async (req, res) => {
    const { type, id } = req.params;
    const { notes } = req.body;
    const result = await enhancedAdminService.approveProvider(type, id, req.user.id, notes);
    res.json({ success: true, ...result });
}));

/**
 * @route POST /api/admin/providers/:type/:id/reject
 * @desc Reject a provider
 */
router.post('/providers/:type/:id/reject', [
    param('type').isIn(['hospital', 'pharmacy', 'clinic', 'diagnostic_center', 'doctor', 'ambulance']).withMessage('Invalid provider type'),
    param('id').isUUID('loose').withMessage('Invalid provider ID'),
    body('reason').notEmpty().withMessage('Rejection reason is required').isString().trim(),
    validate,
], asyncHandler(async (req, res) => {
    const { type, id } = req.params;
    const { reason } = req.body;
    const result = await enhancedAdminService.rejectProvider(type, id, req.user.id, reason);
    res.json({ success: true, ...result });
}));

/**
 * @route POST /api/admin/providers/:type/:id/suspend
 * @desc Suspend a provider
 */
router.post('/providers/:type/:id/suspend', [
    param('type').isIn(['hospital', 'pharmacy', 'clinic', 'diagnostic_center', 'doctor', 'ambulance']).withMessage('Invalid provider type'),
    param('id').isUUID('loose').withMessage('Invalid provider ID'),
    body('reason').notEmpty().withMessage('Suspension reason is required').isString().trim(),
    validate,
], asyncHandler(async (req, res) => {
    const { type, id } = req.params;
    const { reason } = req.body;
    const result = await enhancedAdminService.suspendProvider(type, id, req.user.id, reason);
    res.json({ success: true, ...result });
}));

/**
 * @route POST /api/admin/providers/:type/:id/reactivate
 * @desc Reactivate a suspended provider
 */
router.post('/providers/:type/:id/reactivate', [
    param('type').isIn(['hospital', 'pharmacy', 'clinic', 'diagnostic_center', 'doctor', 'ambulance']).withMessage('Invalid provider type'),
    param('id').isUUID('loose').withMessage('Invalid provider ID'),
    body('notes').optional().isString().trim(),
    validate,
], asyncHandler(async (req, res) => {
    const { type, id } = req.params;
    const { notes } = req.body;
    const result = await enhancedAdminService.reactivateProvider(type, id, req.user.id, notes);
    res.json({ success: true, ...result });
}));

/**
 * @route POST /api/admin/providers/:type/:id/notes
 * @desc Add admin note to a provider
 */
router.post('/providers/:type/:id/notes', [
    param('type').isIn(['hospital', 'pharmacy', 'clinic', 'diagnostic_center', 'doctor', 'ambulance']).withMessage('Invalid provider type'),
    param('id').isUUID('loose').withMessage('Invalid provider ID'),
    body('note').notEmpty().withMessage('Note content is required').isString().trim(),
    body('isInternal').optional().isBoolean(),
    validate,
], asyncHandler(async (req, res) => {
    const { type, id } = req.params;
    const { note, isInternal = true } = req.body;
    const result = await enhancedAdminService.addAdminNote(type, id, req.user.id, note, isInternal);
    res.json({ success: true, data: result });
}));

// ==================== USER MANAGEMENT ====================

/**
 * @route GET /api/admin/users
 * @desc Get all users with filters
 */
router.get('/users', asyncHandler(async (req, res) => {
    const { role, isVerified, isActive, search, page = 1, limit = 20 } = req.query;

    const filters = {};
    if (role) filters.role = role;
    if (isVerified !== undefined) filters.isVerified = isVerified === 'true';
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (search) filters.search = search;

    const result = await enhancedAdminService.getUsers(filters, parseInt(page), parseInt(limit));
    res.json({ success: true, ...result });
}));

/**
 * @route PUT /api/admin/users/:id/status
 * @desc Update user active status
 */
router.put('/users/:id/status', [
    param('id').isUUID().withMessage('Invalid user ID'),
    body('isActive').isBoolean().withMessage('isActive must be a boolean'),
    body('reason').optional().isString().trim(),
    validate,
], asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isActive, reason } = req.body;
    const result = await enhancedAdminService.updateUserStatus(req.user.id, id, isActive, reason);
    res.json({ success: true, ...result });
}));

// ==================== EMERGENCY MANAGEMENT ====================

/**
 * @route GET /api/admin/emergencies
 * @desc Get active emergency requests
 */
router.get('/emergencies', asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const result = await enhancedAdminService.getActiveEmergencies(parseInt(page), parseInt(limit));
    res.json({ success: true, ...result });
}));

/**
 * @route POST /api/admin/emergencies/:id/reassign
 * @desc Reassign an emergency to a different operator
 */
router.post('/emergencies/:id/reassign', [
    param('id').isUUID().withMessage('Invalid emergency ID'),
    body('operatorId').isUUID().withMessage('Valid operator ID is required'),
    body('reason').notEmpty().withMessage('Reason is required').isString().trim(),
    validate,
], asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { operatorId, reason } = req.body;
    const result = await enhancedAdminService.reassignEmergency(id, operatorId, req.user.id, reason);
    res.json({ success: true, ...result });
}));

/**
 * @route PATCH /api/admin/emergencies/:id/status
 * @desc Update emergency request status
 */
router.patch('/emergencies/:id/status', [
    param('id').isUUID().withMessage('Invalid emergency ID'),
    body('status').notEmpty().withMessage('Status is required').isString().trim()
        .isIn(['pending', 'assigned', 'dispatched', 'en_route', 'arrived', 'completed', 'cancelled'])
        .withMessage('Invalid status value'),
    validate,
], asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const result = await enhancedAdminService.updateEmergencyStatus(id, status, req.user.id);
    res.json({ success: true, ...result });
}));

// ==================== COMPLIANCE ====================

/**
 * @route GET /api/admin/compliance/expiring-documents
 * @desc Get documents expiring soon
 */
router.get('/compliance/expiring-documents', asyncHandler(async (req, res) => {
    const { days = 30 } = req.query;
    const result = await enhancedAdminService.getExpiringDocuments(parseInt(days));
    res.json({ success: true, data: result });
}));

// ==================== ANALYTICS ====================

/**
 * @route GET /api/admin/analytics
 * @desc Get platform analytics
 */
router.get('/analytics', asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;
    const analytics = await enhancedAdminService.getAnalytics(period);
    res.json({ success: true, data: analytics });
}));

// ==================== AUDIT LOGS ====================

/**
 * @route GET /api/admin/audit-logs
 * @desc Get audit logs with filters
 */
router.get('/audit-logs', asyncHandler(async (req, res) => {
    const { userId, action, resourceType, fromDate, toDate, page = 1, limit = 50 } = req.query;

    const filters = {};
    if (userId) filters.userId = userId;
    if (action) filters.action = action;
    if (resourceType) filters.resourceType = resourceType;
    if (fromDate) filters.fromDate = fromDate;
    if (toDate) filters.toDate = toDate;

    const result = await enhancedAdminService.getAuditLogs(filters, parseInt(page), parseInt(limit));
    res.json({ success: true, ...result });
}));

// ==================== SYSTEM ====================

/**
 * @route GET /api/admin/system/health
 * @desc Get system health status
 */
router.get('/system/health', asyncHandler(async (req, res) => {
    const health = await enhancedAdminService.getSystemHealth();
    res.json({ success: true, data: health });
}));

module.exports = router;
