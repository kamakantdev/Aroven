const express = require('express');
const { body, query, param } = require('express-validator');
const { validate } = require('../../middleware/validate');
const { authenticate, authorize } = require('../../middleware/auth');
const { uploadProfileImage } = require('../../middleware/upload');
const patientService = require('../../services/patientService');
const appointmentService = require('../../services/appointmentService');
const doctorService = require('../../services/doctorService');
const reportService = require('../../services/reportService');
const dispatchService = require('../../services/dispatchService');
const { asyncHandler } = require('../../middleware/errorHandler');
const { supabaseAdmin } = require('../../config/supabase');
const eventEmitter = require('../../services/eventEmitter');

const router = express.Router();

// All routes require authentication and patient role
router.use(authenticate);
router.use(authorize('patient'));

// Get patient profile
router.get('/profile',
  asyncHandler(async (req, res) => {
    const profile = await patientService.getProfile(req.user.id);
    res.json({ success: true, data: profile });
  })
);

// Update patient profile
router.put('/profile',
  [
    body('name').optional().notEmpty(),
    body('age').optional().isInt({ min: 0, max: 150 }),
    body('gender').optional().isIn(['male', 'female', 'other']),
    body('bloodGroup').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
    body('weight').optional().isFloat({ min: 0 }),
    body('height').optional().isFloat({ min: 0 }),
    body('location').optional().isString(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const profile = await patientService.updateProfile(req.user.id, req.body);
    res.json({ success: true, data: profile });
  })
);

// Upload profile image
router.post('/profile/image',
  uploadProfileImage.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Image is required' });
    }
    const result = await patientService.uploadProfileImage(req.user.id, req.file);
    res.json({ success: true, data: result });
  })
);

// Get dashboard
router.get('/dashboard',
  asyncHandler(async (req, res) => {
    const dashboard = await patientService.getDashboard(req.user.id);
    res.json({ success: true, data: dashboard });
  })
);

// ============ VITALS ============

// Get own vitals history
router.get('/vitals',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;

    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { data, error, count } = await supabaseAdmin
      .from('patient_vitals')
      .select('*', { count: 'exact' })
      .eq('patient_id', patient.id)
      .order('recorded_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;

    // Normalize: DB uses 'oxygen_level' but API/frontend expect 'oxygen_saturation'
    const normalized = (data || []).map(v => ({
      ...v,
      oxygen_saturation: v.oxygen_level ?? v.oxygen_saturation ?? null,
    }));

    res.json({
      success: true,
      data: normalized,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / parseInt(limit)),
      },
    });
  })
);

// Record new vitals
router.post('/vitals',
  [
    body('type').isIn(['blood_pressure', 'heart_rate', 'temperature', 'blood_sugar', 'oxygen_saturation', 'weight', 'height']).withMessage('Invalid vital type'),
    body('value').notEmpty().withMessage('Value is required'),
    body('unit').optional().isString(),
    body('notes').optional().isString(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    // Map type+value to the correct column in patient_vitals table
    const vitalInsert = {
      patient_id: patient.id,
      recorded_by: req.user.id,
      notes: req.body.notes || null,
      recorded_at: new Date().toISOString(),
    };
    const val = parseFloat(req.body.value);
    switch (req.body.type) {
      case 'heart_rate': vitalInsert.heart_rate = Math.round(val); break;
      case 'blood_pressure': {
        // Expect value as "120/80" or separate systolic/diastolic
        if (typeof req.body.value === 'string' && req.body.value.includes('/')) {
          const [sys, dia] = req.body.value.split('/').map(Number);
          vitalInsert.blood_pressure_systolic = Math.round(sys);
          vitalInsert.blood_pressure_diastolic = Math.round(dia);
        } else {
          vitalInsert.blood_pressure_systolic = Math.round(val);
          vitalInsert.blood_pressure_diastolic = req.body.diastolic ? Math.round(parseFloat(req.body.diastolic)) : null;
        }
        break;
      }
      case 'temperature': vitalInsert.temperature = val; break;
      case 'blood_sugar': vitalInsert.blood_sugar = val; break;
      case 'oxygen_saturation': vitalInsert.oxygen_level = val; break;
      case 'weight': vitalInsert.weight = val; break;
      case 'height': vitalInsert.height = val; break;
    }

    const { data, error } = await supabaseAdmin
      .from('patient_vitals')
      .insert(vitalInsert)
      .select('*')
      .single();

    if (error) throw error;

    // Emit real-time event so doctor dashboard gets notified
    eventEmitter.emit('vitals:recorded', {
      patientId: patient.id,
      userId: req.user.id,
      vital: data,
    });
    // Notify only the patient's own doctors via Socket.IO (scoped, not global broadcast)
    if (eventEmitter.io) {
      // Emit to the patient's own room so only their connected doctors receive it
      eventEmitter.io.to(`patient:${req.user.id}`).emit('vitals:new', {
        patientId: patient.id,
        vital: data,
      });
    }

    res.status(201).json({ success: true, data });
  })
);

