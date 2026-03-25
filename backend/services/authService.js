/**
 * Auth Service
 * Handles registration, login, JWT, email verification, password management.
 * 
 * Architecture: Email + Password + JWT (free tier)
 * - bcrypt password hashing
 * - JWT access + refresh tokens with DB rotation
 * - Email verification via signed JWT links (Gmail SMTP / Nodemailer)
 * - Password reset via email links
 * - NO OTP, NO Twilio, NO Supabase Auth \u2014 Supabase used as PostgreSQL only
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { supabaseAdmin } = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');
const { cacheGet, cacheSet, cacheDel } = require('../config/redis');
const { logAudit } = require('../utils/auditLogger');
const { sendVerificationEmail, sendPasswordResetEmail } = require('./emailService');

// Helper: convert JWT duration string to seconds (e.g., '7d' -> 604800)
const parseExpiresIn = (duration) => {
  if (typeof duration === 'number') return duration;
  const match = String(duration).match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 604800; // default 7 days
  const val = parseInt(match[1], 10);
  switch (match[2]) {
    case 's': return val;
    case 'm': return val * 60;
    case 'h': return val * 3600;
    case 'd': return val * 86400;
    default: return 604800;
  }
};

// Generate JWT tokens
const generateTokens = (user) => {
  const expiresInStr = config.jwt.expiresIn || '7d';
  const accessToken = jwt.sign(
    { userId: user.id, role: user.role, email: user.email },
    config.jwt.accessSecret,
    { expiresIn: expiresInStr }
  );

  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn || '30d' }
  );

  return { accessToken, refreshToken, expiresIn: parseExpiresIn(expiresInStr) };
};

// ==================== Register ====================
const register = async (userData) => {
  const { email: rawEmail, phone, password, name, role = 'patient', ...rest } = userData;
  const email = rawEmail?.toLowerCase().trim();

  const orFilters = [];
  if (email) orFilters.push(`email.eq.${email}`);
  if (phone) orFilters.push(`phone.eq.${phone}`);
  const { data: existing } = orFilters.length > 0
    ? await supabaseAdmin.from('users').select('id').or(orFilters.join(',')).single()
    : { data: null };

  if (existing) {
    const error = new Error('User with this email or phone already exists');
    error.statusCode = 409;
    throw error;
  }

  if (!password || password.length < 8) {
    const error = new Error('Password must be at least 8 characters');
    error.statusCode = 400;
    throw error;
  }

  // Enforce password complexity: at least one uppercase, one lowercase, one number
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    const error = new Error('Password must contain at least one uppercase letter, one lowercase letter, and one number');
    error.statusCode = 400;
    throw error;
  }

  const password_hash = await bcrypt.hash(password, 12);

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .insert({
      email,
      phone: phone || null,
      password_hash,
      name,
      role,
      is_active: true,
      is_verified: false,
    })
    .select('*')
    .single();

  if (error) throw error;

  await createRoleProfile(user.id, role, { name, email, phone, ...rest });

  const verificationToken = jwt.sign(
    { userId: user.id, email: user.email, type: 'email_verification' },
    config.jwt.secret,
    { expiresIn: '24h' }
  );

  await sendVerificationEmail(email, name, verificationToken);

  const { password_hash: _, ...safeUser } = user;

  return {
    user: safeUser,
    message: 'Registration successful. Please check your email to verify your account.',
    requiresVerification: true,
  };
};

const createRoleProfile = async (userId, role, data) => {
  try {
    switch (role) {
      case 'patient':
        await supabaseAdmin.from('patients').insert({
          user_id: userId,
          name: data.name,
          blood_group: data.bloodGroup,
          date_of_birth: data.dateOfBirth,
          gender: data.gender,
          address: data.address,
        });
        break;
      case 'doctor':
        await supabaseAdmin.from('doctors').insert({
          user_id: userId,
          name: data.name,
          specialization: data.specialization || 'General',
          license_number: data.licenseNumber || data.license_number,
          experience_years: parseInt(data.experienceYears || data.experience_years || '0', 10),
          consultation_fee: data.consultationFee || data.consultation_fee || 500,
          is_approved: false,
          approval_status: 'pending',
        });
        break;
      case 'hospital_owner':
        await supabaseAdmin.from('hospitals').insert({
          owner_id: userId,
          name: data.name || 'Unnamed Hospital',
          address: data.address || '',
          city: data.city || '',
          license_number: data.licenseNumber || data.license_number || null,
          phone: data.phone || null,
          email: data.email || null,
          latitude: data.latitude ? parseFloat(data.latitude) : null,
          longitude: data.longitude ? parseFloat(data.longitude) : null,
          is_approved: false,
          approval_status: 'pending',
        });
        break;
      case 'pharmacy_owner':
        await supabaseAdmin.from('pharmacies').insert({
          owner_id: userId,
          name: data.name || 'Unnamed Pharmacy',
          address: data.address || '',
          city: data.city || '',
          license_number: data.licenseNumber || data.license_number || null,
          phone: data.phone || null,
          email: data.email || null,
          latitude: data.latitude ? parseFloat(data.latitude) : null,
          longitude: data.longitude ? parseFloat(data.longitude) : null,
          is_approved: false,
          approval_status: 'pending',
        });
        break;
      case 'clinic_owner':
        await supabaseAdmin.from('clinics').insert({
          owner_id: userId,
          name: data.name || 'Unnamed Clinic',
          address: data.address || '',
          city: data.city || '',
          registration_number: data.registrationNumber || data.registration_number || null,
          license_number: data.licenseNumber || data.license_number || null,
          phone: data.phone || null,
          email: data.email || null,
          latitude: data.latitude ? parseFloat(data.latitude) : null,
          longitude: data.longitude ? parseFloat(data.longitude) : null,
          is_approved: false,
          approval_status: 'pending',
        });
        break;
      case 'diagnostic_center_owner':
        await supabaseAdmin.from('diagnostic_centers').insert({
          owner_id: userId,
          name: data.name || 'Unnamed Diagnostic Center',
          address: data.address || '',
          city: data.city || '',
          registration_number: data.registrationNumber || data.registration_number || null,
          license_number: data.licenseNumber || data.license_number || null,
          phone: data.phone || null,
          email: data.email || null,
          latitude: data.latitude ? parseFloat(data.latitude) : null,
          longitude: data.longitude ? parseFloat(data.longitude) : null,
          is_approved: false,
          approval_status: 'pending',
        });
        break;
      case 'ambulance_operator':
        await supabaseAdmin.from('ambulance_operators').insert({
          user_id: userId,
          name: data.name || data.companyName || 'Unnamed Operator',
          company_name: data.companyName || data.name,
          phone: data.phone,
          is_active: false,
          is_approved: false,
          approval_status: 'pending',
        });
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(`Failed to create ${role} profile:`, err.message);
  }
};

// Validate role profile exists (strict real-data mode).
const assertRoleProfileExists = async (user) => {
  if (!user?.id || !user?.role) return;

  const missingProfileError = () => new ApiError(
    403,
    'Profile setup is incomplete for this account. Please complete onboarding or contact support.'
  );

  switch (user.role) {
    case 'patient': {
      const { data: existing } = await supabaseAdmin
        .from('patients')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!existing) throw missingProfileError();
      break;
    }

    case 'doctor': {
      const { data: existing } = await supabaseAdmin
        .from('doctors')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!existing) throw missingProfileError();
      break;
    }

    case 'hospital_owner': {
      const { data: existing } = await supabaseAdmin
        .from('hospitals')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();
      if (!existing) throw missingProfileError();
      break;
    }

    case 'clinic_owner': {
      const { data: existing } = await supabaseAdmin
        .from('clinics')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();
      if (!existing) throw missingProfileError();
      break;
    }

    case 'pharmacy_owner': {
      const { data: existing } = await supabaseAdmin
        .from('pharmacies')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();
      if (!existing) throw missingProfileError();
      break;
    }

    case 'diagnostic_center_owner': {
      const { data: existing } = await supabaseAdmin
        .from('diagnostic_centers')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();
      if (!existing) throw missingProfileError();
      break;
    }

    case 'ambulance_operator': {
      const { data: existing } = await supabaseAdmin
        .from('ambulance_operators')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!existing) throw missingProfileError();
      break;
    }

    default:
      break;
  }
};

// ==================== Verify Email ====================
const verifyEmail = async (token) => {
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    if (decoded.type !== 'email_verification') {
      throw new Error('Invalid token type');
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .update({ is_verified: true })
      .eq('id', decoded.userId)
      .select('id, email, name, role, is_verified')
      .single();

    if (error) throw error;

    return {
      message: 'Email verified successfully. You can now log in.',
      user,
    };
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      const error = new Error('Verification link has expired. Please request a new one.');
      error.statusCode = 400;
      throw error;
    }
    const error = new Error('Invalid or expired verification link');
    error.statusCode = 400;
    throw error;
  }
};

// ==================== Resend Verification ====================
const resendVerification = async (rawEmail) => {
  const email = rawEmail?.toLowerCase().trim();
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email, name, is_verified')
    .eq('email', email)
    .single();

  if (!user) {
    return { message: 'If an account exists with this email, a verification link has been sent.' };
  }

  if (user.is_verified) {
    return { message: 'This email is already verified. You can log in.' };
  }

  const verificationToken = jwt.sign(
    { userId: user.id, email: user.email, type: 'email_verification' },
    config.jwt.secret,
    { expiresIn: '24h' }
  );

  await sendVerificationEmail(user.email, user.name, verificationToken);

  return { message: 'If an account exists with this email, a verification link has been sent.' };
};

// ==================== Login ====================
const login = async (rawEmail, password, expectedRole = null) => {
  const email = rawEmail?.toLowerCase().trim();
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  // Optional role enforcement (portal-specific login)
  // Keep backward compatibility: admin portal accepts both admin and super_admin.
  if (expectedRole) {
    const roleMatches = user.role === expectedRole || (expectedRole === 'admin' && user.role === 'super_admin');
    if (!roleMatches) {
      throw new ApiError(403, 'Invalid credentials for this portal role');
    }
  }

  if (!user.is_active) {
    throw new ApiError(403, 'Your account has been deactivated. Please contact support.');
  }

  if (!user.is_verified) {
    const err = new ApiError(403, 'Please verify your email before logging in. Check your inbox for a verification link.');
    err.code = 'EMAIL_NOT_VERIFIED';
    throw err;
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    throw new ApiError(401, 'Invalid email or password');
  }

  // Strict validation: login requires an actual profile row for the role.
  await assertRoleProfileExists(user);

  const tokens = generateTokens(user);

  try {
    await supabaseAdmin.from('refresh_tokens').insert({
      user_id: user.id,
      token: tokens.refreshToken,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      is_revoked: false,
    });
  } catch (err) {
    console.warn('Failed to persist refresh token:', err.message);
  }

  await supabaseAdmin
    .from('users')
    .update({ last_login: new Date().toISOString() })
    .eq('id', user.id);

  logAudit({ userId: user.id, userRole: user.role, action: 'user.login', entityType: 'user', entityId: user.id });

  const { password_hash: _, ...safeUser } = user;

  return {
    user: safeUser,
    ...tokens,
  };
};

// ==================== Refresh Token ====================
const refreshToken = async (token) => {
  try {
    const decoded = jwt.verify(token, config.jwt.refreshSecret);
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    const { data: storedToken } = await supabaseAdmin
      .from('refresh_tokens')
      .select('id, is_revoked')
      .eq('token', token)
      .eq('user_id', decoded.userId)
      .single();

    // Fix #12: Guard against null storedToken (token not found in DB)
    if (!storedToken) {
      throw new ApiError(401, 'Refresh token not found or already used');
    }

    if (storedToken.is_revoked) {
      throw new ApiError(401, 'Refresh token has been revoked');
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .single();

    if (!user || !user.is_active) {
      throw new ApiError(401, 'User not found or inactive');
    }

    if (!user.is_verified) {
      const err = new ApiError(403, 'Email not verified');
      err.code = 'EMAIL_NOT_VERIFIED';
      throw err;
    }

    if (storedToken) {
      await supabaseAdmin
        .from('refresh_tokens')
        .update({ is_revoked: true, revoked_at: new Date().toISOString() })
        .eq('id', storedToken.id);
    }

    const tokens = generateTokens(user);

    try {
      await supabaseAdmin.from('refresh_tokens').insert({
        user_id: user.id,
        token: tokens.refreshToken,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        is_revoked: false,
      });
    } catch (_) { /* non-fatal */ }

    const { password_hash: _, ...safeUser } = user;
    return { user: safeUser, ...tokens };
  } catch (err) {
    if (err.statusCode) throw err;
    const error = new Error('Invalid or expired refresh token');
    error.statusCode = 401;
    throw error;
  }
};

