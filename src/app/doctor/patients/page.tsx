'use client';

import { useEffect, useState } from 'react';
import { Users, Search, User, Phone, Mail, Loader2, RefreshCw, AlertCircle, Download } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useDoctorStore, type DoctorPatient } from '@/stores/doctorStore';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { downloadCSV } from '@/utils/export';

export default function DoctorPatientsPage() {
    const { patients, loadingPatients, error, fetchPatients, clearError } = useDoctorStore();
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => { fetchPatients(); }, [fetchPatients]);

    const filtered = (patients || []).filter((p: DoctorPatient) =>
        (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    const { totalPages, totalItems, itemsPerPage, paginate } = usePagination(filtered, 12);
    const paginatedItems = paginate(page);

    if (loadingPatients) {
        return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /><span className="ml-2 text-gray-600 dark:text-gray-400">Loading patients...</span></div>;
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <AlertCircle className="h-12 w-12 text-red-400" />
                <p className="text-red-600">{error}</p>
                <Button onClick={() => { clearError(); fetchPatients(); }} leftIcon={<RefreshCw className="h-4 w-4" />}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Patients</h1><p className="text-gray-600 dark:text-gray-400 mt-1">View and manage your patients</p></div>
                <Button variant="outline" onClick={() => downloadCSV(filtered, [
                    { key: 'name', label: 'Name' },
                    { key: 'email', label: 'Email' },
                    { key: 'phone', label: 'Phone' },
                    { key: 'lastVisit', label: 'Last Visit' },
                ], 'patients')} leftIcon={<Download className="h-4 w-4" />}>Export CSV</Button>
            </div>

            <Card padding="sm">
                <Input placeholder="Search patients..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} leftIcon={<Search className="h-5 w-5" />} />
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedItems.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">No patients found</div>
                ) : paginatedItems.map((patient: DoctorPatient) => (
                    <Card key={patient.id} padding="md">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-emerald-100 rounded-full"><User className="h-5 w-5 text-emerald-600" /></div>
                            <div>
                                <p className="font-medium text-gray-900 dark:text-gray-100">{patient.name}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{patient.age ? `${patient.age} yrs` : ''} {patient.gender || ''}</p>
                            </div>
                        </div>
                        {patient.phone && <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1"><Phone className="h-3 w-3" />{patient.phone}</p>}
                        {patient.email && <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1"><Mail className="h-3 w-3" />{patient.email}</p>}
                        {patient.lastVisit && <p className="text-xs text-gray-400 mt-2">Last visit: {new Date(patient.lastVisit).toLocaleDateString('en-IN')}</p>}
                    </Card>
                ))}
            </div>
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
