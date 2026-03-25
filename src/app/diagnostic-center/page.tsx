'use client';

import { useEffect, useCallback } from 'react';
import { FlaskConical, CalendarCheck, Clock, Users } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Link from 'next/link';
import { useDiagnosticCenterStore, type DiagnosticBooking } from '@/stores/diagnosticCenterStore';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useDiagnosticUpdates } from '@/hooks/useSocket';

export default function DiagnosticCenterDashboard() {
    const { stats, todaysBookings, isLoading, error, fetchDashboardData } = useDiagnosticCenterStore();

    // Real-time: refresh dashboard when bookings or results change
    useDiagnosticUpdates(
        useCallback(() => { fetchDashboardData(); }, [fetchDashboardData]),
        useCallback(() => { fetchDashboardData(); }, [fetchDashboardData]),
        useCallback(() => { fetchDashboardData(); }, [fetchDashboardData])
    );

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const currentTime = new Date();

    const STATS = [
        { label: 'Total Tests', value: stats?.totalTests ?? 0, icon: FlaskConical, color: 'text-purple-600', bg: 'bg-purple-100' },
        { label: "Today's Bookings", value: stats?.todaysBookings ?? 0, icon: CalendarCheck, color: 'text-blue-600', bg: 'bg-blue-100' },
        { label: 'Pending Results', value: stats?.pendingResults ?? 0, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100' },
        { label: 'Total Patients', value: stats?.totalPatients ?? 0, icon: Users, color: 'text-green-600', bg: 'bg-green-100' },
    ];

    if (isLoading && !stats) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    if (error && !stats) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <FlaskConical className="h-12 w-12 text-red-400" />
                <p className="text-red-600 text-center max-w-md">{error}</p>
                <button onClick={() => fetchDashboardData()} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-2xl p-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Diagnostic Center Dashboard</h1>
                        <p className="text-purple-100 mt-1">
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

            {/* Today's Bookings */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Today&apos;s Bookings</CardTitle>
                    <Link href="/diagnostic-center/bookings" className="text-sm text-purple-600 hover:underline">
                        View all
                    </Link>
                </CardHeader>
                <CardContent>
                    {todaysBookings.length > 0 ? (
                        <div className="space-y-3">
                            {todaysBookings.map((booking: DiagnosticBooking) => (
                                <div
                                    key={booking.id}
                                    className={`flex items-center justify-between p-4 rounded-xl border ${
                                        booking.status === 'processing'
                                            ? 'border-purple-300 bg-purple-50'
                                            : 'border-gray-200 dark:border-gray-700'
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="text-sm font-medium min-w-[70px]">
                                            <span className="text-gray-900 dark:text-gray-100">{booking.booking_time || '--:--'}</span>
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-gray-100">{booking.patient_name || 'Patient'}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                {booking.test_name || 'Test'} • {booking.collection_type === 'home_collection' ? 'Home Collection' : 'Walk-in'}
                                            </p>
                                        </div>
                                    </div>
                                    <StatusBadge status={booking.status} size="sm" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-32 flex items-center justify-center text-gray-500 dark:text-gray-400">
                            <p>No bookings scheduled for today</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
