'use client';

import { useEffect, useState, useCallback } from 'react';
import { Calendar, Clock, User, Video, Search, RefreshCw, Loader2, AlertCircle, Play, XCircle as XCircleIcon, CheckCircle, Bell } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { useDoctorStore } from '@/stores/doctorStore';
import { useRouter } from 'next/navigation';
import { useAppointmentUpdates, type AppointmentUpdate } from '@/hooks/useSocket';

export default function DoctorAppointmentsPage() {
    const router = useRouter();
    const { appointments, isLoading, error, fetchAppointments, startConsultation, completeAppointment, cancelAppointment, clearError } = useDoctorStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [newApptAlert, setNewApptAlert] = useState<string | null>(null);
    const [page, setPage] = useState(1);

    // Real-time Socket.IO — auto-refresh when patient books/cancels
    useAppointmentUpdates(
        useCallback((update: AppointmentUpdate) => {
            fetchAppointments();
            const msg = update.status === 'scheduled' ? 'New appointment booked by a patient!' :
                update.status === 'cancelled' ? 'An appointment was cancelled' :
                `Appointment status changed to ${update.status}`;
            setNewApptAlert(msg);
            setTimeout(() => setNewApptAlert(null), 5000);
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [])
    );

    useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

    const filtered = (appointments || []).filter(apt => {
        const matchesSearch = (apt.patientName || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || apt.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const { totalPages, totalItems, itemsPerPage, paginate } = usePagination(filtered, 10);
    const paginatedItems = paginate(page);

    // Reset page when filters change
    useEffect(() => { setPage(1); }, [searchQuery, statusFilter]);

    const handleStartConsultation = async (appointmentId: string) => {
        setActionLoading(appointmentId);
        const result = await startConsultation(appointmentId);
        if (result && typeof result === 'string' && result !== 'started') {
            router.push(`/consultation/${result}`);
        }
        setActionLoading(null);
    };

    const handleComplete = async (appointmentId: string) => {
        setActionLoading(appointmentId);
        await completeAppointment(appointmentId);
        setActionLoading(null);
    };

    const handleCancel = async (appointmentId: string) => {
        const reason = prompt('Reason for cancellation (optional):');
        if (reason === null) return; // user pressed Cancel
        setActionLoading(appointmentId);
        await cancelAppointment(appointmentId, reason || undefined);
        setActionLoading(null);
    };

    if (isLoading && appointments.length === 0) {
        return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /><span className="ml-2 text-gray-600 dark:text-gray-400">Loading appointments...</span></div>;
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <AlertCircle className="h-12 w-12 text-red-400" />
                <p className="text-red-600">{error}</p>
                <Button onClick={() => { clearError(); fetchAppointments(); }} leftIcon={<RefreshCw className="h-4 w-4" />}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Real-time Alert */}
            {newApptAlert && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg flex items-center gap-3 animate-pulse">
                    <Bell className="h-5 w-5 text-emerald-600" />
                    <span className="font-medium">🔔 {newApptAlert}</span>
                    <button onClick={() => setNewApptAlert(null)} className="ml-auto text-emerald-800 underline text-sm">Dismiss</button>
                </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Appointments</h1><p className="text-gray-600 dark:text-gray-400 mt-1">Manage your patient appointments</p></div>
                <Button onClick={() => fetchAppointments()} leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
            </div>

            <Card padding="sm">
                <div className="flex items-center gap-4">
                    <div className="flex-1"><Input placeholder="Search patients..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} leftIcon={<Search className="h-5 w-5" />} /></div>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-200">
                        <option value="all">All Status</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
            </Card>

            <Card padding="none">
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filtered.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">No appointments found</div>
                    ) : paginatedItems.map((apt) => {
                        const isActive = ['scheduled', 'confirmed', 'pending'].includes(apt.status);
                        const isActing = actionLoading === apt.id;
                        return (
                            <div key={apt.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700"><User className="h-5 w-5" /></div>
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-gray-100">{apt.patientName || 'Patient'}</p>
                                            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                                                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{apt.date ? new Date(apt.date).toLocaleDateString('en-IN') : '—'}</span>
                                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{apt.time || apt.timeSlot || '—'}</span>
                                                {(apt.type === 'video' || apt.type === 'Video') && <span className="flex items-center gap-1"><Video className="h-3 w-3" />Video</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <StatusBadge status={apt.status || 'scheduled'} size="sm" />
                                        {isActive && (
                                            <div className="flex gap-1">
                                                {(apt.type === 'video' || apt.type === 'Video') && (
                                                    <Button size="sm" variant="primary" onClick={() => handleStartConsultation(apt.id)} disabled={isActing} leftIcon={isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}>
                                                        Start
                                                    </Button>
                                                )}
                                                <Button size="sm" variant="outline" onClick={() => handleComplete(apt.id)} disabled={isActing} leftIcon={<CheckCircle className="h-3 w-3" />}>
                                                    Complete
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => handleCancel(apt.id)} disabled={isActing}>
                                                    <XCircleIcon className="h-3 w-3 text-red-500" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                />
            </Card>
        </div>
    );
}
