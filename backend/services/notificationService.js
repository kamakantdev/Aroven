/**
 * Notification Service
 * User notifications, push notifications, device registration, email fallback
 */
const { supabaseAdmin } = require('../config/supabase');
const config = require('../config');
const crypto = require('crypto');

// ==================== Email Fallback ====================
const { sendNotificationEmail } = require('./emailService');

// Critical notification types that warrant email fallback
const EMAIL_CRITICAL_TYPES = [
  'appointment_confirmed',
  'appointment_cancelled',
  'appointment_reminder',
  'follow_up_reminder',
  'sos_update',
  'sos_accepted',
  'prescription_ready',
  'prescription_expiry_reminder',
  'medicine_missed',
  'emergency',
  'consultation_started',
];

/**
 * Send email notification as fallback when push notification fails or user has no FCM token.
 * Only sends for critical notification types.
 */
const sendEmailFallback = async (userId, notification) => {
  try {
    // Only send email for critical types
    if (!EMAIL_CRITICAL_TYPES.includes(notification.type)) return;

    // Look up user's email and name
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email, name')
      .eq('id', userId)
      .single();

    if (!user?.email) return;

    await sendNotificationEmail(user.email, user.name, notification);
    console.log(`[EMAIL] Fallback sent to user ${userId} (${user.email})`);
  } catch (err) {
    console.error(`[EMAIL] Fallback failed for user ${userId}:`, err.message);
  }
};

// ==================== FCM Push Helper ====================
/**
 * Sends a Firebase Cloud Messaging push notification to a user.
 * Uses FCM HTTP v1 API via Google OAuth2 service account, or falls back
 * to legacy API. Gracefully no-ops if firebase-admin is not configured.
 */
let firebaseApp = null;
let firebaseInitFailed = false;

const loadFirebaseServiceAccount = () => {
  const fs = require('fs');
  const path = require('path');

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  const rawB64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

  if (!raw && !rawB64) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_BASE64 env var not set');
  }

  // Preferred: explicit base64 JSON (safe for env files and CI secrets)
  if (rawB64) {
    const decoded = Buffer.from(rawB64, 'base64').toString('utf8');
    return JSON.parse(decoded);
  }

  const value = String(raw || '').trim();

  // Backward-compatible: inline JSON in FIREBASE_SERVICE_ACCOUNT
  if (value.startsWith('{')) {
    return JSON.parse(value);
  }

  // Default: filesystem path
  const resolvedPath = path.resolve(value);
  return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
};

const getFirebaseApp = () => {
  if (firebaseApp) return firebaseApp;
  if (firebaseInitFailed) return null;

  try {
    const admin = require('firebase-admin');
    const serviceAccount = loadFirebaseServiceAccount();
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('[FCM] Firebase Admin initialized successfully');
    return firebaseApp;
  } catch (err) {
    console.warn('[FCM] Firebase Admin init failed — push disabled:', err.message);
    firebaseInitFailed = true;
    return null;
  }
};

/**
 * Send push notification to a user via FCM if they have an fcm_token.
 * @param {string} userId - User ID to send push to
 * @param {Object} notification - { title, message, type, data }
 */
