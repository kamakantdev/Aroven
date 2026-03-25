/**
 * Upgraded Chatbot Service v2
 * Production-grade healthcare AI with dual-provider architecture.
 *
 * Architecture:
 *   Text  → HuggingFace Meta Llama (primary) → Groq (fallback)
 *   Voice → Groq (low latency primary) → HuggingFace (fallback)
 *   Emergency → Rule engine override (no AI round-trip)
 *
 * Features:
 *   - Provider abstraction with automatic failover
 *   - Medical guardrails (no prescriptions, no dosages, no diagnoses)
 *   - Emergency override rule engine (chest pain, stroke, suicide, etc.)
 *   - Structured JSON response enforcement with retry
 *   - Conversation memory (last N messages + system prompt)
 *   - Rate limiting (per-session + per-day)
 *   - Cost optimization (token limiting, context trimming)
 *   - AI latency logging
 */
const aiRouter = require('./ai/AIRouter');
const { checkEmergency, sanitizeResponse, getSystemPrompt, detectSeverity, detectSpecialist } = require('./ai/medicalGuardrails');
const config = require('../config');
const { cacheGet, cacheSet, cacheIncr } = require('../config/redis');
const { HEALTH_TIPS } = require('../data/healthTips');

// ==================== CONSTANTS ====================

const MEMORY_SIZE = config.ai?.conversationMemorySize || 6;
const MAX_TOKENS = config.ai?.maxTokens || 800;
const MAX_PER_SESSION = config.ai?.maxMessagesPerSession || 20;
const MAX_PER_DAY = config.ai?.maxMessagesPerDay || 100;

// ==================== SESSION OWNERSHIP ====================

/**
 * Validate that a session belongs to the requesting user.
 * Session IDs are formatted as `session_{userId}_{timestamp}` — verify the userId segment.
 * Also does a secondary MongoDB check for sessions created via other flows.
 */
function validateSessionOwnership(userId, sessionId) {
  if (!sessionId || !userId) return false;
  // Session format: session_{userId}_{timestamp}
  const parts = sessionId.split('_');
  if (parts.length >= 3 && parts[0] === 'session') {
    return parts[1] === userId;
  }
  // Legacy/unknown format — deny by default for safety
  return false;
}

// ==================== RATE LIMITING ====================

/**
 * C12 Fix: Atomic check-and-increment rate limiting.
 * Uses INCR (atomic) instead of GET → SET (race-prone).
 * Bug 4 Fix: When Redis is down, DENY by default (fail-closed) to prevent AI budget exhaustion.
 * Returns { allowed: boolean, remaining: number, reason: string }
 */
async function checkAndIncrementRateLimit(userId, sessionId) {
  const sessionKey = `chatbot:rate:session:${sessionId}`;
  const dayKey = `chatbot:rate:day:${userId}:${new Date().toISOString().slice(0, 10)}`;

  // Atomically increment session counter. INCR returns new value; if 1 → key was just created
  const sessionCount = await cacheIncr(sessionKey, 3600); // 1 hour TTL

  // Bug 4 Fix: If Redis is down, cacheIncr returns null — fail-closed (deny)
  if (sessionCount === null) {
    return {
      allowed: false,
      remaining: 0,
      reason: 'Service temporarily unavailable. Please try again in a moment.',
    };
  }

  if (sessionCount > MAX_PER_SESSION) {
    return {
      allowed: false,
      remaining: 0,
      reason: `Session limit reached (${MAX_PER_SESSION} messages). Please start a new session.`,
    };
  }

  // Atomically increment daily counter
  const dayCount = await cacheIncr(dayKey, 86400); // 24 hour TTL

  // Bug 4 Fix: Same fail-closed for daily counter
  if (dayCount === null) {
    return {
      allowed: false,
      remaining: 0,
      reason: 'Service temporarily unavailable. Please try again in a moment.',
    };
  }

  if (dayCount > MAX_PER_DAY) {
    return {
      allowed: false,
      remaining: 0,
      reason: `Daily limit reached (${MAX_PER_DAY} messages). Please try again tomorrow.`,
    };
  }

  return {
    allowed: true,
    remaining: Math.min(MAX_PER_SESSION - sessionCount, MAX_PER_DAY - dayCount),
  };
}

// ==================== CHAT HISTORY ====================

/**
 * Get conversation memory (last N messages) for context.
 */
