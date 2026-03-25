const express = require('express');
const { query, body } = require('express-validator');
const { validate } = require('../../middleware/validate');
const { optionalAuth, authenticate } = require('../../middleware/auth');
const hospitalService = require('../../services/hospitalService');
const clinicService = require('../../services/clinicService');
const { asyncHandler } = require('../../middleware/errorHandler');

const router = express.Router();

// Get facility types
router.get('/types',
  asyncHandler(async (req, res) => {
    const types = await hospitalService.getFacilityTypes();
    res.json({ success: true, data: types });
  })
);

// Get all hospitals (with filters)
router.get('/',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, type, city, isEmergencyAvailable, specialization, search } = req.query;
    const result = await hospitalService.getHospitals(
      { type, city, isEmergencyAvailable: isEmergencyAvailable === 'true', specialization, search },
      parseInt(page),
      parseInt(limit)
    );
    res.json({ success: true, ...result });
  })
);

// Get nearby hospitals
router.get('/nearby',
  [
    query('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
    query('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
    query('radius').optional().isFloat({ min: 1, max: 100 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { latitude, longitude, radius = 10, type, isEmergencyAvailable, is24Hours } = req.query;
    const hospitals = await hospitalService.getNearbyHospitals(
      parseFloat(latitude),
      parseFloat(longitude),
      parseFloat(radius),
      { type, isEmergencyAvailable: isEmergencyAvailable === 'true', is24Hours: is24Hours === 'true' }
    );
    res.json({ success: true, data: hospitals });
  })
);

// Get emergency hospitals
router.get('/emergency',
  [
    query('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
    query('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { latitude, longitude } = req.query;
    const hospitals = await hospitalService.getEmergencyHospitals(
      parseFloat(latitude),
      parseFloat(longitude)
    );
    res.json({ success: true, data: hospitals });
  })
);

// Get pharmacies
router.get('/pharmacies',
  [
    query('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
    query('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { latitude, longitude, radius = 5 } = req.query;
    const pharmacies = await hospitalService.getPharmacies(
      parseFloat(latitude),
      parseFloat(longitude),
      parseFloat(radius)
    );
    res.json({ success: true, data: pharmacies });
  })
);

// Get clinics
router.get('/clinics',
  [
    query('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
    query('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { latitude, longitude, radius = 5 } = req.query;
    const clinics = await hospitalService.getClinics(
      parseFloat(latitude),
      parseFloat(longitude),
      parseFloat(radius)
    );
    res.json({ success: true, data: clinics });
  })
);

// Get diagnostic centers
router.get('/diagnostic-centers',
  [
    query('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
    query('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { latitude, longitude, radius = 10 } = req.query;
    const centers = await hospitalService.getDiagnosticCenters(
      parseFloat(latitude),
      parseFloat(longitude),
      parseFloat(radius)
    );
    res.json({ success: true, data: centers });
  })
);

// Search hospitals
router.get('/search',
  [
    query('q').notEmpty().withMessage('Search query is required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { q, latitude, longitude } = req.query;
    const hospitals = await hospitalService.searchHospitals(
      q,
      latitude ? parseFloat(latitude) : null,
      longitude ? parseFloat(longitude) : null
    );
    res.json({ success: true, data: hospitals });
  })
);

// Get clinic doctors (public — for patient discovery in hospital finder)
router.get('/clinics/:clinicId/doctors',
  asyncHandler(async (req, res) => {
    const doctors = await clinicService.getClinicDoctorsPublic(req.params.clinicId);
    res.json({ success: true, data: doctors });
  })
);

// Get pharmacy inventory (public — for patient to browse medicine at a pharmacy)
router.get('/pharmacies/:pharmacyId/inventory',
  asyncHandler(async (req, res) => {
    const pharmacyService = require('../../services/pharmacyService');
    const { search, category, page = 1, limit = 50 } = req.query;
    const result = await pharmacyService.getInventory(
      req.params.pharmacyId,
      { search, category, publicOnly: true },
      parseInt(page),
      parseInt(limit)
    );
    res.json({ success: true, ...result });
  })
);

// Get hospital by ID
router.get('/:id',
  asyncHandler(async (req, res) => {
    const hospital = await hospitalService.getHospitalById(req.params.id);
    res.json({ success: true, data: hospital });
  })
);

// Get reviews (public)
router.get('/:id/reviews',
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const result = await hospitalService.getReviews(req.params.id, page, limit);
    res.json({ success: true, ...result });
  })
);

// Add review (authenticated)
router.post('/:id/reviews',
  authenticate,
  [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('comment').optional().isString(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const review = await hospitalService.addReview(req.user.id, req.params.id, req.body);
    res.status(201).json({ success: true, data: review });
  })
);

module.exports = router;
