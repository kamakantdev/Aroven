'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/authStore';

// Socket.IO event types
export interface Notification {
    id?: string;
    type: string;
    title: string;
    message: string;
    timestamp: string;
    data?: Record<string, unknown>;
}

export interface AppointmentUpdate {
    id?: string;
    appointmentId?: string;
    patient_id?: string;
    doctor_id?: string;
    status: string;
    doctorName?: string;
    date?: string;
    appointment_date?: string;
    timeSlot?: string;
    time_slot?: string;
    timestamp?: string;
}

// AmbulanceUpdate type moved to hooks/useAmbulanceTracking.ts (AmbulancePosition)

export interface OrderUpdate {
    orderId: string;
    orderNumber: string;
    status: string;
    message: string;
    timestamp: string;
}

export interface DiagnosticBookingUpdate {
    id: string;
    status: string;
    patient_name?: string;
    test_name?: string;
    booking_date?: string;
    result_url?: string;
    message?: string;
    timestamp?: string;
}

export interface VitalUpdate {
    patientId: string;
    vital: {
        id: string;
        type: string;
        value: string;
        unit?: string;
        notes?: string;
        recorded_at: string;
    };
}

export interface ConsultationReady {
    consultationId: string;
    doctorName: string;
    roomId: string;
    timestamp: string;
}

export interface ChatMessage {
    id?: string;
    consultationId?: string;
    userId: string;
    message: string;
    timestamp: string;
}

export interface ConsultationStarted {
    consultationId: string;
    appointmentId: string;
    doctorName: string;
    roomId: string;
    type?: string;
    timestamp: string;
}

export interface ConsultationEnded {
    consultationId: string;
    appointmentId?: string;
    duration?: number;
    prescriptionId?: string;
    timestamp: string;
}

export interface PrescriptionUpdate {
    id: string;
    consultationId?: string;
    doctorName?: string;
    medications?: unknown[];
    diagnosis?: string;
    timestamp: string;
}

// Socket connection options
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5001';

// ── Singleton socket instance (shared across all useSocket() calls) ──
let globalSocket: Socket | null = null;
let globalSocketToken: string | null = null;
let socketRefCount = 0;

function getOrCreateSocket(token: string): Socket {
    // Reuse existing socket if token hasn't changed
    if (globalSocket && globalSocketToken === token && globalSocket.connected) {
        return globalSocket;
    }

    // Token changed or no socket — disconnect old and create new
    if (globalSocket) {
        globalSocket.disconnect();
        globalSocket = null;
    }

    globalSocketToken = token;
    globalSocket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30000,
        randomizationFactor: 0.5,
    });

    globalSocket.on('connect', () => {
        console.log('Socket connected:', globalSocket?.id);
        globalSocket?.emit('subscribe:notifications');
        // Subscribe to role-specific channel for targeted broadcasts
        globalSocket?.emit('subscribe:role');
    });

    return globalSocket;
}

/**
 * Hook for managing Socket.IO connection and real-time events.
 * Uses a SINGLETON socket — multiple components calling useSocket()
 * share the same underlying connection.
 */
export function useSocket() {
    const socketRef = useRef<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [lastPing, setLastPing] = useState<Date | null>(null);
    const { accessToken, isAuthenticated } = useAuthStore();

    // Initialize socket connection (singleton)
    useEffect(() => {
        if (!isAuthenticated || !accessToken) {
            if (socketRef.current) {
                socketRef.current = null;
                setIsConnected(false);
            }
            return;
        }

        const socket = getOrCreateSocket(accessToken);
        socketRef.current = socket;
        socketRefCount++;

        // Track connection state locally
        const onConnect = () => setIsConnected(true);
        const onDisconnect = () => setIsConnected(false);
        const onConnectError = () => setIsConnected(false);
        const onPong = () => setLastPing(new Date());

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('connect_error', onConnectError);
        socket.on('pong', onPong);

        // Set initial state
        setIsConnected(socket.connected);

        // If not yet connected, connect
        if (!socket.connected) {
            socket.connect();
        }

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('connect_error', onConnectError);
            socket.off('pong', onPong);
            socketRefCount = Math.max(0, socketRefCount - 1);

            // Only disconnect when last consumer unmounts
            if (socketRefCount === 0) {
                socket.disconnect();
                globalSocket = null;
                globalSocketToken = null;
            }
            socketRef.current = null;
        };
    }, [isAuthenticated, accessToken]);

    // Get socket instance
    const getSocket = useCallback(() => socketRef.current, []);

    // Emit event
    const emit = useCallback((event: string, data?: unknown) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit(event, data);
        }
    }, []);

    // Subscribe to event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const on = useCallback((event: string, callback: (...args: any[]) => void) => {
        socketRef.current?.on(event, callback);
        return () => {
            socketRef.current?.off(event, callback);
        };
    }, []);

    // Unsubscribe from event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const off = useCallback((event: string, callback?: (...args: any[]) => void) => {
        if (callback) {
            socketRef.current?.off(event, callback);
        } else {
            socketRef.current?.removeAllListeners(event);
        }
    }, []);

    return {
        socket: socketRef.current,
        isConnected,
        lastPing,
        emit,
        on,
        off,
        getSocket,
    };
}