// ============ REMINDERS ============
router.get('/reminders',
  asyncHandler(async (req, res) => {
    const { type, isActive } = req.query;
    const reminders = await patientService.getReminders(req.user.id, { type, isActive });
    res.json({ success: true, data: reminders });
  })
);

// Reminder adherence analytics
router.get('/reminders/adherence',
  [
    query('days').optional().isInt({ min: 1, max: 90 }).withMessage('days must be between 1 and 90'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const days = req.query.days ? parseInt(req.query.days, 10) : 7;
    const data = await patientService.getReminderAdherence(req.user.id, days);
    res.json({ success: true, data });
  })
);

// Create reminder
router.post('/reminders',
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('type').isIn(['medicine', 'appointment', 'test']).withMessage('Invalid reminder type'),
    body('time').notEmpty().withMessage('Time is required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const reminder = await patientService.createReminder(req.user.id, req.body);
    res.status(201).json({ success: true, data: reminder });
  })
);

// Reminder action (taken / skip / snooze)
router.post('/reminders/:id/action',
  [
    param('id').isUUID().withMessage('Invalid reminder ID'),
    body('action').isIn(['taken', 'skip', 'snooze']).withMessage('action must be taken, skip, or snooze'),
    body('snoozeMinutes').optional().isInt({ min: 1, max: 180 }).withMessage('snoozeMinutes must be between 1 and 180'),
    body('scheduledAt').optional().isISO8601().withMessage('scheduledAt must be a valid ISO timestamp'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const result = await patientService.actOnReminder(req.user.id, req.params.id, req.body);
    res.json({ success: true, data: result, message: 'Reminder action saved' });
  })
);

// Update reminder
router.put('/reminders/:id',
  asyncHandler(async (req, res) => {
    const reminder = await patientService.updateReminder(req.user.id, req.params.id, req.body);
    res.json({ success: true, data: reminder });
  })
);

// Delete reminder
router.delete('/reminders/:id',
  asyncHandler(async (req, res) => {
    const result = await patientService.deleteReminder(req.user.id, req.params.id);
    res.json({ success: true, ...result });
  })
);

// ============ EMERGENCY CONTACTS ============

// Add emergency contact
router.post('/emergency-contacts',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('phone').isMobilePhone().withMessage('Valid phone is required'),
    body('relation').notEmpty().withMessage('Relation is required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const contact = await patientService.addEmergencyContact(req.user.id, req.body);
    res.status(201).json({ success: true, data: contact });
  })
);

// Delete emergency contact
router.delete('/emergency-contacts/:id',
  asyncHandler(async (req, res) => {
    const result = await patientService.deleteEmergencyContact(req.user.id, req.params.id);
    res.json({ success: true, ...result });
  })
);

// ============ FAMILY MEMBERS ============

// Add family member
router.post('/family-members',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('relation').notEmpty().withMessage('Relation is required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const member = await patientService.addFamilyMember(req.user.id, req.body);
    res.status(201).json({ success: true, data: member });
  })
);

// Delete family member
router.delete('/family-members/:id',
  asyncHandler(async (req, res) => {
    const result = await patientService.deleteFamilyMember(req.user.id, req.params.id);
    res.json({ success: true, ...result });
  })
);

// ============ APPOINTMENTS (proxy for Android app) ============
// Android calls patients/appointments/* — these proxy to appointmentService

