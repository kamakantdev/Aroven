'use client';

import { useEffect, useState } from 'react';
import { Video, MessageSquare, Clock, User, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useDoctorStore, type Consultation } from '@/stores/doctorStore';
import Link from 'next/link';

export default function DoctorConsultationsPage() {
    const { consultations, loadingConsultations, error, fetchConsultations, clearError } = useDoctorStore();

    useEffect(() => { fetchConsultations(); }, []);

    if (loadingConsultations) {
        return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /><span className="ml-2 text-gray-600 dark:text-gray-400">Loading consultations...</span></div>;
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <AlertCircle className="h-12 w-12 text-red-400" />
                <p className="text-red-600">{error}</p>
                <Button onClick={() => { clearError(); fetchConsultations(); }} leftIcon={<RefreshCw className="h-4 w-4" />}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Consultations</h1><p className="text-gray-600 dark:text-gray-400 mt-1">Active and past consultations</p></div>
                <Button onClick={() => fetchConsultations()} leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
            </div>

            <Card padding="none">
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {(!consultations || consultations.length === 0) ? (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">No consultations found</div>
                    ) : consultations.map((c: Consultation) => (
                        <div key={c.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2.5 rounded-xl ${(c.type || c.appointment?.type) === 'video' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                        {(c.type || c.appointment?.type) === 'video' ? <Video className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-gray-100">{c.patientName || 'Patient'}</p>
                                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{(c.appointment?.appointment_date || c.created_at) ? new Date(c.appointment?.appointment_date || c.created_at!).toLocaleDateString('en-IN') : '—'}</span>
                                            <span className="capitalize">{c.type || c.appointment?.type || 'in-person'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <StatusBadge status={c.status || 'scheduled'} size="sm" />
                                    {c.status === 'active' && (
                                        <Link href={`/consultation/${c.id}`}>
                                            <Button size="sm" variant="primary">Join</Button>
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}
