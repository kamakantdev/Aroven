'use client';

import { useEffect } from 'react';
import { BarChart3, Package, ShoppingCart, TrendingUp, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { usePharmacyStore } from '@/stores/pharmacyStore';

export default function PharmacyReportsPage() {
    const { stats, isLoading, fetchDashboardData } = usePharmacyStore();

    useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

    if (isLoading) {
        return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-orange-600" /></div>;
    }

    return (
        <div className="space-y-6">
            <div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reports</h1><p className="text-gray-600 dark:text-gray-400 mt-1">Pharmacy performance overview</p></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'New Prescriptions', value: stats?.newPrescriptions ?? 0, icon: Package, color: 'bg-orange-100 text-orange-600' },
                    { label: 'Pending Orders', value: stats?.pendingOrders ?? 0, icon: ShoppingCart, color: 'bg-blue-100 text-blue-600' },
                    { label: 'Today\'s Revenue', value: stats?.todaysRevenue ?? 0, icon: BarChart3, color: 'bg-emerald-100 text-emerald-600' },
                    { label: 'Low Stock Items', value: stats?.lowStockItems ?? 0, icon: TrendingUp, color: 'bg-red-100 text-red-600' },
                ].map(s => (
                    <Card key={s.label} padding="md">
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${s.color}`}><s.icon className="h-5 w-5" /></div>
                            <div><p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{s.value.toLocaleString()}</p><p className="text-sm text-gray-500 dark:text-gray-400">{s.label}</p></div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