// Get patient appointments
router.get('/appointments',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;
    const result = await appointmentService.getAppointments(
      req.user.id,
      'patient',
      { status },
      parseInt(page),
      parseInt(limit)
    );
    res.json({ success: true, ...result });
  })
);

// Book appointment
router.post('/appointments',
  [
    body('doctorId').notEmpty().withMessage('Doctor ID is required'),
    body('date').isDate().withMessage('Valid date is required'),
    body('timeSlot').notEmpty().withMessage('Time slot is required'),
    body('type').isIn(['video', 'clinic', 'home_visit', 'in_person']).withMessage('Invalid appointment type'),
    body('hospitalId').optional().isUUID().withMessage('Hospital ID must be valid'),
    body('clinicId').optional().isUUID().withMessage('Clinic ID must be valid'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    if (req.body.type === 'in_person') req.body.type = 'clinic';
    const appointment = await appointmentService.bookAppointment(req.user.id, req.body);
    res.status(201).json({ success: true, data: appointment });
  })
);

// Cancel appointment
router.put('/appointments/:id/cancel',
  asyncHandler(async (req, res) => {
    const appointment = await appointmentService.cancelAppointment(
      req.user.id,
      req.params.id,
      req.body.reason
    );
    res.json({ success: true, data: appointment });
  })
);

// ============ DOCTORS (proxy for Android app) ============
// Android calls patients/doctors/* — these proxy to doctorService

// Get recommended doctors (smart recommendation engine)
// Must be BEFORE /doctors/:id to avoid route collision
router.get('/doctors/recommended',
  asyncHandler(async (req, res) => {
    const parsedLimit = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 20) : 8;

    // Get patient ID for the recommendation engine
    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    const recommended = await patientService.getRecommendedDoctors(
      patient.id,
      req.user.id,
      limit
    );
    res.json({ success: true, data: recommended });
  })
);

// Search doctors
router.get('/doctors',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, specialization, search, hospitalId, clinicId } = req.query;
    const result = await doctorService.getAllDoctors(
      { specialization, search, hospitalId, clinicId },
      parseInt(page),
      parseInt(limit)
    );
    res.json({ success: true, ...result });
  })
);

// Get doctor details
router.get('/doctors/:id',
  asyncHandler(async (req, res) => {
    const doctor = await doctorService.getDoctorById(req.params.id);
    res.json({ success: true, data: doctor });
  })
);

// Get doctor slots
router.get('/doctors/:id/slots',
  [
    query('date').notEmpty().withMessage('Date is required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const slots = await doctorService.getAvailableSlots(req.params.id, req.query.date);
    // Wrap as { date, slots } to match Android SlotsResponse DTO
    res.json({ success: true, data: { date: req.query.date, slots } });
  })
);

// ============ PRESCRIPTIONS ============
// Returns actual prescriptions from the prescriptions table (not reports)

// Get prescriptions for this patient
router.get('/prescriptions',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;

    // Resolve patient record ID from user ID
    const { data: patient } = await supabaseAdmin
      .from('patients').select('id').eq('user_id', req.user.id).single();

    if (!patient) {
      return res.json({ success: true, data: [], pagination: { page: parseInt(page), limit: parseInt(limit), total: 0, totalPages: 0 } });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { data, error, count } = await supabaseAdmin
      .from('prescriptions')
      .select(`
        *,
        prescription_medicines (*),
        doctors!prescriptions_doctor_id_fkey (id, name, specialization, profile_image_url)
      `, { count: 'exact' })
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;

    const now = new Date();

    // Auto-expire prescriptions whose valid_until has passed
    const expiredIds = (data || [])
      .filter(rx => rx.status === 'active' && rx.valid_until && new Date(rx.valid_until) < now)
      .map(rx => rx.id);

    if (expiredIds.length > 0) {
      await supabaseAdmin.from('prescriptions').update({ status: 'expired' }).in('id', expiredIds);
    }

    // Map to shape expected by Android Prescription model
    const prescriptions = (data || []).map(rx => ({
      id: rx.id,
      prescription_number: rx.prescription_number || '',
      diagnosis: rx.diagnosis || '',
      notes: rx.notes,
      follow_up_date: rx.follow_up_date,
      created_at: rx.created_at,
      status: (expiredIds.includes(rx.id) ? 'expired' : rx.status),
      valid_from: rx.valid_from,
      valid_until: rx.valid_until,
      is_dispensed: rx.is_dispensed,
      dietary_advice: rx.dietary_advice,
      lifestyle_advice: rx.lifestyle_advice,
      instructions: rx.instructions,
      doctor: rx.doctors ? {
        id: rx.doctors.id,
        name: rx.doctors.name,
        specialization: rx.doctors.specialization,
        profile_image_url: rx.doctors.profile_image_url,
      } : null,
      medicines: (rx.prescription_medicines || []).map(m => ({
        medicine_name: m.medicine_name,
        dosage: m.dosage,
        frequency: m.frequency,
        duration: m.duration,
        instructions: m.instructions,
        quantity: m.quantity,
        before_food: m.before_food || false,
        is_critical: m.is_critical || false,
      })),
    }));

    res.json({
      success: true,
      data: prescriptions,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0, totalPages: Math.ceil((count || 0) / parseInt(limit)) },
    });
  })
);

