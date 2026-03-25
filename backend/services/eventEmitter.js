/**
 * Event Emitter Service
 * Cross-service event bus with Socket.IO integration for real-time push
 */
const EventEmitter = require('events');
const crypto = require('crypto');
const config = require('../config');

class AppEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.io = null;
    this.instanceId = process.env.INSTANCE_ID || crypto.randomUUID();
    this.eventBusChannel = process.env.EVENT_BUS_CHANNEL || 'swastik:eventbus:v1';
    this.pubClient = null;
    this.subClient = null;
    this.distributedReady = false;
    // Increase listener limit to avoid warnings in production
    this.setMaxListeners(50);
    // I20 Fix: Prevent unhandled errors from crashing the process
    this.on('error', (err) => {
      console.error('[EventEmitter] Unhandled event error:', err.message || err);
    });
  }

  setIO(io) {
    this.io = io;
    if (process.env.NODE_ENV === 'test' && process.env.ENABLE_DISTRIBUTED_EVENT_BUS !== 'true') {
      return;
    }
    this.initializeDistributedBus().catch((err) => {
      console.warn('[EventEmitter] Distributed bus init failed (continuing local-only):', err.message || err);
    });
  }

  getIO() {
    return this.io;
  }

  async initializeDistributedBus() {
    if (process.env.NODE_ENV === 'test' && process.env.ENABLE_DISTRIBUTED_EVENT_BUS !== 'true') return;
    if (this.distributedReady || this.pubClient || !config.redis.ioredisUrl) return;

    const Redis = require('ioredis');
    this.pubClient = new Redis(config.redis.ioredisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 5000),
    });
    this.subClient = this.pubClient.duplicate();

    await Promise.all([this.pubClient.connect(), this.subClient.connect()]);
    await this.subClient.subscribe(this.eventBusChannel);

    this.subClient.on('message', (channel, message) => {
      if (channel !== this.eventBusChannel || !message) return;
      try {
        const envelope = JSON.parse(message);
        if (!envelope?.event || envelope.sourceId === this.instanceId) return;
        super.emit(envelope.event, envelope.payload);
      } catch (err) {
        console.warn('[EventEmitter] Invalid distributed message:', err.message || err);
      }
    });

    this.distributedReady = true;
    console.log('[EventEmitter] Distributed event bus enabled');
  }

  async publishDistributed(event, payload) {
    if (!this.distributedReady || !this.pubClient) return;
    try {
      await this.pubClient.publish(this.eventBusChannel, JSON.stringify({
        sourceId: this.instanceId,
        event,
        payload,
        emittedAt: new Date().toISOString(),
      }));
    } catch (err) {
      console.warn(`[EventEmitter] Failed to publish distributed event (${event}):`, err.message || err);
    }
  }

  emitDistributed(event, payload) {
    try {
      super.emit(event, payload);
    } catch (err) {
      console.error(`[EventEmitter] local emit error (${event}):`, err.message || err);
    }
    this.publishDistributed(event, payload);
  }

  async shutdown() {
    try {
      if (this.subClient) {
        await this.subClient.unsubscribe(this.eventBusChannel).catch(() => {});
        await this.subClient.quit().catch(() => {});
        this.subClient = null;
      }
      if (this.pubClient) {
        await this.pubClient.quit().catch(() => {});
        this.pubClient = null;
      }
      this.distributedReady = false;
    } catch (err) {
      console.warn('[EventEmitter] shutdown warning:', err.message || err);
    }
  }

  // ── Notification helpers ─────────────────────────────────────────
  // I20 Fix: Wrap all emit calls with try-catch to prevent crashes
  notifyUser(userId, event, data) {
    try {
      if (this.io) {
        this.io.to(`user:${userId}`).emit(event, data);
      }
      this.emitDistributed(event, { userId, ...data });
    } catch (err) {
      console.error(`[EventEmitter] notifyUser error (${event}):`, err.message);
    }
  }

  notifyRoom(room, event, data) {
    try {
      if (this.io) {
        this.io.to(room).emit(event, data);
      }
      this.emitDistributed(event, { room, ...data });
    } catch (err) {
      console.error(`[EventEmitter] notifyRoom error (${event}):`, err.message);
    }
  }

  // ── Domain events ────────────────────────────────────────────────
  emitAppointmentBooked(appointment) {
    const { doctor_id, patient_id, hospital_owner_id, clinic_owner_id } = appointment;
    this.notifyUser(doctor_id, 'appointment:new', appointment);
    this.notifyUser(patient_id, 'appointment:confirmed', appointment);
    // Also push as notification so layout handlers catch it
    this.notifyUser(doctor_id, 'notification:new', {
      type: 'appointment',
      title: 'New Appointment',
      message: `New appointment booked${appointment.patient?.name ? ` by ${appointment.patient.name}` : ''}`,
      timestamp: new Date().toISOString(),
      data: { appointmentId: appointment.id },
    });
    // Notify hospital/clinic owner for real-time dashboard updates
    if (hospital_owner_id) {
      this.notifyUser(hospital_owner_id, 'appointment:new', appointment);
      this.notifyUser(hospital_owner_id, 'notification:new', {
        type: 'appointment',
        title: 'New Appointment',
        message: `New appointment booked at your hospital`,
        timestamp: new Date().toISOString(),
        data: { appointmentId: appointment.id },
      });
    }
    if (clinic_owner_id) {
      this.notifyUser(clinic_owner_id, 'appointment:new', appointment);
      this.notifyUser(clinic_owner_id, 'notification:new', {
        type: 'appointment',
        title: 'New Appointment',
        message: `New appointment booked at your clinic`,
        timestamp: new Date().toISOString(),
        data: { appointmentId: appointment.id },
      });
    }
    this.emitDistributed('appointment:booked', appointment);
  }

  emitAppointmentUpdated(appointment) {
    const { doctor_id, patient_id } = appointment;
    this.notifyUser(doctor_id, 'appointment:update', appointment);
    this.notifyUser(patient_id, 'appointment:update', appointment);
    // Push notification to patient about status change
    this.notifyUser(patient_id, 'notification:new', {
      type: 'appointment',
      title: 'Appointment Updated',
      message: `Your appointment status changed to ${appointment.status}`,
      timestamp: new Date().toISOString(),
      data: { appointmentId: appointment.id },
    });
    this.emitDistributed('appointment:update', appointment);
  }

  emitAppointmentCancelled(appointment) {
    const { doctor_id, patient_id } = appointment;
    this.notifyUser(doctor_id, 'appointment:cancelled', appointment);
    this.notifyUser(patient_id, 'appointment:cancelled', appointment);
    // Notify both about cancellation
    this.notifyUser(doctor_id, 'notification:new', {
      type: 'appointment',
      title: 'Appointment Cancelled',
      message: `An appointment has been cancelled`,
      timestamp: new Date().toISOString(),
      data: { appointmentId: appointment.id },
    });
    this.notifyUser(patient_id, 'notification:new', {
      type: 'appointment',
      title: 'Appointment Cancelled',
      message: `Your appointment has been cancelled`,
      timestamp: new Date().toISOString(),
      data: { appointmentId: appointment.id },
    });
    this.emitDistributed('appointment:cancelled', appointment);
  }

  emitConsultationStarted(consultation) {
    const { doctor_id, patient_id } = consultation;
    this.notifyUser(patient_id, 'consultation:started', consultation);
    this.emitDistributed('consultation:started', consultation);
  }

  emitConsultationEnded(consultation) {
    const { doctor_id, patient_id } = consultation;
    this.notifyUser(doctor_id, 'consultation:ended', consultation);
    this.notifyUser(patient_id, 'consultation:ended', consultation);
    this.emitDistributed('consultation:ended', consultation);
  }

  emitEmergencyRequest(emergency) {
    // Broadcast to all ambulance rooms
    this.notifyRoom('ambulance:dispatch', 'emergency:new', emergency);
    this.emitDistributed('emergency:new', emergency);
  }

  emitAmbulanceAssigned(data) {
    const { patient_id, requestId } = data;
    this.notifyUser(patient_id, 'ambulance:assigned', data);
    this.notifyRoom(`ambulance:${requestId}`, 'ambulance:assigned', data);
    this.emitDistributed('ambulance:assigned', data);
  }

  emitAmbulanceStatus(requestId, patientUserId, status, data = {}) {
    const payload = { requestId, status, ...data, timestamp: new Date().toISOString() };
    this.notifyUser(patientUserId, 'ambulance:status-update', payload);
    this.notifyRoom(`ambulance:${requestId}`, 'ambulance:status-update', payload);
    this.emitDistributed('ambulance:status-update', payload);
  }

  emitPrescriptionCreated(prescription) {
    const { patient_id } = prescription;
    this.notifyUser(patient_id, 'prescription:new', prescription);
    this.emitDistributed('prescription:created', prescription);
  }

  emitOrderStatusUpdated(order) {
    const { patient_id, pharmacy_owner_id } = order;
    // Normalize payload to include fields expected by web & Android clients
    const payload = {
      ...order,
      orderId: order.id,
      orderNumber: order.order_number || order.id?.slice(0, 8)?.toUpperCase(),
      message: `Order status updated to ${order.status}`,
      timestamp: order.updated_at || new Date().toISOString(),
    };
    this.notifyUser(patient_id, 'order:update', payload);
    if (pharmacy_owner_id) {
      this.notifyUser(pharmacy_owner_id, 'order:update', payload);
    }
    this.emitDistributed('order:update', payload);
  }

  emitNewOrder(order) {
    const { pharmacy_owner_id } = order;
    if (pharmacy_owner_id) {
      this.notifyUser(pharmacy_owner_id, 'order:new', order);
    }
    this.emitDistributed('order:new', order);
  }

  emitDiagnosticBookingCreated(booking) {
    const { patient_id, center_id, center_owner_id } = booking;
    this.notifyUser(patient_id, 'diagnostic:booking-confirmed', booking);
    const patientNotif = {
      title: 'Booking Confirmed',
      message: 'Your diagnostic test booking has been confirmed',
      type: 'diagnostic_booking',
    };
    this.notifyUser(patient_id, 'notification:new', patientNotif);
    try {
      const notificationService = require('./notificationService');
      notificationService.sendNotification(patient_id, patientNotif).catch(() => {});
    } catch {}
    // Notify the diagnostic center owner for real-time dashboard updates
    if (center_owner_id) {
      this.notifyUser(center_owner_id, 'diagnostic:new-booking', booking);
      this.notifyUser(center_owner_id, 'notification:new', {
        title: 'New Booking',
        message: 'A new diagnostic test booking has been received',
        type: 'diagnostic_booking',
        timestamp: new Date().toISOString(),
      });
    }
    this.emitDistributed('diagnostic:booked', booking);
  }

  emitDiagnosticBookingStatusUpdated(booking) {
    const { patient_id } = booking;
    this.notifyUser(patient_id, 'diagnostic:booking-updated', booking);
    const patientNotif = {
      title: 'Booking Updated',
      message: `Your diagnostic booking status changed to ${booking.status}`,
      type: 'diagnostic_update',
    };
    this.notifyUser(patient_id, 'notification:new', patientNotif);
    try {
      const notificationService = require('./notificationService');
      notificationService.sendNotification(patient_id, patientNotif).catch(() => {});
    } catch {}
    this.emitDistributed('diagnostic:status-updated', booking);
  }

  emitDiagnosticResultUploaded(booking) {
    const { patient_id } = booking;
    this.notifyUser(patient_id, 'diagnostic:result-ready', booking);
    const patientNotif = {
      title: 'Results Ready',
      message: 'Your diagnostic test results are now available',
      type: 'diagnostic_result',
    };
    this.notifyUser(patient_id, 'notification:new', patientNotif);
    try {
      const notificationService = require('./notificationService');
      notificationService.sendNotification(patient_id, patientNotif).catch(() => {});
    } catch {}
    this.emitDistributed('diagnostic:result-uploaded', booking);
  }

  emitNotification(userId, notification) {
    const payload = {
      timestamp: new Date().toISOString(),
      ...notification,
    };
    this.notifyUser(userId, 'notification:new', payload);
    this.emitDistributed('notification:sent', { userId, notification: payload });
  }

  emitProviderCatalogUpdated(update = {}) {
    const payload = {
      timestamp: new Date().toISOString(),
      ...update,
    };
    this.notifyRoom('role:patient', 'catalog:refresh', payload);
    this.emitDistributed('catalog:refresh', payload);
  }

  // Improvement #13: Real-time inventory updates
  emitInventoryUpdated(pharmacyId, pharmacyOwnerId, inventoryItem = {}) {
    const payload = {
      pharmacyId,
      item: inventoryItem,
      timestamp: new Date().toISOString(),
    };
    // Notify patients viewing this pharmacy's inventory
    this.notifyRoom(`pharmacy:${pharmacyId}`, 'inventory:updated', payload);
    // Also notify the pharmacy owner for dashboard consistency
    if (pharmacyOwnerId) {
      this.notifyUser(pharmacyOwnerId, 'inventory:updated', payload);
    }
    this.emitDistributed('inventory:updated', payload);
  }

  // ── Backward-compatible aliases used by tests/legacy callers ────
  emitBulkNotification(userIds = [], notification = {}) {
    for (const userId of userIds) {
      this.emitNotification(userId, notification);
    }
  }

  emitToAdmins(event, data = {}) {
    this.notifyRoom('role:admin', event, data);
    this.notifyRoom('role:super_admin', event, data);
  }

  emitNewProviderRegistration(provider = {}) {
    const payload = {
      type: 'new_registration',
      provider: {
        id: provider.id,
        name: provider.name,
        type: provider.provider_type || provider.type,
      },
      timestamp: new Date().toISOString(),
    };
    this.notifyRoom('role:admin', 'admin:new-registration', payload);
    this.notifyRoom('role:super_admin', 'admin:new-registration', payload);
  }

  emitAppointmentUpdate(userId, appointment = {}, status) {
    const payload = {
      ...appointment,
      appointmentId: appointment.id,
      status,
      doctorName: appointment.doctor_name || appointment.doctorName,
      timestamp: new Date().toISOString(),
    };
    this.notifyUser(userId, 'appointment:update', payload);
  }

  emitNewEmergency(emergency = {}) {
    const payload = {
      ...emergency,
      timestamp: new Date().toISOString(),
    };
    this.notifyRoom('role:admin', 'emergency:new', payload);
    this.notifyRoom('role:super_admin', 'emergency:new', payload);
    this.notifyRoom('role:ambulance_operator', 'emergency:new', payload);
  }

  emitOrderUpdate(patientId, order = {}, status) {
    const statusMessages = {
      pending: 'Your order has been received',
      confirmed: 'Your order has been confirmed',
      dispatched: 'Your order is on the way',
      delivered: 'Your order has been delivered',
      cancelled: 'Your order has been cancelled',
    };

    const payload = {
      ...order,
      orderId: order.id,
      orderNumber: order.order_number || order.orderNumber,
      status,
      message: statusMessages[status] || `Your order status is now ${status}`,
      timestamp: new Date().toISOString(),
    };

    this.notifyUser(patientId, 'order:update', payload);
  }

  emitAmbulanceLocation(requestId, location = {}) {
    const payload = {
      requestId,
      ...location,
      timestamp: new Date().toISOString(),
    };
    this.notifyRoom(`ambulance:${requestId}`, 'ambulance:location-update', payload);
  }

  emitSystemAnnouncement(announcement = {}) {
    const payload = {
      ...announcement,
      timestamp: new Date().toISOString(),
    };
    try {
      if (this.io) {
        this.io.emit('system:announcement', payload);
      }
      this.emitDistributed('system:announcement', payload);
    } catch (err) {
      console.error('[EventEmitter] emitSystemAnnouncement error:', err.message);
    }
  }
}

const eventEmitter = new AppEventEmitter();

module.exports = eventEmitter;
