const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../../middleware/validate');
const { authenticate, authorize } = require('../../middleware/auth');
const { uploadMedicalDocument } = require('../../middleware/upload');
const reportService = require('../../services/reportService');
const { asyncHandler } = require('../../middleware/errorHandler');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get report types
router.get('/types',
  asyncHandler(async (req, res) => {
    const types = reportService.getReportTypes();
    res.json({ success: true, data: types });
  })
);

// ============ PRESCRIPTIONS ============
// NOTE: Must be defined BEFORE /:id to avoid /prescriptions being caught by the param route

// Get prescriptions
router.get('/prescriptions',
  authorize('patient'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const result = await reportService.getPrescriptions(req.user.id, parseInt(page), parseInt(limit));
    res.json({ success: true, ...result });
  })
);

// Get prescription by ID
router.get('/prescriptions/:id',
  authorize('patient'),
  asyncHandler(async (req, res) => {
    const prescription = await reportService.getPrescriptionById(req.user.id, req.params.id);
    res.json({ success: true, data: prescription });
  })
);

// ============ PATIENT ROUTES ============

// Get all reports
router.get('/',
  authorize('patient'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, type, status, fromDate, toDate } = req.query;
    const result = await reportService.getReports(
      req.user.id,
      { type, status, fromDate, toDate },
      parseInt(page),
      parseInt(limit)
    );
    res.json({ success: true, ...result });
  })
);

// Upload report
router.post('/',
  authorize('patient'),
  uploadMedicalDocument.single('file'),
  [
    body('name').notEmpty().withMessage('Report name is required'),
    body('type').notEmpty().withMessage('Report type is required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Report file is required' });
    }
    const report = await reportService.uploadReport(req.user.id, req.file, req.body);
    res.status(201).json({ success: true, data: report });
  })
);

// Get report by ID
router.get('/:id',
  authorize('patient'),
  asyncHandler(async (req, res) => {
    const report = await reportService.getReportById(req.user.id, req.params.id);
    res.json({ success: true, data: report });
  })
);

// Delete report
router.delete('/:id',
  authorize('patient'),
  asyncHandler(async (req, res) => {
    const result = await reportService.deleteReport(req.user.id, req.params.id);
    res.json({ success: true, ...result });
  })
);

// Share report with doctor
router.post('/:id/share',
  authorize('patient'),
  [
    body('doctorId').notEmpty().withMessage('Doctor ID is required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const result = await reportService.shareReportWithDoctor(
      req.user.id,
      req.params.id,
      req.body.doctorId
    );
    res.json({ success: true, ...result });
  })
);

// ============ DOCTOR ROUTES ============

// Add report parameters (doctor)
router.post('/:id/parameters',
  authorize('doctor'),
  [
    body('parameters').isArray().withMessage('Parameters array is required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const result = await reportService.addReportParameters(
      req.user.id,
      req.params.id,
      req.body.parameters
    );
    res.json({ success: true, ...result });
  })
);

module.exports = router;
