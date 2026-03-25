'use client';

import { useEffect, useState } from 'react';
import { Building2, Users, Activity, Loader2, AlertCircle, RefreshCw, Plus, Edit2, Trash2, X, Search } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useHospitalStore } from '@/stores/hospitalStore';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { ConfirmDialog, useConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

export default function HospitalDepartmentsPage() {
    const { departments, isLoading, error, fetchDepartments, addDepartment, updateDepartment, deleteDepartment, clearError } = useHospitalStore();
    const toast = useToast();
    const { dialogProps, confirm } = useConfirmDialog();
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingDept, setEditingDept] = useState<any>(null);
    const [form, setForm] = useState({ name: '', head: '', status: 'active' });
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

    const filtered = (departments || []).filter((dept: any) =>
        (dept.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (dept.head || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    const { totalPages, totalItems, itemsPerPage, paginate } = usePagination(filtered, 12);
    const paginatedItems = paginate(page);

    const resetForm = () => {
        setForm({ name: '', head: '', status: 'active' });
        setEditingDept(null);
        setShowForm(false);
    };

    const openEdit = (dept: any) => {
        setEditingDept(dept);
        setForm({ name: dept.name || '', head: dept.head || '', status: dept.status || 'active' });
        setShowForm(true);
    };

    const handleSubmit = async () => {
        if (!form.name.trim()) return;
        setActionLoading('save');
        const success = editingDept
            ? await updateDepartment(editingDept.id, form)
            : await addDepartment(form);
        if (success) {
            resetForm();
            toast.success(editingDept ? 'Department Updated' : 'Department Added',
                editingDept ? 'Department updated successfully' : 'New department added');
        } else {
            toast.error('Error', 'Failed to save department');
        }
        setActionLoading(null);
    };

    const handleDelete = async (deptId: string, deptName: string) => {
        const confirmed = await confirm({
            title: 'Delete Department',
            message: `Delete "${deptName}"? This cannot be undone.`,
            confirmLabel: 'Delete',
            variant: 'danger',
        });
        if (!confirmed) return;
        setActionLoading(deptId);
        const success = await deleteDepartment(deptId);
        if (success) toast.success('Department Deleted', `${deptName} has been removed`);
        else toast.error('Error', 'Failed to delete department');
        setActionLoading(null);
    };

    if (isLoading && departments.length === 0) {
        return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /><span className="ml-2 text-gray-600 dark:text-gray-400">Loading departments...</span></div>;
    }

    if (error && departments.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <AlertCircle className="h-12 w-12 text-red-400" />
                <p className="text-red-600 dark:text-red-400">{error}</p>
                <Button onClick={() => { clearError(); fetchDepartments(); }} leftIcon={<RefreshCw className="h-4 w-4" />}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Departments</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Manage hospital departments</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => fetchDepartments()} leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
                    <Button onClick={() => { resetForm(); setShowForm(true); }} leftIcon={<Plus className="h-4 w-4" />}>Add Department</Button>
                </div>
            </div>

            {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>}

            {/* Add/Edit Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <Card padding="lg" className="w-full max-w-md">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{editingDept ? 'Edit Department' : 'Add Department'}</h2>
                            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="space-y-3">
                            <Input label="Department Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Enter department name" />
                            <Input label="Head of Department" value={form.head} onChange={e => setForm(f => ({ ...f, head: e.target.value }))} placeholder="Enter department head name" />
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                                <select
                                    value={form.status}
                                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-teal-500"
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <Button variant="outline" onClick={resetForm}>Cancel</Button>
                            <Button onClick={handleSubmit} isLoading={actionLoading === 'save'} disabled={!form.name.trim()}>
                                {editingDept ? 'Update' : 'Add'}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Search */}
            <Card padding="sm">
                <Input placeholder="Search departments..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} leftIcon={<Search className="h-5 w-5" />} />
            </Card>

            {paginatedItems.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                    <p>No departments found.</p>
                    <p className="text-sm mt-1">Click &quot;Add Department&quot; to create one.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paginatedItems.map((dept: any) => (
                        <Card key={dept.id || dept.name} padding="md">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-teal-100 dark:bg-teal-900/40 rounded-xl"><Building2 className="h-5 w-5 text-teal-600" /></div>
                                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{dept.name}</h3>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => openEdit(dept)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Edit">
                                        <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => handleDelete(dept.id, dept.name)} disabled={actionLoading === dept.id} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Delete">
                                        {actionLoading === dept.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                                {dept.head && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{dept.head}</span>}
                                <span className="flex items-center gap-1">
                                    <Activity className="h-3 w-3" />
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${dept.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                                        {dept.status || 'Active'}
                                    </span>
                                </span>
                                {dept.doctorCount != null && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{dept.doctorCount} doctors</span>}
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} itemsPerPage={itemsPerPage} />
            <ConfirmDialog {...dialogProps} />
        </div>
    );
}