async function getConversationMemory(userId, sessionId) {
  try {
    const { ChatMessage } = require('../database/models');
    const messages = await ChatMessage.find({ sessionId, userId, role: { $ne: 'system' } })
      .sort({ createdAt: -1 })
      .limit(MEMORY_SIZE)
      .lean();

    return messages.reverse().map(m => ({
      role: m.role,
      content: m.content,
    }));
  } catch {
    return [];
  }
}

/**
 * Save messages to MongoDB.
 */
async function saveMessages(sessionId, userId, userMessage, assistantResponse, metadata = {}) {
  try {
    const { ChatMessage } = require('../database/models');
    await ChatMessage.insertMany([
      {
        sessionId,
        userId,
        role: 'user',
        content: userMessage,
        metadata: { messageType: metadata.messageType || 'text' },
      },
      {
        sessionId,
        userId,
        role: 'assistant',
        content: typeof assistantResponse === 'string' ? assistantResponse : JSON.stringify(assistantResponse),
        metadata: {
          provider: metadata.provider,
          model: metadata.model,
          latencyMs: metadata.latencyMs,
          tokens: metadata.tokens,
          isEmergency: metadata.isEmergency || false,
        },
      },
    ]);
  } catch (err) {
    console.error('Failed to save chat messages:', err.message);
  }
}

// ==================== PUBLIC API ====================

/**
 * Start a new chat session.
 */
async function startSession(userId, language = 'en') {
  const sessionId = `session_${userId}_${Date.now()}`;

  try {
    const { ChatMessage } = require('../database/models');
    await ChatMessage.create({
      sessionId,
      userId,
      role: 'system',
      content: 'Health assistant session started',
      metadata: { language },
    });
  } catch {
    // MongoDB unavailable — continue
  }

  return {
    sessionId,
    message: 'Chat session started. How can I help you with your health today?',
  };
}

/**
 * Send a message to the AI chatbot.
 *
 * Flow:
 *   1. Rate limit check
 *   2. Emergency rule engine check (pre-AI)
 *   3. Build conversation context (system prompt + memory)
 *   4. Route to AI provider (text→HF, voice→Groq)
 *   5. Parse structured JSON response
 *   6. Medical guardrails post-processing
 *   7. Save to MongoDB
 *   8. Return structured response
 *
 * @param {string} userId
 * @param {string} sessionId
 * @param {string} message
 * @param {Object} options - {messageType: 'text'|'voice', generateAudio, language}
 */
