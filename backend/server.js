require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const crypto = require('crypto');

const config = require('./config');
const compression = require('compression');
const { initializeBucket } = require('./config/minio');
const { connectMongoDB } = require('./config/mongodb');
const { connectRedis } = require('./config/redis');
const { initializeNotificationQueue, shutdownNotificationQueue } = require('./services/notificationQueueService');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { initializeSocketIO } = require('./sockets');

// Import routes
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patient');
const doctorRoutes = require('./routes/doctor');
const appointmentRoutes = require('./routes/appointment');
const consultationRoutes = require('./routes/consultation');
const hospitalRoutes = require('./routes/hospital');
const ambulanceRoutes = require('./routes/ambulance');
const medicineRoutes = require('./routes/medicine');
const chatbotRoutes = require('./routes/chatbot');
const featureToggleRoutes = require('./routes/featureToggle');
const reportRoutes = require('./routes/report');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/enhancedAdmin');
const pharmacyRoutes = require('./routes/pharmacy');
const hospitalManagerRoutes = require('./routes/hospitalManager');
const clinicRoutes = require('./routes/clinic');
const diagnosticCenterRoutes = require('./routes/diagnosticCenter');
const uploadRoutes = require('./routes/uploads');
const healthCardRoutes = require('./routes/healthCard');
const vitalsRoutes = require('./routes/vitals');

// Create Express app
const app = express();
const server = http.createServer(app);

// Shared CORS allowlist for both HTTP and WebSocket
const allowedOrigins = [
  config.frontendWebUrl,
  config.frontendDoctorWebUrl,
  config.frontendAppUrl,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://10.0.2.2:3000', // Android Emulator (Docker/Standard)
  'http://10.0.2.2:5001', // Android Emulator (Local Fallback)
];

const isOriginAllowed = (origin) => {
  if (!origin) return true; // mobile apps / curl / server-to-server
  if (allowedOrigins.includes(origin)) return true;
  if (config.env === 'development' && /^http:\/\/localhost:\d+$/.test(origin)) return true;
  return false;
};

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) return callback(null, true);
      return callback(new Error('CORS not allowed'));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// I7: Socket.IO Redis adapter for horizontal scaling
if (config.redis.ioredisUrl) {
  try {
    const { createAdapter } = require('@socket.io/redis-adapter');
    const Redis = require('ioredis');
    const pubClient = new Redis(config.redis.ioredisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 5000),
    });
    const subClient = pubClient.duplicate();

    Promise.all([pubClient.connect(), subClient.connect()])
      .then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        console.log('✅ Socket.IO Redis adapter connected');
      })
      .catch((err) => {
        console.warn('⚠️  Socket.IO Redis adapter failed (falling back to in-memory):', err.message);
      });
  } catch (err) {
    console.warn('⚠️  @socket.io/redis-adapter not available:', err.message);
  }
} else {
  console.warn('⚠️  REDIS_URL/UPSTASH_REDIS_URL not set for ioredis adapter. Socket.IO scaling is disabled (single-instance mode).');
}

// Initialize Socket.IO
initializeSocketIO(io);

// Initialize event emitter with Socket.IO instance
const eventEmitter = require('./services/eventEmitter');
eventEmitter.setIO(io);

// Make io accessible to routes
app.set('io', io);

