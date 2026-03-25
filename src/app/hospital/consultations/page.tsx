'use client';

import { useEffect, useState } from 'react';
import { hospitalApi } from '@/lib/api';
import Link from 'next/link';
import {
    Video,
    Phone,
    MessageCircle,
    Clock,
    CheckCircle,
    XCircle,
    ChevronLeft,
    ChevronRight,
    Filter,
    User,
    Stethoscope,
    ExternalLink,
} from 'lucide-react';

interface Consultation {
    id: string;
    status: string;
    type: string;
    started_at: string;
    ended_at: string | null;
    diagnosis: string | null;
    notes: string | null;
    doctor: { id: string; name: string; specialization: string; profile_image: string | null };
    patient: { id: string; name: string; phone: string };
    appointment: { id: string; date: string; time_slot: string; type: string } | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    in_progress: { label: 'In Progress', color: 'bg-green-100 text-green-800', icon: <Video className="w-4 h-4" /> },
    completed: { label: 'Completed', color: 'bg-blue-100 text-blue-800', icon: <CheckCircle className="w-4 h-4" /> },
    cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: <XCircle className="w-4 h-4" /> },
};

export default function HospitalConsultationsPage() {
    const [consultations, setConsultations] = useState<Consultation[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>('');

    useEffect(() => {
        loadConsultations();
    }, [page, statusFilter]);

    const loadConsultations = async () => {
        setLoading(true);
        try {
            const res = await hospitalApi.getConsultations(page, statusFilter || undefined) as any;
            if (res.success) {
                setConsultations((res.data || []) as Consultation[]);
                setTotalPages(res.pagination?.totalPages || 1);
            }
        } catch (err) {
            console.error('Failed to load consultations:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) =>
        new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Hospital Consultations</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">View consultations by your affiliated doctors</p>
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                        className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All Status</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                </div>
            ) : consultations.length === 0 ? (
                <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                    <Stethoscope className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No consultations found</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Patient</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Doctor</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">Started</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden lg:table-cell">Diagnosis</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {consultations.map((c) => {
                                const status = statusConfig[c.status] || statusConfig.completed;
                                return (
                                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                                    <User className="w-4 h-4 text-blue-600" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{c.patient?.name || 'N/A'}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">{c.patient?.phone || ''}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{c.doctor?.name || 'N/A'}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{c.doctor?.specialization || ''}</p>
                                        </td>
                                        <td className="px-6 py-4 hidden sm:table-cell">
                                            <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                                                {c.type === 'video' ? <Video className="w-4 h-4" /> : c.type === 'audio' ? <Phone className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                                                {c.type || c.appointment?.type || 'video'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                                                {status.icon} {status.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 hidden md:table-cell">
                                            {c.started_at ? formatDate(c.started_at) : '—'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 max-w-[200px] truncate hidden lg:table-cell">
                                            {c.diagnosis || '—'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {c.status === 'in_progress' && (c.type === 'video' || c.appointment?.type === 'video') && (
                                                <Link href={`/consultation/${c.id}`} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                                                    <Video className="w-3.5 h-3.5" /> Join
                                                </Link>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Page {page} of {totalPages}</span>
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
