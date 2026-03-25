'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    Activity, Heart, Thermometer, Droplets, Loader2, Search,
    User, Plus, X, Wind, Scale, Droplet,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useDoctorStore } from '@/stores/doctorStore';
import { doctorApi } from '@/lib/api';
import { useVitalsUpdates } from '@/hooks/useSocket';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';

interface VitalRecord {
    id: string;
    patientId: string;
    patientName: string;
    patientGender?: string;
    heartRate?: number;
    bloodPressure?: string;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    temperature?: number;
    oxygenLevel?: number;
    respiratoryRate?: number;
    weight?: number;
    bloodSugar?: number;
    notes?: string;
    recordedAt: string;
}

interface VitalForm {
    patientId: string;
    heartRate: string;
    bloodPressureSystolic: string;
    bloodPressureDiastolic: string;
    temperature: string;
    oxygenLevel: string;
    respiratoryRate: string;
    weight: string;
    bloodSugar: string;
    notes: string;
}

const emptyForm: VitalForm = {
    patientId: '',
    heartRate: '',
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    temperature: '',
    oxygenLevel: '',
    respiratoryRate: '',
    weight: '',
    bloodSugar: '',
    notes: '',
};

function VitalBadge({ icon: Icon, label, value, unit, color, bg }: {
    icon: React.ElementType; label: string; value?: number | string | null;
    unit: string; color: string; bg: string;
}) {
    if (value == null) return null;
    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${bg}`}>
            <Icon className={`h-4 w-4 ${color} shrink-0`} />
            <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
                <p className={`text-sm font-semibold ${color}`}>{value} {unit}</p>
            </div>
        </div>
    );
}

export default function DoctorVitalsPage() {
    const { vitals, loadingVitals, fetchVitals, recordVitals, patients, fetchPatients } = useDoctorStore();
    const toast = useToast();
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<VitalForm>(emptyForm);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [patientList, setPatientList] = useState<{ id: string; name: string }[]>([]);
    const [newVitalAlert, setNewVitalAlert] = useState(false);

    // Real-time Socket.IO — auto-refresh when patient records a vital from Android
    useVitalsUpdates(
        useCallback(() => {
            setNewVitalAlert(true);
            fetchVitals();
            setTimeout(() => setNewVitalAlert(false), 5000);
         
        }, [fetchVitals])
    );

    const loadPatientList = useCallback(async () => {
        try {
            const result = await doctorApi.getPatients(1);
            if (result.success) {
                const list = (result.data as any)?.data || [];
                setPatientList(list.map((p: any) => ({ id: p.id, name: p.name || p.patientName })));
            }
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        fetchVitals();
        loadPatientList();
    }, [fetchVitals, loadPatientList]);

    const handleSave = async () => {
        if (!form.patientId) {
            setError('Please select a patient');
            return;
        }
        setIsSaving(true);
        setError('');
        try {
            const payload: Record<string, unknown> = {};
            if (form.heartRate) payload.heartRate = parseInt(form.heartRate);
            if (form.bloodPressureSystolic) payload.bloodPressureSystolic = parseInt(form.bloodPressureSystolic);
            if (form.bloodPressureDiastolic) payload.bloodPressureDiastolic = parseInt(form.bloodPressureDiastolic);
            if (form.temperature) payload.temperature = parseFloat(form.temperature);
            if (form.oxygenLevel) payload.oxygenLevel = parseFloat(form.oxygenLevel);
            if (form.respiratoryRate) payload.respiratoryRate = parseInt(form.respiratoryRate);
            if (form.weight) payload.weight = parseFloat(form.weight);
            if (form.bloodSugar) payload.bloodSugar = parseFloat(form.bloodSugar);
            if (form.notes) payload.notes = form.notes;

            if (Object.keys(payload).length === 0) {
                setError('Please enter at least one vital sign');
                setIsSaving(false);
                return;
            }

            const result = await recordVitals(form.patientId, payload);
            if (result) {
                setForm(emptyForm);
                setShowForm(false);
            } else {
                setError('Failed to save vitals');
            }
        } catch {
            setError('Failed to save vitals');
        } finally {
            setIsSaving(false);
        }
    };

    const filtered = vitals.filter((v: any) =>
        (v.patientName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    const { totalPages, totalItems, itemsPerPage, paginate } = usePagination(filtered, 10);
    const paginatedItems = paginate(page);

    // Summary stats
    const uniquePatients = new Set(vitals.map((v: any) => v.patientId)).size;
    const todayCount = vitals.filter((v: any) => {
        const d = new Date(v.recordedAt || v.created_at);
        const now = new Date();
        return d.toDateString() === now.toDateString();
    }).length;

    if (loadingVitals) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                <span className="ml-2 text-gray-600 dark:text-gray-400">Loading vitals...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Patient Vitals</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Record and monitor patient vital signs</p>
                </div>
                <Button onClick={() => setShowForm(!showForm)} variant={showForm ? 'outline' : 'primary'}>
                    {showForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    {showForm ? 'Cancel' : 'Record Vitals'}
                </Button>
            </div>

            {/* Real-time New Vital Alert */}
            {newVitalAlert && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg flex items-center gap-3 animate-pulse">
                    <Activity className="h-5 w-5 text-emerald-600" />
                    <span className="font-medium">🔔 New vital signs recorded by a patient!</span>
                    <button onClick={() => setNewVitalAlert(false)} className="ml-auto text-emerald-800 underline text-sm">Dismiss</button>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card padding="md">
                    <div className="p-3 bg-red-50 rounded-lg w-fit mb-2">
                        <Heart className="h-6 w-6 text-red-500" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{vitals.length}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Records</p>
                </Card>
                <Card padding="md">
                    <div className="p-3 bg-blue-50 rounded-lg w-fit mb-2">
                        <User className="h-6 w-6 text-blue-500" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{uniquePatients}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Patients Tracked</p>
                </Card>
                <Card padding="md">
                    <div className="p-3 bg-emerald-50 rounded-lg w-fit mb-2">
                        <Activity className="h-6 w-6 text-emerald-500" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{todayCount}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Recorded Today</p>
                </Card>
                <Card padding="md">
                    <div className="p-3 bg-orange-50 rounded-lg w-fit mb-2">
                        <Thermometer className="h-6 w-6 text-orange-500" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{patients.length}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Your Patients</p>
                </Card>
            </div>

            {/* Record Vitals Form */}
            {showForm && (
                <Card padding="lg">
                    <CardHeader>
                        <CardTitle>Record Patient Vitals</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                {error}
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="md:col-span-2 lg:col-span-3">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Patient *</label>
                                <select
                                    value={form.patientId}
                                    onChange={e => setForm({ ...form, patientId: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                >
                                    <option value="">Select patient...</option>
                                    {patientList.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">❤️ Heart Rate (bpm)</label>
                                <Input type="number" placeholder="72" value={form.heartRate}
                                    onChange={e => setForm({ ...form, heartRate: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">🩸 BP Systolic (mmHg)</label>
                                <Input type="number" placeholder="120" value={form.bloodPressureSystolic}
                                    onChange={e => setForm({ ...form, bloodPressureSystolic: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">🩸 BP Diastolic (mmHg)</label>
                                <Input type="number" placeholder="80" value={form.bloodPressureDiastolic}
                                    onChange={e => setForm({ ...form, bloodPressureDiastolic: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">🌡️ Temperature (°F)</label>
                                <Input type="number" step="0.1" placeholder="98.6" value={form.temperature}
                                    onChange={e => setForm({ ...form, temperature: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">💧 SpO₂ (%)</label>
                                <Input type="number" step="0.1" placeholder="98" value={form.oxygenLevel}
                                    onChange={e => setForm({ ...form, oxygenLevel: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">🌬️ Respiratory Rate (/min)</label>
                                <Input type="number" placeholder="16" value={form.respiratoryRate}
                                    onChange={e => setForm({ ...form, respiratoryRate: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">⚖️ Weight (kg)</label>
                                <Input type="number" step="0.1" placeholder="70" value={form.weight}
                                    onChange={e => setForm({ ...form, weight: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">🩸 Blood Sugar (mg/dL)</label>
                                <Input type="number" step="0.1" placeholder="100" value={form.bloodSugar}
                                    onChange={e => setForm({ ...form, bloodSugar: e.target.value })} />
                            </div>
                            <div className="md:col-span-2 lg:col-span-3">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                                <textarea
                                    rows={2}
                                    placeholder="Additional notes..."
                                    value={form.notes}
                                    onChange={e => setForm({ ...form, notes: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <Button variant="outline" onClick={() => { setShowForm(false); setForm(emptyForm); setError(''); }}>
                                Cancel
                            </Button>
                            <Button onClick={handleSave} isLoading={isSaving}>
                                Save Vitals
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Search */}
            <Card padding="sm">
                <Input
                    placeholder="Search patients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    leftIcon={<Search className="h-5 w-5" />}
                />
            </Card>

            {/* Records */}
            {paginatedItems.length === 0 ? (
                <Card padding="lg">
                    <div className="text-center py-12">
                        <Activity className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Vitals Recorded</h3>
                        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                            Click &quot;Record Vitals&quot; to start tracking patient vital signs.
                        </p>
                    </div>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {paginatedItems.map((record) => (
                        <Card key={record.id} padding="md">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-emerald-100 rounded-full">
                                    <User className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{record.patientName}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {record.recordedAt ? new Date(record.recordedAt).toLocaleDateString('en-IN', {
                                            day: 'numeric', month: 'short', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit',
                                        }) : '—'}
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <VitalBadge icon={Heart} label="Heart Rate" value={record.heartRate} unit="bpm" color="text-red-600" bg="bg-red-50" />
                                <VitalBadge icon={Activity} label="Blood Pressure" value={record.bloodPressure} unit="mmHg" color="text-blue-600" bg="bg-blue-50" />
                                <VitalBadge icon={Thermometer} label="Temperature" value={record.temperature} unit="°F" color="text-orange-600" bg="bg-orange-50" />
                                <VitalBadge icon={Droplets} label="SpO₂" value={record.oxygenLevel} unit="%" color="text-cyan-600" bg="bg-cyan-50" />
                                <VitalBadge icon={Wind} label="Resp. Rate" value={record.respiratoryRate} unit="/min" color="text-purple-600" bg="bg-purple-50" />
                                <VitalBadge icon={Scale} label="Weight" value={record.weight} unit="kg" color="text-emerald-600" bg="bg-emerald-50" />
                                <VitalBadge icon={Droplet} label="Blood Sugar" value={record.bloodSugar} unit="mg/dL" color="text-pink-600" bg="bg-pink-50" />
                            </div>
                            {record.notes && (
                                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded-lg">{record.notes}</p>
                            )}
                        </Card>
                    ))}
                </div>
            )}
            <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
            />
        </div>
    );
}
