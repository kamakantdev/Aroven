/**
 * Report Service
 * Medical reports, prescriptions, doctor sharing
 */
const { supabaseAdmin } = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');
const { deleteFile } = require('../config/minio');

// Report types (sync)
// Valid report types matching DB CHECK constraint:
// 'blood_test', 'urine_test', 'x_ray', 'mri', 'ct_scan', 'ecg', 'ultrasound', 'other'
const getReportTypes = () => {
  return [
    { id: 'blood_test', name: 'Blood Test', icon: '🩸' },
    { id: 'urine_test', name: 'Urine Test', icon: '🧪' },
    { id: 'x_ray', name: 'X-Ray', icon: '🦴' },
    { id: 'mri', name: 'MRI', icon: '🧠' },
    { id: 'ct_scan', name: 'CT Scan', icon: '📷' },
    { id: 'ultrasound', name: 'Ultrasound', icon: '📡' },
    { id: 'ecg', name: 'ECG', icon: '❤️' },
    { id: 'other', name: 'Other', icon: '📋' },
  ];
};

// Get reports
const getReports = async (userId, filters = {}, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;

  // Get patient record
  const { data: patient } = await supabaseAdmin
    .from('patients')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!patient) return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };

  let query = supabaseAdmin
    .from('reports')
    .select('*', { count: 'exact' })
    .eq('patient_id', patient.id);

  if (filters.type) query = query.eq('type', filters.type);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.fromDate) query = query.gte('test_date', filters.fromDate);
  if (filters.toDate) query = query.lte('test_date', filters.toDate);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    data: data || [],
    pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
  };
};

// Upload report
const uploadReport = async (userId, file, metadata) => {
  const { data: patient } = await supabaseAdmin
    .from('patients')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!patient) {
    throw new ApiError(404, 'Patient profile not found');
  }

  // Upload file to MinIO
  let fileUrl = null;
  try {
    const { uploadReport: uploadToMinio } = require('../config/minio');
    const uploadResult = await uploadToMinio(file, userId);
    fileUrl = uploadResult.url;
  } catch (err) {
    console.error('File upload error:', err.message);
  }

  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .insert({
      patient_id: patient.id,
      name: metadata.name,
      type: metadata.type,
      test_date: metadata.date || new Date().toISOString().split('T')[0],
      file_url: fileUrl,
      file_size: file.size ? `${(file.size / 1024).toFixed(1)} KB` : null,
      doctor_notes: metadata.notes || null,
      lab_name: metadata.labName || null,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) throw error;
  return report;
};

// Get report by ID
const getReportById = async (userId, reportId) => {
  const { data: patient } = await supabaseAdmin
    .from('patients')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!patient) {
    throw new ApiError(404, 'Patient profile not found');
  }

  const { data, error } = await supabaseAdmin
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .eq('patient_id', patient.id)
    .single();

  if (error || !data) {
    throw new ApiError(404, 'Report not found');
  }

  return data;
};

// Delete report
const deleteReport = async (userId, reportId) => {
  const { data: patient } = await supabaseAdmin
    .from('patients')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!patient) {
    throw new ApiError(404, 'Patient profile not found');
  }

  // M6 Fix: Fetch report first to get file_url for MinIO cleanup
  const { data: report } = await supabaseAdmin
    .from('reports')
    .select('file_url')
    .eq('id', reportId)
    .eq('patient_id', patient.id)
    .single();

  if (!report) {
    throw new ApiError(404, 'Report not found');
  }

  const { error } = await supabaseAdmin
    .from('reports')
    .delete()
    .eq('id', reportId)
    .eq('patient_id', patient.id);

  if (error) throw error;

  // M6: Clean up file from MinIO storage
  if (report.file_url) {
    try {
      // Extract object name from URL (path after bucket name)
      const url = new URL(report.file_url);
      const objectName = url.pathname.split('/').slice(2).join('/');
      if (objectName) await deleteFile(objectName);
    } catch (cleanupErr) {
      console.warn('MinIO cleanup failed (non-fatal):', cleanupErr.message);
    }
  }

  return { message: 'Report deleted' };
};