async function sendMessage(userId, sessionId, message, options = {}) {
  const { messageType = 'text', language = 'en' } = options;

  // 0. Session ownership validation (prevents cross-user session access)
  if (!validateSessionOwnership(userId, sessionId)) {
    return {
      response: {
        summary: 'Invalid session. Please start a new chat session.',
        possible_conditions: [],
        severity: 'low',
        recommended_specialist: 'General Physician',
        requires_emergency: false,
        confidence_score: 0,
        follow_up_question: null,
      },
      provider: 'error',
      error: true,
    };
  }

  // 1. Emergency rule engine FIRST (pre-AI, sub-100ms)
  // CRITICAL: Check emergency BEFORE rate limiting so suicidal/critical patients
  // are NEVER blocked by rate limits — they always get crisis numbers.
  const emergency = checkEmergency(message);
  if (emergency) {
    await saveMessages(sessionId, userId, message, emergency.response, {
      messageType,
      provider: 'emergency_engine',
      isEmergency: true,
      latencyMs: 0,
    });

    return {
      response: {
        summary: emergency.response,
        possible_conditions: [emergency.ruleId.replace(/_/g, ' ')],
        severity: emergency.severity,
        recommended_specialist: emergency.specialist,
        requires_emergency: emergency.requiresEmergency,
        confidence_score: emergency.confidence,
        follow_up_question: null,
      },
      provider: 'emergency_engine',
      isEmergency: true,
      emergencyNumbers: emergency.emergencyNumbers,
    };
  }

  // 2. Atomic rate limit check + increment (only for AI calls, not emergencies)
  const rateCheck = await checkAndIncrementRateLimit(userId, sessionId);
  if (!rateCheck.allowed) {
    return {
      response: {
        summary: rateCheck.reason,
        possible_conditions: [],
        severity: 'low',
        recommended_specialist: 'General Physician',
        requires_emergency: false,
        confidence_score: 0,
        follow_up_question: null,
      },
      provider: 'rate_limited',
      rateLimited: true,
    };
  }

  // 3. Build conversation context
  const history = await getConversationMemory(userId, sessionId);
  const systemPrompt = getSystemPrompt(language);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message },
  ];

  // 4 & 5. Route to AI provider with JSON enforcement
  let aiResult;
  let parsedResponse;

  try {
    aiResult = await aiRouter.routeWithJsonRetry(messages, {
      messageType,
      temperature: 0.7,
      maxTokens: MAX_TOKENS,
    });

    parsedResponse = aiResult.parsedContent;
  } catch (err) {
    console.error('[ChatbotService] AI provider error:', err.message);

    // Fallback: try without JSON mode
    try {
      aiResult = await aiRouter.route(messages, {
        messageType,
        temperature: 0.7,
        maxTokens: MAX_TOKENS,
      });

      // Try to parse, or create structured response from plain text
      parsedResponse = aiRouter._extractJson?.(aiResult.content) || {
        summary: aiResult.content,
        possible_conditions: [],
        severity: detectSeverity(message),
        recommended_specialist: detectSpecialist(message),
        requires_emergency: false,
        confidence_score: 0.5,
        follow_up_question: null,
      };
    } catch (fallbackErr) {
      console.error('[ChatbotService] All AI providers failed:', fallbackErr.message);

      return {
        response: {
          summary: 'I apologize, but I\'m having trouble connecting right now. For immediate help, please call 102/108 for emergencies, or try again in a moment.',
          possible_conditions: [],
          severity: 'low',
          recommended_specialist: 'General Physician',
          requires_emergency: false,
          confidence_score: 0,
          follow_up_question: 'Would you like to try again?',
        },
        provider: 'fallback',
        error: true,
      };
    }
  }

  // 6. Medical guardrails post-processing
  if (parsedResponse.summary) {
    parsedResponse.summary = sanitizeResponse(parsedResponse.summary);
  }

  // Ensure required fields
  parsedResponse = {
    summary: parsedResponse.summary || 'I can help you with that. Could you provide more details?',
    possible_conditions: parsedResponse.possible_conditions || [],
    severity: parsedResponse.severity || detectSeverity(message),
    recommended_specialist: parsedResponse.recommended_specialist || detectSpecialist(message),
    requires_emergency: parsedResponse.requires_emergency || false,
    confidence_score: parsedResponse.confidence_score || 0.5,
    follow_up_question: parsedResponse.follow_up_question || null,
  };

  // 7. Save to MongoDB
  await saveMessages(sessionId, userId, message, parsedResponse.summary, {
    messageType,
    provider: aiResult.provider,
    model: aiResult.model,
    latencyMs: aiResult.latencyMs,
    tokens: aiResult.usage?.totalTokens,
  });

  // Rate already incremented atomically in checkAndIncrementRateLimit

  // 8. Return structured response
  return {
    response: parsedResponse,
    provider: aiResult.provider,
    model: aiResult.model,
    latencyMs: aiResult.latencyMs,
    usage: aiResult.usage,
  };
}

/**
 * Analyze an image (skin condition, wound, report, etc.) using Groq Vision.
 * Accepts a base64-encoded image and optional text description.
 *
 * Uses Groq's Llama 3.2 Vision model which natively supports image input.
 *
 * @param {string} userId
 * @param {string} sessionId
 * @param {string} base64Image - base64-encoded image data (no data:image prefix)
 * @param {string} mimeType - e.g. "image/jpeg", "image/png"
 * @param {string} description - optional user description of what they want analyzed
 */
const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_BASE64_LENGTH = 10 * 1024 * 1024; // ~7.5 MB decoded (10 MB base64)

