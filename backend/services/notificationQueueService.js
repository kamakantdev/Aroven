/**
 * Notification Queue Service
 *
 * Uses BullMQ for scalable async dispatch. Falls back to direct send when:
 *  - queue is disabled,
 *  - Redis TCP URL is missing,
 *  - BullMQ is unavailable,
 *  - worker/queue is not initialized.
 */
const config = require('../config');

let queue = null;
let worker = null;
let queueReady = false;
let queueConnection = null;
let workerConnection = null;

const isQueueEnabled = () => String(process.env.NOTIFICATION_QUEUE_ENABLED || 'true').toLowerCase() !== 'false';

const getDeterministicJobId = (userId, notification) => {
  const key = notification?.data?.idempotencyKey;
  if (!key) return null;
  return `notif:${userId}:${notification.type || 'info'}:${key}`;
};

const initializeNotificationQueue = async () => {
  if (queueReady || queue) return true;
  if (!isQueueEnabled()) {
    console.log('[Queue] Notification queue disabled by NOTIFICATION_QUEUE_ENABLED=false');
    return false;
  }

  if (!config.redis.ioredisUrl) {
    console.warn('[Queue] Redis TCP URL not configured; notification queue disabled (using direct send)');
    return false;
  }

  let bullmq;
  try {
    bullmq = require('bullmq');
  } catch (err) {
    console.warn('[Queue] BullMQ not installed; notification queue disabled (using direct send):', err.message);
    return false;
  }

  const rawQueueName = process.env.NOTIFICATION_QUEUE_NAME || 'swastik_notifications';
  const queueName = String(rawQueueName).replace(/:/g, '_');
  if (queueName !== rawQueueName) {
    console.warn(`[Queue] NOTIFICATION_QUEUE_NAME contains ':'. Using sanitized name: ${queueName}`);
  }
  const concurrency = Math.max(1, Number(process.env.NOTIFICATION_QUEUE_CONCURRENCY || 10));
  const Redis = require('ioredis');
  queueConnection = new Redis(config.redis.ioredisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  workerConnection = queueConnection.duplicate();

  queue = new bullmq.Queue(queueName, {
    connection: queueConnection,
    defaultJobOptions: {
      removeOnComplete: 500,
      removeOnFail: 1000,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    },
  });

  worker = new bullmq.Worker(
    queueName,
    async (job) => {
      const notificationService = require('./notificationService');
      await notificationService.sendNotification(job.data.userId, job.data.notification);
      return { ok: true, jobId: job.id };
    },
    {
      connection: workerConnection,
      concurrency,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`[Queue] Notification job failed (${job?.id}):`, err?.message || err);
  });

  worker.on('error', (err) => {
    console.error('[Queue] Notification worker error:', err?.message || err);
  });

  queueReady = true;
  console.log(`[Queue] Notification queue initialized (${queueName}, concurrency=${concurrency})`);
  return true;
};

const enqueueNotification = async (userId, notification, opts = {}) => {
  const notificationService = require('./notificationService');

  if (!userId || !notification) {
    throw new Error('enqueueNotification requires userId and notification');
  }

  if (!queueReady || !queue || opts.forceDirect === true) {
    return notificationService.sendNotification(userId, notification);
  }

  const jobId = getDeterministicJobId(userId, notification);
  const delayMs = Math.max(0, Number(opts.delayMs || 0));

  await queue.add(
    'send',
    {
      userId,
      notification,
      enqueuedAt: new Date().toISOString(),
    },
    {
      jobId: jobId || undefined,
      delay: delayMs,
    }
  );

  return { queued: true, jobId: jobId || null };
};

const shutdownNotificationQueue = async () => {
  try {
    if (worker) {
      await worker.close();
      worker = null;
    }
    if (queue) {
      await queue.close();
      queue = null;
    }
    if (workerConnection) {
      await workerConnection.quit().catch(() => {});
      workerConnection = null;
    }
    if (queueConnection) {
      await queueConnection.quit().catch(() => {});
      queueConnection = null;
    }
    queueReady = false;
  } catch (err) {
    console.warn('[Queue] Notification queue shutdown warning:', err?.message || err);
  }
};

module.exports = {
  initializeNotificationQueue,
  enqueueNotification,
  shutdownNotificationQueue,
};
