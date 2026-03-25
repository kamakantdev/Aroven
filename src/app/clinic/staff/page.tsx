'use client';

import { useEffect, useState } from 'react';
import { Stethoscope, Loader2, Plus, Trash2, AlertCircle, RefreshCw, X, UserPlus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useClinicStore } from '@/stores/clinicStore';
import { ConfirmDialog, useConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';

export default function ClinicStaffPage() {
    const { doctors, isLoading, error, fetchDoctors, addDoctor, removeDoctor, clearError } = useClinicStore();

    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ email: '', name: '', specialization: '' });
    const [page, setPage] = useState(1);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const { dialogProps, confirm } = useConfirmDialog();
    const toast = useToast();

    useEffect(() => { fetchDoctors(); }, [fetchDoctors]);

    const handleAdd = async () => {
        if (!form.email) return;
        setActionLoading('add');
        await addDoctor(form);
        toast.success('Staff Added', 'Doctor added to clinic');
        setActionLoading(null);
        setShowAdd(false);
        setForm({ email: '', name: '', specialization: '' });
    };

    const handleRemove = async (id: string, name: string) => {
        const confirmed = await confirm({ title: 'Remove Staff', message: `Remove ${name} from clinic?`, confirmLabel: 'Remove', variant: 'danger' });
        if (!confirmed) return;
        setActionLoading(id);
        await removeDoctor(id);
        toast.success('Staff Removed', 'Doctor removed from clinic');
        setActionLoading(null);
    };

    const staff = Array.isArray(doctors) ? doctors : [];
    const { totalPages, totalItems, itemsPerPage, paginate } = usePagination(staff, 10);
    const paginatedItems = paginate(page);

    if (isLoading && staff.length === 0) {
        return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-pink-600" /></div>;
    }

    if (error && staff.length === 0) {
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
                <div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Staff</h1><p className="text-gray-600 dark:text-gray-400 mt-1">Manage clinic doctors & staff</p></div>
                <Button onClick={() => setShowAdd(true)} leftIcon={<UserPlus className="h-4 w-4" />}>Add Doctor</Button>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

            {/* Add Doctor Modal */}
            {showAdd && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <Card padding="lg" className="w-full max-w-md">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">Add Doctor to Clinic</h2>
                            <button onClick={() => setShowAdd(false)}><X className="h-5 w-5 text-gray-400" /></button>
                        </div>
                        <div className="space-y-3">
                            <Input label="Email *" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Enter email" />
                            <Input label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Enter doctor name" />
                            <Input label="Specialization" value={form.specialization} onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))} placeholder="Enter specialization" />
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                            <Button onClick={handleAdd} isLoading={actionLoading === 'add'} disabled={!form.email}>Add Doctor</Button>
                        </div>
                    </Card>
                </div>
            )}

            {staff.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <Stethoscope className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No doctors linked to this clinic yet.</p>
                    <p className="text-sm mt-1">Click &quot;Add Doctor&quot; to invite one.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paginatedItems.map((member: any) => (
                        <Card key={member.id} padding="md">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-pink-100 rounded-full"><Stethoscope className="h-5 w-5 text-pink-600" /></div>
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-gray-100">{member.name}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{member.specialization || member.role || 'Staff'}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleRemove(member.id, member.name)}
                                    disabled={actionLoading === member.id}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    {actionLoading === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
            <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
            />
            <ConfirmDialog {...dialogProps} />
        </div>
    );
}
