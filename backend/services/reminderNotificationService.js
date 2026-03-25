/**
 * Reminder Notification Service
 * Sends scheduled reminders and proactive care notifications.
 */
const { supabaseAdmin } = require('../config/supabase');
const { cacheGet, cacheSet, cacheDel, cacheSetIfNotExists } = require('../config/redis');
const { enqueueNotification } = require('./notificationQueueService');

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const pad2 = (n) => String(n).padStart(2, '0');
const DEFAULT_TIMEZONE = process.env.REMINDER_DEFAULT_TIMEZONE || 'Asia/Kolkata';
const dateKey = (d) => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
const minuteKey = (d) => `${pad2(d.getHours())}${pad2(d.getMinutes())}`;
const isoDateLocal = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const datePlusDays = (d, days) => {
  const v = new Date(d);
  v.setHours(0, 0, 0, 0);
  v.setDate(v.getDate() + days);
  return isoDateLocal(v);
};

const parseHmToMinutes = (input) => {
  if (!input || typeof input !== 'string') return null;
  const value = input.trim().toLowerCase();

  // HH:mm / HH:mm:ss (24-hour)
  let m = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m) {
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return h * 60 + min;
  }

  // h:mm am/pm
  m = value.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ap = m[3];
    if (h < 1 || h > 12 || min < 0 || min > 59) return null;
    if (ap === 'pm' && h !== 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    return h * 60 + min;
  }

  return null;
};

const parseAppointmentStartMinutes = (timeSlot) => {
  if (!timeSlot || typeof timeSlot !== 'string') return null;
  const firstPart = timeSlot.split('-')[0].trim();
  return parseHmToMinutes(firstPart);
};

const isReminderEnabledToday = (days, now) => {
  if (!Array.isArray(days) || days.length === 0) return true;
  const normalized = days.map(d => String(d || '').trim().toLowerCase());
  const dayToken = WEEKDAY_KEYS[now.getDay()];
  const fullDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  return normalized.includes(dayToken) || normalized.includes(fullDay);
};

const getNowContextForTimezone = (now, timeZone = DEFAULT_TIMEZONE) => {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
    });
    const parts = formatter.formatToParts(now).reduce((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});

    const year = parseInt(parts.year, 10);
    const month = parseInt(parts.month, 10);
    const day = parseInt(parts.day, 10);
    const hour = parseInt(parts.hour, 10);
    const minute = parseInt(parts.minute, 10);
    const weekdayShort = String(parts.weekday || '').toLowerCase().slice(0, 3);

    const isoDate = `${year}-${pad2(month)}-${pad2(day)}`;
    return {
      timeZone,
      year,
      month,
      day,
      hour,
      minute,
      weekdayShort,
      minuteOfDay: hour * 60 + minute,
      isoDate,
      yyyymmdd: `${year}${pad2(month)}${pad2(day)}`,
      hhmm: `${pad2(hour)}${pad2(minute)}`,
    };
  } catch {
    // Fallback to server local time if timezone is invalid
    return {
      timeZone: DEFAULT_TIMEZONE,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: now.getHours(),
      minute: now.getMinutes(),
      weekdayShort: WEEKDAY_KEYS[now.getDay()],
      minuteOfDay: now.getHours() * 60 + now.getMinutes(),
      isoDate: isoDateLocal(now),
      yyyymmdd: dateKey(now),
      hhmm: minuteKey(now),
    };
  }
};

const getDateInTimezone = (now, timeZone = DEFAULT_TIMEZONE, plusDays = 0) => {
  const shifted = new Date(now.getTime() + plusDays * 24 * 60 * 60 * 1000);
  return getNowContextForTimezone(shifted, timeZone).isoDate;
};

const isReminderEnabledForContext = (days, ctx) => {
  if (!Array.isArray(days) || days.length === 0) return true;
  const normalized = days.map((d) => String(d || '').trim().toLowerCase());
  return normalized.includes(ctx.weekdayShort);
};

const loadUserTimezoneMap = async (userIds = []) => {
  const uniqueIds = Array.from(new Set((userIds || []).filter(Boolean)));
  const map = new Map();
  for (const uid of uniqueIds) map.set(uid, DEFAULT_TIMEZONE);
  if (uniqueIds.length === 0) return map;

  try {
    const { data } = await supabaseAdmin
      .from('users')
      .select('id, timezone')
      .in('id', uniqueIds);

    for (const row of data || []) {
      map.set(row.id, row.timezone || DEFAULT_TIMEZONE);
    }
  } catch {
    // Column may not be deployed yet; keep default timezone
  }
  return map;
};

