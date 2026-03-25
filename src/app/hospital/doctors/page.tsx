'use client';

import { useEffect, useState } from 'react';
import { Stethoscope, Search, Loader2, RefreshCw, UserPlus, Trash2, AlertCircle, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useHospitalStore } from '@/stores/hospitalStore';
import { ConfirmDialog, useConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';

export default function HospitalDoctorsPage() {
    const { doctors, isLoading, error, fetchDoctors, inviteDoctor, removeDoctor, clearError } = useHospitalStore();
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteData, setInviteData] = useState({ email: '', name: '', specialization: '' });
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const { dialogProps, confirm } = useConfirmDialog();
    const toast = useToast();

    useEffect(() => { fetchDoctors(); }, [fetchDoctors]);

    const filtered = (doctors || []).filter((d: any) =>
        (d.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.specialization || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    const { totalPages, totalItems, itemsPerPage, paginate } = usePagination(filtered, 10);
    const paginatedItems = paginate(page);

    const handleInvite = async () => {
        if (!inviteData.email) return;
        setActionLoading('invite');
        const success = await inviteDoctor(inviteData);
        if (success) {
            setShowInviteModal(false);
            setInviteData({ email: '', name: '', specialization: '' });
        }
        setActionLoading(null);
    };

    const handleRemove = async (doctorId: string, doctorName: string) => {
        const confirmed = await confirm({ title: 'Remove Doctor', message: `Remove Dr. ${doctorName} from the hospital?`, confirmLabel: 'Remove', variant: 'danger' });
        if (!confirmed) return;
        setActionLoading(doctorId);
        await removeDoctor(doctorId);
        toast.success('Doctor Removed', 'Doctor has been removed');
        setActionLoading(null);
    };

    if (isLoading && doctors.length === 0) {
        return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div>;
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <AlertCircle className="h-12 w-12 text-red-400" />
                <p className="text-red-600">{error}</p>
                <Button onClick={() => { clearError(); fetchDoctors(); }} leftIcon={<RefreshCw className="h-4 w-4" />}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Doctors</h1><p className="text-gray-600 dark:text-gray-400 mt-1">Manage hospital doctors</p></div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => fetchDoctors()} leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
                    <Button onClick={() => setShowInviteModal(true)} leftIcon={<UserPlus className="h-4 w-4" />}>Invite Doctor</Button>
                </div>
            </div>

            <Card padding="sm">
                <Input placeholder="Search doctors..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} leftIcon={<Search className="h-5 w-5" />} />
            </Card>

            <Card padding="none">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Doctor</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Specialization</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400 hidden md:table-cell">Contact</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400 hidden sm:table-cell">Status</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {paginatedItems.length === 0 ? (
                                <tr><td colSpan={5} className="py-8 text-center text-gray-500 dark:text-gray-400">No doctors found</td></tr>
                            ) : paginatedItems.map((doc: any) => (
                                <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-teal-100 rounded-lg"><Stethoscope className="h-4 w-4 text-teal-600" /></div>
                                            <span className="font-medium text-gray-900 dark:text-gray-100">{doc.name}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{doc.specialization || '—'}</td>
                                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 hidden md:table-cell">{doc.email || doc.phone || '—'}</td>
                                    <td className="py-3 px-4 hidden sm:table-cell"><StatusBadge status={doc.status || 'approved'} size="sm" /></td>
                                    <td className="py-3 px-4 text-right">
                                        <Button size="sm" variant="outline" onClick={() => handleRemove(doc.id, doc.name)} disabled={actionLoading === doc.id}>
                                            {actionLoading === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3 text-red-500" />}
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
            <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
            />

            {/* Invite Doctor Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Invite Doctor</h3>
                            <button onClick={() => setShowInviteModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label><Input value={inviteData.email} onChange={e => setInviteData(d => ({ ...d, email: e.target.value }))} placeholder="Enter email" /></div>
                            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label><Input value={inviteData.name} onChange={e => setInviteData(d => ({ ...d, name: e.target.value }))} placeholder="Enter doctor name" /></div>
                            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Specialization</label><Input value={inviteData.specialization} onChange={e => setInviteData(d => ({ ...d, specialization: e.target.value }))} placeholder="Enter specialization" /></div>
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t">
                            <Button variant="outline" onClick={() => setShowInviteModal(false)}>Cancel</Button>
                            <Button onClick={handleInvite} isLoading={actionLoading === 'invite'}>Send Invite</Button>
                        </div>
                    </div>
                </div>
            )}
            <ConfirmDialog {...dialogProps} />
        </div>
    );
}