/**
 * Hook for handling notifications — persists in localStorage to survive page refreshes.
 */
export function useNotifications(onNotification?: (notification: Notification) => void) {
    const { on } = useSocket();
    const [notifications, setNotifications] = useState<Notification[]>(() => {
        if (typeof window === 'undefined') return [];
        try {
            const stored = localStorage.getItem('swastik-notifications');
            if (!stored) return [];
            const parsed = JSON.parse(stored);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            // Corrupted data — clear it
            try { localStorage.removeItem('swastik-notifications'); } catch { /* ignore */ }
            return [];
        }
    });

    // Persist to localStorage whenever notifications change
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem('swastik-notifications', JSON.stringify(notifications.slice(0, 50)));
        } catch { /* quota exceeded — ignore */ }
    }, [notifications]);

    useEffect(() => {
        const handleNotification = (notification: Notification) => {
            setNotifications((prev) => [notification, ...prev].slice(0, 50));
            onNotification?.(notification);
        };

        return on('notification:new', handleNotification);
    }, [on, onNotification]);

    const clearNotifications = useCallback(() => {
        setNotifications([]);
        if (typeof window !== 'undefined') {
            localStorage.removeItem('swastik-notifications');
        }
    }, []);

    const unreadCount = notifications.length;

    return { notifications, unreadCount, clearNotifications };
}

/**
 * Hook for handling appointment updates
 */
export function useAppointmentUpdates(onUpdate?: (update: AppointmentUpdate) => void) {
    const { on } = useSocket();
    const [lastUpdate, setLastUpdate] = useState<AppointmentUpdate | null>(null);

    useEffect(() => {
        const handleUpdate = (update: AppointmentUpdate) => {
            setLastUpdate(update);
            onUpdate?.(update);
        };

        const unsubUpdate = on('appointment:update', handleUpdate);
        const unsubNew = on('appointment:new', handleUpdate);
        const unsubConfirmed = on('appointment:confirmed', handleUpdate);
        const unsubCancelled = on('appointment:cancelled', handleUpdate);

        return () => {
            unsubUpdate();
            unsubNew();
            unsubConfirmed();
            unsubCancelled();
        };
    }, [on, onUpdate]);

    return { lastUpdate };
}

// NOTE: useAmbulanceTracking is in hooks/useAmbulanceTracking.ts (dedicated file with start/stop controls)

/**
 * Hook for order updates
 */
export function useOrderUpdates(onUpdate?: (update: OrderUpdate) => void, onNewOrder?: (order: OrderUpdate) => void) {
    const { on } = useSocket();
    const [lastUpdate, setLastUpdate] = useState<OrderUpdate | null>(null);
    const [newOrders, setNewOrders] = useState<OrderUpdate[]>([]);

    useEffect(() => {
        const handleUpdate = (update: OrderUpdate) => {
            setLastUpdate(update);
            onUpdate?.(update);
        };

        const handleNewOrder = (order: OrderUpdate) => {
            setNewOrders((prev) => [order, ...prev].slice(0, 20));
            onNewOrder?.(order);
        };

        const unsubUpdate = on('order:update', handleUpdate);
        const unsubNew = on('order:new', handleNewOrder);

        return () => {
            unsubUpdate();
            unsubNew();
        };
    }, [on, onUpdate, onNewOrder]);

    return { lastUpdate, newOrders };
}

/**
 * Hook for diagnostic booking updates (for diagnostic center owners)
 */
