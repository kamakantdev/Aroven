/**
 * Feature Toggle Routes
 * Doctor-level AI feature control during consultations.
 */
const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const featureToggleService = require('../services/featureToggleService');

const router = express.Router();
router.use(authenticate);

// Get feature toggles for the authenticated doctor
router.get('/',
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ success: false, message: 'Only doctors can manage feature toggles' });
    }
    const toggles = await featureToggleService.getToggles(req.user.id);
    res.json({ success: true, data: toggles });
  })
);

// Update feature toggles
router.put('/',
  [
    body('toggles').isObject().withMessage('toggles must be an object'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ success: false, message: 'Only doctors can manage feature toggles' });
    }
    const updated = await featureToggleService.updateToggles(req.user.id, req.body.toggles);
    res.json({ success: true, data: updated });
  })
);

// Reset feature toggles to defaults
router.post('/reset',
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ success: false, message: 'Only doctors can manage feature toggles' });
    }
    const defaults = await featureToggleService.resetToggles(req.user.id);
    res.json({ success: true, data: defaults });
  })
);

// Check individual feature status
router.get('/:feature',
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ success: false, message: 'Only doctors can check features' });
    }
    const enabled = await featureToggleService.isFeatureEnabled(req.user.id, req.params.feature);
    res.json({ success: true, data: { feature: req.params.feature, enabled } });
  })
);

module.exports = router;