// Share report with doctor
const shareReportWithDoctor = async (userId, reportId, doctorId) => {
  const { data: patient } = await supabaseAdmin
    .from('patients')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!patient) {
    throw new ApiError(404, 'Patient profile not found');
  }

  // Verify report belongs to patient
  const { data: report } = await supabaseAdmin
    .from('reports')
    .select('id')
    .eq('id', reportId)
    .eq('patient_id', patient.id)
    .single();

  if (!report) {
    throw new ApiError(404, 'Report not found');
  }

  // Share report via report_shares table
  const { error } = await supabaseAdmin
    .from('report_shares')
    .upsert({
      report_id: reportId,
      doctor_id: doctorId,
      shared_by: userId,
      shared_at: new Date().toISOString(),
    }, { onConflict: 'report_id,doctor_id' });

  if (error) {
    console.warn('Share via report_shares failed:', error.message);
    // Graceful fallback: log the intent even if table has issues
    throw new ApiError(500, 'Failed to share report');
  }

  return { message: 'Report shared with doctor' };
};

// Get prescriptions
const getPrescriptions = async (userId, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;

  const { data: patient } = await supabaseAdmin
    .from('patients')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!patient) return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };

  const { data, error, count } = await supabaseAdmin
    .from('prescriptions')
    .select('*, doctor:doctors(name, specialization), medicines:prescription_medicines(*)', { count: 'exact' })
    .eq('patient_id', patient.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    data: data || [],
    pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
  };
};

// Get prescription by ID
const getPrescriptionById = async (userId, prescriptionId) => {
  const { data: patient } = await supabaseAdmin
    .from('patients')
    .select('id')
    .eq('user_id', userId)
    .single();

  const { data, error } = await supabaseAdmin
    .from('prescriptions')
    .select('*, doctor:doctors(name, specialization, profile_image_url), medicines:prescription_medicines(*)')
    .eq('id', prescriptionId)
    .eq('patient_id', patient?.id)
    .single();

  if (error || !data) {
    throw new ApiError(404, 'Prescription not found');
  }

  return data;
};

// Add report parameters (doctor)
const addReportParameters = async (doctorUserId, reportId, parameters) => {
  const { data: doctor } = await supabaseAdmin
    .from('doctors')
    .select('id, name')
    .eq('user_id', doctorUserId)
    .single();

  if (!doctor) {
    throw new ApiError(404, 'Doctor profile not found');
  }

  // Authorization: verify the report exists and the doctor has treated this patient
  const { data: report } = await supabaseAdmin
    .from('reports')
    .select('id, patient_id')
    .eq('id', reportId)
    .single();

  if (!report) {
    throw new ApiError(404, 'Report not found');
  }

  // Check doctor has an appointment or consultation with this patient
  const { data: hasRelation } = await supabaseAdmin
    .from('appointments')
    .select('id')
    .eq('doctor_id', doctor.id)
    .eq('patient_id', report.patient_id)
    .limit(1)
    .maybeSingle();

  if (!hasRelation) {
    // Also check report_shares
    const { data: hasShare } = await supabaseAdmin
      .from('report_shares')
      .select('id')
      .eq('report_id', reportId)
      .eq('doctor_id', doctor.id)
      .maybeSingle();

    if (!hasShare) {
      throw new ApiError(403, 'You are not authorized to update this report. You must have a patient relationship or the report must be shared with you.');
    }
  }

  // Determine status from parameters (look for abnormal/critical values)
  let derivedStatus = 'normal';
  if (Array.isArray(parameters)) {
    const hasAbnormal = parameters.some(p => p.status === 'abnormal');
    const hasCritical = parameters.some(p => p.status === 'critical');
    if (hasCritical) derivedStatus = 'critical';
    else if (hasAbnormal) derivedStatus = 'abnormal';
  }

  const { data, error } = await supabaseAdmin
    .from('reports')
    .update({
      parameters,
      result_date: new Date().toISOString().split('T')[0],
      doctor_notes: `Analyzed by Dr. ${doctor.name || 'Unknown'}`,
      status: derivedStatus,
    })
    .eq('id', reportId)
    .select('*')
    .single();

  if (error) throw error;
  return { data, message: 'Report parameters added' };
};

module.exports = {
  getReportTypes,
  getReports,
  uploadReport,
  getReportById,
  deleteReport,
  shareReportWithDoctor,
  getPrescriptions,
  getPrescriptionById,
  addReportParameters,
};
