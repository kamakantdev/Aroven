'use client';

import { useEffect, useState, useCallback } from 'react';
import { FileText, Search, Calendar, Loader2, Plus, RefreshCw, Download } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useDoctorStore } from '@/stores/doctorStore';
import { usePrescriptionUpdates } from '@/hooks/useSocket';
import Link from 'next/link';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { downloadCSV } from '@/utils/export';

export default function DoctorPrescriptionsPage() {
    const { prescriptions, loadingPrescriptions, error, fetchPrescriptions, clearError } = useDoctorStore();
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');

    const loadData = useCallback(() => { fetchPrescriptions(); }, [fetchPrescriptions]);

    useEffect(() => { loadData(); }, [loadData]);

    // Real-time prescription updates
    usePrescriptionUpdates(() => { loadData(); });

    const filtered = (prescriptions || []).filter((p: any) =>
        (p.patientName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.diagnosis || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    const { totalPages, totalItems, itemsPerPage, paginate } = usePagination(filtered, 10);
    const paginatedItems = paginate(page);

    if (loadingPrescriptions) {
        return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /><span className="ml-2 text-gray-600 dark:text-gray-400">Loading prescriptions...</span></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Prescriptions</h1><p className="text-gray-600 dark:text-gray-400 mt-1">View prescriptions you&apos;ve written</p></div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => downloadCSV(filtered, [
                        { key: 'patientName', label: 'Patient' },
                        { key: 'diagnosis', label: 'Diagnosis' },
                        { key: 'date', label: 'Date' },
                        { key: 'status', label: 'Status' },
                    ], 'prescriptions')} leftIcon={<Download className="h-4 w-4" />}>Export CSV</Button>
                    <Button variant="outline" onClick={loadData} leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
                    <Link href="/doctor/prescriptions/new">
                        <Button leftIcon={<Plus className="h-4 w-4" />}>New Prescription</Button>
                    </Link>
                </div>
            </div>

            <Card padding="sm">
                <Input placeholder="Search by patient name or diagnosis..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} leftIcon={<Search className="h-5 w-5" />} />
            </Card>

            <Card padding="none">
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {paginatedItems.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                            {prescriptions.length === 0 ? 'No prescriptions written yet. Prescriptions are created during consultations.' : 'No matching prescriptions found.'}
                        </div>
                    ) : paginatedItems.map((rx) => (
                        <div key={rx.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700"><FileText className="h-5 w-5" /></div>
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-gray-100">{rx.patientName}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1"><Calendar className="h-3 w-3" />{rx.created_at ? new Date(rx.created_at).toLocaleDateString('en-IN') : '—'}</p>
                                        {rx.diagnosis && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Diagnosis: {rx.diagnosis}</p>}
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {(rx.medications || []).slice(0, 3).map((med: any, i: number) => (
                                                <span key={i} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{med.name} {med.dosage}</span>
                                            ))}
                                            {(rx.medications || []).length > 3 && (
                                                <span className="text-xs text-gray-400">+{rx.medications!.length - 3} more</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                                        {rx.status || 'active'}
                                    </span>
                                    {rx.followUpDate && (
                                        <p className="text-xs text-gray-400 mt-1">Follow-up: {new Date(rx.followUpDate).toLocaleDateString('en-IN')}</p>
                                    )}
                                </div>
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
