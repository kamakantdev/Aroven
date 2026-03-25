/**
 * Diagnostic Center Routes
 * API endpoints for diagnostic center operations
 */
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const diagnosticCenterService = require('../services/diagnosticCenterService');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireApproval, ROLES } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');

// ==================== Public Routes ====================

// Search diagnostic centers
router.get('/search', asyncHandler(async (req, res) => {
    const { city, search, testType, page = 1, limit = 20 } = req.query;

    const result = await diagnosticCenterService.searchDiagnosticCenters(
        { city, search, testType },
        parseInt(page),
        parseInt(limit)
    );

    res.json({ success: true, ...result });
}));

// Find nearby diagnostic centers
router.get('/nearby', asyncHandler(async (req, res) => {
    const { latitude, longitude, radius = 10 } = req.query;

    if (!latitude || !longitude) {
        return res.status(400).json({ success: false, message: 'Location required' });
    }

    const centers = await diagnosticCenterService.findNearby(
        parseFloat(latitude),
        parseFloat(longitude),
        parseFloat(radius)
    );

    res.json({ success: true, data: centers });
}));

// Get diagnostic center by ID
router.get('/:id([0-9a-fA-F-]{36})', asyncHandler(async (req, res) => {
    const center = await diagnosticCenterService.getDiagnosticCenterById(req.params.id);
    res.json({ success: true, data: center });
}));

// Get tests available at a specific center (public)
router.get('/:id([0-9a-fA-F-]{36})/tests', asyncHandler(async (req, res) => {
    const { search, category, page = 1, limit = 50 } = req.query;

    const result = await diagnosticCenterService.getTests(
        req.params.id,
        { search, category, isActive: true, publicOnly: true },
        parseInt(page),
        parseInt(limit)
    );

    res.json({ success: true, ...result });
}));

// ==================== Protected Routes ====================
router.use(authenticate);

// Register diagnostic center (C9 Fix: restrict to diagnostic_center_owner role)
router.post('/register',
  requireRole(ROLES.DIAGNOSTIC_CENTER_OWNER),
  [
    body('name').trim().notEmpty().withMessage('Center name is required'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('city').trim().notEmpty().withMessage('City is required'),
    body('address').trim().notEmpty().withMessage('Address is required'),
    body('license_number').trim().notEmpty().withMessage('License number is required'),
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const center = await diagnosticCenterService.registerDiagnosticCenter(req.user.id, req.body);
    res.status(201).json({ success: true, data: center });
  })
);

// Book a test (patient)
router.post('/book',
  [
    body('centerId').notEmpty().isUUID().withMessage('Valid center ID is required'),
    body('testId').notEmpty().isUUID().withMessage('Valid test ID is required'),
    body('bookingDate').notEmpty().isDate().withMessage('Valid booking date is required'),
    body('bookingTime').optional().matches(/^\d{2}:\d{2}$/).withMessage('Time must be HH:MM format'),
    body('collectionType').optional().isIn(['walk_in', 'home_collection']).withMessage('Invalid collection type'),
    body('collectionAddress').if(body('collectionType').equals('home_collection'))
      .notEmpty().withMessage('Address is required for home collection'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { centerId, testId, bookingDate, bookingTime, collectionType, collectionAddress, notes } = req.body;

    // DC5: Use service-layer helpers instead of inline Supabase calls
    const patientId = await diagnosticCenterService.resolvePatientId(req.user.id);
    if (!patientId) {
        return res.status(400).json({ success: false, message: 'Patient profile not found' });
    }

    const booking = await diagnosticCenterService.bookTest(
        patientId,
        centerId,
        testId,
        { bookingDate, bookingTime, collectionType, collectionAddress, notes }
    );

    // DC5: Use service-layer helper for center owner lookup
    const centerOwnerId = await diagnosticCenterService.getCenterOwnerId(centerId);

    // Emit real-time event so diagnostic center dashboard gets notified
    const eventEmitter = require('../services/eventEmitter');
    eventEmitter.emitDiagnosticBookingCreated({
        ...booking,
        patient_id: req.user.id,
        center_id: centerId,
        center_owner_id: centerOwnerId,
    });

    res.status(201).json({ success: true, data: booking });
}));

// ==================== Owner Routes ====================

// Dashboard
router.get('/owner/dashboard', requireRole(ROLES.DIAGNOSTIC_CENTER_OWNER), requireApproval, asyncHandler(async (req, res) => {
    const center = await diagnosticCenterService.getDiagnosticCenterByOwner(req.user.id);
    const dashboard = await diagnosticCenterService.getDashboard(center.id);
    res.json({ success: true, ...dashboard });
}));

// Profile
router.get('/owner/profile', requireRole(ROLES.DIAGNOSTIC_CENTER_OWNER), requireApproval, asyncHandler(async (req, res) => {
    const center = await diagnosticCenterService.getDiagnosticCenterByOwner(req.user.id);
    res.json({ success: true, data: center });
}));