// ==================== Logout ====================
const logout = async (userId, refreshTokenValue) => {
  if (refreshTokenValue) {
    await supabaseAdmin
      .from('refresh_tokens')
      .update({ is_revoked: true, revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('token', refreshTokenValue);
  } else {
    await supabaseAdmin
      .from('refresh_tokens')
      .update({ is_revoked: true, revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_revoked', false);
  }
  await cacheDel(`auth_user:${userId}`);
  logAudit({ userId, userRole: 'unknown', action: 'user.logout', entityType: 'user', entityId: userId });
  return { message: 'Logged out successfully' };
};

// ==================== Change Password ====================
const changePassword = async (userId, currentPassword, newPassword) => {
  if (!newPassword || newPassword.length < 8) {
    throw new ApiError(400, 'New password must be at least 8 characters');
  }

  if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    throw new ApiError(400, 'Password must contain at least one uppercase letter, one lowercase letter, and one number');
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('password_hash')
    .eq('id', userId)
    .single();

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const isValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValid) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  const password_hash = await bcrypt.hash(newPassword, 12);
  await supabaseAdmin
    .from('users')
    .update({ password_hash })
    .eq('id', userId);

  // Revoke all refresh tokens to force re-login on other devices
  await supabaseAdmin
    .from('refresh_tokens')
    .update({ is_revoked: true, revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_revoked', false);

  return { message: 'Password changed successfully' };
};

// ==================== Forgot Password ====================
const forgotPassword = async (rawEmail) => {
  const email = rawEmail?.toLowerCase().trim();
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, name, email, is_active')
    .eq('email', email)
    .single();

  if (!user || !user.is_active) {
    return { message: 'If an account exists with this email, a reset link has been sent.' };
  }

  const resetToken = jwt.sign(
    { userId: user.id, type: 'password_reset' },
    config.jwt.secret,
    { expiresIn: '1h' }
  );

  await cacheSet(`reset:${resetToken}`, user.id, 3600);
  await sendPasswordResetEmail(user.email, user.name, resetToken);

  return { message: 'If an account exists with this email, a reset link has been sent.' };
};

// ==================== Reset Password ====================
const resetPassword = async (token, newPassword) => {
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    if (decoded.type !== 'password_reset') {
      throw new Error('Invalid token');
    }

    // Verify token is still valid in Redis (prevents reuse)
    const storedUserId = await cacheGet(`reset:${token}`);
    if (!storedUserId) {
      throw new ApiError(400, 'Reset link has already been used or expired');
    }

    // Enforce password complexity (matching register/changePassword)
    if (!newPassword || newPassword.length < 8) {
      throw new ApiError(400, 'Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      throw new ApiError(400, 'Password must contain at least one uppercase letter, one lowercase letter, and one number');
    }

    const password_hash = await bcrypt.hash(newPassword, 12);

    // CRITICAL FIX: Update password in DB BEFORE deleting the Redis token.
    // If DB update fails, the user can retry with the same token.
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .update({ password_hash })
      .eq('id', decoded.userId);

    if (dbError) {
      // DB update failed — token is still valid for retry
      console.error('Password reset DB update failed:', dbError.message);
      throw new ApiError(500, 'Failed to update password. Please try again.');
    }

    // DB update succeeded — NOW delete token from Redis to prevent reuse
    await cacheDel(`reset:${token}`);

    // Revoke all existing refresh tokens for this user (force re-login)
    await supabaseAdmin
      .from('refresh_tokens')
      .update({ is_revoked: true, revoked_at: new Date().toISOString() })
      .eq('user_id', decoded.userId)
      .eq('is_revoked', false);

    return { message: 'Password reset successfully' };
  } catch (err) {
    // Re-throw ApiErrors (our own) without masking them
    if (err.statusCode) throw err;
    const error = new Error('Invalid or expired reset token');
    error.statusCode = 400;
    throw error;
  }
};

// Update current user profile (name, phone)
const updateProfile = async (userId, role, updates) => {
  const { name, phone } = updates;
  if (!name && !phone) {
    throw new ApiError(400, 'No valid fields to update');
  }

  // Update phone on users table with format validation
  if (phone) {
    // Fix #44: Validate phone format (E.164 or common Indian formats)
    const phoneStr = String(phone).trim();
    if (!/^\+?[1-9]\d{6,14}$/.test(phoneStr)) {
      throw new ApiError(400, 'Invalid phone number format. Use E.164 format (e.g., +919876543210)');
    }
    const { error } = await supabaseAdmin.from('users').update({ phone: phoneStr }).eq('id', userId);
    if (error) throw error;
  }

  // Update name in role-specific table (and always on users table for consistency)
  if (name) {
    // Always update users.name as the canonical display name
    await supabaseAdmin.from('users').update({ name }).eq('id', userId);

    // Also update role-specific profile table if applicable
    // Map role → { table, ownerColumn } for profile sync
    // Owner roles use 'owner_id', staff roles use 'user_id'
    const roleTableMap = {
      patient: { table: 'patients', col: 'user_id' },
      doctor: { table: 'doctors', col: 'user_id' },
      hospital_owner: { table: 'hospitals', col: 'owner_id' },
      clinic_owner: { table: 'clinics', col: 'owner_id' },
      pharmacy_owner: { table: 'pharmacies', col: 'owner_id' },
      diagnostic_center_owner: { table: 'diagnostic_centers', col: 'owner_id' },
      ambulance_operator: { table: 'ambulance_operators', col: 'user_id' },
      admin: { table: 'admins', col: 'user_id' },
      super_admin: { table: 'admins', col: 'user_id' },
    };
    const mapping = roleTableMap[role];
    if (mapping) {
      await supabaseAdmin.from(mapping.table).update({ name }).eq(mapping.col, userId);
    }
  }

  return { message: 'Profile updated' };
};

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification,
  refreshToken,
  logout,
  changePassword,
  forgotPassword,
  resetPassword,
  updateProfile,
};
