'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    AlertTriangle, Siren, Clock, MapPin, Loader2, RefreshCw, AlertCircle,
    Ambulance, CheckCircle, Phone, Navigation, Send, XCircle, User, Radio
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { hospitalApi } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import OsmMap from '@/components/shared/OsmMapDynamic';
import type { MapMarker } from '@/components/shared/OsmMapDynamic';

interface DispatchEmergency {
    id: string;
    requestNumber?: string;
    patientName: string;
    patientPhone?: string;
    location?: string;
    latitude?: number;
    longitude?: number;
    type: string;
    priority: string;
    status: string;
    dispatchMode?: string;
    createdAt: string;
    assignedAt?: string;
    ambulance?: {
        id: string;
        vehicleNumber: string;
        driverName: string;
        driverPhone?: string;
        type?: string;
        latitude?: number;
        longitude?: number;
    } | null;
    notes?: string;
}

interface AvailableAmbulance {
    id: string;
    vehicle_number: string;
    driver_name: string;
    driver_phone?: string;
    vehicle_type: string;
    current_latitude: number;
    current_longitude: number;
    distance: number;
    distanceText: string;
    eta: string;
}

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
    pending: { color: 'bg-red-100 text-red-700', label: 'PENDING', icon: '🔴' },
    broadcasting: { color: 'bg-orange-100 text-orange-700', label: 'BROADCASTING', icon: '📡' },
    assigned: { color: 'bg-blue-100 text-blue-700', label: 'ASSIGNED', icon: '📋' },
    accepted: { color: 'bg-indigo-100 text-indigo-700', label: 'ACCEPTED', icon: '✅' },
    en_route: { color: 'bg-yellow-100 text-yellow-700', label: 'EN ROUTE', icon: '🚑' },
    arrived: { color: 'bg-green-100 text-green-700', label: 'ARRIVED', icon: '📍' },
    picked_up: { color: 'bg-purple-100 text-purple-700', label: 'PICKED UP', icon: '🏥' },
    en_route_hospital: { color: 'bg-teal-100 text-teal-700', label: 'TO HOSPITAL', icon: '🏥' },
    arrived_hospital: { color: 'bg-emerald-100 text-emerald-700', label: 'AT HOSPITAL', icon: '✅' },
    completed: { color: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400', label: 'COMPLETED', icon: '✔️' },
    cancelled: { color: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400', label: 'CANCELLED', icon: '❌' },
};

const PRIORITY_COLORS: Record<string, string> = {
    critical: 'text-red-600 bg-red-50 border-red-200',
    high: 'text-orange-600 bg-orange-50 border-orange-200',
    normal: 'text-blue-600 bg-blue-50 border-blue-200',
};

export default function HospitalEmergencyPage() {
    const [emergencies, setEmergencies] = useState<DispatchEmergency[]>([]);
    const [availableAmbulances, setAvailableAmbulances] = useState<AvailableAmbulance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [assigningId, setAssigningId] = useState<string | null>(null);
    const [selectedEmergency, setSelectedEmergency] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const { on, emit } = useSocket();

    const fetchEmergencies = useCallback(async () => {
        setError(null);
        try {
            const result = await hospitalApi.getDispatchEmergencies();
            if (result.success) {
                setEmergencies(Array.isArray(result.data) ? result.data : []);
            } else {
                setError(result.error || 'Failed to load emergencies');
            }
        } catch {
            setError('Failed to connect to server.');
        }
        setIsLoading(false);
    }, []);

    const fetchAvailableAmbulances = useCallback(async (lat: number, lng: number) => {
        try {
            const result = await hospitalApi.getAvailableAmbulances(lat, lng);
            if (result.success) {
                setAvailableAmbulances(Array.isArray(result.data) ? result.data : []);
            }
        } catch { /* silent */ }
    }, []);

    useEffect(() => { fetchEmergencies(); }, [fetchEmergencies]);

    // Join dispatch room for real-time updates
    useEffect(() => {
        emit('ambulance:join-dispatch', {});
        const unsub1 = on('emergency:new', () => fetchEmergencies());
        const unsub2 = on('emergency:updated', () => fetchEmergencies());
        const unsub3 = on('ambulance:status-update', () => fetchEmergencies());
        // M3: Listen for ambulance location updates to move map markers in real-time
        const unsub4 = on('ambulance:location-update', (data: any) => {
            const hasLat = Number.isFinite(data?.latitude);
            const hasLng = Number.isFinite(data?.longitude);
            if (hasLat && hasLng) {
                setEmergencies(prev => prev.map(e => {
                    if (e.ambulance && (e.id === data.requestId || e.ambulance.id === data.ambulanceId)) {
                        return {
                            ...e,
                            ambulance: {
                                ...e.ambulance,
                                latitude: data.latitude,
                                longitude: data.longitude,
                            }
                        };
                    }
                    return e;
                }));
            }
        });
        return () => { unsub1(); unsub2(); unsub3(); unsub4(); emit('ambulance:leave-dispatch', {}); };
    }, [on, emit, fetchEmergencies]);

    // Auto-refresh every 15 seconds
    useEffect(() => {
        const interval = setInterval(fetchEmergencies, 15000);
        return () => clearInterval(interval);
    }, [fetchEmergencies]);

    // When selecting an emergency for assignment, load available ambulances
    const handleSelectForAssign = async (emergency: DispatchEmergency) => {
        setSelectedEmergency(emergency.id);
        const { latitude, longitude } = emergency;
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
            await fetchAvailableAmbulances(latitude as number, longitude as number);
        }
    };

    const handleAssignAmbulance = async (requestId: string, ambulanceId: string) => {
        setActionLoading(requestId);
        try {
            const result = await hospitalApi.assignAmbulance(requestId, ambulanceId);
            if (result.success) {
                setSelectedEmergency(null);
                setAvailableAmbulances([]);
                await fetchEmergencies();
            }
        } catch (err) {
            console.error('Assignment failed:', err);
        }
        setActionLoading(null);
    };

    const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const formatTimeAgo = (dateStr: string) => {
        const mins = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
        return mins < 1 ? 'just now' : mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
    };

    const pendingCount = emergencies.filter(e => ['pending', 'broadcasting'].includes(e.status)).length;
    const activeCount = emergencies.filter(e => ['accepted', 'en_route', 'arrived', 'picked_up', 'en_route_hospital'].includes(e.status)).length;
    const assignedCount = emergencies.filter(e => e.status === 'assigned').length;

    // Map markers
    const mapMarkers: MapMarker[] = [];
    emergencies.forEach(e => {
        const patientLat = e.latitude;
        const patientLng = e.longitude;
        if (Number.isFinite(patientLat) && Number.isFinite(patientLng)) {
            mapMarkers.push({
                id: `patient-${e.id}`,
                lat: patientLat as number,
                lng: patientLng as number,
                title: e.patientName,
                popup: `${e.type || 'Emergency'} • ${STATUS_CONFIG[e.status]?.label || e.status}`,
                color: e.priority === 'critical' ? '#DC2626' : e.priority === 'high' ? '#F59E0B' : '#3B82F6',
                pulse: ['pending', 'broadcasting'].includes(e.status),
            });
        }
        const ambulanceLat = e.ambulance?.latitude;
        const ambulanceLng = e.ambulance?.longitude;
        if (Number.isFinite(ambulanceLat) && Number.isFinite(ambulanceLng)) {
            const ambulance = e.ambulance;
            mapMarkers.push({
                id: `amb-${e.id}`,
                lat: ambulanceLat as number,
                lng: ambulanceLng as number,
                title: `🚑 ${ambulance?.vehicleNumber || 'Ambulance'}`,
                popup: `${ambulance?.driverName || 'Driver'} → ${e.patientName}`,
                color: '#059669',
            });
        }
    });

    if (isLoading && emergencies.length === 0) {
        return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-red-600" /></div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">🚑 Emergency Dispatch Center</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Hospital-controlled ambulance dispatch • Real-time tracking</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={fetchEmergencies} leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card padding="md">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-100 rounded-xl"><AlertTriangle className="h-6 w-6 text-red-600" /></div>
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Pending / Broadcasting</p>
                            <p className="text-2xl font-bold text-red-600">{pendingCount}</p>
                        </div>
                    </div>
                </Card>
                <Card padding="md">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-xl"><Ambulance className="h-6 w-6 text-blue-600" /></div>
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Assigned / Waiting Accept</p>
                            <p className="text-2xl font-bold text-blue-600">{assignedCount}</p>
                        </div>
                    </div>
                </Card>
                <Card padding="md">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-xl"><Navigation className="h-6 w-6 text-green-600" /></div>
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Active (En Route / On Scene)</p>
                            <p className="text-2xl font-bold text-green-600">{activeCount}</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Live Map */}
            {mapMarkers.length > 0 && (
                <Card padding="none">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Radio className="h-5 w-5 text-red-500 animate-pulse" />
                            Live Dispatch Map
                        </CardTitle>
                    </CardHeader>
                    <div className="px-4 pb-4">
                        <OsmMap
                            lat={mapMarkers[0]?.lat || 20.5937}
                            lng={mapMarkers[0]?.lng || 78.9629}
                            zoom={12}
                            markers={mapMarkers}
                            height="350px"
                            fitBounds
                        />
                    </div>
                </Card>
            )}

            {error && (
                <Card padding="md">
                    <div className="text-center py-4 text-red-600">
                        <AlertCircle className="h-6 w-6 mx-auto mb-2" />
                        {error}
                        <Button className="mt-2" onClick={fetchEmergencies}>Retry</Button>
                    </div>
                </Card>
            )}

            {/* Ambulance Selection Panel */}
            {selectedEmergency && (
                <Card padding="md" className="border-2 border-blue-400 bg-blue-50/30">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-blue-900">🚑 Select Ambulance to Assign</h3>
                        <button onClick={() => { setSelectedEmergency(null); setAvailableAmbulances([]); }}
                            className="text-gray-400 hover:text-gray-600 dark:text-gray-400"><XCircle className="h-5 w-5" /></button>
                    </div>
                    {availableAmbulances.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-4">No available ambulances found nearby</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {availableAmbulances.map((amb) => (
                                <div key={amb.id} className="bg-white dark:bg-gray-900 border rounded-xl p-3 hover:border-blue-400 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium text-gray-900 dark:text-gray-100">{amb.vehicle_number}</span>
                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Available</span>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">{amb.driver_name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{amb.vehicle_type} • {amb.distanceText} • ETA {amb.eta}</p>
                                    <button
                                        onClick={() => handleAssignAmbulance(selectedEmergency, amb.id)}
                                        disabled={actionLoading === selectedEmergency}
                                        className="mt-2 w-full flex items-center justify-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {actionLoading === selectedEmergency ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                        Assign
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            )}

            {/* Emergency List */}
            {emergencies.length === 0 ? (
                <Card padding="md"><div className="text-center py-8 text-gray-500 dark:text-gray-400">No active emergencies</div></Card>
            ) : (
                <Card padding="none">
                    <CardHeader><CardTitle>Active Emergencies ({emergencies.length})</CardTitle></CardHeader>
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {emergencies.map((e) => {
                            const statusCfg = STATUS_CONFIG[e.status] || STATUS_CONFIG.pending;
                            const priorityCfg = PRIORITY_COLORS[e.priority] || PRIORITY_COLORS.normal;
                            return (
                                <div key={e.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-4 flex-1">
                                            <div className={`p-2.5 rounded-xl ${statusCfg.color}`}>
                                                <Siren className="h-5 w-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="font-medium text-gray-900 dark:text-gray-100">{e.patientName}</h3>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                                                        {statusCfg.icon} {statusCfg.label}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${priorityCfg}`}>
                                                        {e.priority?.toUpperCase()}
                                                    </span>
                                                    {e.dispatchMode === 'sos_broadcast' && (
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">SOS</span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-red-600 font-medium mt-1">{e.type}</p>
                                                <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500 dark:text-gray-400">
                                                    {e.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{e.location}</span>}
                                                    {e.patientPhone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{e.patientPhone}</span>}
                                                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatTimeAgo(e.createdAt)}</span>
                                                </div>
                                                {e.ambulance && (
                                                    <div className="mt-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-1.5 inline-flex items-center gap-2">
                                                        <Ambulance className="h-4 w-4" />
                                                        {e.ambulance.vehicleNumber} • {e.ambulance.driverName}
                                                        {e.ambulance.driverPhone && (
                                                            <a href={`tel:${e.ambulance.driverPhone}`} className="text-blue-600 underline ml-1">{e.ambulance.driverPhone}</a>
                                                        )}
                                                    </div>
                                                )}
                                                {e.notes && <p className="text-xs text-gray-400 mt-1 italic">{e.notes}</p>}
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {e.status === 'pending' && !e.ambulance && (
                                                <button
                                                    onClick={() => handleSelectForAssign(e)}
                                                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                                                >
                                                    <Ambulance className="h-3.5 w-3.5" />
                                                    <span>Assign Ambulance</span>
                                                </button>
                                            )}
                                            {e.patientPhone && (
                                                <a href={`tel:${e.patientPhone}`}
                                                    className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Call Patient">
                                                    <Phone className="h-4 w-4" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}
        </div>
    );
}
