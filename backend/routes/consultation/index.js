const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const consultationService = require('../../services/consultationService');
const { asyncHandler } = require('../../middleware/errorHandler');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get consultation history
router.get('/',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const result = await consultationService.getConsultationHistory(
      req.user.id,
      req.user.role,
      parseInt(page),
      parseInt(limit)
    );
    res.json({ success: true, ...result });
  })
);

// Start consultation (doctor only)
router.post('/:appointmentId/start',
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ success: false, message: 'Only doctors can start consultations' });
    }
    const result = await consultationService.startConsultation(req.user.id, req.params.appointmentId);
    res.status(201).json({ success: true, data: result });
  })
);

// Join consultation (patient only)
router.post('/:id/join',
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'patient') {
      return res.status(403).json({ success: false, message: 'Only patients can join consultations' });
    }
    const result = await consultationService.joinConsultation(req.user.id, req.params.id);
    res.json({ success: true, data: result });
  })
);

// Get consultation by ID
router.get('/:id',
  asyncHandler(async (req, res) => {
    const consultation = await consultationService.getConsultation(
      req.user.id,
      req.user.role,
      req.params.id
    );
    res.json({ success: true, data: consultation });
  })
);

// End consultation (doctor only)
router.put('/:id/end',
  [
    body('diagnosis').optional().isString(),
    body('notes').optional().isString(),
    body('followUpDate').optional().isDate(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ success: false, message: 'Only doctors can end consultations' });
    }
    const consultation = await consultationService.endConsultation(
      req.user.id,
      req.params.id,
      req.body
    );
    res.json({ success: true, data: consultation });
  })
);

// Leave consultation (patient only) — signal patient left the video call
router.post('/:id/leave',
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'patient') {
      return res.status(403).json({ success: false, message: 'Only patients can leave (doctors should end)' });
    }
    const result = await consultationService.leaveConsultation(req.user.id, req.params.id);
    res.json({ success: true, ...result });
  })
);

// Add prescription (doctor only)
router.post('/:id/prescription',
  [
    body('items').isArray().withMessage('Prescription items are required'),
    body('items.*.medicineName').notEmpty().withMessage('Medicine name is required'),
    body('items.*.dosage').notEmpty().withMessage('Dosage is required'),
    body('items.*.frequency').notEmpty().withMessage('Frequency is required'),
    body('items.*.duration').notEmpty().withMessage('Duration is required'),
    body('items.*.instructions').optional().isString(),
    body('items.*.quantity').optional().isInt({ min: 1 }),
    body('items.*.beforeFood').optional().isBoolean(),
    body('items.*.isCritical').optional().isBoolean(),
    body('diagnosis').optional().isString(),
    body('notes').optional().isString(),
    body('followUpDate').optional().isString(),
    body('dietaryAdvice').optional().isString(),
    body('lifestyleAdvice').optional().isString(),
    body('instructions').optional().isString(),
    body('validityDays').optional().isInt({ min: 1, max: 365 }),
    body('allowMultiplePrescriptions').optional().isBoolean(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ success: false, message: 'Only doctors can add prescriptions' });
    }
    const prescription = await consultationService.addPrescription(
      req.user.id,
      req.params.id,
      req.body
    );
    res.status(201).json({ success: true, data: prescription });
  })
);

// AI-assisted clinical decision support (doctor only)
router.post('/:id/ai-assist',
  [
    body('query').notEmpty().withMessage('Query is required'),
    body('symptoms').optional().isString(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ success: false, message: 'Only doctors can use AI assistant' });
    }
    const result = await consultationService.aiAssistDoctor(
      req.user.id,
      req.params.id,
      req.body.query,
      { symptoms: req.body.symptoms }
    );
    res.json({ success: true, data: result });
  })
);

module.exports = router;