// CORS - MUST come before all other middleware
app.use(cors({
  origin: function (origin, callback) {
    if (isOriginAllowed(origin)) return callback(null, true);
    return callback(new Error('CORS not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
}));

// Security middleware (after CORS)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Response compression — 60-80% bandwidth reduction for JSON/text responses
// Critical for low-bandwidth rural areas
app.use(compression({
  level: 6, // Good balance between speed and compression ratio
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

// Request ID for tracing
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// Request Logging (non-health endpoints)
app.use((req, res, next) => {
  if (req.path === '/health' || req.path === '/api/health') return next();
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 2000 || res.statusCode >= 500) {
      console.warn(`[SLOW/ERR] ${req.method} ${req.path} ${res.statusCode} ${duration}ms [${req.id}]`);
    }
  });
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,  // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,
  // Skip rate limiting for health check endpoint
  skip: (req) => req.path === '/health',
});
app.use('/api/', limiter);

// Stricter rate limiting for auth endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 attempts per 15 min
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by IP + email to prevent distributed brute-force
    const email = req.body?.email || '';
    return `${req.ip}:${email}`;
  },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (config.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check — I17: Verify backing stores for production readiness
app.get('/health', async (req, res) => {
  const checks = { server: 'ok' };
  let overallStatus = 'ok';

  // Check Supabase (PostgreSQL)
  try {
    const { supabaseAdmin } = require('./config/supabase');
    const { error } = await supabaseAdmin.from('users').select('id').limit(1);
    checks.supabase = error ? 'degraded' : 'ok';
  } catch {
    checks.supabase = 'down';
    overallStatus = 'degraded';
  }

  // Check Redis
  try {
    const { cacheGet, cacheSet } = require('./config/redis');
    await cacheSet('health:ping', 'pong', 10);
    const val = await cacheGet('health:ping');
    checks.redis = val === 'pong' ? 'ok' : 'degraded';
  } catch {
    checks.redis = 'down';
    // Redis is optional, don't degrade overall
  }

  // Check MongoDB
  try {
    const mongoose = require('mongoose');
    checks.mongodb = mongoose.connection.readyState === 1 ? 'ok' : 'disconnected';
  } catch {
    checks.mongodb = 'unknown';
  }

  // Check MinIO (uploads dependency)
  try {
    const { isStorageAvailable } = require('./config/minio');
    checks.minio = isStorageAvailable() ? 'ok' : 'down';
  } catch {
    checks.minio = 'unknown';
  }

  const statusCode = overallStatus === 'ok' ? 200 : 503;
  res.status(statusCode).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    environment: config.env,
    uptime: process.uptime(),
    checks,
  });
});

// API info
app.get('/api', (req, res) => {
  res.json({
    name: 'Swastik Healthcare API',
    version: '1.0.0',
    description: 'Complete healthcare platform for patients and doctors',
    documentation: '/api/docs',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/ambulances', ambulanceRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/chatbot', chatbotRoutes);

app.use('/api/feature-toggles', featureToggleRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/hospital-manager', hospitalManagerRoutes);
app.use('/api/clinics', clinicRoutes);
app.use('/api/diagnostic-centers', diagnosticCenterRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/health-card', healthCardRoutes);
app.use('/api/vitals', vitalsRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Initialize services and start server
const startServer = async () => {
  try {
    // Initialize MongoDB (optional - continues if fails)
    await connectMongoDB();

    // Initialize Redis (optional - continues if fails)
    await connectRedis();

    // Initialize async notification dispatch queue (falls back to direct send if unavailable)
    await initializeNotificationQueue();

    // Initialize MinIO bucket
    await initializeBucket();

    // Recover any broadcasts stuck from a previous server restart
    try {
      const dispatchService = require('./services/dispatchService');
      await dispatchService.recoverBroadcasts();
    } catch (err) {
      console.warn('⚠️  Broadcast recovery failed (non-fatal):', err.message);
    }

    // Start server
    const PORT = config.port;
    server.listen(PORT, () => {
      // Start consultation timeout cron
      startConsultationTimeoutCron();
      // Start patient reminder notification cron
      startReminderNotificationCron();
      console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   🏥 SWASTIK Healthcare API Server                               ║
║                                                                  ║
║   Environment: ${config.env.padEnd(47)}║
║   Port: ${PORT.toString().padEnd(55)}║
║   URL: http://localhost:${PORT.toString().padEnd(42)}║
║                                                                  ║
║   📡 API Endpoints:                                              ║
║   ├─ Auth:          POST /api/auth/login, /register              ║
║   ├─ Patients:      GET  /api/patients/profile, /dashboard       ║
║   ├─ Doctors:       GET  /api/doctors, /api/doctors/:id          ║
║   ├─ Appointments:  POST /api/appointments                       ║
║   ├─ Consultations: POST /api/consultations/:id/start            ║
║   ├─ Hospitals:     GET  /api/hospitals/nearby                   ║
║   ├─ Ambulances:    POST /api/ambulances/request (SOS)           ║
║   ├─ Medicines:     GET  /api/medicines/search                   ║
║   ├─ Chatbot:       POST /api/chatbot/message                    ║
║   ├─ Reports:       GET  /api/reports                            ║
║   └─ Notifications: GET  /api/notifications                      ║
║                                                                  ║
║   🔌 WebSocket Events:                                           ║
║   ├─ ambulance:track      - Track ambulance location             ║
║   ├─ ambulance:location   - Update ambulance location            ║
║   ├─ video:join           - Join video consultation              ║
║   ├─ video:offer/answer   - WebRTC signaling                     ║
║   └─ chat:message         - In-consultation chat                 ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// I19: Consultation timeout cron — mark stale 'in_progress' consultations as 'timed_out'
let consultationTimeoutInterval;
let reminderNotificationInterval;
const startConsultationTimeoutCron = () => {
  consultationTimeoutInterval = setInterval(async () => {
    try {
      const { supabaseAdmin } = require('./config/supabase');
      const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours
      const { data, error } = await supabaseAdmin
        .from('consultations')
        .update({ status: 'timed_out', ended_at: new Date().toISOString() })
        .eq('status', 'in_progress')
        .lt('started_at', cutoff)
        .select('id');

      if (!error && data?.length > 0) {
        console.log(`[Cron] Timed out ${data.length} stale consultations`);
      }
    } catch (err) {
      console.error('[Cron] Consultation timeout error:', err.message);
    }
  }, 10 * 60 * 1000); // Every 10 minutes
};

const startReminderNotificationCron = () => {
  if (String(process.env.REMINDER_CRON_ENABLED || 'true').toLowerCase() === 'false') {
    console.log('[Cron] Reminder notification scheduler is disabled by REMINDER_CRON_ENABLED=false');
    return;
  }

  const intervalMs = Number(process.env.REMINDER_CRON_INTERVAL_MS || 60 * 1000);
  const lockTtlSec = Math.max(10, Math.ceil(intervalMs / 1000) - 2);

  reminderNotificationInterval = setInterval(async () => {
    try {
      // Multi-instance safety: only one instance should run reminder scan per interval.
      const { cacheSetIfNotExists } = require('./config/redis');
      const lockAcquired = await cacheSetIfNotExists('cron:reminder:lock', process.pid, lockTtlSec);
      if (!lockAcquired) return;

      const reminderNotificationService = require('./services/reminderNotificationService');
      await reminderNotificationService.runReminderNotificationTick();
    } catch (err) {
      console.error('[Cron] Reminder notification error:', err.message);
    }
  }, intervalMs);
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  // Clear cron interval to prevent stale timers
  if (consultationTimeoutInterval) clearInterval(consultationTimeoutInterval);
  if (reminderNotificationInterval) clearInterval(reminderNotificationInterval);
  server.close(() => {
    process.exit(1);
  });
  // Force kill after 15 seconds if server.close() hangs
  setTimeout(() => {
    console.error('Forced shutdown after unhandled rejection timeout');
    process.exit(1);
  }, 15000);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// I18: Graceful shutdown — close all connections cleanly
const gracefulShutdown = async (signal) => {
  console.log(`${signal} received. Shutting down gracefully...`);

  // Stop accepting new connections
  server.close(async () => {
    try {
      // Stop cron
      if (consultationTimeoutInterval) clearInterval(consultationTimeoutInterval);
      if (reminderNotificationInterval) clearInterval(reminderNotificationInterval);

      // Close Socket.IO
      if (io) {
        io.close();
        console.log('✅ Socket.IO closed');
      }

      // Close notification queue worker/producer
      await shutdownNotificationQueue();

      // Close distributed event bus clients
      await eventEmitter.shutdown();

      // Close MongoDB
      try {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState === 1) {
          await mongoose.connection.close();
          console.log('✅ MongoDB closed');
        }
      } catch { /* ignore */ }

      console.log('Process terminated.');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  });

  // Force kill after 15 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 15000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the server
startServer();

module.exports = { app, server, io };
