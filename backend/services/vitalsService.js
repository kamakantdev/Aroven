/**
 * Vitals Service
 * Reads session-based CV vitals from Redis Streams (AI service) with fallback to consultation_vitals_log.
 * Stream key: telemedicine:vitals:{sessionId}
 */
const { getRedisClient } = require('../config/redis');
const { supabaseAdmin } = require('../config/supabase');
const consultationService = require('./consultationService');

const STREAM_PREFIX = 'telemedicine:vitals:';

function parseStreamEntry(entryOrPair) {
  let id, payloadStr;
  if (Array.isArray(entryOrPair) && entryOrPair.length >= 2) {
    const [eid, fields] = entryOrPair;
    if (!Array.isArray(fields)) return null;
    const idx = fields.indexOf('payload');
    if (idx === -1 || !fields[idx + 1]) return null;
    id = eid;
    payloadStr = fields[idx + 1];
  } else if (entryOrPair && typeof entryOrPair === 'object' && !Array.isArray(entryOrPair)) {
    const keys = Object.keys(entryOrPair);
    if (keys.length === 0) return null;
    id = keys[0];
    const obj = entryOrPair[id];
    payloadStr = obj?.payload ?? obj?.payload;
    if (payloadStr == null) return null;
  } else {
    return null;
  }
  try {
    const data = typeof payloadStr === 'string' ? JSON.parse(payloadStr) : payloadStr;
    return data && typeof data === 'object' ? { _stream_id: id, ...data } : null;
  } catch {
    return null;
  }
}

/**
 * Verify user has access to this consultation (sessionId = consultationId)
 */
async function verifySessionAccess(userId, role, sessionId) {
  await consultationService.getConsultation(userId, role, sessionId);
}

/**
 * Get latest vitals from Redis stream
 */
async function getLatest(sessionId) {
  const redis = getRedisClient();
  if (!redis) {
    return await getLatestFromDb(sessionId);
  }

  try {
    // XREVRANGE stream + - COUNT 1
    const entries = await redis.xrevrange(`${STREAM_PREFIX}${sessionId}`, '+', '-', { count: 1 });
    if (!entries || entries.length === 0) {
      return await getLatestFromDb(sessionId);
    }
    const parsed = parseStreamEntry(entries[0]);
    return parsed || (await getLatestFromDb(sessionId));
  } catch (err) {
    console.error('[VitalsService] Redis getLatest error:', err.message);
    return await getLatestFromDb(sessionId);
  }
}

/**
 * Get vitals history from Redis stream
 */
async function getHistory(sessionId, limit = 100) {
  const redis = getRedisClient();
  if (!redis) {
    return await getHistoryFromDb(sessionId, limit);
  }

  try {
    const entries = await redis.xrevrange(`${STREAM_PREFIX}${sessionId}`, '+', '-', { count: Math.min(limit, 500) });
    if (!entries || entries.length === 0) {
      return await getHistoryFromDb(sessionId, limit);
    }
    const parsed = entries.map(parseStreamEntry).filter(Boolean);
    return parsed.length > 0 ? parsed : await getHistoryFromDb(sessionId, limit);
  } catch (err) {
    console.error('[VitalsService] Redis getHistory error:', err.message);
    return await getHistoryFromDb(sessionId, limit);
  }
}

/**
 * Get alerts from vitals (messages that contain alerts)
 */
async function getAlerts(sessionId, limit = 50) {
  const history = await getHistory(sessionId, 200);
  const alerts = [];
  const seen = new Set();

  for (const entry of history) {
    const list = entry.alerts;
    if (!Array.isArray(list)) continue;
    for (const a of list) {
      const key = a.code || a.message || JSON.stringify(a);
      if (seen.has(key)) continue;
      seen.add(key);
      alerts.push({ ...a, _stream_id: entry._stream_id });
      if (alerts.length >= limit) return alerts;
    }
  }
  return alerts;
}

/**
 * Build a simple summary from vitals history
 */
async function getSummary(sessionId) {
  const history = await getHistory(sessionId, 100);
  if (history.length === 0) {
    return { message: 'No vitals data for this session', signalsActive: 0, alertCount: 0 };
  }

  const latest = history[0];
  const alerts = (latest.alerts || []);
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;

  const signals = [];
  if (latest.heart_rate != null) signals.push('heart_rate');
  if (latest.respiration_rate != null) signals.push('respiration');
  if (latest.spo2 != null) signals.push('spo2');
  if (latest.drowsiness_score != null) signals.push('drowsiness');
  if (latest.pain_score != null) signals.push('pain');
  if (latest.posture) signals.push('posture');
  if (latest.fall_detected != null) signals.push('fall');
  if (latest.tremor_detected != null) signals.push('tremor');
  if (latest.temperature != null) signals.push('temperature');
  if (latest.blood_pressure_systolic != null) signals.push('blood_pressure');

  return {
    sessionId,
    message: criticalCount > 0
      ? `${criticalCount} critical alert(s), ${warningCount} warning(s)`
      : warningCount > 0
        ? `${warningCount} warning(s) - continue monitoring`
        : 'Vitals within normal range',
    signalsActive: signals.length,
    alertCount: alerts.length,
    criticalCount,
    warningCount,
    latestTimestamp: latest.processed_at || latest._stream_id,
  };
}

/**
 * Fallback: get latest from consultation_vitals_log
 */
async function getLatestFromDb(sessionId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('consultation_vitals_log')
      .select('vitals_snapshot')
      .eq('consultation_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data?.vitals_snapshot) return null;
    const v = data.vitals_snapshot;
    return typeof v === 'object' ? v : (typeof v === 'string' ? JSON.parse(v) : null);
  } catch (err) {
    console.error('[VitalsService] getLatestFromDb error:', err.message);
    return null;
  }
}

/**
 * Fallback: get history from consultation_vitals_log
 */
async function getHistoryFromDb(sessionId, limit = 100) {
  try {
    const { data, error } = await supabaseAdmin
      .from('consultation_vitals_log')
      .select('vitals_snapshot, created_at')
      .eq('consultation_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data?.length) return [];
    return data.map(row => ({
      ...(typeof row.vitals_snapshot === 'object' ? row.vitals_snapshot : {}),
      processed_at: row.created_at,
    })).filter(Boolean);
  } catch (err) {
    console.error('[VitalsService] getHistoryFromDb error:', err.message);
    return [];
  }
}

module.exports = {
  verifySessionAccess,
  getLatest,
  getHistory,
  getAlerts,
  getSummary,
};
