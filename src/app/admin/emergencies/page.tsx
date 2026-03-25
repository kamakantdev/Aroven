'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    Siren, MapPin, Clock, Phone, AlertTriangle,
    CheckCircle, Ambulance, RefreshCw, Loader2,
    Radio, Eye
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { adminApi } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import OsmMap from '@/components/shared/OsmMapDynamic';
import type { MapMarker } from '@/components/shared/OsmMapDynamic';

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
    active: { color: 'bg-red-100 text-red-700 border-red-200', label: 'ACTIVE', icon: '🔴' },
    pending: { color: 'bg-red-100 text-red-700 border-red-200', label: 'PENDING', icon: '🔴' },
    broadcasting: { color: 'bg-orange-100 text-orange-700 border-orange-200', label: 'BROADCASTING', icon: '📡' },
    assigned: { color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'ASSIGNED', icon: '📋' },
    accepted: { color: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: 'ACCEPTED', icon: '✅' },
    dispatched: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'DISPATCHED', icon: '🚑' },
    en_route_pickup: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'EN ROUTE', icon: '🚑' },
    en_route: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'EN ROUTE', icon: '🚑' },
    arrived: { color: 'bg-green-100 text-green-700 border-green-200', label: 'ARRIVED', icon: '📍' },
    picked_up: { color: 'bg-purple-100 text-purple-700 border-purple-200', label: 'PICKED UP', icon: '🏥' },
    en_route_hospital: { color: 'bg-teal-100 text-teal-700 border-teal-200', label: 'TO HOSPITAL', icon: '🏥' },
    arrived_hospital: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'AT HOSPITAL', icon: '✅' },
    resolved: { color: 'bg-green-100 text-green-700 border-green-200', label: 'RESOLVED', icon: '✔️' },
    completed: { color: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700', label: 'COMPLETED', icon: '✔️' },
    cancelled: { color: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700', label: 'CANCELLED', icon: '❌' },
    timeout: { color: 'bg-orange-100 text-orange-700 border-orange-200', label: 'TIMEOUT', icon: '⏰' },
    no_ambulance: { color: 'bg-red-100 text-red-800 border-red-300', label: 'NO AMBULANCE', icon: '⚠️' },
};

interface Emergency {
    id: string;
    patientName: string;
    phone: string;
    location: string;
    type: string;
    status: string;
    priority?: string;
    dispatchMode?: string;
    requestedAt: string;
    ambulance?: string;
    ambulanceVehicle?: string;
    ambulanceDriver?: string;
    latitude?: number;
    longitude?: number;
}

export default function EmergenciesPage() {
    const [emergencies, setEmergencies] = useState<Emergency[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { on, emit } = useSocket();

    const fetchEmergencies = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await adminApi.getEmergencies();
            if (!result.success) throw new Error('Failed');
            const apiData = (result.data as any)?.data || (result.data as any) || [];
            const normalized: Emergency[] = (Array.isArray(apiData) ? apiData : []).map((item: any) => ({
                id: item.id,
                patientName: item.requester_name || item.patient?.name || item.patientName || 'Unknown patient',
                phone: item.requester_phone || item.phone || '',
                location: item.pickup_address || item.location || '',
                type: item.emergency_type || item.type || 'medical',
                status: item.status || 'pending',
                priority: item.priority,
                dispatchMode: item.dispatch_mode || item.dispatchMode,
                requestedAt: item.requested_at || item.created_at || item.requestedAt || '',
                ambulance: item.ambulance?.name || item.ambulance_name || item.ambulance || '',
                ambulanceVehicle: item.ambulance?.vehicle_number || item.vehicle_number || item.ambulanceVehicle || item.vehicle_id || '',
                ambulanceDriver: item.ambulance?.driver_name || item.ambulanceDriver || '',
                latitude: item.pickup_latitude ?? item.latitude,
                longitude: item.pickup_longitude ?? item.longitude,
            }));
            setEmergencies(normalized);
        } catch { setError('Failed to load emergency data'); }
        setIsLoading(false);
    }, []);

    useEffect(() => { fetchEmergencies(); }, [fetchEmergencies]);

    // Join dispatch room for live updates
    useEffect(() => {
        emit('ambulance:join-dispatch', {});
        const unsub1 = on('emergency:new', () => fetchEmergencies());
        const unsub2 = on('emergency:updated', () => fetchEmergencies());
        const unsub3 = on('ambulance:status-update', () => fetchEmergencies());
        // M4: Listen for ambulance location updates for live map markers
        const unsub4 = on('ambulance:location-update', (data: any) => {
            if (data.latitude && data.longitude) {
                setEmergencies((prev: Emergency[]) => prev.map(e => {
                    if (e.id === data.requestId) {
                        return { ...e, latitude: data.latitude, longitude: data.longitude };
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

    const pendingCount = emergencies.filter(e => ['active', 'pending', 'broadcasting'].includes(e.status)).length;
    const activeCount = emergencies.filter(e => ['dispatched', 'assigned', 'accepted', 'en_route_pickup', 'en_route', 'arrived', 'picked_up', 'en_route_hospital'].includes(e.status)).length;
    const resolvedCount = emergencies.filter(e => ['resolved', 'completed'].includes(e.status)).length;

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        if (!dateStr || Number.isNaN(d.getTime())) return '—';
        return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    };

    // Map markers for all geo-located emergencies
    const geoEmergencies = emergencies.filter(e => e.latitude && e.longitude && !['completed', 'cancelled', 'resolved'].includes(e.status));
    const mapMarkers: MapMarker[] = geoEmergencies.map(e => ({
        id: e.id,
        lat: e.latitude!,
        lng: e.longitude!,
        title: e.patientName,
        popup: `${e.type} • ${STATUS_CONFIG[e.status]?.label || e.status}<br/>${e.location || ''}`,
        color: ['pending', 'active', 'broadcasting'].includes(e.status) ? '#DC2626' :
            ['dispatched', 'assigned', 'accepted', 'en_route_pickup', 'en_route'].includes(e.status) ? '#F59E0B' : '#059669',
        pulse: ['active', 'pending', 'broadcasting'].includes(e.status),
    }));

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">🏥 Emergency Monitor</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Real-time monitoring of all emergency requests (hospitals manage dispatch independently)</p>
                </div>
                <Button onClick={fetchEmergencies} leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card padding="md">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-100 rounded-xl"><AlertTriangle className="h-6 w-6 text-red-600" /></div>
                        <div><p className="text-sm text-gray-600 dark:text-gray-400">Pending / SOS</p><p className="text-2xl font-bold text-red-600">{pendingCount}</p></div>
                    </div>
                </Card>
                <Card padding="md">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-yellow-100 rounded-xl"><Ambulance className="h-6 w-6 text-yellow-600" /></div>
                        <div><p className="text-sm text-gray-600 dark:text-gray-400">Active / Dispatched</p><p className="text-2xl font-bold text-yellow-600">{activeCount}</p></div>
                    </div>
                </Card>
                <Card padding="md">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-xl"><CheckCircle className="h-6 w-6 text-green-600" /></div>
                        <div><p className="text-sm text-gray-600 dark:text-gray-400">Resolved</p><p className="text-2xl font-bold text-green-600">{resolvedCount}</p></div>
                    </div>
                </Card>
            </div>

            {/* Live Map */}
            {mapMarkers.length > 0 && (
                <Card padding="none">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Radio className="h-5 w-5 text-red-500 animate-pulse" />
                            Live Emergency Map
                        </CardTitle>
                    </CardHeader>
                    <div className="px-4 pb-4">
                        <OsmMap lat={mapMarkers[0].lat} lng={mapMarkers[0].lng} zoom={12} markers={mapMarkers} height="350px" fitBounds />
                    </div>
                </Card>
            )}

            {/* Emergency List */}
            <Card padding="none">
                <CardHeader><CardTitle>All Emergencies</CardTitle></CardHeader>
                {isLoading ? (
                    <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-red-600" /><span className="ml-2 text-gray-500 dark:text-gray-400">Loading...</span></div>
                ) : error ? (
                    <div className="p-8 text-center"><p className="text-red-600">{error}</p><Button className="mt-4" onClick={fetchEmergencies} leftIcon={<RefreshCw className="h-4 w-4" />}>Retry</Button></div>
                ) : emergencies.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">No emergency requests found</div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {emergencies.map((emergency) => {
                            const statusCfg = STATUS_CONFIG[emergency.status] || STATUS_CONFIG.pending;
                            return (
                                <div key={emergency.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className={`p-2.5 rounded-xl ${statusCfg.color}`}><Siren className="h-5 w-5" /></div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="font-medium text-gray-900 dark:text-gray-100">{emergency.patientName}</h3>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                                                        {statusCfg.icon} {statusCfg.label}
                                                    </span>
                                                    {emergency.priority && (
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                            emergency.priority === 'critical' ? 'bg-red-50 text-red-700' :
                                                            emergency.priority === 'high' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'
                                                        }`}>{emergency.priority.toUpperCase()}</span>
                                                    )}
                                                    {emergency.dispatchMode === 'sos_broadcast' && (
                                                        <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700">SOS Broadcast</span>
                                                    )}
                                                    {emergency.dispatchMode === 'hospital_controlled' && (
                                                        <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">Hospital Dispatch</span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-red-600 font-medium mt-1">{emergency.type}</p>
                                                <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                                                    {emergency.location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{emergency.location}</span>}
                                                    {emergency.phone && <span className="flex items-center gap-1"><Phone className="h-4 w-4" />{emergency.phone}</span>}
                                                    <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{formatTime(emergency.requestedAt)}</span>
                                                </div>
                                                {(emergency.ambulance || emergency.ambulanceVehicle) && (
                                                    <p className="text-sm text-blue-600 mt-2 flex items-center gap-1">
                                                        <Ambulance className="h-4 w-4" />
                                                        {emergency.ambulanceVehicle || emergency.ambulance}
                                                        {emergency.ambulanceDriver && ` • ${emergency.ambulanceDriver}`}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        {/* Monitor-only indicator */}
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                                <Eye className="h-3.5 w-3.5" /> Monitoring
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        </div>
    );
}
