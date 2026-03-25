'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    History, Search, Filter, User, Shield, Settings, FileText,
    CheckCircle, XCircle, Eye, Download, Calendar, Loader2, RefreshCw
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { adminApi } from '@/lib/api';

type ActionType = 'approval' | 'rejection' | 'update' | 'login' | 'settings' | 'view' | 'create' | 'delete';

interface AuditLog {
    id: string;
    action: string;
    description: string;
    user: string;
    userRole: string;
    target?: string;
    timestamp: string;
    ip?: string;
    resourceType?: string;
}

const ACTION_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    approval: { icon: CheckCircle, color: 'bg-green-100 text-green-600', label: 'Approval' },
    approve: { icon: CheckCircle, color: 'bg-green-100 text-green-600', label: 'Approval' },
    rejection: { icon: XCircle, color: 'bg-red-100 text-red-600', label: 'Rejection' },
    reject: { icon: XCircle, color: 'bg-red-100 text-red-600', label: 'Rejection' },
    update: { icon: FileText, color: 'bg-blue-100 text-blue-600', label: 'Update' },
    login: { icon: User, color: 'bg-purple-100 text-purple-600', label: 'Login' },
    settings: { icon: Settings, color: 'bg-orange-100 text-orange-600', label: 'Settings' },
    view: { icon: Eye, color: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400', label: 'View' },
    create: { icon: FileText, color: 'bg-blue-100 text-blue-600', label: 'Create' },
    delete: { icon: XCircle, color: 'bg-red-100 text-red-600', label: 'Delete' },
};

const DEFAULT_ACTION = { icon: FileText, color: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400', label: 'Action' };

export default function AuditPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchAuditLogs = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await adminApi.getAuditLogs(page);
            if (!result.success) throw new Error('Failed to fetch audit logs');

            const rows = Array.isArray(result.data) ? result.data : [];
            const normalized: AuditLog[] = rows.map((row: any) => {
                const actionRaw = String(row.action || row.eventType || 'update');
                const action = actionRaw.toLowerCase();
                const user = row.user?.name || row.userName || row.actorName || row.user || 'System';
                const userRole = row.userRole || row.actorRole || row.role || 'unknown';
                const description = row.description
                    || row.message
                    || row.details?.message
                    || `${actionRaw} action performed`;

                return {
                    id: row._id || row.id || `${actionRaw}-${row.createdAt || row.timestamp || Math.random()}`,
                    action,
                    description,
                    user,
                    userRole,
                    target: row.entityId || row.resourceId || row.target,
                    timestamp: row.createdAt || row.timestamp || new Date().toISOString(),
                    ip: row.ipAddress || row.ip,
                    resourceType: row.resourceType || row.entityType,
                };
            });

            setLogs(normalized);
            setTotalPages(result.pagination?.totalPages || 1);
        } catch (err) {
            console.error('Error fetching audit logs:', err);
            setError('Failed to load audit logs');
        } finally {
            setIsLoading(false);
        }
    }, [page]);

    useEffect(() => { fetchAuditLogs(); }, [fetchAuditLogs]);

    const filteredLogs = logs.filter(log =>
        (log.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.user || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.action || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Audit Trail</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Track all administrative actions and changes</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={fetchAuditLogs} leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
                </div>
            </div>

            <Card padding="sm">
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <Input placeholder="Search audit logs..." value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)} leftIcon={<Search className="h-5 w-5" />} />
                    </div>
                </div>
            </Card>

            <Card padding="none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Recent Activity
                    </CardTitle>
                </CardHeader>
                {isLoading ? (
                    <div className="flex items-center justify-center p-12">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                        <span className="ml-2 text-gray-500 dark:text-gray-400">Loading audit logs...</span>
                    </div>
                ) : error ? (
                    <div className="p-8 text-center">
                        <p className="text-red-600">{error}</p>
                        <Button className="mt-4" onClick={fetchAuditLogs} leftIcon={<RefreshCw className="h-4 w-4" />}>Retry</Button>
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">No audit logs found</div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {filteredLogs.map((log) => {
                            const actionConfig = ACTION_CONFIG[log.action] || DEFAULT_ACTION;
                            const ActionIcon = actionConfig.icon;
                            return (
                                <div key={log.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <div className="flex items-start gap-4">
                                        <div className={`p-2 rounded-lg ${actionConfig.color}`}><ActionIcon className="h-4 w-4" /></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{log.description}</p>
                                            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                <span className="flex items-center gap-1"><User className="h-3 w-3" />{log.user}</span>
                                                <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{log.userRole}</span>
                                                {log.ip && <span>IP: {log.ip}</span>}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${actionConfig.color}`}>
                                                {actionConfig.label}
                                            </span>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatTime(log.timestamp)}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-100 dark:border-gray-800">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                        <span className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</span>
                        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                    </div>
                )}
            </Card>
        </div>
    );
}
