/** 
 * Centralized Configuration
 * Loads all environment variables with defaults
 */
require('dotenv').config();

const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5001,

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },

  // JWT — I12: Separate secrets for access & refresh tokens
  jwt: {
    secret: (() => {
      const secret = process.env.JWT_SECRET;
      if (!secret && process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: JWT_SECRET environment variable is required in production');
      }
      if (!secret) {
        throw new Error('FATAL: JWT_SECRET environment variable is required. Set it in your .env file.');
      }
      return secret;
    })(),
    get accessSecret() {
      return process.env.JWT_ACCESS_SECRET || this.secret;
    },
    get refreshSecret() {
      return process.env.JWT_REFRESH_SECRET || this.secret;
    },
    expiresIn: process.env.JWT_EXPIRES_IN || '1h', // Fix #35: Reduced from 7d to 1h
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  // MongoDB
  mongodb: {
    uri: process.env.MONGODB_URI,
    dbName: process.env.MONGODB_DB_NAME || 'swastik_healthcare',
  },

  // Redis (Upstash)
  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
    // I7: ioredis TCP URL for Socket.IO adapter & pub/sub (Upstash provides this)
    ioredisUrl: process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL,
  },

  // MinIO (defaults are for local dev only — override in production!)
  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT, 10) || 9000,
    accessKey: process.env.MINIO_ACCESS_KEY || (() => {
      if (process.env.NODE_ENV === 'production') throw new Error('FATAL: MINIO_ACCESS_KEY required in production');
      return 'minioadmin';
    })(),
    secretKey: process.env.MINIO_SECRET_KEY || (() => {
      if (process.env.NODE_ENV === 'production') throw new Error('FATAL: MINIO_SECRET_KEY required in production');
      return 'minioadmin';
    })(),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    bucketName: process.env.MINIO_BUCKET_NAME || 'swastik-healthcare',
    publicUrl: process.env.MINIO_PUBLIC_URL || 'http://localhost:9000',
  },

  // Frontend URLs
  frontendWebUrl: process.env.FRONTEND_WEB_URL || 'http://localhost:3000',
  frontendDoctorWebUrl: process.env.FRONTEND_DOCTOR_WEB_URL || 'http://localhost:3001',
  frontendAppUrl: process.env.FRONTEND_APP_URL || 'exp://localhost:8081',

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 min
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  // AI Providers
  ai: {
    groqApiKey: process.env.GROQ_API_KEY,
    huggingFaceKey: process.env.HUGGINGFACE_API_KEY,
    // Provider routing: text → HuggingFace, voice → Groq
    textProvider: process.env.AI_TEXT_PROVIDER || 'huggingface',
    voiceProvider: process.env.AI_VOICE_PROVIDER || 'groq',
    // Rate limits
    maxMessagesPerSession: parseInt(process.env.AI_MAX_PER_SESSION, 10) || 20,
    maxMessagesPerDay: parseInt(process.env.AI_MAX_PER_DAY, 10) || 100,
    // Context window
    conversationMemorySize: parseInt(process.env.AI_MEMORY_SIZE, 10) || 6,
    maxTokens: parseInt(process.env.AI_MAX_TOKENS, 10) || 800,
  },

  // Legacy aliases (backward compat)
  groq: {
    apiKey: process.env.GROQ_API_KEY,
  },
  huggingface: {
    apiKey: process.env.HUGGINGFACE_API_KEY,
  },

  // ElevenLabs TTS
  elevenLabs: {
    apiKey: process.env.ELEVENLABS_API_KEY || '',
    voiceId: process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM',
  },

  // WebRTC
  webrtc: {
    stunServer: process.env.WEBRTC_STUN_SERVER || 'stun:stun.l.google.com:19302',
    turnServer: process.env.WEBRTC_TURN_SERVER || '',
  },

  // Email (Gmail SMTP via Nodemailer)
  email: {
    gmailUser: process.env.GMAIL_USER,
    gmailAppPassword: process.env.GMAIL_APP_PASSWORD,
    fromName: process.env.EMAIL_FROM_NAME || 'Swastik Healthcare',
    fromEmail: process.env.EMAIL_FROM_ADDRESS || process.env.FROM_EMAIL || 'noreply@swastik.health',
  },
};

module.exports = config;
