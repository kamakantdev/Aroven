'use client';

import { useEffect, useState } from 'react';
import { Clock, Plus, Loader2, RefreshCw, Trash2, AlertCircle, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useDoctorStore, TimeSlot } from '@/stores/doctorStore';
import { ConfirmDialog, useConfirmDialog } from '@/components/shared/ConfirmDialog';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function DoctorSchedulePage() {
    const { schedule, isLoading, error, fetchSchedule, updateSchedule, clearError } = useDoctorStore();
    const [showAddModal, setShowAddModal] = useState(false);
    const [newSlot, setNewSlot] = useState({ day: 'Monday', startTime: '09:00', endTime: '17:00' });
    const [saving, setSaving] = useState(false);
    const { dialogProps, confirm: confirmAction } = useConfirmDialog();

    useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

    const handleAddSlot = async () => {
        setSaving(true);
        const updatedSlots = [...schedule, { ...newSlot, isAvailable: true }];
        const success = await updateSchedule(updatedSlots as unknown as Record<string, unknown>[]);
        if (success) {
            setShowAddModal(false);
            setNewSlot({ day: 'Monday', startTime: '09:00', endTime: '17:00' });
        }
        setSaving(false);
    };

    const handleRemoveSlot = async (index: number) => {
        const confirmed = await confirmAction({ title: 'Remove Slot', message: 'Remove this time slot?', confirmLabel: 'Remove', variant: 'warning' });
        if (!confirmed) return;
        setSaving(true);
        const updatedSlots = schedule.filter((_, i) => i !== index);
        await updateSchedule(updatedSlots as unknown as Record<string, unknown>[]);
        setSaving(false);
    };

    const handleToggleSlot = async (index: number) => {
        setSaving(true);
        const updatedSlots = schedule.map((slot, i) =>
            i === index ? { ...slot, isAvailable: !slot.isAvailable } : slot
        );
        await updateSchedule(updatedSlots as unknown as Record<string, unknown>[]);
        setSaving(false);
    };

    if (isLoading && schedule.length === 0) {
        return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /><span className="ml-2 text-gray-600 dark:text-gray-400">Loading schedule...</span></div>;
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <AlertCircle className="h-12 w-12 text-red-400" />
                <p className="text-red-600">{error}</p>
                <Button onClick={() => { clearError(); fetchSchedule(); }} leftIcon={<RefreshCw className="h-4 w-4" />}>Retry</Button>
            </div>
        );
    }

    const scheduleByDay = DAYS.map(day => ({
        day,
        slots: schedule.map((s, i) => ({ ...s, _idx: i })).filter(s => s.day === day),
    }));

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Schedule</h1><p className="text-gray-600 dark:text-gray-400 mt-1">Manage your availability slots</p></div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchSchedule} leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
                    <Button onClick={() => setShowAddModal(true)} leftIcon={<Plus className="h-4 w-4" />}>Add Slot</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {scheduleByDay.map(({ day, slots }) => (
                    <Card key={day} padding="md">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">{day}</h3>
                        {slots.length === 0 ? (
                            <p className="text-sm text-gray-400">No slots configured</p>
                        ) : (
                            <div className="space-y-2">
                                {slots.map((slot) => (
                                    <div key={slot._idx} className={`flex items-center justify-between gap-2 text-sm px-3 py-2 rounded-lg ${slot.isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                                        <button onClick={() => handleToggleSlot(slot._idx)} className="flex items-center gap-2 flex-1 text-left" disabled={saving}>
                                            <Clock className="h-3 w-3" />
                                            <span>{slot.startTime} – {slot.endTime}</span>
                                            {!slot.isAvailable && <span className="text-xs opacity-60">(off)</span>}
                                        </button>
                                        <button onClick={() => handleRemoveSlot(slot._idx)} className="p-1 hover:bg-red-100 rounded text-red-500 hover:text-red-700" disabled={saving}>
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                ))}
            </div>

            {/* Add Slot Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Add Time Slot</h3>
                            <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Day</label>
                                <select value={newSlot.day} onChange={e => setNewSlot(s => ({ ...s, day: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-200">
                                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Time</label>
                                    <input type="time" value={newSlot.startTime} onChange={e => setNewSlot(s => ({ ...s, startTime: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-200" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Time</label>
                                    <input type="time" value={newSlot.endTime} onChange={e => setNewSlot(s => ({ ...s, endTime: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-200" />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t">
                            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
                            <Button onClick={handleAddSlot} isLoading={saving}>Add Slot</Button>
                        </div>
                    </div>
                </div>
            )}
            <ConfirmDialog {...dialogProps} />
        </div>
    );
}
