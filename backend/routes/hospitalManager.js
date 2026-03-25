/**
 * Hospital Manager Routes
 * API endpoints for hospital owners and managers
 */
const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validate');
const hospitalManagerService = require('../services/hospitalManagerService');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireApproval, ROLES } = require('../middleware/rbac');
const { asyncHandler } = require('../middleware/errorHandler');

// All routes require authentication
router.use(authenticate);

// Dashboard
router.get('/dashboard', requireRole(ROLES.HOSPITAL_OWNER, ROLES.HOSPITAL_MANAGER), requireApproval, asyncHandler(async (req, res) => {
    const hospital = await hospitalManagerService.getHospitalByOwner(req.user.id);
    const dashboard = await hospitalManagerService.getDashboard(hospital.id, req.user.id);
    res.json({ success: true, ...dashboard });
}));

// Profile
router.get('/profile', requireRole(ROLES.HOSPITAL_OWNER, ROLES.HOSPITAL_MANAGER), requireApproval, asyncHandler(async (req, res) => {
    const hospital = await hospitalManagerService.getHospitalByOwner(req.user.id);
    res.json({ success: true, hospital });
}));

router.put('/profile', requireRole(ROLES.HOSPITAL_OWNER, ROLES.HOSPITAL_MANAGER), requireApproval, [
    body('name').optional().isString().trim().isLength({ min: 2, max: 200 }),
    body('phone').optional().isString().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('address').optional().isString().trim(),
    body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
    body('bed_capacity').optional().isInt({ min: 0 }).withMessage('Bed capacity must be a positive number'),
    body('profile_image').optional().isString(),
    validate,
], asyncHandler(async (req, res) => {
    const hospital = await hospitalManagerService.getHospitalByOwner(req.user.id);
    // Whitelist allowed fields
    const allowed = ['name', 'phone', 'email', 'address', 'latitude', 'longitude', 'bed_capacity', 'profile_image'];
    const safeUpdates = {};
    for (const key of allowed) {
        if (req.body[key] !== undefined) safeUpdates[key] = req.body[key];
    }
    const updated = await hospitalManagerService.updateHospital(hospital.id, req.user.id, safeUpdates);
    res.json({ success: true, hospital: updated });
}));

// Doctors
router.get('/doctors', requireRole(ROLES.HOSPITAL_OWNER, ROLES.HOSPITAL_MANAGER), asyncHandler(async (req, res) => {
    const hospital = await hospitalManagerService.getHospitalByOwner(req.user.id);
    const { specialization, isAvailable, search, page = 1, limit = 20 } = req.query;

    const result = await hospitalManagerService.getDoctors(
        hospital.id,
        req.user.id,
        { specialization, isAvailable: isAvailable === 'true', search },
        parseInt(page),
        parseInt(limit)
    );

    res.json({ success: true, ...result });
}));

router.post('/doctors/invite', requireRole(ROLES.HOSPITAL_OWNER, ROLES.HOSPITAL_MANAGER), [
    body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('phone').optional().isString().trim(),
    body('name').optional().isString().trim().isLength({ min: 2, max: 100 }),
    body('specialization').optional().isString().trim(),
    validate,
], asyncHandler(async (req, res) => {
    const hospital = await hospitalManagerService.getHospitalByOwner(req.user.id);
    const result = await hospitalManagerService.inviteDoctor(hospital.id, req.user.id, req.body);
    res.json({ success: true, ...result });
}));

router.delete('/doctors/:doctorId', requireRole(ROLES.HOSPITAL_OWNER), [
    param('doctorId').isUUID().withMessage('Invalid doctor ID'),
    validate,
], asyncHandler(async (req, res) => {
    const hospital = await hospitalManagerService.getHospitalByOwner(req.user.id);
    await hospitalManagerService.removeDoctor(hospital.id, req.user.id, req.params.doctorId);
    res.json({ success: true });
}));

// Appointments
router.get('/appointments', requireRole(ROLES.HOSPITAL_OWNER, ROLES.HOSPITAL_MANAGER), asyncHandler(async (req, res) => {
    const hospital = await hospitalManagerService.getHospitalByOwner(req.user.id);
    const { status, doctorId, date, fromDate, toDate, page = 1, limit = 20 } = req.query;

    const result = await hospitalManagerService.getAppointments(
        hospital.id,
        req.user.id,
        { status, doctorId, date, fromDate, toDate },
        parseInt(page),
        parseInt(limit)
    );

    res.json({ success: true, ...result });
}));

// Analytics
router.get('/analytics', requireRole(ROLES.HOSPITAL_OWNER, ROLES.HOSPITAL_MANAGER), asyncHandler(async (req, res) => {
    const hospital = await hospitalManagerService.getHospitalByOwner(req.user.id);
    const { period = '30d' } = req.query;

    const analytics = await hospitalManagerService.getAnalytics(hospital.id, req.user.id, period);
    res.json({ success: true, ...analytics });
}));

// Managers
router.get('/managers', requireRole(ROLES.HOSPITAL_OWNER, ROLES.HOSPITAL_MANAGER), asyncHandler(async (req, res) => {
    const hospital = await hospitalManagerService.getHospitalByOwner(req.user.id);
    const managers = await hospitalManagerService.getManagers(hospital.id, req.user.id);
    res.json({ success: true, managers });
}));

router.post('/managers', requireRole(ROLES.HOSPITAL_OWNER), [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('name').notEmpty().isString().trim().isLength({ min: 2, max: 100 }).withMessage('Name is required (2-100 chars)'),
    body('phone').optional().isString().trim(),
    validate,
], asyncHandler(async (req, res) => {
    const hospital = await hospitalManagerService.getHospitalByOwner(req.user.id);
    const manager = await hospitalManagerService.addManager(hospital.id, req.user.id, req.body);
    res.json({ success: true, manager });
}));

// Emergencies
router.get('/emergencies', requireRole(ROLES.HOSPITAL_OWNER, ROLES.HOSPITAL_MANAGER), asyncHandler(async (req, res) => {
    const hospital = await hospitalManagerService.getHospitalByOwner(req.user.id);
    const { supabaseAdmin } = require('../config/supabase');

    const { data, error } = await supabaseAdmin
        .from('emergency_requests')
        .select('*')
        .eq('destination_hospital_id', hospital.id)
        .in('status', [
            'pending', 'assigned', 'dispatched', 'en_route', 'en_route_pickup',
            'arrived', 'arrived_pickup', 'picked_up', 'patient_onboard',
            'en_route_hospital', 'arrived_hospital'
        ])
        .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data: data || [] });
}));

// Consultations — view all consultations by hospital-affiliated doctors
router.get('/consultations', requireRole(ROLES.HOSPITAL_OWNER, ROLES.HOSPITAL_MANAGER), asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    const result = await hospitalManagerService.getConsultations(req.user.id, parseInt(page), parseInt(limit), status);
    res.json({ success: true, ...result });
}));

module.exports = router;
