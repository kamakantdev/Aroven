const { supabaseAdmin } = require('../config/supabase');
const { uploadProfileImage, deleteFile, getPresignedUrl } = require('../config/minio');
const { ApiError } = require('../middleware/errorHandler');
const { paginate, paginatedResponse } = require('../utils/helpers');
const { cacheGet, cacheSet, cacheDel } = require('../config/redis');

const VALID_GENDERS = ['male', 'female', 'other'];
const VALID_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

class PatientService {
  // Get patient profile
  async getProfile(userId) {
    const { data: patient, error } = await supabaseAdmin
      .from('patients')
      .select(`
        *,
        user:users(email, phone, is_verified, created_at)
      `)
      .eq('user_id', userId)
      .single();

    if (error || !patient) {
      throw new ApiError(404, 'Patient profile not found');
    }

    // Get additional data
    const [
      { data: emergencyContacts },
      { data: familyMembers },
      { count: appointmentCount },
      { count: reportCount }
    ] = await Promise.all([
      supabaseAdmin.from('emergency_contacts').select('*').eq('patient_id', patient.id),
      supabaseAdmin.from('family_members').select('*').eq('patient_id', patient.id),
      supabaseAdmin.from('appointments').select('*', { count: 'exact', head: true }).eq('patient_id', patient.id),
      supabaseAdmin.from('reports').select('*', { count: 'exact', head: true }).eq('patient_id', patient.id),
    ]);

    return {
      ...patient,
      // Flatten common user fields for mobile/web clients expecting top-level values
      email: patient.user?.email || patient.email || null,
      phone: patient.user?.phone || patient.phone || null,
      is_verified: patient.user?.is_verified ?? patient.is_verified ?? false,
      // Backward-compatible alias used by some clients
      location: patient.address || patient.location || null,
      emergencyContacts: emergencyContacts || [],
      familyMembers: familyMembers || [],
      stats: {
        appointments: appointmentCount || 0,
        reports: reportCount || 0,
      },
    };
  }

  // Update patient profile
  async updateProfile(userId, updateData) {
    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!patient) {
      throw new ApiError(404, 'Patient profile not found');
    }

    // Only include fields that are explicitly provided (not undefined)
    // Whitelist approach to prevent mass-assignment
    const updateFields = { updated_at: new Date().toISOString() };
    if (updateData.name !== undefined) updateFields.name = String(updateData.name).trim().slice(0, 100);
    if (updateData.age !== undefined) {
      const age = parseInt(updateData.age, 10);
      if (!isNaN(age) && age >= 0 && age <= 150) updateFields.age = age;
    }
    if (updateData.dateOfBirth !== undefined || updateData.date_of_birth !== undefined) {
      updateFields.date_of_birth = updateData.dateOfBirth || updateData.date_of_birth;
    }
    if (updateData.gender !== undefined) {
      if (VALID_GENDERS.includes(updateData.gender)) updateFields.gender = updateData.gender;
    }
    if (updateData.bloodGroup !== undefined) {
      if (VALID_BLOOD_GROUPS.includes(updateData.bloodGroup)) updateFields.blood_group = updateData.bloodGroup;
    }
    if (updateData.blood_group !== undefined) {
      if (VALID_BLOOD_GROUPS.includes(updateData.blood_group)) updateFields.blood_group = updateData.blood_group;
    }
    if (updateData.weight !== undefined) {
      const weight = parseFloat(updateData.weight);
      if (!isNaN(weight) && weight > 0 && weight < 500) updateFields.weight = weight;
    }
    if (updateData.height !== undefined) {
      const height = parseFloat(updateData.height);
      if (!isNaN(height) && height > 0 && height < 300) updateFields.height = height;
    }
    if (updateData.location !== undefined) updateFields.address = String(updateData.location).trim().slice(0, 200);
    if (updateData.address !== undefined) updateFields.address = String(updateData.address).trim().slice(0, 200);
    if (updateData.city !== undefined) updateFields.city = String(updateData.city).trim().slice(0, 100);
    if (updateData.state !== undefined) updateFields.state = String(updateData.state).trim().slice(0, 100);
    if (updateData.pincode !== undefined) updateFields.pincode = String(updateData.pincode).trim().slice(0, 10);
    if (updateData.abhaNumber !== undefined) updateFields.abha_number = String(updateData.abhaNumber).trim().slice(0, 50);