export function useDiagnosticUpdates(
    onNewBooking?: (booking: DiagnosticBookingUpdate) => void,
    onStatusUpdate?: (booking: DiagnosticBookingUpdate) => void,
    onResultReady?: (booking: DiagnosticBookingUpdate) => void
) {
    const { on } = useSocket();
    const [newBookings, setNewBookings] = useState<DiagnosticBookingUpdate[]>([]);
    const [lastUpdate, setLastUpdate] = useState<DiagnosticBookingUpdate | null>(null);

    useEffect(() => {
        const handleNewBooking = (booking: DiagnosticBookingUpdate) => {
            setNewBookings((prev) => [booking, ...prev].slice(0, 20));
            onNewBooking?.(booking);
        };

        const handleStatusUpdate = (booking: DiagnosticBookingUpdate) => {
            setLastUpdate(booking);
            onStatusUpdate?.(booking);
        };

        const handleResultReady = (booking: DiagnosticBookingUpdate) => {
            setLastUpdate(booking);
            onResultReady?.(booking);
        };

        const unsubs = [
            on('diagnostic:new-booking', handleNewBooking),
            on('diagnostic:booking-confirmed', handleNewBooking),
            on('diagnostic:booking-updated', handleStatusUpdate),
            on('diagnostic:result-ready', handleResultReady),
        ];

        return () => { unsubs.forEach((unsub) => unsub()); };
    }, [on, onNewBooking, onStatusUpdate, onResultReady]);

    return { newBookings, lastUpdate };
}

/**
 * Hook for vitals updates (for doctors)
 */
export function useVitalsUpdates(onNewVital?: (vital: VitalUpdate) => void) {
    const { on } = useSocket();
    const [newVitals, setNewVitals] = useState<VitalUpdate[]>([]);

    useEffect(() => {
        const handleNewVital = (vital: VitalUpdate) => {
            setNewVitals((prev) => [vital, ...prev].slice(0, 50));
            onNewVital?.(vital);
        };

        return on('vitals:new', handleNewVital);
    }, [on, onNewVital]);

    return { newVitals };
}

/**
 * Hook for video consultation events
 */
export function useVideoConsultation(roomId: string | null) {
    const { emit, on } = useSocket();
    const [participants, setParticipants] = useState<string[]>([]);
    const [offer, setOffer] = useState<RTCSessionDescriptionInit | null>(null);
    const [answer, setAnswer] = useState<RTCSessionDescriptionInit | null>(null);
    const [iceCandidate, setIceCandidate] = useState<RTCIceCandidateInit | null>(null);

    useEffect(() => {
        if (!roomId) return;

        // Join room
        emit('video:join', roomId);

        const handleUserJoined = (data: { userId: string }) => {
            setParticipants((prev) => [...new Set([...prev, data.userId])]);
        };

        const handleUserLeft = (data: { userId: string }) => {
            setParticipants((prev) => prev.filter((id) => id !== data.userId));
        };

        const handleOffer = (data: { offer: RTCSessionDescriptionInit }) => setOffer(data.offer);
        const handleAnswer = (data: { answer: RTCSessionDescriptionInit }) => setAnswer(data.answer);
        const handleIceCandidate = (data: { candidate: RTCIceCandidateInit }) => setIceCandidate(data.candidate);

        const unsubs = [
            on('video:user-joined', handleUserJoined),
            on('video:user-left', handleUserLeft),
            on('video:offer', handleOffer),
            on('video:answer', handleAnswer),
            on('video:ice-candidate', handleIceCandidate),
        ];

        return () => {
            emit('video:leave', roomId);
            unsubs.forEach((unsub) => unsub());
        };
    }, [roomId, emit, on]);

    const sendOffer = useCallback(
        (offerData: RTCSessionDescriptionInit) => {
            emit('video:offer', { roomId, offer: offerData });
        },
        [roomId, emit]
    );

    const sendAnswer = useCallback(
        (answerData: RTCSessionDescriptionInit) => {
            emit('video:answer', { roomId, answer: answerData });
        },
        [roomId, emit]
    );

    const sendIceCandidate = useCallback(
        (candidate: RTCIceCandidateInit) => {
            emit('video:ice-candidate', { roomId, candidate });
        },
        [roomId, emit]
    );

    return {
        participants,
        offer,
        answer,
        iceCandidate,
        sendOffer,
        sendAnswer,
        sendIceCandidate,
    };
}

/**
 * Hook for consultation started events (C1) — fires when doctor starts a video consultation
 */
