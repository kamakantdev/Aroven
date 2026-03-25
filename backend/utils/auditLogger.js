/**
 * Audit Logger Utility (I2 / I15)
 * Writes audit logs to MongoDB AuditLog collection.
 * Gracefully degrades if MongoDB is unavailable.
 */

/**
 * Log an audit event.
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} opts.userRole
 * @param {string} opts.action — e.g. 'user.login', 'appointment.booked', 'provider.approved'
 * @param {string} [opts.entityType] — e.g. 'user', 'appointment', 'hospital'
 * @param {string} [opts.entityId]
 * @param {object} [opts.oldData]
 * @param {object} [opts.newData]
 * @param {object} [opts.metadata] — extra context
 * @param {string} [opts.ipAddress]
 * @param {string} [opts.userAgent]
 */
const logAudit = async (opts) => {
  try {
    const { AuditLog } = require('../database/models');
    if (!AuditLog) return;

    await AuditLog.create({
      userId: opts.userId,
      userRole: opts.userRole,
      action: opts.action,
      entityType: opts.entityType,
      entityId: opts.entityId,
      oldData: opts.oldData,
      newData: opts.newData,
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
      metadata: opts.metadata,
    });
  } catch (err) {
    // Non-fatal — never block main flow for audit logging
    console.warn('[Audit] Failed to log:', err.message);
  }
};

/**
 * Log an analytics event (I2).
 * @param {object} opts
 */
const logAnalytics = async (opts) => {
  try {
    const { AnalyticsEvent } = require('../database/models');
    if (!AnalyticsEvent) return;

    await AnalyticsEvent.create({
      eventType: opts.eventType,
      userId: opts.userId,
      userRole: opts.userRole,
      sessionId: opts.sessionId,
      properties: opts.properties,
      deviceInfo: opts.deviceInfo,
      location: opts.location,
    });
  } catch (err) {
    console.warn('[Analytics] Failed to log:', err.message);
  }
};

/**
 * Log a search event (I2).
 * @param {object} opts
 */
const logSearch = async (opts) => {
  try {
    const { SearchLog } = require('../database/models');
    if (!SearchLog) return;

    await SearchLog.create({
      userId: opts.userId,
      searchType: opts.searchType,
      query: opts.query,
      filters: opts.filters,
      resultsCount: opts.resultsCount,
      clickedResultId: opts.clickedResultId,
    });
  } catch (err) {
    console.warn('[SearchLog] Failed to log:', err.message);
  }
};

module.exports = { logAudit, logAnalytics, logSearch };