// Get prescription by ID
router.get('/prescriptions/:id',
  asyncHandler(async (req, res) => {

    const { data: patient } = await supabaseAdmin
      .from('patients').select('id').eq('user_id', req.user.id).single();

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    const { data: rx, error } = await supabaseAdmin
      .from('prescriptions')
      .select(`
        *,
        prescription_medicines (*),
        doctors!prescriptions_doctor_id_fkey (id, name, specialization, profile_image_url)
      `)
      .eq('id', req.params.id)
      .eq('patient_id', patient.id)
      .single();

    if (error || !rx) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }

    // Auto-expire if valid_until has passed
    let effectiveStatus = rx.status;
    if (rx.status === 'active' && rx.valid_until && new Date(rx.valid_until) < new Date()) {
      await supabaseAdmin.from('prescriptions').update({ status: 'expired' }).eq('id', rx.id);
      effectiveStatus = 'expired';
    }

    res.json({
      success: true,
      data: {
        id: rx.id,
        prescription_number: rx.prescription_number || '',
        diagnosis: rx.diagnosis || '',
        notes: rx.notes,
        follow_up_date: rx.follow_up_date,
        created_at: rx.created_at,
        status: effectiveStatus,
        valid_from: rx.valid_from,
        valid_until: rx.valid_until,
        is_dispensed: rx.is_dispensed,
        dietary_advice: rx.dietary_advice,
        lifestyle_advice: rx.lifestyle_advice,
        instructions: rx.instructions,
        doctor: rx.doctors ? {
          id: rx.doctors.id,
          name: rx.doctors.name,
          specialization: rx.doctors.specialization,
          profile_image_url: rx.doctors.profile_image_url,
        } : null,
        medicines: (rx.prescription_medicines || []).map(m => ({
          medicine_name: m.medicine_name,
          dosage: m.dosage,
          frequency: m.frequency,
          duration: m.duration,
          instructions: m.instructions,
          quantity: m.quantity,
          before_food: m.before_food || false,
          is_critical: m.is_critical || false,
        })),
      },
    });
  })
);