export function useConsultationStarted(onStarted?: (data: ConsultationStarted) => void) {
    const { on } = useSocket();
    const [consultation, setConsultation] = useState<ConsultationStarted | null>(null);

    useEffect(() => {
        const handleStarted = (data: ConsultationStarted) => {
            setConsultation(data);
            onStarted?.(data);
        };

        return on('consultation:started', handleStarted);
    }, [on, onStarted]);

    return { consultation };
}

/**
 * Hook for consultation ended events (M5/I9) — fires when doctor ends a consultation
 */
export function useConsultationEnded(onEnded?: (data: ConsultationEnded) => void) {
    const { on } = useSocket();
    const [endedConsultation, setEndedConsultation] = useState<ConsultationEnded | null>(null);

    useEffect(() => {
        const handleEnded = (data: ConsultationEnded) => {
            setEndedConsultation(data);
            onEnded?.(data);
        };

        return on('consultation:ended', handleEnded);
    }, [on, onEnded]);

    return { endedConsultation };
}

/**
 * Hook for prescription updates (C2) — fires when doctor creates a new prescription
 */
export function usePrescriptionUpdates(onPrescription?: (data: PrescriptionUpdate) => void) {
    const { on } = useSocket();
    const [lastPrescription, setLastPrescription] = useState<PrescriptionUpdate | null>(null);

    useEffect(() => {
        const handlePrescription = (data: PrescriptionUpdate) => {
            setLastPrescription(data);
            onPrescription?.(data);
        };

        return on('prescription:new', handlePrescription);
    }, [on, onPrescription]);

    return { lastPrescription };
}

/**
 * Hook for consultation chat
 */
export function useConsultationChat(consultationId: string | null) {
    const { emit, on } = useSocket();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);

    useEffect(() => {
        if (!consultationId) return;

        // Join chat
        emit('chat:join', consultationId);

        const handleMessage = (message: ChatMessage) => {
            setMessages((prev) => [...prev, message]);
        };

        const handleTyping = (data: { userId: string; isTyping: boolean }) => {
            if (data.isTyping) {
                setTypingUsers((prev) => [...new Set([...prev, data.userId])]);
            } else {
                setTypingUsers((prev) => prev.filter((id) => id !== data.userId));
            }
        };

        const unsubs = [
            on('chat:message', handleMessage),
            on('chat:typing', handleTyping),
        ];

        return () => {
            unsubs.forEach((unsub) => unsub());
            emit('chat:leave', consultationId);
        };
    }, [consultationId, emit, on]);

    const sendMessage = useCallback(
        (message: string) => {
            emit('chat:message', { consultationId, message });
        },
        [consultationId, emit]
    );

    const setTyping = useCallback(
        (isTyping: boolean) => {
            emit('chat:typing', { consultationId, isTyping });
        },
        [consultationId, emit]
    );

    return {
        messages,
        typingUsers,
        sendMessage,
        setTyping,
    };
}

// ── Vitals Types ──────────────────────────────────────────────────

export interface VitalsStreamData {
    session_id: string;
    heart_rate?: number;
    respiration_rate?: number;
    posture?: string;
    spine_angle?: number;
    fall_detected?: boolean;
    tremor_detected?: boolean;
    tremor_severity?: number;
    tremor_frequency?: number;
    drowsiness_score?: number;
    facial_asymmetry_score?: number;
    stress_level?: string;
    hrv_rmssd?: number;
    hrv_sdnn?: number;
    pain_score?: number;
    pain_action_units?: string;
    skin_condition?: string;
    skin_classification?: string;
    skin_confidence?: number;
    pallor_score?: number;
    hemoglobin_estimate?: number;
    spo2?: number;
    temperature?: number;
    blood_pressure_systolic?: number;
    blood_pressure_diastolic?: number;
    processed_at?: string;
    patient_user_id?: string;
    alerts?: VitalsAlert[];
    active_signals?: string[];
    total_signals?: number;
}

export interface VitalsAlert {
    /** Unique machine-readable alert code, e.g. "TACHYCARDIA", "FALL_DETECTED" */
    code: string;
    /** The CV signal metric that triggered this alert, e.g. "heart_rate" */
    metric: string;
    /** Clinical severity level */
    severity: 'critical' | 'warning' | 'info';
    /** Clinical threshold that was breached (null for boolean signals) */
    threshold?: number | null;
    /** The actual measured value at trigger time */
    current_value?: number | boolean | null;
    /** Human-readable clinical message */
    message: string;
    /** ISO 8601 UTC timestamp */
    timestamp: string;
}

