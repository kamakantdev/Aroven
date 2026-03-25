'use client';

import { useEffect, useState } from 'react';
import { Calendar, Search, Loader2, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useClinicStore } from '@/stores/clinicStore';
import { useAppointmentUpdates } from '@/hooks/useSocket';
import { Pagination, usePagination } from '@/components/ui/Pagination';

export default function ClinicAppointmentsPage() {
    const { appointments, isLoading, fetchAppointments } = useClinicStore();
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

    // Real-time: auto-refresh when new/updated appointments arrive via Socket.IO
    useAppointmentUpdates(() => { fetchAppointments(); });

    const filtered = (appointments || []).filter((a: any) =>
        (a.patientName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    const { totalPages, totalItems, itemsPerPage, paginate } = usePagination(filtered, 10);
    const paginatedItems = paginate(page);

    if (isLoading) {
        return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-pink-600" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Appointments</h1><p className="text-gray-600 dark:text-gray-400 mt-1">Clinic appointment management</p></div>
                <Button onClick={() => fetchAppointments()} leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
            </div>

            <Card padding="sm"><Input placeholder="Search appointments..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} leftIcon={<Search className="h-5 w-5" />} /></Card>

            <Card padding="none">
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {paginatedItems.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">No appointments found</div>
                    ) : paginatedItems.map((apt: any) => (
                        <div key={apt.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 rounded-xl bg-pink-100 text-pink-700"><Calendar className="h-5 w-5" /></div>
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-gray-100">{apt.patientName || 'Patient'}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{apt.date ? new Date(apt.date).toLocaleDateString('en-IN') : '—'} &middot; {apt.time || '—'}</p>
                                </div>
                            </div>
                            <StatusBadge status={apt.status || 'scheduled'} size="sm" />
                        </div>
                    ))}
                </div>
            </Card>
            <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
            />
        </div>
    );
}