// Forward prescription to a pharmacy — creates an order linked to the prescription
router.post('/prescriptions/:id/forward-to-pharmacy',
  [
    body('pharmacyId').notEmpty().withMessage('Pharmacy ID is required'),
    body('deliveryAddress').optional().isString(),
  ],
  validate,
  asyncHandler(async (req, res) => {

    const { data: patient } = await supabaseAdmin
      .from('patients').select('id').eq('user_id', req.user.id).single();

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    // Verify prescription belongs to this patient and is active
    const { data: rx, error: rxErr } = await supabaseAdmin
      .from('prescriptions')
      .select('id, status, valid_until, medicines, prescription_medicines(*)')
      .eq('id', req.params.id)
      .eq('patient_id', patient.id)
      .single();

    if (rxErr || !rx) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }

    if (rx.status === 'expired' || rx.status === 'cancelled') {
      return res.status(400).json({ success: false, message: `Cannot forward a ${rx.status} prescription` });
    }

    // Check if prescription has expired by date
    if (rx.valid_until && new Date(rx.valid_until) < new Date()) {
      // Mark as expired
      await supabaseAdmin.from('prescriptions').update({ status: 'expired' }).eq('id', rx.id);
      return res.status(400).json({ success: false, message: 'This prescription has expired' });
    }

    // Verify pharmacy exists
    const { data: pharmacy } = await supabaseAdmin
      .from('pharmacies').select('id, name').eq('id', req.body.pharmacyId).single();

    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }

    // Build order items from prescription medicines
    const rxMeds = rx.prescription_medicines || [];
    const items = rxMeds.map(m => ({
      name: m.medicine_name,
      quantity: m.quantity || 1,
      price: 0, // pharmacy will set actual price
      fromPrescription: true,
    }));

    const pharmacyService = require('../../services/pharmacyService');
    const order = await pharmacyService.createOrder(req.user.id, {
      pharmacyId: pharmacy.id,
      items,
      prescriptionId: rx.id,
      deliveryAddress: req.body.deliveryAddress || null,
    });

    res.status(201).json({ success: true, data: order, message: `Prescription forwarded to ${pharmacy.name}` });
  })
);

// ============ REPORTS (proxy for Android app) ============
// Android calls patients/reports — these proxy to reportService

router.get('/reports',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const result = await reportService.getReports(
      req.user.id,
      {},
      parseInt(page),
      parseInt(limit)
    );
    res.json({ success: true, ...result });
  })
);

// ============ EMERGENCY (proxy for Android app) ============
// Android calls patients/emergency — uses new SOS Broadcast Dispatch system

// Request emergency (SOS broadcast to nearby ambulances)
router.post('/emergency',
  [
    body('latitude').isFloat().withMessage('Valid latitude is required'),
    body('longitude').isFloat().withMessage('Valid longitude is required'),
    body('emergencyType').optional().isIn(['medical', 'general', 'cardiac', 'accident', 'trauma', 'pregnancy', 'other']),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const result = await dispatchService.requestSOS(req.user.id, req.body);
    res.status(201).json({ success: true, data: result });
  })
);

// Get active emergency
router.get('/emergency/active',
  asyncHandler(async (req, res) => {
    try {
      // Resolve patient record ID from user ID
      const { data: patient } = await supabaseAdmin
        .from('patients')
        .select('id')
        .eq('user_id', req.user.id)
        .single();

      if (!patient) {
        return res.json({ success: true, data: null });
      }

      const { data, error } = await supabaseAdmin
        .from('emergency_requests')
        .select('*')
        .eq('patient_id', patient.id)
        .in('status', ['pending', 'broadcasting', 'assigned', 'accepted', 'en_route', 'arrived', 'picked_up'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return res.json({ success: true, data: null });
      }
      res.json({ success: true, data });
    } catch (err) {
      res.json({ success: true, data: null });
    }
  })
);

// Cancel emergency
router.put('/emergency/:id/cancel',
  asyncHandler(async (req, res) => {
    const result = await dispatchService.cancelByPatient(
      req.user.id,
      req.params.id,
      req.body.reason
    );
    res.json({ success: true, ...result });
  })
);

// ============ REVIEWS (proxy for Android app) ============

// Submit review (delegate to hospitalService for dedup + rating update)
router.post('/reviews',
  [
    body('doctorId').optional().notEmpty(),
    body('hospitalId').optional().notEmpty(),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
    body('comment').optional().isString(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    try {
      const hospitalService = require('../../services/hospitalService');

      // Resolve patient record from user
      const { data: patientRow } = await supabaseAdmin
        .from('patients')
        .select('id')
        .eq('user_id', req.user.id)
        .single();

      if (!patientRow) {
        return res.status(404).json({ success: false, message: 'Patient profile not found' });
      }

      if (req.body.hospitalId) {
        // Hospital review — use hospitalService.addReview(userId, hospitalId, reviewData)
        const result = await hospitalService.addReview(req.user.id, req.body.hospitalId, {
          rating: req.body.rating,
          comment: req.body.comment || '',
        });
        return res.status(201).json({ success: true, data: result });
      }

      // Doctor review — polymorphic insert with duplicate check
      const reviewableType = 'doctor';
      const reviewableId = req.body.doctorId;

      // Check for existing review
      const { data: existingReview } = await supabaseAdmin
        .from('reviews')
        .select('id')
        .eq('patient_id', patientRow.id)
        .eq('reviewable_type', reviewableType)
        .eq('reviewable_id', reviewableId)
        .single();

      if (existingReview) {
        return res.status(409).json({ success: false, message: 'You have already reviewed this doctor' });
      }

      const { data, error } = await supabaseAdmin
        .from('reviews')
        .insert({
          patient_id: patientRow.id,
          reviewable_type: reviewableType,
          reviewable_id: reviewableId,
          rating: req.body.rating,
          comment: req.body.comment || '',
        })
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({ success: true, data });
    } catch (err) {
      const status = err.statusCode || 500;
      res.status(status).json({ success: false, message: err.message || 'Failed to submit review' });
    }
  })
);

// ============ MEDICINE ORDERS (patient-side) ============

// Get my orders
router.get('/orders',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;

    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    let query = supabaseAdmin
      .from('pharmacy_orders')
      .select('*, pharmacy:pharmacies(id, name, phone, address)', { count: 'exact' })
      .eq('patient_id', patient.id);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / parseInt(limit)),
      },
    });
  })
);

