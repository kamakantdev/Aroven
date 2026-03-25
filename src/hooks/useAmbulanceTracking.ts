'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSocket } from './useSocket';

export interface AmbulancePosition {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    timestamp?: string;
}

export interface AmbulanceDriver {
    driverName?: string;
    driverPhone?: string;
    vehicleNumber?: string;
    vehicleType?: string;
}

interface UseAmbulanceTrackingResult {
    /** Current ambulance location */
    location: AmbulancePosition | null;
    /** Current emergency status */
    status: string | null;
    /** Estimated arrival time (string like "8 min") */
    eta: string | null;
    /** Whether actively receiving location updates */
    isTracking: boolean;
    /** Assigned driver information */
    driver: AmbulanceDriver | null;
    /** Start tracking an emergency request */
    startTracking: (requestId: string) => void;
    /** Stop tracking */
    stopTracking: () => void;
}

interface AmbulanceLocationUpdatePayload {
    requestId?: string;
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    timestamp?: string;
    eta?: string | number;
}

interface AmbulanceStatusUpdatePayload {
    requestId?: string;
    status: string;
    eta?: string | number;
}

interface AmbulanceAssignedPayload {
    requestId?: string;
    driverName?: string;
    driver_name?: string;
    driverPhone?: string;
    driver_phone?: string;
    vehicleNumber?: string;
    vehicle_number?: string;
    vehicleType?: string;
    vehicle_type?: string;
}

/**
 * Hook for real-time ambulance tracking via Socket.IO.
 * Uses the ambulance:track / ambulance:location-update / ambulance:status-update events.
 */
export function useAmbulanceTracking(initialRequestId?: string | null): UseAmbulanceTrackingResult {
    const { emit, on, isConnected } = useSocket();
    const [location, setLocation] = useState<AmbulancePosition | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [eta, setEta] = useState<string | null>(null);
    const [isTracking, setIsTracking] = useState(false);
    const [driver, setDriver] = useState<AmbulanceDriver | null>(null);
    const [requestId, setRequestId] = useState<string | null>(initialRequestId || null);

    const startTracking = useCallback((id: string) => {
        setRequestId(id);
        setIsTracking(true);
    }, []);

    const stopTracking = useCallback(() => {
        // Emit untrack to leave the server room
        if (requestId) {
            emit('ambulance:untrack', requestId);
        }
        setRequestId(null);
        setIsTracking(false);
        setLocation(null);
        setStatus(null);
        setEta(null);
        setDriver(null);
    }, [requestId, emit]);

    useEffect(() => {
        if (!requestId || !isConnected) return;

        // Subscribe to ambulance tracking room
        emit('ambulance:track', requestId);

        // Listen for location updates
        const unsubLocation = on('ambulance:location-update', (data: AmbulanceLocationUpdatePayload) => {
            if (data.requestId === requestId || !data.requestId) {
                setLocation({
                    latitude: data.latitude,
                    longitude: data.longitude,
                    heading: data.heading,
                    speed: data.speed,
                    timestamp: data.timestamp,
                });
                if (data.eta) setEta(String(data.eta));
            }
        });

        // Listen for status updates
        const unsubStatus = on('ambulance:status-update', (data: AmbulanceStatusUpdatePayload) => {
            if (data.requestId === requestId || !data.requestId) {
                setStatus(data.status);
                if (data.eta) setEta(String(data.eta));
            }
        });

        // Listen for ambulance assigned (driver info)
        const unsubAssigned = on('ambulance:assigned', (data: AmbulanceAssignedPayload) => {
            if (data.requestId === requestId || !data.requestId) {
                setDriver({
                    driverName: data.driverName || data.driver_name,
                    driverPhone: data.driverPhone || data.driver_phone,
                    vehicleNumber: data.vehicleNumber || data.vehicle_number,
                    vehicleType: data.vehicleType || data.vehicle_type,
                });
                setStatus('assigned');
            }
        });

        return () => {
            unsubLocation();
            unsubStatus();
            unsubAssigned();
            emit('ambulance:untrack', requestId);
        };
    }, [requestId, isConnected, emit, on]);

    // Re-subscribe on reconnect
    useEffect(() => {
        if (isConnected && requestId && isTracking) {
            emit('ambulance:track', requestId);
        }
    }, [isConnected, requestId, isTracking, emit]);

    return { location, status, eta, isTracking, driver, startTracking, stopTracking };
}
