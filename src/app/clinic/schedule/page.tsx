'use client';

import { useEffect, useState } from 'react';
import { Clock, Calendar, Plus, Loader2, RefreshCw, Trash2, AlertCircle, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { clinicApi } from '@/lib/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface ClinicSlot {
    day: string;
    openTime: string;
    closeTime: string;
    isOpen: boolean;
}

export default function ClinicSchedulePage() {
    const [schedule, setSchedule] = useState<ClinicSlot[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    const fetchSchedule = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await clinicApi.getSchedule();
            if (res.success) {
                const data = res.data as any;
                const sched = data?.schedule || data?.opening_hours || data?.operatingHours || [];
                if (Array.isArray(sched) && sched.length > 0) {
                    setSchedule(sched);
                } else {
                    // Default schedule
                    setSchedule(DAYS.map(day => ({
                        day, openTime: '09:00', closeTime: '18:00',
                        isOpen: !['Saturday', 'Sunday'].includes(day),
                    })));
                }
            } else {
                setError(res.error || 'Failed to load schedule');
            }
        } catch { setError('Failed to connect to server.'); }
        setIsLoading(false);
    };

    useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

    const handleToggleDay = (day: string) => {
        setSchedule(prev => prev.map(s => s.day === day ? { ...s, isOpen: !s.isOpen } : s));
    };

    const handleTimeChange = (day: string, field: 'openTime' | 'closeTime', value: string) => {
        setSchedule(prev => prev.map(s => s.day === day ? { ...s, [field]: value } : s));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await clinicApi.updateSchedule({ schedule });
            if (res.success) {
                setEditing(false);
            } else {
                setError(res.error || 'Failed to save schedule');
            }
        } catch { setError('Network error.'); }
        setSaving(false);
    };

    if (isLoading) return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-pink-600" /></div>;

    if (error && schedule.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <AlertCircle className="h-12 w-12 text-red-400" />
                <p className="text-red-600">{error}</p>
                <Button onClick={fetchSchedule} leftIcon={<RefreshCw className="h-4 w-4" />}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Schedule</h1><p className="text-gray-600 dark:text-gray-400 mt-1">Clinic operating hours</p></div>
                <div className="flex gap-2">
                    {editing ? (
                        <>
                            <Button variant="outline" onClick={() => { setEditing(false); fetchSchedule(); }}>Cancel</Button>
                            <Button onClick={handleSave} isLoading={saving}>Save Schedule</Button>
                        </>
                    ) : (
                        <Button onClick={() => setEditing(true)}>Edit Schedule</Button>
                    )}
                </div>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {schedule.map(slot => (
                    <Card key={slot.day} padding="md">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Calendar className="h-4 w-4 text-pink-600" />{slot.day}</h3>
                            {editing && (
                                <button onClick={() => handleToggleDay(slot.day)} className={`w-10 h-5 rounded-full transition-colors ${slot.isOpen ? 'bg-pink-600' : 'bg-gray-300'}`}>
                                    <div className={`w-4 h-4 bg-white dark:bg-gray-900 rounded-full shadow transform transition-transform ${slot.isOpen ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                </button>
                            )}
                        </div>
                        {slot.isOpen ? (
                            editing ? (
                                <div className="flex items-center gap-2">
                                    <input type="time" value={slot.openTime} onChange={e => handleTimeChange(slot.day, 'openTime', e.target.value)} className="flex-1 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-sm" />
                                    <span className="text-gray-400">–</span>
                                    <input type="time" value={slot.closeTime} onChange={e => handleTimeChange(slot.day, 'closeTime', e.target.value)} className="flex-1 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-sm" />
                                </div>
                            ) : (
                                <p className="text-sm text-pink-700 flex items-center gap-1 bg-pink-50 px-3 py-2 rounded-lg">
                                    <Clock className="h-3 w-3" />{slot.openTime} – {slot.closeTime}
                                </p>
                            )
                        ) : (
                            <p className="text-sm text-gray-400 flex items-center gap-1"><Clock className="h-3 w-3" />Closed</p>
                        )}
                    </Card>
                ))}
            </div>
        </div>
    );
}