const shouldSendOnce = async (cacheId, ttlSeconds = 3 * 60 * 60) => {
  const locked = await cacheSetIfNotExists(cacheId, '1', ttlSeconds);
  if (locked) return true;

  // Redis missing/down: fallback to non-atomic best effort path
  const exists = await cacheGet(cacheId);
  if (exists) return false;
  await cacheSet(cacheId, '1', ttlSeconds);
  return true;
};

const loadActionLogForDate = async (userId, yyyymmdd) => {
  let actions = await cacheGet(`reminder:actions:${userId}:${yyyymmdd}`);
  if (!Array.isArray(actions)) {
    try {
      actions = typeof actions === 'string' ? JSON.parse(actions) : [];
    } catch {
      actions = [];
    }
  }
  if ((actions || []).length > 0) return actions;

  // Redis fallback: read persisted reminder actions from DB if available
  try {
    const start = `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}T00:00:00.000Z`;
    const end = `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}T23:59:59.999Z`;
    const { data } = await supabaseAdmin
      .from('reminder_actions')
      .select('reminder_id, action, scheduled_at, acted_at, snooze_until')
      .eq('user_id', userId)
      .gte('scheduled_at', start)
      .lte('scheduled_at', end)
      .limit(2000);

    return (data || []).map((r) => ({
      reminderId: r.reminder_id,
      action: r.action,
      scheduledAt: r.scheduled_at,
      actedAt: r.acted_at,
      snoozeUntil: r.snooze_until,
    }));
  } catch {
    return actions || [];
  }
};

const getActiveSnoozeFallback = async (userId, reminderId, now) => {
  try {
    const { data } = await supabaseAdmin
      .from('reminder_actions')
      .select('action, snooze_until, acted_at')
      .eq('user_id', userId)
      .eq('reminder_id', reminderId)
      .order('acted_at', { ascending: false })
      .limit(3);

    const latest = (data || [])[0];
    if (!latest) return null;
    if (latest.action !== 'snooze') return null;
    if (!latest.snooze_until) return null;
    const until = new Date(latest.snooze_until);
    if (Number.isNaN(until.getTime())) return null;
    return until >= now ? latest.snooze_until : null;
  } catch {
    return null;
  }
};

const hasActionForReminder = (actions, reminderId, accepted = ['taken', 'skip']) => {
  return (actions || []).some(a => a?.reminderId === reminderId && accepted.includes(a?.action));
};

const resolveReminderNotificationPayload = (row) => {
  const type = String(row?.type || 'medicine').toLowerCase();

  if (type === 'test') {
    return {
      title: '🧪 Health Task Reminder',
      message: row.title ? `Time for: ${row.title}` : 'It is time for your scheduled health task.',
      type: 'health_task_reminder',
    };
  }

  if (type === 'appointment') {
    return {
      title: '📌 Care Reminder',
      message: row.title ? `Reminder: ${row.title}` : 'You have an upcoming care task.',
      type: 'care_plan_reminder',
    };
  }

  return {
    title: '💊 Medicine Reminder',
    message: row.title ? `Time to take: ${row.title}` : 'It is time to take your medicine.',
    type: 'medicine_reminder',
  };
};

