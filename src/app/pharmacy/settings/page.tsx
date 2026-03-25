'use client';

import { useEffect, useState } from 'react';
import { Save, Loader2, Lock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import { ProfileImageUpload } from '@/components/shared/ProfileImageUpload';
import LocationPicker from '@/components/shared/LocationPickerDynamic';
import { pharmacyApi, authApi } from '@/lib/api';

export default function PharmacySettingsPage() {
    const user = useAuthStore((s) => s.user);
    const [isLoading, setIsLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const [form, setForm] = useState({ name: '', phone: '', address: '', email: '', licenseNumber: '', profileImage: '' as string | null, latitude: null as number | null, longitude: null as number | null });
    const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [pwSaving, setPwSaving] = useState(false);

    const loadProfile = async () => {
        setIsLoading(true);
        try {
            const res = await pharmacyApi.getProfile();
            if (res.success && res.data) {
                const raw = res.data as any;
                const d = raw.data || raw;
                setForm({ name: d.name || user?.name || '', phone: d.phone || '', address: d.address || '', email: d.email || user?.email || '', licenseNumber: d.licenseNumber || d.license_number || '', profileImage: d.profile_image || d.profileImage || d.avatar_url || null, latitude: d.latitude ?? null, longitude: d.longitude ?? null });
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
            setStatus({ type: 'error', message: 'Location is required so patients can find your pharmacy on map.' });
            setSaving(false);
            return;
        }
        try {
            const res = await pharmacyApi.updateProfile({ name: form.name, phone: form.phone, address: form.address, licenseNumber: form.licenseNumber, ...(form.latitude != null && form.longitude != null ? { latitude: form.latitude, longitude: form.longitude } : {}) });
            if (res.success) setStatus({ type: 'success', message: 'Settings saved successfully.' });
            else setStatus({ type: 'error', message: res.error || 'Failed to save.' });
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

    if (isLoading) return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-orange-600" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1><p className="text-gray-600 dark:text-gray-400 mt-1">Pharmacy configuration</p></div>
                <Button onClick={handleSave} isLoading={saving} leftIcon={<Save className="h-4 w-4" />}>Save Changes</Button>
            </div>

            {status && (
                <div className={`px-4 py-3 rounded-lg text-sm border ${status.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {status.message}
                </div>
            )}

            <Card>
                <CardHeader><CardTitle>Pharmacy Information</CardTitle></CardHeader>
                <CardContent>
                    <ProfileImageUpload
                        currentImage={form.profileImage}
                        name={form.name}
                        onUploadComplete={(url) => setForm(f => ({ ...f, profileImage: url }))}
                        accentColor="orange"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <Input label="Pharmacy Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                        <Input label="Email" value={form.email} readOnly className="bg-gray-50 dark:bg-gray-800" />
                        <Input label="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 XXXXX XXXXX" />
                        <Input label="License Number" value={form.licenseNumber} onChange={e => setForm(f => ({ ...f, licenseNumber: e.target.value }))} placeholder="DL-XXXX-XXXX" />
                        <div className="md:col-span-2"><Input label="Address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Pharmacy address" /></div>
                        <div className="md:col-span-2">
                            <LocationPicker
                                latitude={form.latitude}
                                longitude={form.longitude}
                                address={form.address}
                                onLocationChange={(lat, lng) => {
                                    if (lat === 0 && lng === 0) {
                                        setForm(f => ({ ...f, latitude: null, longitude: null }));
                                    } else {
                                        setForm(f => ({ ...f, latitude: lat, longitude: lng }));
                                    }
                                }}
                                accentColor="orange"
                                label="Pharmacy Location"
                                height="250px"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

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