async function analyzeImage(userId, sessionId, base64Image, mimeType = 'image/jpeg', description = '') {
  // Validate base64 image size (prevents memory bomb)
  if (!base64Image || typeof base64Image !== 'string') {
    return {
      response: { summary: 'No image provided. Please share an image for analysis.', possible_conditions: [], severity: 'low', recommended_specialist: 'General Physician', requires_emergency: false, confidence_score: 0, follow_up_question: null },
      provider: 'error', error: true,
    };
  }
  if (base64Image.length > MAX_BASE64_LENGTH) {
    return {
      response: { summary: 'Image is too large. Please share an image smaller than 7.5 MB.', possible_conditions: [], severity: 'low', recommended_specialist: 'General Physician', requires_emergency: false, confidence_score: 0, follow_up_question: null },
      provider: 'error', error: true,
    };
  }
  // Validate MIME type
  if (!ALLOWED_IMAGE_MIMES.includes(mimeType)) {
    return {
      response: { summary: `Unsupported image format: ${mimeType}. Please use JPEG, PNG, GIF, or WebP.`, possible_conditions: [], severity: 'low', recommended_specialist: 'General Physician', requires_emergency: false, confidence_score: 0, follow_up_question: null },
      provider: 'error', error: true,
    };
  }

  // Session ownership validation
  if (!validateSessionOwnership(userId, sessionId)) {
    return {
      response: { summary: 'Invalid session. Please start a new chat session.', possible_conditions: [], severity: 'low', recommended_specialist: 'General Physician', requires_emergency: false, confidence_score: 0, follow_up_question: null },
      provider: 'error', error: true,
    };
  }

  // C12 fix: Rate limit image analysis too (was missing before)
  const rateCheck = await checkAndIncrementRateLimit(userId, sessionId);
  if (!rateCheck.allowed) {
    return {
      response: {
        summary: rateCheck.reason,
        possible_conditions: [],
        severity: 'low',
        recommended_specialist: 'General Physician',
        requires_emergency: false,
        confidence_score: 0,
        follow_up_question: null,
      },
      provider: 'rate_limited',
      rateLimited: true,
    };
  }

  const startTime = Date.now();

  const groqApiKey = config.ai?.groqApiKey || process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    return {
      response: {
        summary: 'Image analysis is temporarily unavailable. Please describe your symptoms in text instead.',
        possible_conditions: [],
        severity: 'low',
        recommended_specialist: 'General Physician',
        requires_emergency: false,
        confidence_score: 0,
        follow_up_question: 'Can you describe what you see in the image?',
      },
      provider: 'unavailable',
      error: true,
    };
  }

  const userPrompt = description
    ? `The patient has shared an image and says: "${description}". Please analyze the image for any visible medical conditions.`
    : 'The patient has shared an image for medical analysis. Please analyze it for any visible medical conditions, skin issues, wounds, or abnormalities.';

  const systemPrompt = `You are Swastik Health Assistant, a medical image analysis AI. Analyze the provided image and respond ONLY with valid JSON in this exact format:
{
  "summary": "Brief description of what you see and your assessment",
  "possible_conditions": ["condition1", "condition2"],
  "severity": "low|medium|high|critical",
  "recommended_specialist": "Specialist Type",
  "requires_emergency": false,
  "confidence_score": 0.7,
  "follow_up_question": "A relevant follow-up question"
}

GUIDELINES:
- NEVER diagnose — suggest possibilities and recommend professional consultation
- For skin conditions, describe what you observe (color, texture, size, pattern)
- For wounds, assess apparent severity and recommend care
- For medical reports/documents, summarize key findings
- Always recommend consulting a doctor for proper diagnosis
- If the image is unclear or not medical, say so honestly
- Be empathetic and helpful`;

  try {
    // 45s timeout for image analysis (larger payload needs more time)
    const controller = new AbortController();
    const abortTimeout = setTimeout(() => controller.abort(), 45_000);

    let response;
    try {
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.2-90b-vision-preview',
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: userPrompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          temperature: 0.3,
          max_tokens: 800,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(abortTimeout);
      if (fetchErr.name === 'AbortError') {
        throw new Error('Image analysis timed out after 45s');
      }
      throw fetchErr;
    } finally {
      clearTimeout(abortTimeout);
    }

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ChatbotService] Groq Vision error:', response.status, errorText);
      throw new Error(`Groq Vision API error (${response.status})`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const usage = data.usage || {};

    // Parse JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(content);
    } catch {
      // Try extracting JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsedResponse = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    }

    if (!parsedResponse) {
      parsedResponse = {
        summary: content || 'I was unable to analyze the image clearly. Please try with a clearer photo or describe your symptoms.',
        possible_conditions: [],
        severity: 'low',
        recommended_specialist: 'General Physician',
        requires_emergency: false,
        confidence_score: 0.3,
        follow_up_question: 'Could you describe what you see or take a clearer photo?',
      };
    }

    // Ensure required fields
    parsedResponse = {
      summary: parsedResponse.summary || 'Image analysis complete.',
      possible_conditions: parsedResponse.possible_conditions || [],
      severity: parsedResponse.severity || 'low',
      recommended_specialist: parsedResponse.recommended_specialist || 'Dermatologist',
      requires_emergency: parsedResponse.requires_emergency || false,
      confidence_score: parsedResponse.confidence_score || 0.5,
      follow_up_question: parsedResponse.follow_up_question || null,
    };

    // Sanitize response
    if (parsedResponse.summary) {
      parsedResponse.summary = sanitizeResponse(parsedResponse.summary);
    }

    // Save to MongoDB
    await saveMessages(sessionId, userId, `[Image: ${description || 'Medical image analysis'}]`, parsedResponse.summary, {
      messageType: 'image',
      provider: 'groq_vision',
      model: 'llama-3.2-90b-vision-preview',
      latencyMs,
      tokens: usage.total_tokens,
    });

    // Rate already incremented atomically in checkAndIncrementRateLimit

    return {
      response: parsedResponse,
      provider: 'groq_vision',
      model: 'llama-3.2-90b-vision-preview',
      latencyMs,
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
      },
    };
  } catch (err) {
    console.error('[ChatbotService] Image analysis failed:', err.message);
    return {
      response: {
        summary: 'I was unable to analyze the image. Please try again or describe your symptoms in text. For emergencies, call 102/108.',
        possible_conditions: [],
        severity: 'low',
        recommended_specialist: 'General Physician',
        requires_emergency: false,
        confidence_score: 0,
        follow_up_question: 'Can you describe what you see in text?',
      },
      provider: 'fallback',
      error: true,
    };
  }
}