/**
 * Hook for real-time vitals streaming during consultation.
 * Native FastAPI WebSockets architecture.
 */
/**
 * Hook for real-time vitals streaming during consultation.
 * Production-hardened: JWT auth, exponential backoff reconnect,
 * stream replay via last_id, and application-level ping/pong.
 */
export function useVitalsStream(sessionId: string | null, role: 'doctor' | 'patient' = 'doctor') {
    const [latestVitals, setLatestVitals] = useState<VitalsStreamData | null>(null);
    const [vitalsHistory, setVitalsHistory] = useState<VitalsStreamData[]>([]);
    const [alerts, setAlerts] = useState<VitalsAlert[]>([]);
    const [criticalAlert, setCriticalAlert] = useState<{ sessionId: string; alerts: VitalsAlert[] } | null>(null);
    const [aiInsights, setAiInsights] = useState<Record<string, unknown> | string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const lastMessageIdRef = useRef<string | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const isUnmountedRef = useRef(false);
    const connectRef = useRef<(() => void) | null>(null);

    const connect = useCallback(() => {
        if (!sessionId || isUnmountedRef.current) return;

        // Read JWT from localStorage (written by authStore on login)
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

        // Build WebSocket URL with auth token and optional stream replay ID
        const params = new URLSearchParams();
        if (token) params.set('token', token);
        if (role === 'doctor' && lastMessageIdRef.current) {
            params.set('last_id', lastMessageIdRef.current);
        }
        const query = params.toString();
        const baseUrl = (process.env.NEXT_PUBLIC_AI_WS_URL || 'ws://localhost:8000').replace(/^http/, 'ws').replace(/\/$/, '');
        const wsUrl = `${baseUrl}/ws/vitals/${sessionId}/${role}${query ? `?${query}` : ''}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            reconnectAttemptsRef.current = 0; // Reset backoff counter on successful connect
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                // Respond to server keepalive pings
                if (data.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong', ts: data.ts }));
                    return;
                }
                if (data.type === 'pong') return;

                // Track last Redis stream message ID for replay on reconnect
                if (data._stream_id) lastMessageIdRef.current = data._stream_id;

                // AI reasoning from background LLM inference
                if (data.ai_reasoning) {
                    setAiInsights(data.ai_reasoning);
                    return;
                }

                // Regular CV Edge Stream payload
                setLatestVitals(data);
                setVitalsHistory(prev => [data, ...prev].slice(0, 120));

                if (data.alerts?.length > 0) {
                    const incoming = data.alerts as VitalsAlert[];
                    setAlerts(prev => [...incoming, ...prev].slice(0, 50));
                    // Only flash critical-severity alerts as the visual overlay
                    const criticals = incoming.filter(a => a.severity === 'critical');
                    if (criticals.length > 0) {
                        setCriticalAlert({ sessionId, alerts: criticals });
                        setTimeout(() => setCriticalAlert(null), 10000);
                    }
                }
            } catch (err) {
                console.error('FastAPI WS parse error:', err);
            }
        };

        ws.onclose = (event) => {
            wsRef.current = null;
            if (isUnmountedRef.current) return;
            // Don't reconnect on auth rejections (4001 = missing/expired token, 4003 = wrong role)
            if (event.code === 4001 || event.code === 4003) {
                console.error(`Vitals WS auth error [${event.code}]: ${event.reason}`);
                return;
            }
            // Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s cap
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30_000);
            reconnectAttemptsRef.current += 1;
            reconnectTimerRef.current = setTimeout(() => connectRef.current?.(), delay);
        };

        ws.onerror = () => ws.close();
    }, [sessionId, role]);

    useEffect(() => {
        isUnmountedRef.current = false;
        connectRef.current = connect;
        connect();
        return () => {
            isUnmountedRef.current = true;
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            wsRef.current?.close();
            wsRef.current = null;
        };
    }, [connect]);

    const sendVitals = useCallback((vitals: Partial<VitalsStreamData>) => {
        if (!sessionId || wsRef.current?.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(JSON.stringify(vitals));
    }, [sessionId]);

    return { latestVitals, vitalsHistory, alerts, criticalAlert, aiInsights, sendVitals };
}