const sendPushNotification = async (userId, notification) => {
  try {
    const app = getFirebaseApp();
    if (!app) {
      // FCM not configured — try email for critical notifications
      await sendEmailFallback(userId, notification);
      return;
    }

    // Look up user's FCM token
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('fcm_token, device_type')
      .eq('id', userId)
      .single();

    if (!user?.fcm_token) {
      // No FCM token — try email for critical notifications
      await sendEmailFallback(userId, notification);
      return;
    }

    const admin = require('firebase-admin');
    const message = {
      token: user.fcm_token,
      notification: {
        title: notification.title,
        body: notification.message,
      },
      data: {
        type: notification.type || 'info',
        ...(notification.data ? Object.fromEntries(
          Object.entries(notification.data).map(([k, v]) => [k, String(v)])
        ) : {}),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'swastik_default',
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    await admin.messaging(app).send(message);
    console.log(`[FCM] Push sent to user ${userId}`);
  } catch (err) {
    // Token may be invalid/expired — clean up and try email
    if (err.code === 'messaging/registration-token-not-registered' ||
        err.code === 'messaging/invalid-registration-token') {
      console.warn(`[FCM] Invalid token for user ${userId}, cleaning up & sending email`);
      await supabaseAdmin
        .from('users')
        .update({ fcm_token: null })
        .eq('id', userId);
      // Fallback to email for critical notifications
      await sendEmailFallback(userId, notification);
    } else {
      console.error(`[FCM] Push failed for user ${userId}:`, err.message);
      // Also try email when push fails entirely
      await sendEmailFallback(userId, notification);
    }
  }
};

// Get user notifications (used by routes/notifications.js)
const getUserNotifications = async (userId, page = 1, limit = 20, unreadOnly = false) => {
  const offset = (page - 1) * limit;
  let query = supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', userId);

  if (unreadOnly) query = query.eq('is_read', false);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    notifications: data || [],
    pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
  };
};

// Get notifications (alias for routes/notification/index.js)
const getNotifications = async (userId, page = 1, limit = 20) => {
  return getUserNotifications(userId, page, limit, false);
};

// Get unread count
const getUnreadCount = async (userId) => {
  const { count, error } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
  return count || 0;
};

// Mark as read
const markAsRead = async (userId, notificationId) => {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return { message: 'Notification marked as read', data };
};

// Mark all as read
const markAllAsRead = async (userId) => {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
  return { message: 'All notifications marked as read' };
};

// Delete notification
const deleteNotification = async (userId, notificationId) => {
  const { error } = await supabaseAdmin
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) throw error;
  return { message: 'Notification deleted' };
};

// Clear all notifications
const clearAllNotifications = async (userId) => {
  const { error } = await supabaseAdmin
    .from('notifications')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
  return { message: 'All notifications cleared' };
};

// Register device for push notifications
const registerDevice = async (userId, fcmToken, deviceType) => {
  // Fix: Store deviceType alongside FCM token (was previously ignored)
  const updateFields = { fcm_token: fcmToken };
  if (deviceType) {
    updateFields.device_type = deviceType;
  }

  let { error } = await supabaseAdmin
    .from('users')
    .update(updateFields)
    .eq('id', userId);

  // Backward compatibility: some deployments may not have device_type column
  if (error && (error.code === '42703' || /device_type/i.test(error.message || ''))) {
    ({ error } = await supabaseAdmin
      .from('users')
      .update({ fcm_token: fcmToken })
      .eq('id', userId));
  }

  if (error) throw error;
  return { message: 'Device registered for push notifications' };
};

// Create notification (used internally by other services)
const uuidFromDeterministicKey = (key) => {
  const hex = crypto.createHash('sha1').update(String(key)).digest('hex').slice(0, 32);
  const raw = hex.split('');
  raw[12] = '5'; // version 5-like marker for deterministic key UUID
  raw[16] = ['8', '9', 'a', 'b'][parseInt(raw[16], 16) % 4];
  const normalized = raw.join('');
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20, 32)}`;
};

const createNotification = async (userId, notification) => {
  const payload = {
    user_id: userId,
    title: notification.title,
    message: notification.message,
    type: notification.type || 'info',
    data: notification.data || {},
    is_read: false,
  };

  const idempotencyKey = notification?.data?.idempotencyKey;

  if (!idempotencyKey) {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  const deterministicId = uuidFromDeterministicKey(`${userId}:${notification.type || 'info'}:${idempotencyKey}`);

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert({ ...payload, id: deterministicId })
    .select('*')
    .single();

  if (!error) return data;

  // Duplicate insert from parallel worker / retry — fetch existing record and return
  if (error?.code === '23505') {
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('id', deterministicId)
      .single();

    if (!fetchErr && existing) return existing;
  }

  throw error;
};

// Send notification — creates persistent DB record + emits via Socket.IO + FCM push
// This is the primary method other services should call.
const sendNotification = async (userId, notification) => {
  const data = await createNotification(userId, notification);

  // Also emit via Socket.IO for real-time delivery
  try {
    const eventEmitter = require('./eventEmitter');
    const io = eventEmitter.getIO();
    if (io) {
      io.to(`user:${userId}`).emit('notification:new', {
        id: data.id,
        type: notification.type || 'info',
        title: notification.title,
        message: notification.message,
        data: notification.data || {},
        timestamp: data.created_at,
      });
    }
  } catch {
    // Socket not available — notification is still persisted in DB
  }

  // Send FCM push notification (non-blocking)
  sendPushNotification(userId, notification).catch(() => {});

  return data;
};

module.exports = {
  getUserNotifications,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  registerDevice,
  createNotification,
  sendNotification,
  sendPushNotification,
  sendEmailFallback,
};
