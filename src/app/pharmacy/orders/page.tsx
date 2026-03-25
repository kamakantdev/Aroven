'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    ShoppingCart, Search, Loader2, RefreshCw, CheckCircle, XCircle,
    AlertCircle, Package, Bell, MapPin, Clock, IndianRupee, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { usePharmacyStore } from '@/stores/pharmacyStore';
import { useOrderUpdates } from '@/hooks/useSocket';
import { ConfirmDialog, useConfirmDialog } from '@/components/shared/ConfirmDialog';

export default function PharmacyOrdersPage() {
    const { orders, loadingOrders, error, fetchOrders, updateOrderStatus, clearError } = usePharmacyStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [tab, setTab] = useState<'all' | 'pending' | 'active' | 'completed'>('all');
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [newOrderAlert, setNewOrderAlert] = useState(false);
    const [page, setPage] = useState(1);
    const { dialogProps, confirm: confirmAction } = useConfirmDialog();

    // Real-time Socket.IO — new orders and status updates
    useOrderUpdates(
        useCallback(() => { fetchOrders(); }, [fetchOrders]),
        useCallback(() => {
            setNewOrderAlert(true);
            fetchOrders();
            setTimeout(() => setNewOrderAlert(false), 5000);
        }, [fetchOrders])
    );

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    const handleStatus = async (orderId: string, status: string) => {
        if (status === 'cancelled') {
            const confirmed = await confirmAction({ title: 'Cancel Order', message: 'Cancel this order?', confirmLabel: 'Cancel Order', variant: 'danger' });
            if (!confirmed) return;
        }
        setActionLoading(orderId);
        await updateOrderStatus(orderId, status);
        setActionLoading(null);
    };

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const filtered = (orders || []).filter((o: any) => {
        const name = (o.patient?.name || o.patientName || o.customerName || '').toLowerCase();
        const matchSearch = name.includes(searchQuery.toLowerCase()) ||
            o.id?.toLowerCase().includes(searchQuery.toLowerCase());
        if (tab === 'pending') return matchSearch && o.status === 'pending';
        if (tab === 'active') return matchSearch && ['confirmed', 'processing', 'ready', 'dispatched'].includes(o.status);
        if (tab === 'completed') return matchSearch && ['delivered', 'cancelled'].includes(o.status);
        return matchSearch;
    });

    const { totalPages, totalItems, itemsPerPage, paginate } = usePagination(filtered, 10);
    const paginatedOrders = paginate(page);

    // Reset page when filters change
    useEffect(() => { setPage(1); }, [searchQuery, tab]);

    const pendingCount = (orders || []).filter((o: any) => o.status === 'pending').length;
    const activeCount = (orders || []).filter((o: any) => ['confirmed', 'processing', 'ready', 'dispatched'].includes(o.status)).length;
    const deliveredCount = (orders || []).filter((o: any) => o.status === 'delivered').length;

    if (loadingOrders && !orders?.length) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
                <span className="ml-2 text-gray-600 dark:text-gray-400">Loading orders...</span>
            </div>
        );
    }

    if (error && !orders?.length) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <AlertCircle className="h-12 w-12 text-red-400" />
                <p className="text-red-600">{error}</p>
                <Button onClick={() => { clearError(); fetchOrders(); }} leftIcon={<RefreshCw className="h-4 w-4" />}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Orders</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Medicine orders from patients — manage fulfillment</p>
                </div>
                <Button onClick={() => fetchOrders()} variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
            </div>

            {/* New Order Alert */}
            {newOrderAlert && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-3 animate-pulse">
                    <Bell className="h-5 w-5 text-green-600" />
                    <span className="font-medium">🔔 New order received!</span>
                    <button onClick={() => { setNewOrderAlert(false); setTab('pending'); }} className="ml-auto text-green-800 underline text-sm">View Pending</button>
                </div>
            )}

            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card padding="md"><div className="flex items-center gap-3"><div className="p-2.5 bg-orange-100 rounded-xl"><ShoppingCart className="h-5 w-5 text-orange-600" /></div><div><p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{(orders || []).length}</p><p className="text-xs text-gray-500 dark:text-gray-400">Total</p></div></div></Card>
                <Card padding="md"><div className="flex items-center gap-3"><div className="p-2.5 bg-yellow-100 rounded-xl"><Clock className="h-5 w-5 text-yellow-600" /></div><div><p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{pendingCount}</p><p className="text-xs text-gray-500 dark:text-gray-400">Pending</p></div></div></Card>
                <Card padding="md"><div className="flex items-center gap-3"><div className="p-2.5 bg-blue-100 rounded-xl"><Package className="h-5 w-5 text-blue-600" /></div><div><p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{activeCount}</p><p className="text-xs text-gray-500 dark:text-gray-400">Active</p></div></div></Card>
                <Card padding="md"><div className="flex items-center gap-3"><div className="p-2.5 bg-green-100 rounded-xl"><CheckCircle className="h-5 w-5 text-green-600" /></div><div><p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{deliveredCount}</p><p className="text-xs text-gray-500 dark:text-gray-400">Delivered</p></div></div></Card>
            </div>

            {/* Tabs + Search */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                    {([
                        { key: 'all' as const, label: 'All' },
                        { key: 'pending' as const, label: `Pending${pendingCount ? ` (${pendingCount})` : ''}` },
                        { key: 'active' as const, label: `Active${activeCount ? ` (${activeCount})` : ''}` },
                        { key: 'completed' as const, label: 'Completed' },
                    ]).map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>
                <div className="flex-1"><Input placeholder="Search by patient or order ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} leftIcon={<Search className="h-5 w-5" />} /></div>
            </div>

            {/* Orders */}
            <div className="space-y-3">
                {filtered.length === 0 ? (
                    <Card padding="lg"><div className="p-8 text-center text-gray-500 dark:text-gray-400"><ShoppingCart className="h-10 w-10 mx-auto mb-2 text-gray-300" />No orders found{tab !== 'all' && ` with status "${tab}"`}</div></Card>
                ) : paginatedOrders.map((order: any) => {
                    const isExpanded = expandedOrderId === order.id;
                    const items = order.items || [];
                    const patientName = order.patient?.name || order.patientName || order.customerName || 'Patient';
                    const total = order.total_amount || order.total || items.reduce((s: number, i: any) => s + (i.subtotal || (i.price || 0) * (i.quantity || 1)), 0);

                    return (
                        <Card key={order.id} padding="none">
                            <div className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center justify-between gap-4"
                                onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}>
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className={`p-2.5 rounded-xl flex-shrink-0 ${order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : order.status === 'processing' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                                        <ShoppingCart className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-gray-900 dark:text-gray-100">#{order.id?.slice(-6).toUpperCase()}</p>
                                            <StatusBadge status={order.status || 'pending'} size="sm" />
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{patientName} · {items.length} item{items.length !== 1 ? 's' : ''}</p>
                                        <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 flex-shrink-0">
                                    {total > 0 && <div className="flex items-center gap-1 text-gray-900 dark:text-gray-100 font-bold"><IndianRupee className="h-4 w-4" />{Number(total).toFixed(0)}</div>}
                                    {['pending', 'confirmed', 'processing', 'ready', 'dispatched'].includes(order.status) && (
                                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                            {order.status === 'pending' && (
                                                <button onClick={() => handleStatus(order.id, 'confirmed')} disabled={actionLoading === order.id}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Confirm">
                                                    {actionLoading === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                                                </button>
                                            )}
                                            {order.status === 'confirmed' && (
                                                <button onClick={() => handleStatus(order.id, 'processing')} disabled={actionLoading === order.id}
                                                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Start Processing"><Package className="h-4 w-4" /></button>
                                            )}
                                            {order.status === 'processing' && (
                                                <button onClick={() => handleStatus(order.id, 'ready')} disabled={actionLoading === order.id}
                                                    className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg" title="Mark Ready"><CheckCircle className="h-4 w-4" /></button>
                                            )}
                                            {['ready', 'dispatched'].includes(order.status) && (
                                                <button onClick={() => handleStatus(order.id, 'delivered')} disabled={actionLoading === order.id}
                                                    className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Mark Delivered"><CheckCircle className="h-4 w-4" /></button>
                                            )}
                                            {order.status !== 'dispatched' && (
                                                <button onClick={() => handleStatus(order.id, 'cancelled')} disabled={actionLoading === order.id}
                                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Cancel"><XCircle className="h-4 w-4" /></button>
                                            )}
                                        </div>
                                    )}
                                    {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                                </div>
                            </div>

                            {/* Expanded Detail */}
                            {isExpanded && (
                                <div className="border-t border-gray-100 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-800/50 space-y-4">
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Order Items</h4>
                                        <div className="space-y-2">
                                            {items.map((item: any, idx: number) => (
                                                <div key={idx} className="flex items-center justify-between bg-white dark:bg-gray-900 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-800">
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.name || item.medicineName || 'Medicine'}</p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">Qty: {item.quantity || 1}</p>
                                                    </div>
                                                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">₹{item.subtotal || ((item.price || 0) * (item.quantity || 1))}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {order.delivery_address && (
                                        <div className="flex items-start gap-2">
                                            <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                                            <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400">Delivery Address</p><p className="text-sm text-gray-700 dark:text-gray-300">{order.delivery_address}</p></div>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700">
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Amount</span>
                                        <span className="text-lg font-bold text-gray-900 dark:text-gray-100">₹{total > 0 ? Number(total).toFixed(2) : '—'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-gray-500 dark:text-gray-400">Payment:</span>
                                        <StatusBadge status={order.payment_status || 'pending'} size="sm" />
                                    </div>
                                </div>
                            )}
                        </Card>
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
            <ConfirmDialog {...dialogProps} />
        </div>
    );
    /* eslint-enable @typescript-eslint/no-explicit-any */
}
