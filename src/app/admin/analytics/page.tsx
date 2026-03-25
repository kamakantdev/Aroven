'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    Users, Stethoscope, Calendar, Activity,
    ArrowUpRight, ArrowDownRight, RefreshCw, Loader2
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { adminApi } from '@/lib/api';

interface AnalyticsData {
    stats?: {
        totalUsers?: number;
        totalDoctors?: number;
        totalAppointments?: number;
        platformUptime?: number;
        userGrowth?: number;
        doctorGrowth?: number;
        appointmentGrowth?: number;
    };
    monthlyData?: { month: string; users: number; appointments: number }[];
    topSpecialties?: { name: string; count: number; percentage: number }[];
    platformMetrics?: {
        avgRating?: number;
        patientSatisfaction?: number;
        avgWaitTime?: string;
        activeNow?: number;
    };
}

export default function AnalyticsPage() {
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [period, setPeriod] = useState('30d');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAnalytics = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await adminApi.getAnalytics(period);
            if (result.success) {
                setAnalytics(result.data || result);
            } else {
                setError('Failed to load analytics data');
            }
        } catch (err) {
            console.error('Error fetching analytics:', err);
            setError('Failed to load analytics data');
        } finally {
            setIsLoading(false);
        }
    }, [period]);

    useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

    const stats = analytics?.stats;
    const STATS_CARDS = [
        { label: 'Total Users', value: stats?.totalUsers?.toLocaleString() ?? '—',
          change: stats?.userGrowth != null ? `${stats.userGrowth > 0 ? '+' : ''}${stats.userGrowth.toFixed(1)}%` : '',
          trend: (stats?.userGrowth ?? 0) >= 0 ? 'up' as const : 'down' as const,
          icon: Users, color: 'bg-blue-100 text-blue-600' },
        { label: 'Active Doctors', value: stats?.totalDoctors?.toLocaleString() ?? '—',
          change: stats?.doctorGrowth != null ? `${stats.doctorGrowth > 0 ? '+' : ''}${stats.doctorGrowth.toFixed(1)}%` : '',
          trend: (stats?.doctorGrowth ?? 0) >= 0 ? 'up' as const : 'down' as const,
          icon: Stethoscope, color: 'bg-emerald-100 text-emerald-600' },
        { label: 'Appointments', value: stats?.totalAppointments?.toLocaleString() ?? '—',
          change: stats?.appointmentGrowth != null ? `${stats.appointmentGrowth > 0 ? '+' : ''}${stats.appointmentGrowth.toFixed(1)}%` : '',
          trend: (stats?.appointmentGrowth ?? 0) >= 0 ? 'up' as const : 'down' as const,
          icon: Calendar, color: 'bg-purple-100 text-purple-600' },
        { label: 'Platform Uptime', value: stats?.platformUptime != null ? `${stats.platformUptime}%` : '—',
          change: '', trend: 'up' as const, icon: Activity, color: 'bg-green-100 text-green-600' },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600 dark:text-gray-400">Loading analytics...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <p className="text-red-600">{error}</p>
                <Button onClick={fetchAnalytics} leftIcon={<RefreshCw className="h-4 w-4" />}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Analytics Dashboard</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Platform performance and insights</p>
                </div>
                <div className="flex items-center gap-3">
                    <select value={period} onChange={(e) => setPeriod(e.target.value)}
                        className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-200">
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                        <option value="90d">Last 90 days</option>
                        <option value="1y">Last year</option>
                    </select>
                    <Button variant="outline" onClick={fetchAnalytics} leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {STATS_CARDS.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <Card key={stat.label} padding="md">
                            <div className="flex items-start justify-between">
                                <div className={`p-2.5 rounded-xl ${stat.color}`}><Icon className="h-5 w-5" /></div>
                                {stat.change && (
                                    <div className={`flex items-center gap-1 text-sm ${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                                        {stat.trend === 'up' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                                        {stat.change}
                                    </div>
                                )}
                            </div>
                            <div className="mt-4">
                                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{stat.label}</p>
                            </div>
                        </Card>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle>User Growth</CardTitle></CardHeader>
                    <CardContent>
                        {analytics?.monthlyData && analytics.monthlyData.length > 0 ? (
                            <div className="h-64 flex items-end justify-between gap-2 px-4">
                                {analytics.monthlyData.map((data) => {
                                    const maxUsers = Math.max(...analytics.monthlyData!.map(d => d.users), 1);
                                    return (
                                        <div key={data.month} className="flex flex-col items-center gap-2 flex-1">
                                            <span className="text-xs text-gray-500 dark:text-gray-400">{data.users.toLocaleString()}</span>
                                            <div className="w-full bg-blue-500 rounded-t" style={{ height: `${(data.users / maxUsers) * 200}px` }} />
                                            <span className="text-xs text-gray-500 dark:text-gray-400">{data.month}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="h-64 flex items-center justify-center text-gray-400">No monthly data available</div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Top Specialties</CardTitle></CardHeader>
                    <CardContent>
                        {analytics?.topSpecialties && analytics.topSpecialties.length > 0 ? (
                            <div className="space-y-4">
                                {analytics.topSpecialties.map((specialty) => (
                                    <div key={specialty.name}>
                                        <div className="flex items-center justify-between text-sm mb-1">
                                            <span className="text-gray-700 dark:text-gray-300">{specialty.name}</span>
                                            <span className="text-gray-500 dark:text-gray-400">{specialty.count.toLocaleString()} consultations</span>
                                        </div>
                                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${specialty.percentage}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-64 flex items-center justify-center text-gray-400">No specialty data available</div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle>Platform Metrics</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                            <p className="text-3xl font-bold text-blue-600">{analytics?.platformMetrics?.avgRating?.toFixed(1) ?? '—'}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Avg. Rating</p>
                        </div>
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                            <p className="text-3xl font-bold text-emerald-600">{analytics?.platformMetrics?.patientSatisfaction != null ? `${analytics.platformMetrics.patientSatisfaction}%` : '—'}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Patient Satisfaction</p>
                        </div>
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                            <p className="text-3xl font-bold text-purple-600">{analytics?.platformMetrics?.avgWaitTime ?? '—'}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Avg. Wait Time</p>
                        </div>
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                            <p className="text-3xl font-bold text-orange-600">{analytics?.platformMetrics?.activeNow?.toLocaleString() ?? '—'}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Active Now</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
