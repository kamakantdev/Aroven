'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    BarChart3, TrendingUp, Users, Calendar, Loader2, RefreshCw,
    CheckCircle, XCircle, DollarSign, Clock
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useHospitalStore } from '@/stores/hospitalStore';
import { hospitalApi } from '@/lib/api';

interface AnalyticsData {
    period: string;
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    totalRevenue: number;
}

export default function HospitalReportsPage() {
    const { stats, isLoading: dashLoading, fetchDashboardData } = useHospitalStore();
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);

    const fetchAnalytics = useCallback(async () => {
        setAnalyticsLoading(true);
        try {
            const response = await hospitalApi.getAnalytics();
            if (response.success) {
                setAnalytics(response.data as unknown as AnalyticsData);
            }
        } catch (err) {
            console.error('Failed to fetch analytics:', err);
        } finally {
            setAnalyticsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboardData();
        fetchAnalytics();
    }, [fetchDashboardData, fetchAnalytics]);

    const isLoading = dashLoading || analyticsLoading;

    if (isLoading && !stats && !analytics) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
            </div>
        );
    }

    const completionRate = analytics && analytics.totalAppointments > 0
        ? Math.round((analytics.completedAppointments / analytics.totalAppointments) * 100)
        : 0;

    const cancellationRate = analytics && analytics.totalAppointments > 0
        ? Math.round((analytics.cancelledAppointments / analytics.totalAppointments) * 100)
        : 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reports & Analytics</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Hospital performance overview</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { fetchDashboardData(); fetchAnalytics(); }}
                    disabled={isLoading}
                >
                    <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Hospital Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Bed Capacity', value: stats?.bedCapacity ?? '—', icon: Users, color: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400' },
                    { label: 'Today\'s Appointments', value: stats?.todaysAppointments ?? 0, icon: Calendar, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
                    { label: 'Doctors', value: stats?.totalDoctors ?? 0, icon: TrendingUp, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
                    { label: 'Departments', value: stats?.departments ?? 0, icon: BarChart3, color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
                ].map((stat) => (
                    <Card key={stat.label} padding="md">
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${stat.color}`}><stat.icon className="h-5 w-5" /></div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                    {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Analytics Section */}
            {analytics && (
                <>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Appointment Analytics
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card padding="md">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                                    <Clock className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                        {analytics.totalAppointments.toLocaleString()}
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Appointments</p>
                                </div>
                            </div>
                        </Card>

                        <Card padding="md">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                                    <CheckCircle className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                        {analytics.completedAppointments.toLocaleString()}
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Completed ({completionRate}%)
                                    </p>
                                </div>
                            </div>
                        </Card>

                        <Card padding="md">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                                    <XCircle className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                        {analytics.cancelledAppointments.toLocaleString()}
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Cancelled ({cancellationRate}%)
                                    </p>
                                </div>
                            </div>
                        </Card>

                        <Card padding="md">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                                    <DollarSign className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                        ₹{analytics.totalRevenue.toLocaleString()}
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Completion Rate Bar */}
                    {analytics.totalAppointments > 0 && (
                        <Card padding="md">
                            <CardHeader>
                                <CardTitle>Appointment Completion Rate</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                                        <span>Completed</span>
                                        <span>{completionRate}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                                        <div
                                            className="bg-green-500 h-3 rounded-full transition-all duration-500"
                                            style={{ width: `${completionRate}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                                        <span>Cancelled</span>
                                        <span>{cancellationRate}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                                        <div
                                            className="bg-red-400 h-3 rounded-full transition-all duration-500"
                                            style={{ width: `${cancellationRate}%` }}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
