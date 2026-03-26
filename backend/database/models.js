/**
 * MongoDB Models
 * Used for high-volume data that doesn't need relational queries
 */
const { mongoose } = require('../config/mongodb');

// Audit Log Schema - tracks all important actions
const auditLogSchema = new mongoose.Schema({
    userId: { type: String, index: true },
    userRole: { type: String, index: true },
    action: { type: String, required: true, index: true },
    entityType: { type: String, index: true }, // user, doctor, patient, appointment, etc.
    entityId: { type: String, index: true },
    oldData: mongoose.Schema.Types.Mixed,
    newData: mongoose.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String,
    metadata: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now, index: true },
});

// Chat Message Schema - high volume, append-only
const chatMessageSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    metadata: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now, index: true },
});

// Analytics Event Schema - for tracking user behavior
const analyticsEventSchema = new mongoose.Schema({
    eventType: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    userRole: String,
    sessionId: String,
    properties: mongoose.Schema.Types.Mixed,
    deviceInfo: {
        platform: String, // web, android, ios
        version: String,
        userAgent: String,
    },
    location: {
        latitude: Number,
        longitude: Number,
        city: String,
    },
    createdAt: { type: Date, default: Date.now, index: true },
});

// Ambulance Location Ping Schema - very high volume
const ambulanceLocationSchema = new mongoose.Schema({
    ambulanceId: { type: String, required: true, index: true },
    requestId: { type: String, index: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    heading: Number,
    speed: Number,
    accuracy: Number,
    createdAt: { type: Date, default: Date.now, index: true, expires: 86400 }, // TTL 24 hours
});

// Search Log Schema - for improving search
const searchLogSchema = new mongoose.Schema({
    userId: String,
    searchType: { type: String, index: true }, // doctor, medicine, hospital
    query: { type: String, required: true },
    filters: mongoose.Schema.Types.Mixed,
    resultsCount: Number,
    clickedResultId: String,
    createdAt: { type: Date, default: Date.now, index: true },
});

// Create models only if mongoose is connected
let AuditLog, ChatMessage, AnalyticsEvent, AmbulanceLocation, SearchLog;

try {
    AuditLog = mongoose.model('AuditLog', auditLogSchema);
    ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
    AnalyticsEvent = mongoose.model('AnalyticsEvent', analyticsEventSchema);
    AmbulanceLocation = mongoose.model('AmbulanceLocation', ambulanceLocationSchema);
    SearchLog = mongoose.model('SearchLog', searchLogSchema);
} catch (error) {
    // Models might already exist
    AuditLog = mongoose.models.AuditLog;
    ChatMessage = mongoose.models.ChatMessage;
    AnalyticsEvent = mongoose.models.AnalyticsEvent;
    AmbulanceLocation = mongoose.models.AmbulanceLocation;
    SearchLog = mongoose.models.SearchLog;
}

module.exports = {
    AuditLog,
    ChatMessage,
    AnalyticsEvent,
    AmbulanceLocation,
    SearchLog,
};