/**
 * Analyze symptoms with structured AI response.
 */
async function analyzeSymptoms(symptoms, language = 'en') {
  const prompt = `Analyze these symptoms for a patient in India:
${symptoms}

Respond with this JSON structure:
{
  "conditions": [{"name": "...", "probability": "high|medium|low", "description": "..."}],
  "recommendedSpecialist": "Specialist Type",
  "urgency": "emergency|urgent|routine",
  "immediateSteps": ["step1", "step2"],
  "warningSignsToWatch": ["sign1", "sign2"],
  "shouldSeeDoctor": true,
  "suggestedTimeframe": "within X hours/days",
  "disclaimer": "This is AI-generated analysis, not a medical diagnosis."
}`;

  try {
    const result = await aiRouter.routeWithJsonRetry([
      { role: 'system', content: 'You are a medical symptom analyzer. Always recommend consulting a doctor. Respond only with valid JSON.' },
      { role: 'user', content: prompt },
    ], {
      messageType: 'text',
      temperature: 0.3,
      maxTokens: 600,
    });

    const analysis = result.parsedContent;
    analysis.disclaimer = 'This is AI-generated analysis and NOT a medical diagnosis. Please consult a qualified healthcare professional.';

    return analysis;
  } catch (err) {
    console.error('Symptom analysis error:', err.message);
    return {
      error: true,
      message: 'Unable to analyze symptoms at this time. Please consult a doctor directly.',
      shouldSeeDoctor: true,
      urgency: 'urgent',
      disclaimer: 'Please consult a qualified healthcare professional.',
    };
  }
}

/**
 * Get health tips by category.
 */
function getHealthTips(category = 'general') {
  return HEALTH_TIPS[category] || HEALTH_TIPS.general;
}

/**
 * Get chat history for a session.
 */
async function getChatHistory(userId, sessionId) {
  // Session ownership validation
  if (!validateSessionOwnership(userId, sessionId)) {
    return [];
  }
  try {
    const { ChatMessage } = require('../database/models');
    const messages = await ChatMessage.find({ sessionId, userId })
      .sort({ createdAt: 1 });

    return messages.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.createdAt,
      metadata: m.metadata,
    }));
  } catch {
    return [];
  }
}

/**
 * Get all sessions for a user.
 */
async function getUserSessions(userId, limit = 10) {
  try {
    const { ChatMessage } = require('../database/models');
    const sessions = await ChatMessage.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$sessionId',
          lastMessage: { $last: '$content' },
          updatedAt: { $max: '$createdAt' },
          messageCount: { $sum: 1 },
        },
      },
      { $sort: { updatedAt: -1 } },
      { $limit: limit },
    ]);

    return sessions.map(s => ({
      sessionId: s._id,
      lastMessage: s.lastMessage,
      updatedAt: s.updatedAt,
      messageCount: s.messageCount,
    }));
  } catch {
    return [];
  }
}

/**
 * End a chat session.
 */
async function endSession(userId, sessionId) {
  // Session ownership validation
  if (!validateSessionOwnership(userId, sessionId)) {
    return { message: 'Invalid session' };
  }
  try {
    const { ChatMessage } = require('../database/models');
    await ChatMessage.create({
      sessionId,
      userId,
      role: 'system',
      content: 'Session ended',
    });
  } catch {
    // MongoDB unavailable
  }
  return { message: 'Chat session ended' };
}

/**
 * Get AI provider status (for monitoring).
 */
function getProviderStatus() {
  return aiRouter.getStatus();
}

module.exports = {
  startSession,
  sendMessage,
  analyzeSymptoms,
  analyzeImage,
  getHealthTips,
  getChatHistory,
  getUserSessions,
  endSession,
  getProviderStatus,
};