const sendDueMedicineReminders = async (now) => {
  const { data: rows, error } = await supabaseAdmin
    .from('reminders')
    .select('id, patient_id, title, type, time, days, is_active, patients!inner(user_id, name)')
    .eq('is_active', true);

  if (error) throw error;

  const tzMap = await loadUserTimezoneMap((rows || []).map((r) => r?.patients?.user_id));

  for (const row of rows || []) {
    const userId = row?.patients?.user_id;
    if (!userId) continue;
    const nowCtx = getNowContextForTimezone(now, tzMap.get(userId) || DEFAULT_TIMEZONE);
    const currentMinute = nowCtx.minuteOfDay;

    // 1) Snoozed one-off reminders (highest priority)
    const snoozeKey = `reminder:snooze:${userId}:${row.id}`;
    const snoozeData = await cacheGet(snoozeKey);
    const fallbackSnoozeUntil = await getActiveSnoozeFallback(userId, row.id, now);
    const snoozeUntilRaw = snoozeData?.snoozeUntil || fallbackSnoozeUntil;
    const snoozeUntil = snoozeUntilRaw ? new Date(snoozeUntilRaw) : null;
    if (snoozeUntil && !Number.isNaN(snoozeUntil.getTime())) {
      const snoozeCtx = getNowContextForTimezone(snoozeUntil, nowCtx.timeZone);
      if (snoozeCtx.yyyymmdd === nowCtx.yyyymmdd && snoozeCtx.minuteOfDay === currentMinute) {
        const dedupeSnooze = `notif:reminder:snooze:${row.id}:${snoozeCtx.yyyymmdd}:${snoozeCtx.hhmm}`;
        if (await shouldSendOnce(dedupeSnooze)) {
          await enqueueNotification(userId, {
            title: '⏰ Snoozed Medicine Reminder',
            message: row.title ? `Snoozed alert: ${row.title}` : 'Your snoozed medicine reminder is due now.',
            type: 'medicine_reminder',
            data: {
              idempotencyKey: dedupeSnooze,
              reminderId: row.id,
              patientId: row.patient_id,
              snoozed: true,
              scheduledTime: row.time,
            },
          });
        }
        await cacheDel(snoozeKey);
      }
    }

    if (!isReminderEnabledForContext(row.days, nowCtx)) continue;

    const reminderMinute = parseHmToMinutes(row.time);
    if (reminderMinute == null || reminderMinute !== currentMinute) continue;

    // If user already marked this reminder as taken/skip today, don't notify again
    const actions = await loadActionLogForDate(userId, nowCtx.yyyymmdd);
    if (hasActionForReminder(actions, row.id, ['taken', 'skip'])) continue;

    const dedupeKey = `notif:reminder:${row.id}:${nowCtx.yyyymmdd}:${nowCtx.hhmm}`;
    if (!(await shouldSendOnce(dedupeKey))) continue;

    const payload = resolveReminderNotificationPayload(row);
    await enqueueNotification(userId, {
      title: payload.title,
      message: payload.message,
      type: payload.type,
      data: {
        idempotencyKey: dedupeKey,
        reminderId: row.id,
        reminderType: row.type || 'medicine',
        patientId: row.patient_id,
        scheduledTime: row.time,
      },
    });
  }
};

const sendMissedDoseReminders = async (now) => {
  const { data: rows, error } = await supabaseAdmin
    .from('reminders')
    .select('id, patient_id, title, type, time, days, is_active, patients!inner(user_id)')
    .eq('is_active', true)
    .eq('type', 'medicine');

  if (error) throw error;

  const tzMap = await loadUserTimezoneMap((rows || []).map((r) => r?.patients?.user_id));

  for (const row of rows || []) {
    const userId = row?.patients?.user_id;
    if (!userId) continue;
    const nowCtx = getNowContextForTimezone(now, tzMap.get(userId) || DEFAULT_TIMEZONE);
    const todayKey = nowCtx.yyyymmdd;
    if (!isReminderEnabledForContext(row.days, nowCtx)) continue;

    const reminderMinute = parseHmToMinutes(row.time);
    if (reminderMinute == null) continue;

    const missedMinute = reminderMinute + 30; // 30-minute grace window
    if (missedMinute > 23 * 60 + 59 || nowCtx.minuteOfDay !== missedMinute) continue;

    const snoozeData = await cacheGet(`reminder:snooze:${userId}:${row.id}`);
    if (snoozeData?.snoozeUntil) continue;

    const actions = await loadActionLogForDate(userId, todayKey);
    if (hasActionForReminder(actions, row.id, ['taken', 'skip', 'snooze'])) continue;

    const dedupeKey = `notif:reminder:missed:${row.id}:${todayKey}:${pad2(reminderMinute)}`;
    if (!(await shouldSendOnce(dedupeKey, 8 * 60 * 60))) continue;

    await enqueueNotification(userId, {
      title: '⚠️ Dose Missed',
      message: row.title
        ? `You may have missed: ${row.title}. Mark as taken or snooze.`
        : 'You may have missed a scheduled medicine dose.',
      type: 'medicine_missed',
      data: {
        idempotencyKey: dedupeKey,
        reminderId: row.id,
        patientId: row.patient_id,
        scheduledTime: row.time,
        graceMinutes: 30,
      },
    });
  }
};

