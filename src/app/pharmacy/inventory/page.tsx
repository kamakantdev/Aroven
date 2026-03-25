'use client';

import { useEffect, useState } from 'react';
import { Package, Search, Loader2, RefreshCw, Plus, Trash2, Edit2, AlertCircle, X, Download } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { usePharmacyStore } from '@/stores/pharmacyStore';
import { ConfirmDialog, useConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';
import { downloadCSV } from '@/utils/export';

export default function PharmacyInventoryPage() {
    const { inventory, loadingInventory, error, fetchInventory, addInventoryItem, updateInventoryItem, deleteInventoryItem, clearError } = usePharmacyStore();
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [tab, setTab] = useState<'all' | 'low'>('all');
    const [showAdd, setShowAdd] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: '', quantity: '', price: '', manufacturer: '', expiryDate: '' });
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const { dialogProps, confirm: confirmAction } = useConfirmDialog();
    const toast = useToast();

    useEffect(() => { fetchInventory(); }, [fetchInventory]);

    const items = (inventory || []).filter((item: any) => {
        const matchSearch = (item.name || '').toLowerCase().includes(searchQuery.toLowerCase());
        if (tab === 'low') return matchSearch && (item.stock ?? item.quantity ?? 0) <= 10;
        return matchSearch;
    });
    const { totalPages, totalItems, itemsPerPage, paginate } = usePagination(items, 10);
    const paginatedItems = paginate(page);

    const resetForm = () => { setForm({ name: '', quantity: '', price: '', manufacturer: '', expiryDate: '' }); setShowAdd(false); setEditId(null); };

    const handleAdd = async () => {
        if (!form.name) return;
        setActionLoading('add');
        const success = await addInventoryItem({ name: form.name, quantity: parseInt(form.quantity) || 0, price: parseFloat(form.price) || 0, manufacturer: form.manufacturer, expiryDate: form.expiryDate || undefined });
        if (success) { resetForm(); toast.success('Item Added', 'Inventory item added successfully'); }
        setActionLoading(null);
    };

    const handleUpdate = async () => {
        if (!editId) return;
        setActionLoading('edit');
        const success = await updateInventoryItem(editId, { name: form.name, quantity: parseInt(form.quantity) || 0, price: parseFloat(form.price) || 0, manufacturer: form.manufacturer, expiryDate: form.expiryDate || undefined });
        if (success) { resetForm(); toast.success('Item Updated', 'Inventory item updated'); }
        setActionLoading(null);
    };

    const handleDelete = async (id: string, name: string) => {
        const confirmed = await confirmAction({ title: 'Delete Item', message: `Delete ${name} from inventory?`, confirmLabel: 'Delete', variant: 'danger' });
        if (!confirmed) return;
        setActionLoading(id);
        await deleteInventoryItem(id);
        toast.success('Item Deleted', 'Item has been removed');
        setActionLoading(null);
    };

    const openEdit = (item: any) => {
        setEditId(item.id);
        setForm({ name: item.name || '', quantity: String(item.stock ?? item.quantity ?? 0), price: String(item.price ?? ''), manufacturer: item.manufacturer || '', expiryDate: item.expiryDate || '' });
        setShowAdd(true);
    };

    if (loadingInventory && paginatedItems.length === 0) return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-orange-600" /></div>;

    if (error && paginatedItems.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <AlertCircle className="h-12 w-12 text-red-400" />
                <p className="text-red-600">{error}</p>
                <Button onClick={() => { clearError(); fetchInventory(); }} leftIcon={<RefreshCw className="h-4 w-4" />}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Inventory</h1><p className="text-gray-600 dark:text-gray-400 mt-1">Manage medicine inventory</p></div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => downloadCSV(items, [
                        { key: 'name', label: 'Medicine' },
                        { key: 'quantity', label: 'Quantity' },
                        { key: 'price', label: 'Price' },
                        { key: 'manufacturer', label: 'Manufacturer' },
                        { key: 'expiryDate', label: 'Expiry Date' },
                    ], 'inventory')} leftIcon={<Download className="h-4 w-4" />}>Export CSV</Button>
                    <Button onClick={() => { resetForm(); setShowAdd(true); }} leftIcon={<Plus className="h-4 w-4" />}>Add Item</Button>
                </div>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

            {/* Add/Edit Modal */}
            {showAdd && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <Card padding="lg" className="w-full max-w-md">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">{editId ? 'Edit Item' : 'Add Inventory Item'}</h2>
                            <button onClick={resetForm}><X className="h-5 w-5 text-gray-400" /></button>
                        </div>
                        <div className="space-y-3">
                            <Input label="Medicine Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Enter medicine name" />
                            <div className="grid grid-cols-2 gap-3">
                                <Input label="Quantity" type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                                <Input label="Price (₹)" type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                            </div>
                            <Input label="Manufacturer" value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} />
                            <Input label="Expiry Date" type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <Button variant="outline" onClick={resetForm}>Cancel</Button>
                            <Button onClick={editId ? handleUpdate : handleAdd} isLoading={actionLoading === 'add' || actionLoading === 'edit'} disabled={!form.name}>{editId ? 'Update' : 'Add'}</Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Tabs + Search */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                    {(['all', 'low'] as const).map(t => (
                        <button key={t} onClick={() => { setTab(t); setPage(1); }} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300'}`}>
                            {t === 'all' ? 'All Items' : 'Low Stock'}
                        </button>
                    ))}
                </div>
                <div className="flex-1">
                    <Input placeholder="Search inventory..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} leftIcon={<Search className="h-5 w-5" />} />
                </div>
            </div>

            <Card padding="none">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Medicine</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Stock</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400 hidden sm:table-cell">Price</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400 hidden sm:table-cell">Status</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {paginatedItems.length === 0 ? (
                                <tr><td colSpan={5} className="py-8 text-center text-gray-500 dark:text-gray-400">No items found</td></tr>
                            ) : paginatedItems.map((item: any) => {
                                const stock = item.stock ?? item.quantity ?? 0;
                                return (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-orange-100 rounded-lg"><Package className="h-4 w-4 text-orange-600" /></div>
                                                <div>
                                                    <span className="font-medium text-gray-900 dark:text-gray-100">{item.name}</span>
                                                    {item.manufacturer && <p className="text-xs text-gray-400">{item.manufacturer}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{stock}</td>
                                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 hidden sm:table-cell">{item.price ? `₹${item.price}` : '—'}</td>
                                        <td className="py-3 px-4 hidden sm:table-cell">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${stock <= 10 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                {stock <= 10 ? 'Low Stock' : 'In Stock'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => openEdit(item)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button onClick={() => handleDelete(item.id, item.name)} disabled={actionLoading === item.id} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                    {actionLoading === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
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
            <ConfirmDialog {...dialogProps} />
        </div>
    );
}