router.put('/owner/profile', requireRole(ROLES.DIAGNOSTIC_CENTER_OWNER), requireApproval, asyncHandler(async (req, res) => {
    const center = await diagnosticCenterService.getDiagnosticCenterByOwner(req.user.id);
    // Whitelist allowed fields to prevent arbitrary column writes
    const allowed = [
        'name', 'phone', 'email', 'address', 'city', 'state', 'pincode',
        'latitude', 'longitude', 'license_number', 'nabl_accreditation',
        'sample_collection_available', 'home_collection_available',
        'home_collection_fee', 'is_24_hours', 'profile_image',
    ];
    const safeUpdates = {};
    for (const key of allowed) {
        if (req.body[key] !== undefined) safeUpdates[key] = req.body[key];
    }
    const updated = await diagnosticCenterService.updateDiagnosticCenter(center.id, req.user.id, safeUpdates);
    res.json({ success: true, data: updated });
}));

// ==================== Test Catalog ====================

router.get('/owner/tests', requireRole(ROLES.DIAGNOSTIC_CENTER_OWNER), asyncHandler(async (req, res) => {
    const center = await diagnosticCenterService.getDiagnosticCenterByOwner(req.user.id);
    const { search, category, page = 1, limit = 50 } = req.query;

    const result = await diagnosticCenterService.getTests(
        center.id,
        { search, category },
        parseInt(page),
        parseInt(limit)
    );

    res.json({ success: true, ...result });
}));

router.post('/owner/tests', requireRole(ROLES.DIAGNOSTIC_CENTER_OWNER), asyncHandler(async (req, res) => {
    const center = await diagnosticCenterService.getDiagnosticCenterByOwner(req.user.id);
    const test = await diagnosticCenterService.addTest(center.id, req.body);
    res.status(201).json({ success: true, data: test });
}));

router.put('/owner/tests/:testId', requireRole(ROLES.DIAGNOSTIC_CENTER_OWNER), asyncHandler(async (req, res) => {
    const center = await diagnosticCenterService.getDiagnosticCenterByOwner(req.user.id);
    const updated = await diagnosticCenterService.updateTest(center.id, req.params.testId, req.body);
    res.json({ success: true, data: updated });
}));

router.delete('/owner/tests/:testId', requireRole(ROLES.DIAGNOSTIC_CENTER_OWNER), asyncHandler(async (req, res) => {
    const center = await diagnosticCenterService.getDiagnosticCenterByOwner(req.user.id);
    await diagnosticCenterService.deleteTest(center.id, req.params.testId);
    res.json({ success: true, message: 'Test removed' });
}));

// ==================== Bookings / Results ====================

router.get('/owner/bookings', requireRole(ROLES.DIAGNOSTIC_CENTER_OWNER), asyncHandler(async (req, res) => {
    const center = await diagnosticCenterService.getDiagnosticCenterByOwner(req.user.id);
    const { status, resultStatus, date, page = 1, limit = 20 } = req.query;

    const result = await diagnosticCenterService.getBookings(
        center.id,
        { status, resultStatus, date },
        parseInt(page),
        parseInt(limit)
    );

    res.json({ success: true, ...result });
}));

// M6: Get single booking by ID
router.get('/owner/bookings/:bookingId', requireRole(ROLES.DIAGNOSTIC_CENTER_OWNER), asyncHandler(async (req, res) => {
    const center = await diagnosticCenterService.getDiagnosticCenterByOwner(req.user.id);
    const booking = await diagnosticCenterService.getBookingById(center.id, req.params.bookingId);
    res.json({ success: true, data: booking });
}));

router.patch('/owner/bookings/:bookingId/status', requireRole(ROLES.DIAGNOSTIC_CENTER_OWNER), asyncHandler(async (req, res) => {
    const center = await diagnosticCenterService.getDiagnosticCenterByOwner(req.user.id);
    const updated = await diagnosticCenterService.updateBookingStatus(
        center.id,
        req.params.bookingId,
        req.body.status,
        { cancelledBy: req.user.id, reason: req.body.reason }
    );

    // Fix #29: Removed duplicate notification — updateBookingStatus() already emits via eventEmitter

    res.json({ success: true, data: updated });
}));

router.patch('/owner/bookings/:bookingId/result', requireRole(ROLES.DIAGNOSTIC_CENTER_OWNER), asyncHandler(async (req, res) => {
    const center = await diagnosticCenterService.getDiagnosticCenterByOwner(req.user.id);
    const updated = await diagnosticCenterService.uploadResult(
        center.id,
        req.params.bookingId,
        req.body,
        req.user.id
    );

    // Notify patient that result is ready
    if (updated?.patient_id) {
        const eventEmitter = require('../services/eventEmitter');
        const { data: patientRow } = await require('../config/supabase').supabaseAdmin
            .from('patients').select('user_id').eq('id', updated.patient_id).single();
        if (patientRow) {
            eventEmitter.emitDiagnosticResultUploaded({
                ...updated,
                patient_id: patientRow.user_id,
                message: 'Your test result is ready',
            });
        }
    }

    res.json({ success: true, data: updated });
}));

// Analytics
router.get('/owner/analytics', requireRole(ROLES.DIAGNOSTIC_CENTER_OWNER), asyncHandler(async (req, res) => {
    const center = await diagnosticCenterService.getDiagnosticCenterByOwner(req.user.id);
    const analytics = await diagnosticCenterService.getAnalytics(center.id);
    res.json({ success: true, data: analytics });
}));

module.exports = router;