const sendUpcomingAppointmentReminders = async (now) => {
  const serverToday = now.toISOString().slice(0, 10);
  const serverTomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: appointments, error } = await supabaseAdmin
    .from('appointments')
    .select(`
      id,
      appointment_date,
      time_slot,
      status,
      type,
      patient_id,
      doctor:doctors(name, specialization),
      patient:patients!inner(user_id, name)
    `)
    .in('status', ['scheduled', 'confirmed'])
    .in('appointment_date', [serverToday, serverTomorrow]);

  if (error) throw error;

  const tzMap = await loadUserTimezoneMap((appointments || []).map((a) => a?.patient?.user_id));

  for (const appt of appointments || []) {
    const patientUserId = appt?.patient?.user_id;
    if (!patientUserId) continue;
    const nowCtx = getNowContextForTimezone(now, tzMap.get(patientUserId) || DEFAULT_TIMEZONE);
    const today = nowCtx.isoDate;
    const nowMinutes = nowCtx.minuteOfDay;

    const startMin = parseAppointmentStartMinutes(appt.time_slot);
    if (startMin == null) continue;

    const isToday = appt.appointment_date === today;
    const oneHourBefore = startMin - 60;

    // 60-minute prior reminder (today only)
    if (isToday && oneHourBefore >= 0 && nowMinutes === oneHourBefore) {
      const key60 = `notif:appt:${appt.id}:${dateKey(now)}:60`;
      if (await shouldSendOnce(key60, 6 * 60 * 60)) {
        await enqueueNotification(patientUserId, {
          title: '📅 Consultation in 1 hour',
          message: `Your consultation${appt.doctor?.name ? ` with Dr. ${appt.doctor.name}` : ''} starts at ${appt.time_slot}.`,
          type: 'appointment_reminder',
          data: { idempotencyKey: key60, appointmentId: appt.id, stage: 'one_hour' },
        });
      }
    }

    // At-start reminder (today only)
    if (isToday && nowMinutes === startMin) {
      const keyStart = `notif:appt:${appt.id}:${dateKey(now)}:start`;
      if (await shouldSendOnce(keyStart, 6 * 60 * 60)) {
        await enqueueNotification(patientUserId, {
          title: '🩺 Consultation time now',
          message: `Your consultation${appt.doctor?.name ? ` with Dr. ${appt.doctor.name}` : ''} is starting now.`,
          type: 'appointment_reminder',
          data: { idempotencyKey: keyStart, appointmentId: appt.id, stage: 'start_now' },
        });
      }
    }
  }
};

const sendPrescriptionExpiryReminders = async (now) => {
  const in1 = datePlusDays(now, 1);
  const in3 = datePlusDays(now, 3);
  const in7 = datePlusDays(now, 7);
  const targets = [in1, in3, in7];

  const { data: rows, error } = await supabaseAdmin
    .from('prescriptions')
    .select('id, prescription_number, valid_until, status, patient:patients!inner(user_id, name)')
    .in('valid_until', targets);

  if (error) throw error;

  for (const rx of rows || []) {
    const userId = rx?.patient?.user_id;
    if (!userId || !rx?.valid_until) continue;
    if (['expired', 'cancelled'].includes(String(rx.status || '').toLowerCase())) continue;

    const daysLeft = rx.valid_until === in1 ? 1 : rx.valid_until === in3 ? 3 : 7;
    const dedupeKey = `notif:rx:expiry:${rx.id}:${rx.valid_until}:${daysLeft}`;
    if (!(await shouldSendOnce(dedupeKey, 48 * 60 * 60))) continue;

    await enqueueNotification(userId, {
      title: '💊 Prescription Expiry Reminder',
      message: `Your prescription${rx.prescription_number ? ` (${rx.prescription_number})` : ''} expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}.`,
      type: 'prescription_expiry_reminder',
      data: {
        idempotencyKey: dedupeKey,
        prescriptionId: rx.id,
        prescriptionNumber: rx.prescription_number,
        validUntil: rx.valid_until,
        daysLeft,
      },
    });
  }
};

