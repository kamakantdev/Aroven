const express = require('express');
const { body, query } = require('express-validator');
const { validate } = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const appointmentService = require('../../services/appointmentService');
const { asyncHandler } = require('../../middleware/errorHandler');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get appointments
router.get('/',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status, type, fromDate, toDate, upcoming, since, fields } = req.query;
    const result = await appointmentService.getAppointments(
      req.user.id,
      req.user.role,
      { status, type, fromDate, toDate, upcoming: upcoming === 'true', since },
      parseInt(page),
      parseInt(limit)
    );
    // Sparse field selection: ?fields=id,status,appointment_date reduces payload
    if (fields && result.data) {
      const allowedFields = fields.split(',').map(f => f.trim());
      result.data = result.data.map(item => {
        const picked = {};
        for (const key of allowedFields) {
          if (key in item) picked[key] = item[key];
        }
        return picked;
      });
    }
    res.json({ success: true, ...result });
  })
);

// Book appointment (patient only)
router.post('/',
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
    if (req.user.role !== 'patient') {
      return res.status(403).json({ success: false, message: 'Only patients can book appointments' });
    }
    // Normalize: 'in_person' is an alias for 'clinic' — store consistently
    if (req.body.type === 'in_person') req.body.type = 'clinic';
    const appointment = await appointmentService.bookAppointment(req.user.id, req.body);
    res.status(201).json({ success: true, data: appointment });
  })
);

// Get appointment by ID
router.get('/:id',
  asyncHandler(async (req, res) => {
    const appointment = await appointmentService.getAppointmentById(
      req.user.id,
      req.user.role,
      req.params.id
    );
    res.json({ success: true, data: appointment });
  })
);

// Update appointment status (doctor only)
router.put('/:id/status',
  [
    body('status').isIn(['confirmed', 'cancelled', 'completed', 'no_show']).withMessage('Invalid status'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ success: false, message: 'Only doctors can update appointment status' });
    }
    const { status, reason } = req.body;
    const appointment = await appointmentService.updateAppointmentStatus(
      req.user.id,
      req.params.id,
      status,
      reason
    );
    res.json({ success: true, data: appointment });
  })
);

// Cancel appointment (patient)
router.delete('/:id',
  [
    body('reason').optional().isString(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'patient') {
      return res.status(403).json({ success: false, message: 'Only patients can cancel their appointments' });
    }
    const appointment = await appointmentService.cancelAppointment(
      req.user.id,
      req.params.id,
      req.body.reason
    );
    res.json({ success: true, data: appointment });
  })
);

// Cancel appointment via PUT (Android app compatibility)
router.put('/:id/cancel',
  [
    body('reason').optional().isString(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'patient') {
      return res.status(403).json({ success: false, message: 'Only patients can cancel their appointments' });
    }
    const appointment = await appointmentService.cancelAppointment(
      req.user.id,
      req.params.id,
      req.body.reason
    );
    res.json({ success: true, data: appointment });
  })
);

// Reschedule appointment
router.post('/:id/reschedule',
  [
    body('date').isDate().withMessage('Valid date is required'),
    body('timeSlot').notEmpty().withMessage('Time slot is required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { date, timeSlot } = req.body;
    const appointment = await appointmentService.rescheduleAppointment(
      req.user.id,
      req.user.role,
      req.params.id,
      date,
      timeSlot
    );
    res.json({ success: true, data: appointment });
  })
);

module.exports = router;
