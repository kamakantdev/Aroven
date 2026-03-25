'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { consultationsApi } from '@/lib/api';
import {
    ArrowLeft,
    Plus,
    Trash2,
    Send,
    Loader2,
    AlertCircle,
    CheckCircle,
    FileText,
    Pill,
} from 'lucide-react';

interface PrescriptionItem {
    medicineName: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string;
    quantity: number;
    beforeFood: boolean;
    isCritical: boolean;
}

const FREQUENCY_OPTIONS = [
    'Once daily',
    'Twice daily',
    'Three times daily',
    'Four times daily',
    'Every 6 hours',
    'Every 8 hours',
    'Every 12 hours',
    'As needed',
    'Before meals',
    'After meals',
    'At bedtime',
];

const DURATION_OPTIONS = [
    '3 days',
    '5 days',
    '7 days',
    '10 days',
    '14 days',
    '21 days',
    '1 month',
    '2 months',
    '3 months',
    'Until finished',
    'As directed',
];

const emptyItem: PrescriptionItem = {
    medicineName: '',
    dosage: '',
    frequency: 'Twice daily',
    duration: '7 days',
    instructions: '',
    quantity: 1,
    beforeFood: false,
    isCritical: false,
};

export default function NewPrescriptionPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const consultationId = searchParams.get('consultation') || '';

    const [items, setItems] = useState<PrescriptionItem[]>([{ ...emptyItem }]);
    const [diagnosis, setDiagnosis] = useState('');
    const [notes, setNotes] = useState('');
    const [followUpDate, setFollowUpDate] = useState('');
    const [dietaryAdvice, setDietaryAdvice] = useState('');
    const [lifestyleAdvice, setLifestyleAdvice] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [consultationData, setConsultationData] = useState<Record<string, unknown> | null>(null);

    useEffect(() => {
        if (consultationId) {
            consultationsApi.getDetails(consultationId).then((res) => {
                if (res.success && res.data) {
                    setConsultationData(res.data as Record<string, unknown>);
                }
            });
        }
    }, [consultationId]);

    const addItem = () => {
        setItems((prev) => [...prev, { ...emptyItem }]);
    };

    const removeItem = (index: number) => {
        if (items.length <= 1) return;
        setItems((prev) => prev.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: keyof PrescriptionItem, value: string | number | boolean) => {
        setItems((prev) =>
            prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
        );
    };

    const isValid = useCallback(() => {
        return (
            consultationId &&
            items.length > 0 &&
            items.every((item) => item.medicineName.trim() && item.dosage.trim() && item.frequency && item.duration)
        );
    }, [consultationId, items]);

    const handleSubmit = async () => {
        if (!isValid()) return;
        setIsSubmitting(true);
        setError(null);

        try {
            const response = await consultationsApi.addPrescription(consultationId, {
                items: items.map((item) => ({
                    medicineName: item.medicineName,
                    dosage: item.dosage,
                    frequency: item.frequency,
                    duration: item.duration,
                    instructions: item.instructions,
                    quantity: item.quantity,
                    beforeFood: item.beforeFood,
                    isCritical: item.isCritical,
                })),
                diagnosis: diagnosis || undefined,
                notes: notes || undefined,
                followUpDate: followUpDate || undefined,
                dietaryAdvice: dietaryAdvice || undefined,
                lifestyleAdvice: lifestyleAdvice || undefined,
            });

            if (response.success) {
                setSuccess(true);
                setTimeout(() => {
                    router.push('/doctor/prescriptions');
                }, 1500);
            } else {
                setError(response.error || 'Failed to create prescription');
            }
        } catch (err) {
            setError('Failed to create prescription. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Prescription Created!</h2>
                    <p className="text-gray-500 dark:text-gray-400">The patient has been notified.</p>
                </div>
            </div>
        );
    }

    const patient = consultationData?.patient as Record<string, unknown> | undefined;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Write Prescription</h1>
                    {patient && (
                        <p className="text-gray-500 dark:text-gray-400 mt-0.5">
                            Patient: <span className="font-medium text-gray-700 dark:text-gray-300">{patient.name as string}</span>
                        </p>
                    )}
                </div>
            </div>

            {!consultationId && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-800">
                        No consultation ID found. Please start this page from an active consultation.
                    </p>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{error}</p>
                </div>
            )}

            {/* Diagnosis & Notes */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-4">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-600" /> Diagnosis & Notes
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Diagnosis</label>
                        <input
                            type="text"
                            value={diagnosis}
                            onChange={(e) => setDiagnosis(e.target.value)}
                            placeholder="Enter diagnosis"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Follow-up Date</label>
                        <input
                            type="date"
                            value={followUpDate}
                            onChange={(e) => setFollowUpDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Additional notes for the patient..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dietary Advice</label>
                        <textarea
                            value={dietaryAdvice}
                            onChange={(e) => setDietaryAdvice(e.target.value)}
                            placeholder="Enter dietary advice"
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lifestyle Advice</label>
                        <textarea
                            value={lifestyleAdvice}
                            onChange={(e) => setLifestyleAdvice(e.target.value)}
                            placeholder="Enter lifestyle advice"
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                    </div>
                </div>
            </div>

            {/* Medicine Items */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Pill className="w-5 h-5 text-emerald-600" /> Medicines ({items.length})
                    </h2>
                    <button
                        onClick={addItem}
                        className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                        <Plus className="w-4 h-4" /> Add Medicine
                    </button>
                </div>

                {items.map((item, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3 relative">
                        {items.length > 1 && (
                            <button
                                onClick={() => removeItem(index)}
                                className="absolute top-3 right-3 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Medicine Name *</label>
                                <input
                                    type="text"
                                    value={item.medicineName}
                                    onChange={(e) => updateItem(index, 'medicineName', e.target.value)}
                                    placeholder="Enter medicine name"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Dosage *</label>
                                <input
                                    type="text"
                                    value={item.dosage}
                                    onChange={(e) => updateItem(index, 'dosage', e.target.value)}
                                    placeholder="Enter dosage"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Frequency *</label>
                                <select
                                    value={item.frequency}
                                    onChange={(e) => updateItem(index, 'frequency', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                >
                                    {FREQUENCY_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Duration *</label>
                                <select
                                    value={item.duration}
                                    onChange={(e) => updateItem(index, 'duration', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                >
                                    {DURATION_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Quantity</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={item.quantity}
                                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Instructions</label>
                                <input
                                    type="text"
                                    value={item.instructions}
                                    onChange={(e) => updateItem(index, 'instructions', e.target.value)}
                                    placeholder="Enter instructions"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-6 pt-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={item.beforeFood}
                                    onChange={(e) => updateItem(index, 'beforeFood', e.target.checked)}
                                    className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                />
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Take before food</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={item.isCritical}
                                    onChange={(e) => updateItem(index, 'isCritical', e.target.checked)}
                                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                />
                                <span className="text-xs font-medium text-red-600 dark:text-red-400">Critical medicine</span>
                            </label>
                        </div>
                    </div>
                ))}
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 pb-8">
                <button
                    onClick={() => router.back()}
                    className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 font-medium"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={!isValid() || isSubmitting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                    {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Send className="w-4 h-4" />
                    )}
                    {isSubmitting ? 'Creating...' : 'Send Prescription'}
                </button>
            </div>
        </div>
    );
}
