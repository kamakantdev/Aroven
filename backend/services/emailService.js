/**
 * Email Service
 * Handles all email sending via Gmail SMTP (Nodemailer).
 * Free tier — no Twilio, no SendGrid, no paid services.
 */
const nodemailer = require('nodemailer');
const config = require('../config');

// Fix #11: HTML escape utility to prevent XSS in email templates
const escapeHtml = (str) => {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// ==================== Transporter Setup ====================
let transporter = null;
let initFailed = false;

const getTransporter = () => {
  if (transporter) return transporter;
  if (initFailed) return null;

  try {
    if (!config.email.gmailUser || !config.email.gmailAppPassword) {
      console.warn('[EMAIL] Gmail SMTP credentials not configured — email sending disabled');
      console.warn('[EMAIL] Set GMAIL_USER and GMAIL_APP_PASSWORD in .env');
      initFailed = true;
      return null;
    }

    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.email.gmailUser,
        pass: config.email.gmailAppPassword,
      },
    });

    console.log('[EMAIL] Gmail SMTP transporter initialized successfully');
    return transporter;
  } catch (err) {
    console.warn('[EMAIL] Gmail SMTP init failed:', err.message);
    initFailed = true;
    return null;
  }
};

// ==================== Send Email Helper ====================
const sendEmail = async ({ to, subject, html, text }) => {
  const transport = getTransporter();
  if (!transport) {
    console.warn(`[EMAIL] Skipping email to ${to} — SMTP not configured`);
    // In development, log the email content
    if (config.env !== 'production') {
      console.log(`📧 [DEV EMAIL]\n  To: ${to}\n  Subject: ${subject}\n  Body: ${text || '(HTML only)'}`);
    }
    return { success: false, reason: 'smtp_not_configured' };
  }

  try {
    const info = await transport.sendMail({
      from: `"${config.email.fromName}" <${config.email.gmailUser}>`,
      to,
      subject,
      html,
      text: text || subject,
    });

    console.log(`[EMAIL] Sent to ${to} — Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[EMAIL] Failed to send to ${to}:`, err.message);
    return { success: false, reason: err.message };
  }
};

// ==================== Email Templates ====================

/**
 * Send email verification link after registration.
 */
const sendVerificationEmail = async (email, name, verificationToken) => {
  const verifyUrl = `${config.frontendWebUrl}/verify-email?token=${verificationToken}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #7C3AED, #5B21B6); border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🏥 Swastik Healthcare</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 5px 0 0; font-size: 14px;">Healthcare Reimagined</p>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="color: #1f2937; margin-top: 0;">Welcome, ${escapeHtml(name)}! 👋</h2>
        <p style="color: #4b5563; line-height: 1.6;">
          Thank you for joining Swastik Healthcare. To get started, please verify your email address by clicking the button below:
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verifyUrl}" 
             style="display: inline-block; padding: 14px 32px; background: #7C3AED; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            ✅ Verify Email Address
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 13px;">
          Or copy and paste this link in your browser:<br>
          <a href="${verifyUrl}" style="color: #7C3AED; word-break: break-all;">${verifyUrl}</a>
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          This link expires in 24 hours. If you didn't create an account, please ignore this email.<br>
          © ${new Date().getFullYear()} Swastik Healthcare
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: 'Verify Your Email — Swastik Healthcare',
    html,
    text: `Welcome to Swastik Healthcare, ${escapeHtml(name)}! Verify your email by visiting: ${verifyUrl}`,
  });
};

/**
 * Send password reset link.
 */
const sendPasswordResetEmail = async (email, name, resetToken) => {
  const resetUrl = `${config.frontendWebUrl}/reset-password?token=${resetToken}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #7C3AED, #5B21B6); border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🏥 Swastik Healthcare</h1>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="color: #1f2937; margin-top: 0;">Password Reset Request</h2>
        <p style="color: #4b5563; line-height: 1.6;">
          Hi ${escapeHtml(name || 'there')}, we received a request to reset your password. Click the button below to set a new one:
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="display: inline-block; padding: 14px 32px; background: #DC2626; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            🔑 Reset Password
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 13px;">
          Or copy and paste this link:<br>
          <a href="${resetUrl}" style="color: #7C3AED; word-break: break-all;">${resetUrl}</a>
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          This link expires in 1 hour. If you didn't request a reset, ignore this email — your password won't change.<br>
          © ${new Date().getFullYear()} Swastik Healthcare
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: 'Reset Your Password — Swastik Healthcare',
    html,
    text: `Reset your Swastik Healthcare password: ${resetUrl} (expires in 1 hour)`,
  });
};