const sendFollowUpVisitReminders = async (now) => {
  const hhmm = minuteKey(now);
  const today = isoDateLocal(now);
  const tomorrow = datePlusDays(now, 1);

  // day-before reminder at 09:00, same-day reminder at 08:00
  let targetDate = null;
  let stage = null;
  if (hhmm === '0900') {
    targetDate = tomorrow;
    stage = 'day_before';
  } else if (hhmm === '0800') {
    targetDate = today;
    stage = 'same_day';
  }
  if (!targetDate) return;

  const { data: rows, error } = await supabaseAdmin
    .from('prescriptions')
    .select('id, follow_up_date, prescription_number, patient:patients!inner(user_id, name)')
    .eq('follow_up_date', targetDate);

  if (error) throw error;

  for (const rx of rows || []) {
    const userId = rx?.patient?.user_id;
    if (!userId) continue;

    const dedupeKey = `notif:followup:${rx.id}:${targetDate}:${stage}`;
    if (!(await shouldSendOnce(dedupeKey, 48 * 60 * 60))) continue;

    await enqueueNotification(userId, {
      title: '📅 Follow-up Consultation Reminder',
      message: stage === 'day_before'
        ? `You have a follow-up consultation tomorrow (${targetDate}).`
        : 'Your follow-up consultation is due today.',
      type: 'follow_up_reminder',
      data: {
        idempotencyKey: dedupeKey,
        prescriptionId: rx.id,
        prescriptionNumber: rx.prescription_number,
        followUpDate: targetDate,
        stage,
      },
    });
  }
};

const sendDiagnosticTestReminders = async (now) => {
  const hhmm = minuteKey(now);
  const today = isoDateLocal(now);
  const tomorrow = datePlusDays(now, 1);

  // day-before reminder at 18:00, same-day reminder at 07:00
  let targetDate = null;
  let stage = null;
  if (hhmm === '1800') {
    targetDate = tomorrow;
    stage = 'day_before';
  } else if (hhmm === '0700') {
    targetDate = today;
    stage = 'same_day';
  }
  if (!targetDate) return;

  const { data: rows, error } = await supabaseAdmin
    .from('diagnostic_bookings')
    .select(`
      id,
      booking_date,
      booking_time,
      status,
      test_name,
      center:diagnostic_centers(name),
      patient:patients!inner(user_id)
    `)
    .eq('booking_date', targetDate)
    .in('status', ['booked', 'confirmed']);

  if (error) throw error;

  for (const row of rows || []) {
    const userId = row?.patient?.user_id;
    if (!userId) continue;

    const dedupeKey = `notif:diag:${row.id}:${targetDate}:${stage}`;
    if (!(await shouldSendOnce(dedupeKey, 48 * 60 * 60))) continue;

    await enqueueNotification(userId, {
      title: '🧪 Diagnostic Test Reminder',
      message: stage === 'day_before'
        ? `Your diagnostic test${row.test_name ? ` (${row.test_name})` : ''} is scheduled tomorrow${row.booking_time ? ` at ${row.booking_time}` : ''}.`
        : `Your diagnostic test${row.test_name ? ` (${row.test_name})` : ''} is scheduled today${row.booking_time ? ` at ${row.booking_time}` : ''}.`,
      type: 'diagnostic_test_reminder',
      data: {
        idempotencyKey: dedupeKey,
        bookingId: row.id,
        bookingDate: row.booking_date,
        bookingTime: row.booking_time,
        testName: row.test_name,
        centerName: row?.center?.name,
        stage,
      },
    });
  }
};

const sendUnreadReportReviewReminders = async (now) => {
  // Run every day at 10:00 to avoid noisy hourly reminders
  if (minuteKey(now) !== '1000') return;

  const thresholdIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from('notifications')
    .select('id, user_id, created_at, type, is_read, data')
    .eq('type', 'diagnostic_result')
    .eq('is_read', false)
    .lte('created_at', thresholdIso)
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) throw error;

  for (const row of rows || []) {
    if (!row?.user_id) continue;

    const dedupeKey = `notif:report:review:${row.id}:${isoDateLocal(now)}`;
    if (!(await shouldSendOnce(dedupeKey, 48 * 60 * 60))) continue;

    await enqueueNotification(row.user_id, {
      title: '📄 Review Your Test Report',
      message: 'You have an unread diagnostic report. Please review it and consult your doctor if needed.',
      type: 'report_review_reminder',
      data: {
        idempotencyKey: dedupeKey,
        sourceNotificationId: row.id,
        sourceType: row.type,
        sourceCreatedAt: row.created_at,
      },
    });
  }
};

const runReminderNotificationTick = async (referenceNow = new Date()) => {
  const now = referenceNow instanceof Date ? referenceNow : new Date(referenceNow);
  await sendDueMedicineReminders(now);
  await sendMissedDoseReminders(now);
  await sendUpcomingAppointmentReminders(now);
  await sendPrescriptionExpiryReminders(now);
  await sendFollowUpVisitReminders(now);
  await sendDiagnosticTestReminders(now);
  await sendUnreadReportReviewReminders(now);
};

module.exports = {
  runReminderNotificationTick,
};