// Get single order
router.get('/orders/:id',
  asyncHandler(async (req, res) => {

    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    const { data, error } = await supabaseAdmin
      .from('pharmacy_orders')
      .select('*, pharmacy:pharmacies(id, name, phone, address, city)')
      .eq('id', req.params.id)
      .eq('patient_id', patient.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, data });
  })
);

// Cancel order
router.patch('/orders/:id/cancel',
  asyncHandler(async (req, res) => {

    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    // Only cancel if pending
    const { data: order } = await supabaseAdmin
      .from('pharmacy_orders')
      .select('*')
      .eq('id', req.params.id)
      .eq('patient_id', patient.id)
      .single();

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!['pending', 'confirmed', 'processing'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Cannot cancel order in current status' });
    }

    const { data, error } = await supabaseAdmin
      .from('pharmacy_orders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;

    // Notify pharmacy
    const { data: pharmacy } = await supabaseAdmin
      .from('pharmacies')
      .select('owner_id')
      .eq('id', order.pharmacy_id)
      .single();

    if (pharmacy) {
      eventEmitter.emitOrderStatusUpdated({
        ...data,
        patient_id: req.user.id,
        pharmacy_owner_id: pharmacy.owner_id,
      });
    }

    res.json({ success: true, data });
  })
);

// ============ DIAGNOSTIC BOOKINGS (patient-side) ============

// Get my diagnostic bookings
router.get('/diagnostic-bookings',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;

    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    let query = supabaseAdmin
      .from('diagnostic_bookings')
      .select(`
        *,
        test:diagnostic_tests(id, name, category, price),
        center:diagnostic_centers(id, name, phone, address, city)
      `, { count: 'exact' })
      .eq('patient_id', patient.id);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / parseInt(limit)),
      },
    });
  })
);

// Get single diagnostic booking
router.get('/diagnostic-bookings/:id',
  asyncHandler(async (req, res) => {

    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    const { data, error } = await supabaseAdmin
      .from('diagnostic_bookings')
      .select(`
        *,
        test:diagnostic_tests(id, name, category, price, description),
        center:diagnostic_centers(id, name, phone, address, city, email)
      `)
      .eq('id', req.params.id)
      .eq('patient_id', patient.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    res.json({ success: true, data });
  })
);

// Cancel diagnostic booking
router.patch('/diagnostic-bookings/:id/cancel',
  asyncHandler(async (req, res) => {

    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    const { data: booking } = await supabaseAdmin
      .from('diagnostic_bookings')
      .select('*')
      .eq('id', req.params.id)
      .eq('patient_id', patient.id)
      .single();

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (!['booked'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'Cannot cancel booking in current status' });
    }

    const { data, error } = await supabaseAdmin
      .from('diagnostic_bookings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;

    eventEmitter.emitDiagnosticBookingStatusUpdated({
      ...data,
      patient_id: req.user.id,
    });

    res.json({ success: true, data });
  })
);

module.exports = router;