/**
 * Send notification email (fallback when FCM push fails).
 */
const sendNotificationEmail = async (email, name, notification) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; padding: 15px; background: linear-gradient(135deg, #7C3AED, #5B21B6); border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">🏥 Swastik Healthcare</h1>
      </div>
      
      <div style="background: #ffffff; padding: 25px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="color: #1f2937; margin-top: 0;">${escapeHtml(notification.title)}</h2>
        <p style="color: #4b5563; line-height: 1.6;">${escapeHtml(notification.message)}</p>
        
        <div style="text-align: center; margin: 25px 0;">
          <a href="${config.frontendWebUrl}" 
             style="display: inline-block; padding: 12px 28px; background: #7C3AED; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Open Swastik
          </a>
        </div>
        
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          © ${new Date().getFullYear()} Swastik Healthcare
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: `${notification.title} — Swastik Healthcare`,
    html,
    text: `${notification.title}: ${notification.message}`,
  });
};

/**
 * Send account approval notification.
 */
const sendApprovalEmail = async (email, name, role, status, notes = '') => {
  const roleLoginPathMap = {
    doctor: 'doctor',
    hospital_owner: 'hospital',
    clinic_owner: 'clinic',
    pharmacy_owner: 'pharmacy',
    diagnostic_center_owner: 'diagnostic-center',
  };
  const loginPath = roleLoginPathMap[role];

  const statusConfig = {
    approved: {
      emoji: '✅',
      color: '#059669',
      title: 'Account Approved!',
      message: `Congratulations! Your ${role.replace(/_/g, ' ')} account has been approved. You can now log in and start using all features.`,
    },
    rejected: {
      emoji: '❌',
      color: '#DC2626',
      title: 'Account Not Approved',
      message: `Unfortunately, your ${role.replace(/_/g, ' ')} account was not approved at this time.${notes ? ` Reason: ${escapeHtml(notes)}` : ''}`,
    },
    review: {
      emoji: '🔍',
      color: '#D97706',
      title: 'Account Under Review',
      message: `Your ${role.replace(/_/g, ' ')} account is currently under review. We'll notify you once a decision is made.`,
    },
    reactivated: {
      emoji: '🟢',
      color: '#059669',
      title: 'Account Reactivated',
      message: `Your ${role.replace(/_/g, ' ')} account has been reactivated. You can access your dashboard again.`,
    },
    suspended: {
      emoji: '⛔',
      color: '#DC2626',
      title: 'Account Suspended',
      message: `Your ${role.replace(/_/g, ' ')} account has been suspended.${notes ? ` Reason: ${escapeHtml(notes)}` : ''}`,
    },
  };

  const cfg = statusConfig[status] || statusConfig.review;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #7C3AED, #5B21B6); border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🏥 Swastik Healthcare</h1>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="font-size: 48px;">${cfg.emoji}</span>
        </div>
        <h2 style="color: ${cfg.color}; text-align: center; margin-top: 0;">${cfg.title}</h2>
        <p style="color: #4b5563; line-height: 1.6; text-align: center;">
          Hi ${escapeHtml(name)}, ${cfg.message}
        </p>
        
        ${status === 'approved' && loginPath ? `
          <div style="text-align: center; margin: 25px 0;">
            <a href="${config.frontendWebUrl}/login/${loginPath}" 
               style="display: inline-block; padding: 14px 32px; background: #059669; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Login Now
            </a>
          </div>
        ` : ''}
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          © ${new Date().getFullYear()} Swastik Healthcare
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: `${cfg.title} — Swastik Healthcare`,
    html,
    text: `Hi ${name}, ${cfg.message}`,
  });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendNotificationEmail,
  sendApprovalEmail,
  getTransporter,
};
