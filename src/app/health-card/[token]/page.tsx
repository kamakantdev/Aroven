'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams } from 'next/navigation';
import {
    User, Heart, FileText, Pill, Activity, AlertTriangle,
    Phone, Mail, MapPin, Calendar, Clock, Shield,
    Droplets, Thermometer, Wind, Loader2, ChevronDown, ChevronUp,
    Stethoscope, ClipboardList, Users, BadgeAlert
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

interface HealthRecord {
    patient: {
        name: string; age: number; dateOfBirth: string; gender: string;
        bloodGroup: string; weight: number; height: number; location: string;
        abhaNumber: string; profileImageUrl: string; phone: string; email: string;
        allergies: string[]; medicalConditions: string[]; chronicDiseases: string[];
        currentMedications: any[]; medicalHistory: any[];
        insuranceProvider: string; insuranceId: string;
    };
    prescriptions: any[];
    reports: any[];
    vitals: any[];
    consultations: any[];
    emergencyContacts: any[];
    familyMembers: any[];
    generatedAt: string;
}

function HealthCardContent() {
    const params = useParams();
    const token = params.token as string;
    const [record, setRecord] = useState<HealthRecord | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        profile: true, allergies: true, prescriptions: false, reports: false,
        vitals: false, consultations: false, emergency: false, family: false,
    });

    useEffect(() => {
        if (!token) return;
        const fetchRecord = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`${API_BASE_URL}/health-card/${token}`);
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load');
                setRecord(data.data);
            } catch (err: any) {
                setError(err.message || 'Health card not found or expired');
            }
            setIsLoading(false);
        };
        fetchRecord();
    }, [token]);

    const toggleSection = (key: string) => {
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
                <div className="text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-purple-600 mx-auto" />
                    <p className="mt-4 text-gray-600 text-lg">Loading Health Card...</p>
                </div>
            </div>
        );
    }

    if (error || !record) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="h-8 w-8 text-red-500" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Health Card Unavailable</h1>
                    <p className="text-gray-600">{error || 'This health card has expired or been revoked. Please ask the patient to generate a new QR code.'}</p>
                    <div className="mt-6 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500">Powered by <span className="font-semibold text-purple-600">Swastik Healthcare</span></p>
                    </div>
                </div>
            </div>
        );
    }

    const p = record.patient;
    const bmi = p.weight && p.height ? (p.weight / ((p.height / 100) ** 2)).toFixed(1) : null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
            {/* Header */}
            <header className="bg-gradient-to-r from-purple-700 to-indigo-700 text-white">
                <div className="max-w-4xl mx-auto px-4 py-6">
                    <div className="flex items-center gap-2 mb-1">
                        <Shield className="h-5 w-5 text-purple-200" />
                        <span className="text-purple-200 text-sm font-medium">Swastik Digital Health Card</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold">
                            {p.name?.charAt(0)?.toUpperCase() || 'P'}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">{p.name}</h1>
                            <div className="flex flex-wrap gap-3 mt-1 text-sm text-purple-100">
                                {p.age && <span>{p.age} yrs</span>}
                                {p.gender && <span>• {p.gender}</span>}
                                {p.bloodGroup && <span>• 🩸 {p.bloodGroup}</span>}
                                {p.abhaNumber && <span>• ABHA: {p.abhaNumber}</span>}
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-purple-200 mt-3">
                        Generated {new Date(record.generatedAt).toLocaleString('en-IN')} • Valid for 24 hours
                    </p>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">

                {/* Critical Alert: Allergies */}
                {p.allergies.length > 0 && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <BadgeAlert className="h-5 w-5 text-red-600" />
                            <h3 className="font-bold text-red-800">⚠️ ALLERGIES</h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {p.allergies.map((a: string, i: number) => (
                                <span key={i} className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">{a}</span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Patient Info */}
                <Section title="Patient Information" icon={<User className="h-5 w-5" />} sectionKey="profile"
                    expanded={expandedSections.profile} onToggle={toggleSection}>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <InfoItem icon={<Calendar />} label="Date of Birth" value={p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString('en-IN') : 'N/A'} />
                        <InfoItem icon={<User />} label="Gender" value={p.gender || 'N/A'} />
                        <InfoItem icon={<Droplets />} label="Blood Group" value={p.bloodGroup || 'N/A'} />
                        <InfoItem icon={<Activity />} label="Weight" value={p.weight ? `${p.weight} kg` : 'N/A'} />
                        <InfoItem icon={<Activity />} label="Height" value={p.height ? `${p.height} cm` : 'N/A'} />
                        {bmi && <InfoItem icon={<Heart />} label="BMI" value={bmi} />}
                        <InfoItem icon={<Phone />} label="Phone" value={p.phone || 'N/A'} />
                        <InfoItem icon={<Mail />} label="Email" value={p.email || 'N/A'} />
                        <InfoItem icon={<MapPin />} label="Location" value={p.location || 'N/A'} />
                        {p.insuranceProvider && <InfoItem icon={<Shield />} label="Insurance" value={`${p.insuranceProvider} (${p.insuranceId})`} />}
                    </div>
                    {p.medicalConditions.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                            <p className="text-sm font-medium text-gray-700 mb-1">Medical Conditions</p>
                            <div className="flex flex-wrap gap-2">
                                {p.medicalConditions.map((c: string, i: number) => (
                                    <span key={i} className="px-2 py-1 bg-orange-50 text-orange-700 rounded-lg text-xs">{c}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {p.chronicDiseases.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                            <p className="text-sm font-medium text-gray-700 mb-1">Chronic Diseases</p>
                            <div className="flex flex-wrap gap-2">
                                {p.chronicDiseases.map((d: string, i: number) => (
                                    <span key={i} className="px-2 py-1 bg-red-50 text-red-700 rounded-lg text-xs">{d}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {p.currentMedications.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                            <p className="text-sm font-medium text-gray-700 mb-1">Current Medications</p>
                            <div className="flex flex-wrap gap-2">
                                {p.currentMedications.map((m: any, i: number) => (
                                    <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs">
                                        {typeof m === 'string' ? m : m.name || JSON.stringify(m)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </Section>

                {/* Prescriptions */}
                <Section title={`Prescriptions (${record.prescriptions.length})`} icon={<Pill className="h-5 w-5" />}
                    sectionKey="prescriptions" expanded={expandedSections.prescriptions} onToggle={toggleSection}>
                    {record.prescriptions.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-4">No prescriptions found</p>
                    ) : (
                        <div className="space-y-3">
                            {record.prescriptions.map((rx: any) => (
                                <div key={rx.id} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium text-sm">{rx.prescriptionNumber}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                                            rx.status === 'active' ? 'bg-green-100 text-green-700' :
                                            rx.status === 'fulfilled' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                                        }`}>{rx.status}</span>
                                    </div>
                                    <p className="text-sm text-gray-800">{rx.diagnosis}</p>
                                    {rx.doctor && <p className="text-xs text-gray-500 mt-1">Dr. {rx.doctor.name} • {rx.doctor.specialization}</p>}
                                    {rx.medications && Array.isArray(rx.medications) && (
                                        <div className="mt-2 space-y-1">
                                            {rx.medications.map((med: any, i: number) => (
                                                <div key={i} className="text-xs bg-purple-50 rounded p-2">
                                                    <span className="font-medium text-purple-800">{med.name || med.medicine_name}</span>
                                                    {(med.dosage || med.frequency) && (
                                                        <span className="text-purple-600"> — {med.dosage} {med.frequency} for {med.duration}</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-xs text-gray-400 mt-1">{new Date(rx.createdAt).toLocaleDateString('en-IN')}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </Section>

                {/* Reports */}
                <Section title={`Medical Reports (${record.reports.length})`} icon={<FileText className="h-5 w-5" />}
                    sectionKey="reports" expanded={expandedSections.reports} onToggle={toggleSection}>
                    {record.reports.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-4">No reports found</p>
                    ) : (
                        <div className="space-y-3">
                            {record.reports.map((r: any) => (
                                <div key={r.id} className="border rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium text-sm">{r.title}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                                            r.resultStatus === 'normal' ? 'bg-green-100 text-green-700' :
                                            r.resultStatus === 'abnormal' ? 'bg-orange-100 text-orange-700' :
                                            r.resultStatus === 'critical' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                                        }`}>{r.resultStatus || 'pending'}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                                        <span>{r.type?.replace('_', ' ')}</span>
                                        {r.labName && <span>• {r.labName}</span>}
                                        {r.testDate && <span>• {new Date(r.testDate).toLocaleDateString('en-IN')}</span>}
                                    </div>
                                    {r.summary && <p className="text-sm text-gray-700 mt-2">{r.summary}</p>}
                                    {r.parameters && Array.isArray(r.parameters) && r.parameters.length > 0 && (
                                        <div className="mt-2 grid grid-cols-2 gap-1">
                                            {r.parameters.slice(0, 6).map((param: any, i: number) => (
                                                <div key={i} className="text-xs bg-gray-50 rounded p-1.5">
                                                    <span className="text-gray-500">{param.name}: </span>
                                                    <span className="font-medium">{param.value} {param.unit}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </Section>

                {/* Vitals */}
                <Section title={`Vitals History (${record.vitals.length})`} icon={<Activity className="h-5 w-5" />}
                    sectionKey="vitals" expanded={expandedSections.vitals} onToggle={toggleSection}>
                    {record.vitals.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-4">No vitals recorded</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-600">
                                        <th className="px-2 py-2 text-left">Date</th>
                                        <th className="px-2 py-2">BP</th>
                                        <th className="px-2 py-2">HR</th>
                                        <th className="px-2 py-2">SpO₂</th>
                                        <th className="px-2 py-2">Temp</th>
                                        <th className="px-2 py-2">Sugar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {record.vitals.slice(0, 10).map((v: any, i: number) => (
                                        <tr key={i} className="border-b last:border-0">
                                            <td className="px-2 py-2 text-gray-600">{v.recordedAt ? new Date(v.recordedAt).toLocaleDateString('en-IN') : '-'}</td>
                                            <td className="px-2 py-2 text-center font-medium">{v.bpSystolic && v.bpDiastolic ? `${v.bpSystolic}/${v.bpDiastolic}` : '-'}</td>
                                            <td className="px-2 py-2 text-center">{v.heartRate || '-'}</td>
                                            <td className="px-2 py-2 text-center">{v.oxygenLevel ? `${v.oxygenLevel}%` : '-'}</td>
                                            <td className="px-2 py-2 text-center">{v.temperature ? `${v.temperature}°` : '-'}</td>
                                            <td className="px-2 py-2 text-center">{v.bloodSugar || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Section>

                {/* Consultations */}
                <Section title={`Consultation History (${record.consultations.length})`} icon={<Stethoscope className="h-5 w-5" />}
                    sectionKey="consultations" expanded={expandedSections.consultations} onToggle={toggleSection}>
                    {record.consultations.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-4">No consultations found</p>
                    ) : (
                        <div className="space-y-3">
                            {record.consultations.map((c: any) => (
                                <div key={c.id} className="border rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium text-sm">{c.chiefComplaint || 'General Consultation'}</span>
                                        <span className="text-xs text-gray-400">{c.date ? new Date(c.date).toLocaleDateString('en-IN') : ''}</span>
                                    </div>
                                    {c.doctor && <p className="text-xs text-purple-600">Dr. {c.doctor.name} • {c.doctor.specialization}</p>}
                                    {c.diagnosis && (
                                        <div className="mt-2">
                                            <p className="text-xs text-gray-500">Diagnosis</p>
                                            <p className="text-sm">{Array.isArray(c.diagnosis) ? c.diagnosis.join(', ') : c.diagnosis}</p>
                                        </div>
                                    )}
                                    {c.findings && <p className="text-xs text-gray-600 mt-1"><span className="font-medium">Findings:</span> {c.findings}</p>}
                                    {c.advice && <p className="text-xs text-gray-600 mt-1"><span className="font-medium">Advice:</span> {c.advice}</p>}
                                    {c.followUpRequired && c.followUpDate && (
                                        <p className="text-xs text-blue-600 mt-1">📅 Follow-up: {new Date(c.followUpDate).toLocaleDateString('en-IN')}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </Section>

                {/* Emergency Contacts */}
                <Section title={`Emergency Contacts (${record.emergencyContacts.length})`} icon={<Phone className="h-5 w-5" />}
                    sectionKey="emergency" expanded={expandedSections.emergency} onToggle={toggleSection}>
                    {record.emergencyContacts.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-4">No emergency contacts</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {record.emergencyContacts.map((ec: any) => (
                                <div key={ec.id} className="flex items-center gap-3 border rounded-lg p-3">
                                    <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
                                        <Phone className="h-4 w-4 text-red-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">{ec.name}</p>
                                        <p className="text-xs text-gray-500">{ec.relationship} • {ec.phone}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Section>

                {/* Family Members */}
                {record.familyMembers.length > 0 && (
                    <Section title={`Family Members (${record.familyMembers.length})`} icon={<Users className="h-5 w-5" />}
                        sectionKey="family" expanded={expandedSections.family} onToggle={toggleSection}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {record.familyMembers.map((fm: any) => (
                                <div key={fm.id} className="flex items-center gap-3 border rounded-lg p-3">
                                    <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center">
                                        <User className="h-4 w-4 text-purple-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">{fm.name}</p>
                                        <p className="text-xs text-gray-500">{fm.relationship} {fm.blood_group ? `• ${fm.blood_group}` : ''}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {/* Footer */}
                <div className="text-center py-6">
                    <p className="text-xs text-gray-400">
                        This health card was generated by the patient using <span className="font-semibold text-purple-500">Swastik Healthcare</span>.
                        <br />Data is read-only and automatically expires in 24 hours.
                    </p>
                </div>
            </main>
        </div>
    );
}

// Collapsible section component
function Section({ title, icon, sectionKey, expanded, onToggle, children }: {
    title: string; icon: React.ReactNode; sectionKey: string;
    expanded: boolean; onToggle: (key: string) => void; children: React.ReactNode;
}) {
    return (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <button onClick={() => onToggle(sectionKey)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2 text-gray-800">
                    <span className="text-purple-600">{icon}</span>
                    <h2 className="font-semibold text-sm">{title}</h2>
                </div>
                {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </button>
            {expanded && <div className="px-4 pb-4">{children}</div>}
        </div>
    );
}

// Small info display component
function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-gray-400 h-4 w-4">{icon}</span>
            <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
                <p className="text-sm font-medium text-gray-800">{value}</p>
            </div>
        </div>
    );
}

// Page wrapper with Suspense
export default function HealthCardPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
                <Loader2 className="h-10 w-10 animate-spin text-purple-600" />
            </div>
        }>
            <HealthCardContent />
        </Suspense>
    );
}
