'use client';

import { useEffect, useCallback } from 'react';
import {
    Users,
    Stethoscope,
    Building2,
    Building,
    Pill,
    Siren,
    Clock,
    CheckCircle,
    XCircle,
    AlertTriangle,
    TrendingUp,
    Activity,
    FileWarning
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import Link from 'next/link';
import { useAdminStore, type ProviderCategory, type RecentAction, type Alert } from '@/stores/adminStore';
import { useAppointmentUpdates } from '@/hooks/useSocket';

// Icon mapping for provider categories
const CATEGORY_ICONS: Record<string, typeof Stethoscope> = {
    doctors: Stethoscope,
    hospitals: Building2,
    clinics: Building,
    pharmacies: Pill,
    ambulances: Siren,
};

const CATEGORY_COLORS: Record<string, string> = {
    doctors: 'bg-emerald-600',
    hospitals: 'bg-teal-600',
    clinics: 'bg-pink-600',
    pharmacies: 'bg-orange-600',
    ambulances: 'bg-red-600',
};

export default function AdminDashboard() {
    const { stats, providerCategories, recentActions, alerts, isLoading, error, fetchDashboardData } = useAdminStore();

    // Real-time: refresh dashboard when appointment events come in
    useAppointmentUpdates(useCallback(() => { fetchDashboardData(); }, [fetchDashboardData]));

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const currentTime = new Date();

    // Stats configuration using real data
    const STATS = [
        { label: 'Total Providers', value: stats?.totalProviders ?? 0, icon: Users, change: '', color: 'text-blue-600', bg: 'bg-blue-100' },
        { label: 'Active Today', value: stats?.activeToday ?? 0, icon: Activity, change: '', color: 'text-green-600', bg: 'bg-green-100' },
        { label: 'Pending Approvals', value: stats?.pendingApprovals ?? 0, icon: Clock, change: '', color: 'text-yellow-600', bg: 'bg-yellow-100' },
        { label: 'Active Emergencies', value: stats?.activeEmergencies ?? 0, icon: AlertTriangle, change: '', color: 'text-red-600', bg: 'bg-red-100' },
    ];

    if (isLoading && !stats) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error && !stats) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <AlertTriangle className="h-12 w-12 text-red-400" />
                <p className="text-red-600 text-center max-w-md">{error}</p>
                <button onClick={() => fetchDashboardData()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Admin Control Center</h1>
                        <p className="text-blue-100 mt-1">
                            {currentTime.toLocaleDateString('en-IN', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </p>
                    </div>
                    <div className="hidden md:flex items-center gap-6">
                        <div className="text-right">
                            <p className="text-sm text-blue-200">System Status</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></span>
                                <span className="font-medium">All Systems Operational</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Alerts */}
            {alerts.length > 0 && (
                <div className="space-y-2">
                    {alerts.map((alert: Alert, idx: number) => (
                        <Link
                            key={idx}
                            href={alert.link}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${alert.type === 'error'
                                ? 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100'
                                : alert.type === 'warning'
                                    ? 'bg-yellow-50 border-yellow-200 text-yellow-800 hover:bg-yellow-100'
                                    : 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100'
                                }`}
                        >
                            {alert.type === 'error' ? (
                                <XCircle className="h-5 w-5" />
                            ) : alert.type === 'warning' ? (
                                <FileWarning className="h-5 w-5" />
                            ) : (
                                <AlertTriangle className="h-5 w-5" />
                            )}
                            <span className="text-sm font-medium">{alert.message}</span>
                        </Link>
                    ))}
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {STATS.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <Card key={stat.label} className="relative overflow-hidden">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stat.value}</p>
                                    {stat.change && (
                                        <p className={`text-sm mt-1 ${stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                                            {stat.change} from last week
                                        </p>
                                    )}
                                </div>
                                <div className={`p-3 rounded-xl ${stat.bg}`}>
                                    <Icon className={`h-6 w-6 ${stat.color}`} />
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Provider Categories */}
            <Card>
                <CardHeader>
                    <CardTitle>Provider Overview</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {providerCategories.map((category: ProviderCategory) => {
                            const Icon = CATEGORY_ICONS[category.type] || Users;
                            const color = CATEGORY_COLORS[category.type] || 'bg-gray-600';
                            return (
                                <Link
                                    key={category.name}
                                    href={`/admin/approvals?type=${category.type}`}
                                    className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600 hover:shadow-sm transition-all"
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className={`p-2 rounded-lg ${color} text-white`}>
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <span className="font-medium text-gray-900 dark:text-gray-100">{category.name}</span>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500 dark:text-gray-400">Approved</span>
                                            <span className="font-medium text-gray-900 dark:text-gray-100">{category.approved}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500 dark:text-gray-400">Pending</span>
                                            <span className="font-medium text-yellow-600">{category.pending}</span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Actions */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Recent Actions</CardTitle>
                        <Link href="/admin/audit" className="text-sm text-blue-600 hover:underline">
                            View all
                        </Link>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {recentActions.map((action: RecentAction) => (
                                <div key={action.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-full ${action.status === 'approved' ? 'bg-green-100' :
                                            action.status === 'rejected' ? 'bg-red-100' :
                                                action.status === 'suspended' ? 'bg-red-100' :
                                                    'bg-blue-100'
                                            }`}>
                                            {action.status === 'approved' ? (
                                                <CheckCircle className="h-4 w-4 text-green-600" />
                                            ) : action.status === 'rejected' || action.status === 'suspended' ? (
                                                <XCircle className="h-4 w-4 text-red-600" />
                                            ) : (
                                                <Clock className="h-4 w-4 text-blue-600" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{action.target}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{action.type} • {action.time}</p>
                                        </div>
                                    </div>
                                    <StatusBadge status={action.status} size="sm" />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-3">
                            <Link
                                href="/admin/approvals"
                                className="p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:bg-blue-50 transition-colors text-center"
                            >
                                <Clock className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Review Pending</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stats?.pendingApprovals ?? 0} waiting</p>
                            </Link>
                            <Link
                                href="/admin/emergencies"
                                className="p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-red-300 hover:bg-red-50 transition-colors text-center"
                            >
                                <Siren className="h-8 w-8 text-red-600 mx-auto mb-2" />
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Emergencies</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stats?.activeEmergencies ?? 0} active</p>
                            </Link>
                            <Link
                                href="/admin/compliance"
                                className="p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-yellow-300 hover:bg-yellow-50 transition-colors text-center"
                            >
                                <FileWarning className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Compliance</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Review status</p>
                            </Link>
                            <Link
                                href="/admin/analytics"
                                className="p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-green-300 hover:bg-green-50 transition-colors text-center"
                            >
                                <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Analytics</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">View reports</p>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
