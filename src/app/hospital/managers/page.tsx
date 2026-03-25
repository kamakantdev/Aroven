'use client';

import { useEffect, useState } from 'react';
import { Users, Search, Loader2, RefreshCw, UserPlus, Trash2, AlertCircle, X, Shield } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { hospitalApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

interface Manager {
    id: string;
    user_id: string;
    role: string;
    created_at: string;
    user?: {
        name: string;
        email: string;
        phone?: string;
    };
    name?: string;
    email?: string;
}

export default function HospitalManagersPage() {
    const [managers, setManagers] = useState<Manager[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [addData, setAddData] = useState({ userId: '' });
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const toast = useToast();

    const fetchManagers = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await hospitalApi.getManagers();
            if (response.success) {
                const data = response.data as Record<string, unknown>;
                setManagers((data.managers || data.data || data || []) as Manager[]);
            } else {
                setError(response.error || 'Failed to load managers');
            }
        } catch (err) {
            console.error('Error fetching managers:', err);
            setError('Failed to connect to server. Please check your connection.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchManagers();
    }, []);

    const handleAddManager = async () => {
        if (!addData.userId.trim()) return;
        setActionLoading('add');
        try {
            const response = await hospitalApi.addManager({ userId: addData.userId.trim() });
            if (response.success) {
                toast.success('Manager Added', 'New manager has been added to the hospital');
                setShowAddModal(false);
                setAddData({ userId: '' });
                fetchManagers();
            } else {
                toast.error('Failed', response.error || 'Could not add manager');
            }
        } catch (err) {
            console.error('Error adding manager:', err);
            toast.error('Error', 'Failed to connect to server');
        } finally {
            setActionLoading(null);
        }
    };

    const filtered = managers.filter((m) => {
        const name = m.user?.name || m.name || '';
        const email = m.user?.email || m.email || '';
        return (
            name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            email.toLowerCase().includes(searchQuery.toLowerCase())
        );
    });

    if (isLoading && managers.length === 0) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
            </div>
        );
    }

    if (error && managers.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <AlertCircle className="h-12 w-12 text-red-400" />
                <p className="text-red-600 dark:text-red-400">{error}</p>
                <Button
                    onClick={() => {
                        setError(null);
                        fetchManagers();
                    }}
                    leftIcon={<RefreshCw className="h-4 w-4" />}
                >
                    Retry
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Managers</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Manage hospital staff with portal access
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => fetchManagers()}
                        leftIcon={<RefreshCw className="h-4 w-4" />}
                    >
                        Refresh
                    </Button>
                    <Button
                        onClick={() => setShowAddModal(true)}
                        leftIcon={<UserPlus className="h-4 w-4" />}
                    >
                        Add Manager
                    </Button>
                </div>
            </div>

            <Card padding="sm">
                <Input
                    placeholder="Search managers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    leftIcon={<Search className="h-5 w-5" />}
                />
            </Card>

            <Card padding="none">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Manager
                                </th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400 hidden md:table-cell">
                                    Email
                                </th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                                    Role
                                </th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                                    Added
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="py-12 text-center text-gray-500 dark:text-gray-400"
                                    >
                                        <div className="flex flex-col items-center gap-2">
                                            <Shield className="h-10 w-10 text-gray-300 dark:text-gray-600" />
                                            <p>No managers found</p>
                                            <p className="text-sm">
                                                Add managers to delegate hospital portal access
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((mgr) => (
                                    <tr
                                        key={mgr.id || mgr.user_id}
                                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                    >
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                                                    <Users className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                                                </div>
                                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                                    {mgr.user?.name || mgr.name || 'Unknown'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 hidden md:table-cell">
                                            {mgr.user?.email || mgr.email || '—'}
                                        </td>
                                        <td className="py-3 px-4 hidden sm:table-cell">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                                                {mgr.role || 'manager'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                                            {mgr.created_at
                                                ? new Date(mgr.created_at).toLocaleDateString()
                                                : '—'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Add Manager Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                                Add Manager
                            </h3>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    User ID *
                                </label>
                                <Input
                                    value={addData.userId}
                                    onChange={(e) =>
                                        setAddData((d) => ({ ...d, userId: e.target.value }))
                                    }
                                    placeholder="Enter the user's ID"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    The user must already have an account on the platform.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
                            <Button variant="outline" onClick={() => setShowAddModal(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAddManager}
                                isLoading={actionLoading === 'add'}
                                disabled={!addData.userId.trim()}
                            >
                                Add Manager
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
