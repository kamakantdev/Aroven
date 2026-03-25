/**
 * Chatbot Routes v2
 * Upgraded with dual-provider AI (HuggingFace + Groq), structured JSON responses,
 * medical guardrails, emergency override engine, and rate limiting.
 *
 * Endpoints:
 *   POST /session/start          → Start new chat session
 *   POST /message                → Send message (text or voice type)
 *   GET  /session/:sessionId     → Get chat history
 *   GET  /sessions               → Get all user sessions
 *   POST /session/:sessionId/end → End session
 *   POST /analyze-symptoms       → Quick symptom analysis
 *   GET  /health-tips            → Get health tips by category
 *   GET  /provider-status        → AI provider health check
 */
const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const chatbotService = require('../../services/chatbotServiceV2');
const { asyncHandler } = require('../../middleware/errorHandler');
const { uploadAny } = require('../../middleware/upload');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Start new chat session
router.post('/session/start',
  asyncHandler(async (req, res) => {
    const result = await chatbotService.startSession(req.user.id);
    res.status(201).json({ success: true, data: result });
  })
);

// Send message (supports text + voice messageType for provider routing)
router.post('/message',
  [
    body('sessionId').notEmpty().withMessage('Session ID is required'),
    body('message').notEmpty().withMessage('Message is required'),
    body('messageType')
      .optional()
      .isIn(['text', 'voice'])
      .withMessage('messageType must be "text" or "voice"'),
    body('language')
      .optional()
      .isIn(['en', 'hi'])
      .withMessage('language must be "en" or "hi"'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { sessionId, message, messageType = 'text', language = 'en' } = req.body;

    const result = await chatbotService.sendMessage(
      req.user.id,
      sessionId,
      message,
      { messageType, language }
    );

    res.json({ success: true, data: result });
  })
);

// Analyze image (skin condition, wound, medical report, etc.)
// Accepts multipart/form-data with image file OR JSON with base64 image
router.post('/analyze-image',
  uploadAny.single('image'),
  asyncHandler(async (req, res) => {
    let base64Image, mimeType, description, sessionId;

    if (req.file) {
      // Multipart upload
      base64Image = req.file.buffer.toString('base64');
      mimeType = req.file.mimetype;
      description = req.body.description || '';
      sessionId = req.body.sessionId;
    } else if (req.body.image) {
      // JSON with base64 image
      base64Image = req.body.image.replace(/^data:image\/\w+;base64,/, '');
      mimeType = req.body.mimeType || 'image/jpeg';
      description = req.body.description || '';
      sessionId = req.body.sessionId;
    } else {
      return res.status(400).json({ success: false, message: 'No image provided. Send an image file or base64 data.' });
    }

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Session ID is required' });
    }

    const result = await chatbotService.analyzeImage(
      req.user.id,
      sessionId,
      base64Image,
      mimeType,
      description
    );

    res.json({ success: true, data: result });
  })
);

// Get chat history
router.get('/session/:sessionId',
  asyncHandler(async (req, res) => {
    const result = await chatbotService.getChatHistory(req.user.id, req.params.sessionId);
    res.json({ success: true, data: result });
  })
);

// Get all user sessions
router.get('/sessions',
  asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;
    const sessions = await chatbotService.getUserSessions(req.user.id, parseInt(limit));
    res.json({ success: true, data: sessions });
  })
);

// End session
router.post('/session/:sessionId/end',
  asyncHandler(async (req, res) => {
    const result = await chatbotService.endSession(req.user.id, req.params.sessionId);
    res.json({ success: true, ...result });
  })
);

// Quick symptom analysis (rate-limited via sendMessage to prevent abuse)
router.post('/analyze-symptoms',
  [
    body('symptoms').notEmpty().withMessage('Symptoms are required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    // Route through sendMessage so it gets session ownership + rate limiting
    // Create a temporary session if none exists, or use a dedicated symptom session
    const tempSession = await chatbotService.startSession(req.user.id);
    const result = await chatbotService.sendMessage(
      req.user.id,
      tempSession.sessionId,
      `I have these symptoms: ${req.body.symptoms}. Please analyze them.`,
      { messageType: 'text', language: req.body.language || 'en' }
    );
    res.json({ success: true, data: result });
  })
);

// Get health tips
router.get('/health-tips',
  asyncHandler(async (req, res) => {
    const { category = 'general' } = req.query;
    const tips = chatbotService.getHealthTips(category);
    res.json({ success: true, data: tips });
  })
);

// AI provider health status (for monitoring/admin dashboard)
router.get('/provider-status',
  asyncHandler(async (req, res) => {
    const status = chatbotService.getProviderStatus();
    res.json({ success: true, data: status });
  })
);

module.exports = router;
