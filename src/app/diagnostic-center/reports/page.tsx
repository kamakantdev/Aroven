'use client';

import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, FlaskConical, CalendarCheck, CheckCircle2, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { diagnosticCenterApi } from '@/lib/api';

interface Analytics {
    totalBookings: number;
    completedResults: number;
    monthlyBookings: number;
    completionRate: string;
    popularTests?: { name: string; count: number }[];
    revenueThisMonth?: number;
    bookingsByStatus?: Record<string, number>;
}

export default function ReportsPage() {
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadAnalytics();
    }, []);

    const loadAnalytics = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await diagnosticCenterApi.getAnalytics();
            if (res.success) {
                setAnalytics(res.data as Analytics);
            } else {
                setError(res.error || 'Failed to load analytics');
            }
        } catch {
            setError('Failed to connect to server.');
        }
        setIsLoading(false);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <BarChart3 className="h-12 w-12 text-red-400" />
                <p className="text-red-600">{error}</p>
                <button onClick={loadAnalytics} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                    Retry
                </button>
            </div>
        );
    }

    const STATS = [
        { label: 'Total Bookings', value: analytics?.totalBookings ?? 0, icon: CalendarCheck, color: 'text-purple-600', bg: 'bg-purple-100' },
        { label: 'Completed Results', value: analytics?.completedResults ?? 0, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
        { label: 'This Month', value: analytics?.monthlyBookings ?? 0, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-100' },
        { label: 'Completion Rate', value: analytics?.completionRate ?? '0%', icon: BarChart3, color: 'text-amber-600', bg: 'bg-amber-100' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reports & Analytics</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Overview of your diagnostic center performance</p>
            </div>

            {/* Stats */}
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

            {/* Booking Status Breakdown */}
            {analytics?.bookingsByStatus && (
                <Card>
                    <CardHeader><CardTitle>Bookings by Status</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {Object.entries(analytics.bookingsByStatus).map(([status, count]) => {
                                const total = analytics.totalBookings || 1;
                                const pct = Math.round((count / total) * 100);
                                return (
                                    <div key={status}>
                                        <div className="flex items-center justify-between text-sm mb-1">
                                            <span className="text-gray-700 dark:text-gray-300 capitalize">{status.replace(/_/g, ' ')}</span>
                                            <span className="text-gray-500 dark:text-gray-400">{count} ({pct}%)</span>
                                        </div>
                                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Popular Tests */}
            {analytics?.popularTests && analytics.popularTests.length > 0 && (
                <Card>
                    <CardHeader><CardTitle>Most Popular Tests</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {analytics.popularTests.map((test, idx) => (
                                <div key={test.name} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-sm">
                                            {idx + 1}
                                        </div>
                                        <span className="font-medium text-gray-900 dark:text-gray-100">{test.name}</span>
                                    </div>
                                    <span className="text-sm text-gray-500 dark:text-gray-400">{test.count} bookings</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Revenue */}
            {analytics?.revenueThisMonth !== undefined && (
                <Card>
                    <CardHeader><CardTitle>Revenue This Month</CardTitle></CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-green-100 rounded-xl">
                                <TrendingUp className="h-8 w-8 text-green-600" />
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">₹{analytics.revenueThisMonth.toLocaleString('en-IN')}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Based on completed bookings</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
