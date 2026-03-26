const express = require('express');
const { query, body } = require('express-validator');
const { validate } = require('../../middleware/validate');
const { optionalAuth, authenticate } = require('../../middleware/auth');
const { uploadMedicalDocument } = require('../../middleware/upload');
const medicineService = require('../../services/medicineService');
const { asyncHandler } = require('../../middleware/errorHandler');

const router = express.Router();

// Get categories
router.get('/categories',
  asyncHandler(async (req, res) => {
    const categories = await medicineService.getCategories();
    res.json({ success: true, data: categories });
  })
);

// Get popular medicines by category scope
router.get('/categories/popular',
  asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;
    const medicines = await medicineService.getPopularMedicines(parseInt(limit));
    res.json({ success: true, data: medicines });
  })
);

// Get nearby medicines (Hybrid approach)
router.get('/nearby',
  [
    query('latitude').optional().isFloat().withMessage('Valid latitude is required'),
    query('longitude').optional().isFloat().withMessage('Valid longitude is required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { latitude, longitude, radius = 25, limit = 20 } = req.query;
    if (!latitude || !longitude) {
      return res.json({ success: true, data: [] });
    }
    const medicines = await medicineService.getNearbyMedicines(
      parseFloat(latitude),
      parseFloat(longitude),
      parseFloat(radius),
      parseInt(limit)
    );
    res.json({ success: true, data: medicines });
  })
);

// Search medicines
router.get('/search',
  asyncHandler(async (req, res) => {
    const { q, category, requiresPrescription, maxPrice, page = 1, limit = 20 } = req.query;
    const result = await medicineService.searchMedicines(
      q,
      { category, requiresPrescription: requiresPrescription === 'true', maxPrice: maxPrice ? parseFloat(maxPrice) : null },
      parseInt(page),
      parseInt(limit)
    );
    res.json({ success: true, ...result });
  })
);

// Get medicine by ID
router.get('/:id',
  asyncHandler(async (req, res) => {
    const medicine = await medicineService.getMedicineById(req.params.id);
    res.json({ success: true, data: medicine });
  })
);

// Get medicine availability at nearby pharmacies
router.get('/:id/availability',
  [
    query('latitude').isFloat().withMessage('Valid latitude is required'),
    query('longitude').isFloat().withMessage('Valid longitude is required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { latitude, longitude, radius = 10 } = req.query;
    const availability = await medicineService.getMedicineAvailability(
      req.params.id,
      parseFloat(latitude),
      parseFloat(longitude),
      parseFloat(radius)
    );
    res.json({ success: true, data: availability });
  })
);

// Get alternative medicines (generics)
router.get('/:id/alternatives',
  asyncHandler(async (req, res) => {
    const alternatives = await medicineService.getAlternatives(req.params.id);
    res.json({ success: true, data: alternatives });
  })
);

// Find pharmacies with medicine
router.get('/:id/pharmacies',
  [
    query('latitude').isFloat().withMessage('Valid latitude is required'),
    query('longitude').isFloat().withMessage('Valid longitude is required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { latitude, longitude, radius = 10 } = req.query;
    const pharmacies = await medicineService.findPharmaciesWithMedicine(
      req.params.id,
      parseFloat(latitude),
      parseFloat(longitude),
      parseFloat(radius)
    );
    res.json({ success: true, data: pharmacies });
  })
);

// Check prescription requirements
router.post('/check-prescription',
  [
    body('medicineIds').isArray().withMessage('Medicine IDs array is required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const result = await medicineService.checkPrescriptionRequirement(req.body.medicineIds);
    res.json({ success: true, data: result });
  })
);

// Upload prescription
router.post('/upload-prescription',
  authenticate,
  uploadMedicalDocument.single('prescription'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Prescription file is required' });
    }
    const result = await medicineService.uploadPrescription(
      req.user.id,
      req.file,
      req.body.orderId
    );
    res.json({ success: true, data: result });
  })
);

const pharmacyService = require('../../services/pharmacyService');

// Create order
router.post('/orders',
  authenticate,
  [
    body('pharmacyId').notEmpty().withMessage('Pharmacy ID is required'),
    body('items').isArray({ min: 1 }).withMessage('Items array is required'),
    body('items.*.medicineId').notEmpty().withMessage('Medicine ID is required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('deliveryAddress').notEmpty().withMessage('Delivery address is required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const order = await pharmacyService.createOrder(req.user.id, req.body);
    res.status(201).json({ success: true, data: order });
  })
);

module.exports = router;
