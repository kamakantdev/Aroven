'use client';

import { useEffect, useCallback } from 'react';
import { FileText, Package, ShoppingCart, AlertTriangle, TrendingUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import Link from 'next/link';
import { usePharmacyStore, type Prescription, type InventoryItem } from '@/stores/pharmacyStore';
import { useOrderUpdates, usePrescriptionUpdates } from '@/hooks/useSocket';

export default function PharmacyDashboard() {
    const { stats, pendingPrescriptions, lowStockItems, isLoading, error, fetchDashboardData } = usePharmacyStore();

    // Real-time: refresh dashboard on new orders or prescriptions
    useOrderUpdates(
        useCallback(() => { fetchDashboardData(); }, [fetchDashboardData]),
        useCallback(() => { fetchDashboardData(); }, [fetchDashboardData])
    );
    usePrescriptionUpdates(useCallback(() => { fetchDashboardData(); }, [fetchDashboardData]));

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const currentTime = new Date();

    // Stats configuration using real data
    const STATS = [
        { label: 'New Prescriptions', value: stats?.newPrescriptions ?? 0, icon: FileText, color: 'text-orange-600', bg: 'bg-orange-100' },
        { label: 'Pending Orders', value: stats?.pendingOrders ?? 0, icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-100' },
        { label: 'Low Stock Items', value: stats?.lowStockItems ?? 0, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' },
        { label: "Today's Revenue", value: `₹${(stats?.todaysRevenue ?? 0).toLocaleString('en-IN')}`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-100' },
    ];

    if (isLoading && !stats) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
            </div>
        );
    }

    if (error && !stats) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <AlertTriangle className="h-12 w-12 text-red-400" />
                <p className="text-red-600 text-center max-w-md">{error}</p>
                <button onClick={() => fetchDashboardData()} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-orange-600 to-orange-800 rounded-2xl p-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Pharmacy Fulfillment Console</h1>
                        <p className="text-orange-100 mt-1">
                            {currentTime.toLocaleDateString('en-IN', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {STATS.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <Card key={stat.label}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stat.value}</p>
                                </div>
                                <div className={`p-3 rounded-xl ${stat.bg}`}>
                                    <Icon className={`h-6 w-6 ${stat.color}`} />
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pending Prescriptions */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>New Prescriptions</CardTitle>
                        <Link href="/pharmacy/prescriptions" className="text-sm text-orange-600 hover:underline">
                            View all
                        </Link>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {pendingPrescriptions.map((rx: Prescription) => (
                                <div key={rx.id} className="flex items-center justify-between p-3 border border-gray-100 dark:border-gray-800 rounded-xl">
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-gray-100">{rx.patientName}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{rx.doctorName} • {rx.items} items</p>
                                    </div>
                                    <div className="text-right">
                                        <StatusBadge status={rx.status} size="sm" />
                                        <p className="text-xs text-gray-400 mt-1">{rx.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Low Stock Alerts */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                            Low Stock Alerts
                        </CardTitle>
                        <Link href="/pharmacy/inventory" className="text-sm text-orange-600 hover:underline">
                            Manage
                        </Link>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {lowStockItems.map((item: InventoryItem) => (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg">
                                    <span className="font-medium text-gray-900 dark:text-gray-100">{item.name}</span>
                                    <span className="text-sm text-red-600 font-medium">{item.quantity} left</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
