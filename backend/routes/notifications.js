/**
 * Notification Routes - Real-time notifications API
 */
const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validate');
const notificationService = require('../services/notificationService');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/notifications
 * @desc Get user notifications with pagination
 * @access Private
 */
router.get('/', [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('unreadOnly').optional().isIn(['true', 'false']).withMessage('unreadOnly must be true or false'),
    validate,
], asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    const result = await notificationService.getUserNotifications(
        req.user.id,
        parseInt(page),
        parseInt(limit),
        unreadOnly === 'true'
    );

    res.json({ success: true, data: result });
}));

/**
 * @route GET /api/notifications/unread-count
 * @desc Get unread notification count
 * @access Private
 */
router.get('/unread-count', asyncHandler(async (req, res) => {
    const count = await notificationService.getUnreadCount(req.user.id);
    res.json({ success: true, data: { count } });
}));

/**
 * @route PUT /api/notifications/:id/read
 * @desc Mark notification as read
 * @access Private
 */
router.put('/:id/read', [
    param('id').isUUID().withMessage('Invalid notification ID'),
    validate,
], asyncHandler(async (req, res) => {
    const result = await notificationService.markAsRead(req.user.id, req.params.id);
    res.json({ success: true, ...result });
}));

/**
 * @route PUT /api/notifications/read-all
 * @desc Mark all notifications as read
 * @access Private
 */
router.put('/read-all', asyncHandler(async (req, res) => {
    const result = await notificationService.markAllAsRead(req.user.id);
    res.json({ success: true, ...result });
}));

/**
 * @route POST /api/notifications/register-device
 * @desc Register device for push notifications
 * @access Private
 */
router.post('/register-device', [
    body('fcmToken').notEmpty().withMessage('FCM token is required').isString(),
    body('deviceType').optional().isIn(['android', 'ios', 'web']).withMessage('deviceType must be android, ios, or web'),
    body('deviceId').optional().isString(),
    validate,
], asyncHandler(async (req, res) => {
    const { fcmToken, deviceType, deviceId } = req.body;

    await notificationService.registerDevice(req.user.id, fcmToken, deviceType || 'android');

    // Optional device_id persistence for multi-device debugging/analytics
    if (deviceId) {
        const { supabaseAdmin } = require('../config/supabase');
        let { error } = await supabaseAdmin
            .from('users')
            .update({ device_id: deviceId })
            .eq('id', req.user.id);

        // Backward compatibility: silently skip when device_id column doesn't exist
        if (error && (error.code === '42703' || /device_id/i.test(error.message || ''))) {
            error = null;
        }
        if (error) throw error;
    }

    res.json({ success: true, message: 'Device registered for push notifications' });
}));

/**
 * @route DELETE /api/notifications/unregister-device
 * @desc Unregister device from push notifications
 * @access Private
 */
router.delete('/unregister-device', asyncHandler(async (req, res) => {
    const { supabaseAdmin } = require('../config/supabase');

    let { error } = await supabaseAdmin
        .from('users')
        .update({
            fcm_token: null,
            device_type: null,
            device_id: null
        })
        .eq('id', req.user.id);

    // Backward compatibility: some environments don't have device_type/device_id
    if (error && (error.code === '42703' || /device_type|device_id/i.test(error.message || ''))) {
        ({ error } = await supabaseAdmin
            .from('users')
            .update({ fcm_token: null })
            .eq('id', req.user.id));
    }

    if (error) throw error;

    res.json({ success: true, message: 'Device unregistered from push notifications' });
}));

module.exports = router;
