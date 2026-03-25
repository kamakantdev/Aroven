/**
 * Clinic Routes
 * API endpoints for clinic operations
 */
const express = require('express');
const router = express.Router();
const clinicService = require('../services/clinicService');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireApproval, ROLES } = require('../middleware/rbac');
const { asyncHandler } = require('../middleware/errorHandler');

// Public routes
router.get('/search', asyncHandler(async (req, res) => {
    const { city, specialization, search, page = 1, limit = 20 } = req.query;

    const result = await clinicService.searchClinics(
        { city, specialization, search },
        parseInt(page),
        parseInt(limit)
    );

    res.json({ success: true, ...result });
}));

router.get('/nearby', asyncHandler(async (req, res) => {
    const { latitude, longitude, radius = 10, specialization } = req.query;

    if (!latitude || !longitude) {
        return res.status(400).json({ success: false, message: 'Location required' });
    }

    const clinics = await clinicService.findNearby(
        parseFloat(latitude),
        parseFloat(longitude),
        parseFloat(radius),
        specialization
    );

    res.json({ success: true, data: clinics });
}));

router.get('/:id', asyncHandler(async (req, res) => {
    const clinic = await clinicService.getClinicById(req.params.id);
    res.json({ success: true, data: clinic });
}));

// Protected routes
router.use(authenticate);

// Register clinic (C9 Fix: restrict to clinic_owner role)
router.post('/register', requireRole(ROLES.CLINIC_OWNER), asyncHandler(async (req, res) => {
    const clinic = await clinicService.registerClinic(req.user.id, req.body);
    res.status(201).json({ success: true, data: clinic });
}));

// Clinic owner routes
router.get('/owner/dashboard', requireRole(ROLES.CLINIC_OWNER), requireApproval, asyncHandler(async (req, res) => {
    const clinic = await clinicService.getClinicByOwner(req.user.id);
    const dashboard = await clinicService.getDashboard(clinic.id, req.user.id);
    res.json({ success: true, ...dashboard });
}));

router.get('/owner/profile', requireRole(ROLES.CLINIC_OWNER), requireApproval, asyncHandler(async (req, res) => {
    const clinic = await clinicService.getClinicByOwner(req.user.id);
    res.json({ success: true, data: clinic });
}));

router.put('/owner/profile', requireRole(ROLES.CLINIC_OWNER), requireApproval, asyncHandler(async (req, res) => {
    const clinic = await clinicService.getClinicByOwner(req.user.id);
    // Whitelist allowed fields to prevent arbitrary column writes
    const allowed = [
        'name', 'phone', 'email', 'address', 'city', 'state', 'pincode',
        'latitude', 'longitude', 'specializations', 'facilities', 'description',
        'opening_hours', 'is_24_hours', 'profile_image_url', 'image_url', 'profile_image'
    ];
    const safeUpdates = {};
    for (const key of allowed) {
        if (req.body[key] !== undefined) safeUpdates[key] = req.body[key];
    }
    const updated = await clinicService.updateClinic(clinic.id, req.user.id, safeUpdates);
    res.json({ success: true, data: updated });
}));

// Doctors
router.get('/owner/doctors', requireRole(ROLES.CLINIC_OWNER), asyncHandler(async (req, res) => {
    const clinic = await clinicService.getClinicByOwner(req.user.id);
    const { page = 1, limit = 20 } = req.query;

    const result = await clinicService.getDoctors(clinic.id, req.user.id, parseInt(page), parseInt(limit));
    res.json({ success: true, ...result });
}));

// Add doctor by ID (path param) or by email (body)
router.post('/owner/doctors/:doctorId?', requireRole(ROLES.CLINIC_OWNER), asyncHandler(async (req, res) => {
    const clinic = await clinicService.getClinicByOwner(req.user.id);

    let doctorId = req.params.doctorId;

    // If no doctorId in path, try to resolve from email in request body
    if (!doctorId && req.body.email) {
        const { supabaseAdmin } = require('../config/supabase');
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', req.body.email)
            .eq('role', 'doctor')
            .single();
        if (!user) {
            return res.status(404).json({ success: false, message: 'Doctor with this email not found' });
        }
        // Find doctor record by user_id
        const { data: doctor } = await supabaseAdmin
            .from('doctors')
            .select('id')
            .eq('user_id', user.id)
            .single();
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor profile not found for this email' });
        }
        doctorId = doctor.id;
    }

    if (!doctorId) {
        return res.status(400).json({ success: false, message: 'Doctor ID or email is required' });
    }

    const doctor = await clinicService.addDoctor(clinic.id, req.user.id, doctorId);
    res.json({ success: true, doctor });
}));

router.delete('/owner/doctors/:doctorId', requireRole(ROLES.CLINIC_OWNER), asyncHandler(async (req, res) => {
    const clinic = await clinicService.getClinicByOwner(req.user.id);
    await clinicService.removeDoctor(clinic.id, req.user.id, req.params.doctorId);
    res.json({ success: true });
}));

// Appointments
router.get('/owner/appointments', requireRole(ROLES.CLINIC_OWNER), asyncHandler(async (req, res) => {
    const clinic = await clinicService.getClinicByOwner(req.user.id);
    const { status, date, page = 1, limit = 20 } = req.query;

    const result = await clinicService.getAppointments(
        clinic.id,
        req.user.id,
        { status, date },
        parseInt(page),
        parseInt(limit)
    );

    res.json({ success: true, ...result });
}));

// Consultations — view all consultations by clinic-affiliated doctors
router.get('/owner/consultations', requireRole(ROLES.CLINIC_OWNER), asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    const result = await clinicService.getConsultations(req.user.id, parseInt(page), parseInt(limit), status);
    res.json({ success: true, ...result });
}));

// Schedule
router.get('/owner/schedule', requireRole(ROLES.CLINIC_OWNER), asyncHandler(async (req, res) => {
    const clinic = await clinicService.getClinicByOwner(req.user.id);
    const schedule = await clinicService.getSchedule(clinic.id, req.user.id);
    res.json({ success: true, data: { schedule } });
}));

router.put('/owner/schedule', requireRole(ROLES.CLINIC_OWNER), asyncHandler(async (req, res) => {
    const clinic = await clinicService.getClinicByOwner(req.user.id);
    const schedulePayload = req.body?.schedule ?? req.body;
    const schedule = await clinicService.updateSchedule(clinic.id, req.user.id, schedulePayload);
    res.json({ success: true, data: { schedule } });
}));

module.exports = router;
