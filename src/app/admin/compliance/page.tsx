'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    Shield, FileText, AlertTriangle, Clock, CheckCircle,
    XCircle, Download, RefreshCw, Loader2, Calendar
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { adminApi } from '@/lib/api';

interface ExpiringDocument {
    id: string;
    providerName: string;
    providerType: string;
    documentType: string;
    expiryDate: string;
    status: string;
    daysUntilExpiry: number;
}

export default function CompliancePage() {
    const [documents, setDocuments] = useState<ExpiringDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [days, setDays] = useState(30);

    const fetchCompliance = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await adminApi.getComplianceDocuments(days);
            if (!result.success) throw new Error('Failed to fetch compliance data');
            const payload = result.data as any;
            const apiDocuments = Array.isArray(payload?.documents) ? payload.documents : null;

            if (apiDocuments) {
                setDocuments(apiDocuments);
                return;
            }

            const operators = Array.isArray(payload?.operators) ? payload.operators : [];
            const nowTs = Date.now();

            const normalized: ExpiringDocument[] = operators.map((op: any) => {
                const expiryDate = op.license_expiry || op.expiryDate || op.expiry_date || null;
                const expiryTs = expiryDate ? new Date(expiryDate).getTime() : Number.NaN;
                const daysUntilExpiry = Number.isFinite(expiryTs)
                    ? Math.ceil((expiryTs - nowTs) / (1000 * 60 * 60 * 24))
                    : 0;

                return {
                    id: op.id,
                    providerName: op.name || 'Unknown',
                    providerType: 'ambulance_operator',
                    documentType: 'Operator License',
                    expiryDate: expiryDate || new Date().toISOString(),
                    status: daysUntilExpiry <= 0 ? 'expired' : daysUntilExpiry <= 7 ? 'expiring_soon' : 'valid',
                    daysUntilExpiry,
                };
            });

            setDocuments(normalized);
        } catch (err) {
            console.error('Error fetching compliance data:', err);
            setError('Failed to load compliance data');
        } finally {
            setIsLoading(false);
        }
    }, [days]);

    useEffect(() => { fetchCompliance(); }, [fetchCompliance]);

    const expiredCount = documents.filter(d => d.daysUntilExpiry <= 0).length;
    const expiringCount = documents.filter(d => d.daysUntilExpiry > 0 && d.daysUntilExpiry <= 7).length;
    const upcomingCount = documents.filter(d => d.daysUntilExpiry > 7).length;

    const getStatusColor = (daysLeft: number) => {
        if (daysLeft <= 0) return 'bg-red-100 text-red-700';
        if (daysLeft <= 7) return 'bg-yellow-100 text-yellow-700';
        return 'bg-green-100 text-green-700';
    };

    const getStatusLabel = (daysLeft: number) => {
        if (daysLeft <= 0) return 'Expired';
        if (daysLeft <= 7) return 'Expiring Soon';
        return 'Valid';
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Compliance Management</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Track provider document expiry and compliance status</p>
                </div>
                <div className="flex items-center gap-3">
                    <select value={days} onChange={(e) => setDays(Number(e.target.value))}
                        className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-200">
                        <option value={7}>Next 7 days</option>
                        <option value={30}>Next 30 days</option>
                        <option value={60}>Next 60 days</option>
                        <option value={90}>Next 90 days</option>
                    </select>
                    <Button variant="outline" onClick={fetchCompliance} leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card padding="md">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-100 rounded-xl"><XCircle className="h-6 w-6 text-red-600" /></div>
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Expired</p>
                            <p className="text-2xl font-bold text-red-600">{expiredCount}</p>
                        </div>
                    </div>
                </Card>
                <Card padding="md">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-yellow-100 rounded-xl"><AlertTriangle className="h-6 w-6 text-yellow-600" /></div>
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Expiring Soon</p>
                            <p className="text-2xl font-bold text-yellow-600">{expiringCount}</p>
                        </div>
                    </div>
                </Card>
                <Card padding="md">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-xl"><CheckCircle className="h-6 w-6 text-green-600" /></div>
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Valid</p>
                            <p className="text-2xl font-bold text-green-600">{upcomingCount}</p>
                        </div>
                    </div>
                </Card>
            </div>

            <Card padding="none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Document Status
                    </CardTitle>
                </CardHeader>
                {isLoading ? (
                    <div className="flex items-center justify-center p-12">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                        <span className="ml-2 text-gray-500 dark:text-gray-400">Loading compliance data...</span>
                    </div>
                ) : error ? (
                    <div className="p-8 text-center">
                        <p className="text-red-600">{error}</p>
                        <Button className="mt-4" onClick={fetchCompliance} leftIcon={<RefreshCw className="h-4 w-4" />}>Retry</Button>
                    </div>
                ) : documents.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                        <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
                        <p>No expiring documents found in the next {days} days</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {documents.map((doc) => (
                            <div key={doc.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-lg ${getStatusColor(doc.daysUntilExpiry)}`}>
                                            <FileText className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-gray-100">{doc.providerName}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{doc.documentType} &middot; {doc.providerType}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Expires</p>
                                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                {new Date(doc.expiryDate).toLocaleDateString('en-IN')}
                                            </p>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(doc.daysUntilExpiry)}`}>
                                            {getStatusLabel(doc.daysUntilExpiry)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
