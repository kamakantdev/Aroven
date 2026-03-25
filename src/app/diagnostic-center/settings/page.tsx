'use client';

import { useEffect, useState } from 'react';
import { Save, Loader2, Lock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import { ProfileImageUpload } from '@/components/shared/ProfileImageUpload';
import LocationPicker from '@/components/shared/LocationPickerDynamic';
import { diagnosticCenterApi, authApi } from '@/lib/api';

export default function DiagnosticCenterSettingsPage() {
    const user = useAuthStore((s) => s.user);
    const [isLoading, setIsLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const [form, setForm] = useState({
        name: '', phone: '', email: '', address: '', city: '', state: '', pincode: '',
        license_number: '', nabl_accreditation: '',
        sample_collection_available: true, home_collection_available: false,
        home_collection_fee: '', is_24_hours: false,
        profileImage: '' as string | null,
        latitude: null as number | null, longitude: null as number | null,
    });
    const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [pwSaving, setPwSaving] = useState(false);

    const loadProfile = async () => {
        setIsLoading(true);
        try {
            const res = await diagnosticCenterApi.getProfile();
            if (res.success && res.data) {
                const raw = res.data as any;
                const d = raw.data || raw;
                setForm({
                    name: d.name || user?.name || '',
                    phone: d.phone || '',
                    email: d.email || user?.email || '',
                    address: d.address || '',
                    city: d.city || '',
                    state: d.state || '',
                    pincode: d.pincode || '',
                    license_number: d.license_number || '',
                    nabl_accreditation: d.nabl_accreditation || '',
                    sample_collection_available: d.sample_collection_available ?? true,
                    home_collection_available: d.home_collection_available ?? false,
                    home_collection_fee: d.home_collection_fee?.toString() || '',
                    is_24_hours: d.is_24_hours ?? false,
                    profileImage: d.image_url || d.profile_image || null,
                    latitude: d.latitude ?? null,
                    longitude: d.longitude ?? null,
                });
            } else {
                setForm(f => ({ ...f, name: user?.name || '', email: user?.email || '' }));
            }
        } catch {
            setForm(f => ({ ...f, name: user?.name || '', email: user?.email || '' }));
        }
        setIsLoading(false);
    };

    useEffect(() => { loadProfile(); }, []);

    const handleSave = async () => {
        setSaving(true);
        setStatus(null);
        if (!form.phone.trim()) {
            setStatus({ type: 'error', message: 'Phone is required for approval and patient contact.' });
            setSaving(false);
            return;
        }
        if (form.latitude == null || form.longitude == null) {
            setStatus({ type: 'error', message: 'Location is required so patients can find your center on map.' });
            setSaving(false);
            return;
        }
        try {
            const res = await diagnosticCenterApi.updateProfile({
                name: form.name, phone: form.phone, address: form.address,
                city: form.city, state: form.state, pincode: form.pincode,
                license_number: form.license_number, nabl_accreditation: form.nabl_accreditation,
                sample_collection_available: form.sample_collection_available,
                home_collection_available: form.home_collection_available,
                home_collection_fee: form.home_collection_fee ? parseFloat(form.home_collection_fee) : 0,
                is_24_hours: form.is_24_hours,
                profile_image: form.profileImage || undefined,
                ...(form.latitude != null && form.longitude != null ? { latitude: form.latitude, longitude: form.longitude } : {}),
            });
            if (res.success) setStatus({ type: 'success', message: 'Settings saved successfully.' });
            else setStatus({ type: 'error', message: res.error || 'Failed to save settings.' });
        } catch { setStatus({ type: 'error', message: 'Network error.' }); }
        setSaving(false);
        setTimeout(() => setStatus(null), 4000);
    };

    const handlePasswordChange = async () => {
        if (pwForm.newPassword !== pwForm.confirmPassword) { setStatus({ type: 'error', message: 'Passwords do not match.' }); return; }
        if (pwForm.newPassword.length < 6) { setStatus({ type: 'error', message: 'Password must be at least 6 characters.' }); return; }
        setPwSaving(true);
        setStatus(null);
        try {
            const res = await authApi.changePassword(pwForm.currentPassword, pwForm.newPassword);
            if (res.success) {
                setStatus({ type: 'success', message: 'Password changed successfully.' });
                setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            } else setStatus({ type: 'error', message: res.error || 'Failed to change password.' });
        } catch { setStatus({ type: 'error', message: 'Network error.' }); }
        setPwSaving(false);
        setTimeout(() => setStatus(null), 4000);
    };

    if (isLoading) return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-purple-600" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Diagnostic center configuration</p>
                </div>
                <Button onClick={handleSave} isLoading={saving} leftIcon={<Save className="h-4 w-4" />}>Save Changes</Button>
            </div>

            {status && (
                <div className={`px-4 py-3 rounded-lg text-sm border ${status.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {status.message}
                </div>
            )}

            {/* Basic Info */}
            <Card>
                <CardHeader><CardTitle>Center Information</CardTitle></CardHeader>
                <CardContent>
                    <ProfileImageUpload
                        currentImage={form.profileImage}
                        name={form.name}
                        onUploadComplete={(url) => setForm(f => ({ ...f, profileImage: url }))}
                        accentColor="purple"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <Input label="Center Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                        <Input label="Email" value={form.email} readOnly className="bg-gray-50 dark:bg-gray-800" />
                        <Input label="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 XXXXX XXXXX" />
                        <Input label="Address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Center address" />
                        <Input label="City" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                        <Input label="State" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
                        <Input label="Pincode" value={form.pincode} onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))} />
                    </div>
                    <div className="mt-4">
                        <LocationPicker
                            latitude={form.latitude}
                            longitude={form.longitude}
                            address={[form.address, form.city, form.state, form.pincode].filter(Boolean).join(', ')}
                            onLocationChange={(lat, lng) => {
                                if (lat === 0 && lng === 0) {
                                    setForm(f => ({ ...f, latitude: null, longitude: null }));
                                } else {
                                    setForm(f => ({ ...f, latitude: lat, longitude: lng }));
                                }
                            }}
                            accentColor="purple"
                            label="Center Location"
                            height="250px"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Licensing */}
            <Card>
                <CardHeader><CardTitle>Licensing & Accreditation</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="License Number" value={form.license_number} onChange={e => setForm(f => ({ ...f, license_number: e.target.value }))} placeholder="License number" />
                        <Input label="NABL Accreditation" value={form.nabl_accreditation} onChange={e => setForm(f => ({ ...f, nabl_accreditation: e.target.value }))} placeholder="NABL-TC-XXXX (optional)" />
                    </div>
                </CardContent>
            </Card>

            {/* Services */}
            <Card>
                <CardHeader><CardTitle>Services & Hours</CardTitle></CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-6">
                            <label className="flex items-center gap-2">
                                <input type="checkbox" checked={form.sample_collection_available}
                                    onChange={e => setForm(f => ({ ...f, sample_collection_available: e.target.checked }))}
                                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Sample Collection Available</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input type="checkbox" checked={form.home_collection_available}
                                    onChange={e => setForm(f => ({ ...f, home_collection_available: e.target.checked }))}
                                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Home Collection Available</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input type="checkbox" checked={form.is_24_hours}
                                    onChange={e => setForm(f => ({ ...f, is_24_hours: e.target.checked }))}
                                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Open 24 Hours</span>
                            </label>
                        </div>
                        {form.home_collection_available && (
                            <Input label="Home Collection Fee (₹)" type="number" value={form.home_collection_fee}
                                onChange={e => setForm(f => ({ ...f, home_collection_fee: e.target.value }))} placeholder="0" />
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Change Password */}
            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Lock className="h-4 w-4" />Change Password</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input label="Current Password" type="password" value={pwForm.currentPassword} onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} />
                        <Input label="New Password" type="password" value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} />
                        <Input label="Confirm Password" type="password" value={pwForm.confirmPassword} onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))} />
                    </div>
                    <div className="mt-4">
                        <Button variant="outline" onClick={handlePasswordChange} isLoading={pwSaving} disabled={!pwForm.currentPassword || !pwForm.newPassword}>Change Password</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