    const { error } = await supabaseAdmin
      .from('patients')
      .update(updateFields)
      .eq('id', patient.id)
      .select()
      .single();

    if (error) {
      throw new ApiError(400, 'Failed to update profile');
    }

    await cacheDel(`patient:dashboard:${userId}`);

    // Return normalized profile shape expected by clients
    return this.getProfile(userId);
  }

  // Upload profile image
  async uploadProfileImage(userId, file) {
    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id, profile_image_url')
      .eq('user_id', userId)
      .single();

    if (!patient) {
      throw new ApiError(404, 'Patient profile not found');
    }

    // Delete old image if exists
    if (patient.profile_image_url) {
      try {
        // Extract object path after the bucket name in the URL
        const urlParts = patient.profile_image_url.split('/');
        const bucketIndex = urlParts.findIndex(p => p === 'swastik-uploads' || p === 'swastik');
        const objectPath = bucketIndex >= 0 ? urlParts.slice(bucketIndex + 1).join('/') : urlParts.slice(-2).join('/');
        await deleteFile(objectPath);
      } catch (e) {
        console.log('Failed to delete old image:', e.message);
      }
    }

    // Upload new image
    const { url } = await uploadProfileImage(file, userId);

    // Update patient profile
    await supabaseAdmin
      .from('patients')
      .update({ profile_image_url: url })
      .eq('id', patient.id);

    await cacheDel(`patient:dashboard:${userId}`);

    return { url };
  }

  // Get dashboard data
  async getDashboard(userId) {
    // Check cache first (30s TTL — short enough for near-real-time, long enough to absorb reloads)
    const cacheKey = `patient:dashboard:${userId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id, name')
      .eq('user_id', userId)
      .single();

    if (!patient) {
      throw new ApiError(404, 'Patient profile not found');
    }

    // Run all independent queries in parallel (was sequential)
    const [appointmentsResult, remindersResult, consultationsResult, notificationsResult, statsResult] = await Promise.allSettled([
      supabaseAdmin
        .from('appointments')
        .select(`*, doctor:doctors(id, name, specialization, profile_image_url)`)
        .eq('patient_id', patient.id)
        .in('status', ['scheduled', 'confirmed'])
        .gte('appointment_date', new Date().toISOString().split('T')[0])
        .order('appointment_date', { ascending: true })
        .limit(5),
      supabaseAdmin
        .from('reminders')
        .select('*')
        .eq('patient_id', patient.id)
        .eq('is_active', true)
        .order('time', { ascending: true })
        .limit(10),
      supabaseAdmin
        .from('consultations')
        .select(`*, doctor:doctors(id, name, specialization)`)
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(10),
      // Parallel stats counts
      Promise.all([
        supabaseAdmin.from('consultations').select('*', { count: 'exact', head: true }).eq('patient_id', patient.id),
        supabaseAdmin.from('prescriptions').select('*', { count: 'exact', head: true }).eq('patient_id', patient.id),
        supabaseAdmin.from('reports').select('*', { count: 'exact', head: true }).eq('patient_id', patient.id),
      ]),
    ]);

    const upcomingAppointments = appointmentsResult.status === 'fulfilled' ? appointmentsResult.value.data || [] : [];
    const reminders = remindersResult.status === 'fulfilled' ? remindersResult.value.data || [] : [];
    const recentConsultations = consultationsResult.status === 'fulfilled' ? consultationsResult.value.data || [] : [];
    const notifications = notificationsResult.status === 'fulfilled' ? notificationsResult.value.data || [] : [];
    const unreadCount = notificationsResult.status === 'fulfilled' ? notificationsResult.value.count || 0 : 0;

    // Resolve stats counts
    let stats = { total_consultations: 0, total_prescriptions: 0, total_reports: 0 };
    if (statsResult.status === 'fulfilled') {
      const [consultCount, prescCount, reportCount] = statsResult.value;
      stats = {
        total_consultations: consultCount.count || 0,
        total_prescriptions: prescCount.count || 0,
        total_reports: reportCount.count || 0,
      };
    }

    // Get recommended doctors (smart recommendation engine)
    // Performance hardening: cap recommendation compute time for dashboard requests
    const recommendedDoctors = await Promise.race([
      this.getRecommendedDoctors(patient.id, userId),
      new Promise((resolve) => setTimeout(() => resolve([]), 700)),
    ]).catch(() => []);

    const dashboard = {
      patient: { id: patient.id, name: patient.name },
      upcomingAppointments,
      reminders,
      recentConsultations,
      notifications,
      unreadNotificationCount: unreadCount,
      recommendedDoctors,
      stats,
    };

    // Cache for 30 seconds
    try { await cacheSet(cacheKey, dashboard, 30); } catch (_) { /* non-fatal */ }

    return dashboard;
  }

  // ==================== SMART RECOMMENDATION ENGINE ====================

  /**
   * Recommend doctors based on patient's health profile, consultation history,
   * chatbot interactions, and medical conditions.
   * 
   * Priority order:
   * 1. Specialists matching chatbot-detected symptoms (recent chats)
   * 2. Specialists the patient has consulted before (follow-up care)
   * 3. Specialists matching patient's chronic conditions
   * 4. Fallback: top-rated, available doctors across all specializations
   */
  async getRecommendedDoctors(patientId, userId, limit = 8) {
    const normalizedLimit = Number.isFinite(Number(limit))
      ? Math.min(Math.max(parseInt(limit, 10), 1), 20)
      : 8;
    // Specialist mapping: condition/symptom keywords → specialization
    const CONDITION_SPECIALIST_MAP = {
      'Cardiologist': ['heart', 'chest pain', 'palpitations', 'blood pressure', 'hypertension', 'cholesterol', 'cardiac'],
      'Dermatologist': ['skin', 'rash', 'acne', 'eczema', 'hair loss', 'itching', 'psoriasis', 'dermatitis'],
      'Orthopedic': ['bone', 'joint', 'back pain', 'fracture', 'arthritis', 'knee', 'spine', 'osteoporosis'],
      'Neurologist': ['headache', 'migraine', 'dizziness', 'numbness', 'seizure', 'epilepsy', 'neuropathy'],
      'Gastroenterologist': ['stomach', 'digestion', 'acid reflux', 'constipation', 'diarrhea', 'ibs', 'liver', 'gerd'],
      'Pulmonologist': ['breathing', 'cough', 'asthma', 'lungs', 'respiratory', 'copd', 'bronchitis'],
      'ENT Specialist': ['ear', 'nose', 'throat', 'sinus', 'hearing', 'tonsil', 'vertigo'],
      'Ophthalmologist': ['eye', 'vision', 'glasses', 'cataract', 'glaucoma', 'retina'],
      'Gynecologist': ['period', 'pregnancy', 'menstrual', 'pcod', 'pcos', 'fertility', 'uterine'],
      'Pediatrician': ['child', 'baby', 'infant', 'kids', 'vaccination'],
      'Psychiatrist': ['anxiety', 'depression', 'stress', 'insomnia', 'mental health', 'bipolar'],
      'Endocrinologist': ['diabetes', 'thyroid', 'hormone', 'insulin', 'metabolic'],
      'Nephrologist': ['kidney', 'renal', 'dialysis', 'urinary'],
      'Urologist': ['prostate', 'bladder', 'urinary tract', 'uti'],
      'Oncologist': ['cancer', 'tumor', 'chemotherapy', 'oncology'],
      'General Physician': ['fever', 'cold', 'flu', 'checkup', 'general', 'fatigue', 'weakness'],
    };

    try {
      const targetSpecializations = new Set();
      const recommendationReasons = {};

      // --- Signal 1: Recent chatbot conversations (user messages) ---
      const { data: recentChatSessions } = await supabaseAdmin
        .from('chat_sessions')
        .select('id')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(5);

      if (recentChatSessions?.length > 0) {
        const sessionIds = recentChatSessions.map(s => s.id);
        const { data: userMessages } = await supabaseAdmin
          .from('chat_messages')
          .select('content')
          .in('session_id', sessionIds)
          .eq('role', 'user')
          .order('created_at', { ascending: false })
          .limit(20);

        if (userMessages?.length > 0) {
          const allSymptomText = userMessages.map(m => m.content).join(' ').toLowerCase();
          for (const [specialist, keywords] of Object.entries(CONDITION_SPECIALIST_MAP)) {
            if (keywords.some(k => allSymptomText.includes(k))) {
              targetSpecializations.add(specialist);
              recommendationReasons[specialist] = 'Based on your recent symptoms';
            }
          }
        }
      }

      // --- Signal 2: Patient's past consultation specializations ---
      const { data: pastAppointments } = await supabaseAdmin
        .from('appointments')
        .select('doctor:doctors(specialization)')
        .eq('patient_id', patientId)
        .in('status', ['completed', 'confirmed', 'scheduled'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (pastAppointments?.length > 0) {
        pastAppointments.forEach(apt => {
          const spec = apt.doctor?.specialization;
          if (spec) {
            targetSpecializations.add(spec);
            if (!recommendationReasons[spec]) {
              recommendationReasons[spec] = 'Based on your consultation history';
            }
          }
        });
      }

      // --- Signal 3: Patient's chronic conditions / medical profile ---
      const { data: patientProfile } = await supabaseAdmin
        .from('patients')
        .select('medical_conditions, allergies, chronic_conditions')
        .eq('id', patientId)
        .single();

      if (patientProfile) {
        const conditions = [
          ...(patientProfile.medical_conditions || []),
          ...(patientProfile.chronic_conditions || []),
        ].join(' ').toLowerCase();

        if (conditions) {
          for (const [specialist, keywords] of Object.entries(CONDITION_SPECIALIST_MAP)) {
            if (keywords.some(k => conditions.includes(k))) {
              targetSpecializations.add(specialist);
              if (!recommendationReasons[specialist]) {
                recommendationReasons[specialist] = 'Based on your health profile';
              }
            }
          }
        }
      }

      // --- Fetch doctors matching target specializations ---
      let recommendedDoctors = [];

      if (targetSpecializations.size > 0) {
        const { data: matchedDoctors } = await supabaseAdmin
          .from('doctors')
          .select('id, name, specialization, rating, experience_years, profile_image_url, consultation_fee, is_available')
          .eq('is_approved', true)
          .eq('is_available', true)
          .in('specialization', [...targetSpecializations])
          .order('rating', { ascending: false })
          .limit(normalizedLimit);

        recommendedDoctors = (matchedDoctors || []).map(doc => ({
          ...doc,
          recommendation_reason: recommendationReasons[doc.specialization] || 'Recommended for you',
        }));
      }

      // --- Fallback: fill remaining slots with top-rated doctors ---
      if (recommendedDoctors.length < normalizedLimit) {
        const existingIds = recommendedDoctors.map(d => d.id);
        const remaining = normalizedLimit - recommendedDoctors.length;

        const { data: fallbackPool } = await supabaseAdmin
          .from('doctors')
          .select('id, name, specialization, rating, experience_years, profile_image_url, consultation_fee, is_available')
          .eq('is_approved', true)
          .eq('is_available', true)
          .order('rating', { ascending: false })
          // Pull a slightly larger pool so we can remove duplicates in-memory safely
          .limit(normalizedLimit * 3);

        const fallbackDoctors = (fallbackPool || [])
          .filter(doc => !existingIds.includes(doc.id))
          .slice(0, remaining);

        const fallbackWithReason = (fallbackDoctors || []).map(doc => ({
          ...doc,
          recommendation_reason: 'Top rated doctor',
        }));

        recommendedDoctors = [...recommendedDoctors, ...fallbackWithReason];
      }

      return recommendedDoctors;
    } catch (error) {
      console.error('Recommendation engine error:', error);
      // Graceful fallback: return top-rated doctors
      const { data: fallback } = await supabaseAdmin
        .from('doctors')
        .select('id, name, specialization, rating, experience_years, profile_image_url, consultation_fee, is_available')
        .eq('is_approved', true)
        .eq('is_available', true)
        .order('rating', { ascending: false })
        .limit(normalizedLimit);

      return (fallback || []).map(doc => ({
        ...doc,
        recommendation_reason: 'Top rated doctor',
      }));
    }
  }

  // Get reminders
  async getReminders(userId, filters = {}) {
    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!patient) {
      throw new ApiError(404, 'Patient profile not found');
    }

    let query = supabaseAdmin
      .from('reminders')
      .select('*')
      .eq('patient_id', patient.id);

    if (filters.type) {
      query = query.eq('type', filters.type);
    }

    if (filters.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    const { data: reminders, error } = await query
      .order('time', { ascending: true });

    if (error) {
      throw new ApiError(400, 'Failed to fetch reminders');
    }

    return reminders;
  }

  // Mark reminder action: taken / skip / snooze
  async actOnReminder(userId, reminderId, actionData = {}) {
    const action = String(actionData.action || '').trim().toLowerCase();
    if (!['taken', 'skip', 'snooze'].includes(action)) {
      throw new ApiError(400, 'Invalid action. Use taken, skip, or snooze');
    }

    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!patient) {
      throw new ApiError(404, 'Patient profile not found');
    }

    const { data: reminder } = await supabaseAdmin
      .from('reminders')
      .select('id, title, time, is_active')
      .eq('id', reminderId)
      .eq('patient_id', patient.id)
      .single();

    if (!reminder) {
      throw new ApiError(404, 'Reminder not found');
    }

    const now = new Date();
    const scheduledAt = actionData.scheduledAt ? new Date(actionData.scheduledAt) : now;
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new ApiError(400, 'scheduledAt must be a valid ISO timestamp');
    }

    const pad2 = (n) => String(n).padStart(2, '0');
    const yyyymmdd = `${scheduledAt.getFullYear()}${pad2(scheduledAt.getMonth() + 1)}${pad2(scheduledAt.getDate())}`;
    const actionsKey = `reminder:actions:${userId}:${yyyymmdd}`;

    let existing = await cacheGet(actionsKey);
    if (!Array.isArray(existing)) {
      try {
        existing = typeof existing === 'string' ? JSON.parse(existing) : [];
      } catch {
        existing = [];
      }
    }

    const event = {
      reminderId: reminder.id,
      action,
      reminderTitle: reminder.title,
      reminderTime: reminder.time,
      scheduledAt: scheduledAt.toISOString(),
      actedAt: now.toISOString(),
      snoozeUntil: null,
    };

    // Replace any previous action for same reminder+scheduled slot
    const deduped = (existing || []).filter(
      e => !(e?.reminderId === event.reminderId && e?.scheduledAt === event.scheduledAt)
    );

    if (action === 'snooze') {
      const snoozeMinutes = parseInt(actionData.snoozeMinutes, 10);
      if (!Number.isFinite(snoozeMinutes) || snoozeMinutes < 1 || snoozeMinutes > 180) {
        throw new ApiError(400, 'snoozeMinutes must be between 1 and 180');
      }
      const snoozeUntil = new Date(now.getTime() + snoozeMinutes * 60 * 1000);
      event.snoozeUntil = snoozeUntil.toISOString();
      await cacheSet(`reminder:snooze:${userId}:${reminder.id}`, {
        snoozeUntil: event.snoozeUntil,
        reminderTitle: reminder.title,
        reminderTime: reminder.time,
      }, snoozeMinutes * 60 + 3600);
    } else {
      await cacheDel(`reminder:snooze:${userId}:${reminder.id}`);
    }

    deduped.push(event);
    await cacheSet(actionsKey, deduped, 60 * 60 * 24 * 60); // retain for 60 days

    // Redis fallback persistence (best-effort): store actions in DB so reminder engine
    // can still resolve taken/skip/snooze even if Redis is unavailable.
    try {
      await supabaseAdmin
        .from('reminder_actions')
        .upsert({
          user_id: userId,
          patient_id: patient.id,
          reminder_id: reminder.id,
          action,
          scheduled_at: event.scheduledAt,
          acted_at: event.actedAt,
          snooze_until: event.snoozeUntil,
          source: 'app',
        }, {
          onConflict: 'user_id,reminder_id,scheduled_at',
        });
    } catch (persistErr) {
      // Non-blocking to preserve API responsiveness.
      console.warn('[PatientService] reminder_actions persistence skipped:', persistErr.message);
    }

    return {
      reminderId: reminder.id,
      action,
      scheduledAt: event.scheduledAt,
      actedAt: event.actedAt,
      snoozeUntil: event.snoozeUntil,
    };
  }

  // Reminder adherence summary for the last N days
  async getReminderAdherence(userId, days = 7) {
    const safeDays = Math.min(Math.max(parseInt(days, 10) || 7, 1), 90);

    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!patient) {
      throw new ApiError(404, 'Patient profile not found');
    }

    const { data: reminders, error } = await supabaseAdmin
      .from('reminders')
      .select('id, title, time, days, is_active')
      .eq('patient_id', patient.id)
      .eq('is_active', true);

    if (error) {
      throw new ApiError(400, 'Failed to fetch reminders for adherence');
    }

    const pad2 = (n) => String(n).padStart(2, '0');
    const dateKey = (d) => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
    const weekdayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const isReminderEnabledOnDate = (daysArr, d) => {
      if (!Array.isArray(daysArr) || daysArr.length === 0) return true;
      const normalized = daysArr.map(x => String(x || '').trim().toLowerCase());
      const dayToken = weekdayKeys[d.getDay()];
      const fullDay = d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      return normalized.includes(dayToken) || normalized.includes(fullDay);
    };

    const byDate = [];
    let totalDue = 0;
    let totalTaken = 0;
    let totalSkipped = 0;
    let totalSnoozed = 0;

    for (let i = safeDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = dateKey(d);

      let actions = await cacheGet(`reminder:actions:${userId}:${key}`);
      if (!Array.isArray(actions)) {
        try { actions = typeof actions === 'string' ? JSON.parse(actions) : []; } catch { actions = []; }
      }

      const due = (reminders || []).reduce((acc, r) => acc + (isReminderEnabledOnDate(r.days, d) ? 1 : 0), 0);
      const taken = (actions || []).filter(a => a?.action === 'taken').length;
      const skipped = (actions || []).filter(a => a?.action === 'skip').length;
      const snoozed = (actions || []).filter(a => a?.action === 'snooze').length;
      const missed = Math.max(0, due - taken - skipped);

      totalDue += due;
      totalTaken += taken;
      totalSkipped += skipped;
      totalSnoozed += snoozed;

      byDate.push({
        date: d.toISOString().slice(0, 10),
        due,
        taken,
        skipped,
        snoozed,
        missed,
      });
    }

    return {
      days: safeDays,
      summary: {
        dueDoses: totalDue,
        takenDoses: totalTaken,
        skippedDoses: totalSkipped,
        snoozedEvents: totalSnoozed,
        missedDoses: Math.max(0, totalDue - totalTaken - totalSkipped),
        adherencePercent: totalDue > 0 ? Math.round((totalTaken / totalDue) * 100) : 0,
      },
      byDate,
    };
  }

  // Create reminder
  async createReminder(userId, reminderData) {
    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!patient) {
      throw new ApiError(404, 'Patient profile not found');
    }

    const { data: reminder, error } = await supabaseAdmin
      .from('reminders')
      .insert({
        patient_id: patient.id,
        title: reminderData.title,
        type: reminderData.type,
        time: reminderData.time,
        days: reminderData.days || [],
        notes: reminderData.notes,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw new ApiError(400, 'Failed to create reminder');
    }

    return reminder;
  }

  // Update reminder
  async updateReminder(userId, reminderId, updateData) {
    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!patient) {
      throw new ApiError(404, 'Patient profile not found');
    }

    const { data: reminder, error } = await supabaseAdmin
      .from('reminders')
      .update({
        title: updateData.title,
        type: updateData.type,
        time: updateData.time,
        days: updateData.days,
        notes: updateData.notes,
        is_active: updateData.isActive,
        is_completed: updateData.isCompleted,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reminderId)
      .eq('patient_id', patient.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'Reminder not found');
      }
      throw new ApiError(400, 'Failed to update reminder');
    }

    return reminder;
  }

  // Delete reminder
  async deleteReminder(userId, reminderId) {
    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!patient) {
      throw new ApiError(404, 'Patient profile not found');
    }

    const { data: deleted, error } = await supabaseAdmin
      .from('reminders')
      .delete()
      .eq('id', reminderId)
      .eq('patient_id', patient.id)
      .select('id');

    if (error) {
      throw new ApiError(400, 'Failed to delete reminder');
    }

    if (!deleted || deleted.length === 0) {
      throw new ApiError(404, 'Reminder not found');
    }

    return { message: 'Reminder deleted successfully' };
  }

  // Add emergency contact
  async addEmergencyContact(userId, contactData) {
    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!patient) {
      throw new ApiError(404, 'Patient profile not found');
    }

    const { data: contact, error } = await supabaseAdmin
      .from('emergency_contacts')
      .insert({
        patient_id: patient.id,
        name: contactData.name,
        phone: contactData.phone,
        relationship: contactData.relation || contactData.relationship,
      })
      .select()
      .single();

    if (error) {
      throw new ApiError(400, 'Failed to add emergency contact');
    }

    await cacheDel(`patient:dashboard:${userId}`);

    return contact;
  }

  // Delete emergency contact
  async deleteEmergencyContact(userId, contactId) {
    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!patient) {
      throw new ApiError(404, 'Patient profile not found');
    }

    const { error } = await supabaseAdmin
      .from('emergency_contacts')
      .delete()
      .eq('id', contactId)
      .eq('patient_id', patient.id);

    if (error) {
      throw new ApiError(400, 'Failed to delete emergency contact');
    }

    await cacheDel(`patient:dashboard:${userId}`);

    return { message: 'Emergency contact deleted successfully' };
  }

  // Add family member
  async addFamilyMember(userId, memberData) {
    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!patient) {
      throw new ApiError(404, 'Patient profile not found');
    }

    const { data: member, error } = await supabaseAdmin
      .from('family_members')
      .insert({
        patient_id: patient.id,
        name: memberData.name,
        relationship: memberData.relation || memberData.relationship,
        date_of_birth: memberData.dateOfBirth || memberData.date_of_birth || null,
        gender: memberData.gender,
        blood_group: memberData.bloodGroup || memberData.blood_group || null,
      })
      .select()
      .single();

    if (error) {
      throw new ApiError(400, 'Failed to add family member');
    }

    await cacheDel(`patient:dashboard:${userId}`);

    return member;
  }

  // Delete family member
  async deleteFamilyMember(userId, memberId) {
    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!patient) {
      throw new ApiError(404, 'Patient profile not found');
    }

    const { error } = await supabaseAdmin
      .from('family_members')
      .delete()
      .eq('id', memberId)
      .eq('patient_id', patient.id);

    if (error) {
      throw new ApiError(400, 'Failed to delete family member');
    }

    await cacheDel(`patient:dashboard:${userId}`);

    return { message: 'Family member deleted successfully' };
  }
}

module.exports = new PatientService();
