'use client';

import { useEffect, useState } from 'react';
import { FileText, Search, Loader2, RefreshCw, AlertCircle, CheckCircle, Package } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { usePharmacyStore } from '@/stores/pharmacyStore';
import { pharmacyApi } from '@/lib/api';
import { useOrderUpdates } from '@/hooks/useSocket';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';

export default function PharmacyPrescriptionsPage() {
    const { prescriptions, isLoading, error, fetchPrescriptions, clearError } = usePharmacyStore();
    const toast = useToast();
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [tab, setTab] = useState<'all' | 'pending' | 'dispensed'>('all');

    useEffect(() => { fetchPrescriptions(); }, [fetchPrescriptions]);

    // Real-time: auto-refresh when new orders arrive (prescriptions often come with orders)
    useOrderUpdates(() => { fetchPrescriptions(); }, () => { fetchPrescriptions(); });

    const handleDispense = async (rxId: string) => {
        setActionLoading(rxId);
        try {
            const res = await pharmacyApi.dispensePrescription(rxId);
            if (res.success) { await fetchPrescriptions(); toast.success('Prescription Dispensed', 'Prescription has been dispensed'); }
        } catch { /* store error handled */ }
        setActionLoading(null);
    };

    const filtered = (prescriptions || []).filter((p: any) => {
        const matchSearch = (p.patientName || '').toLowerCase().includes(searchQuery.toLowerCase());
        if (tab === 'pending') return matchSearch && ['pending', 'ready'].includes(p.status);
        if (tab === 'dispensed') return matchSearch && ['dispensed', 'fulfilled'].includes(p.status);
        return matchSearch;
    });
    const { totalPages, totalItems, itemsPerPage, paginate } = usePagination(filtered, 10);
    const paginatedItems = paginate(page);

    if (isLoading && !prescriptions?.length) return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-orange-600" /></div>;

    if (error && !prescriptions?.length) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <AlertCircle className="h-12 w-12 text-red-400" />
                <p className="text-red-600">{error}</p>
                <Button onClick={() => { clearError(); fetchPrescriptions(); }} leftIcon={<RefreshCw className="h-4 w-4" />}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Prescriptions</h1><p className="text-gray-600 dark:text-gray-400 mt-1">Manage incoming prescriptions</p></div>
                <Button onClick={() => fetchPrescriptions()} leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                    {(['all', 'pending', 'dispensed'] as const).map(t => (
                        <button key={t} onClick={() => { setTab(t); setPage(1); }} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300'}`}>{t}</button>
                    ))}
                </div>
                <div className="flex-1"><Input placeholder="Search prescriptions..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} leftIcon={<Search className="h-5 w-5" />} /></div>
            </div>

            <Card padding="none">
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {paginatedItems.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400"><FileText className="h-10 w-10 mx-auto mb-2 text-gray-300" />No prescriptions found</div>
                    ) : paginatedItems.map((rx: any) => (
                        <div key={rx.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 min-w-0">
                                <div className="p-2.5 rounded-xl bg-orange-100 text-orange-700 flex-shrink-0"><FileText className="h-5 w-5" /></div>
                                <div className="min-w-0">
                                    <p className="font-medium text-gray-900 dark:text-gray-100">{rx.patientName || 'Patient'}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{rx.medications?.length || 0} medications · {rx.doctorName ? `Dr. ${rx.doctorName}` : ''} {rx.date ? `· ${new Date(rx.date).toLocaleDateString('en-IN')}` : ''}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                                <StatusBadge status={rx.status || 'pending'} size="sm" />
                                {['pending', 'ready'].includes(rx.status) && (
                                    <button onClick={() => handleDispense(rx.id)} disabled={actionLoading === rx.id}
                                        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors" title="Dispense">
                                        {actionLoading === rx.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                        <span>Dispense</span>
                                    </button>
                                )}
                            </div>
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
