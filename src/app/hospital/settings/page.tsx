'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import { ProfileImageUpload } from '@/components/shared/ProfileImageUpload';
import LocationPicker from '@/components/shared/LocationPickerDynamic';
import { hospitalApi, authApi } from '@/lib/api';

export default function HospitalSettingsPage() {
    const user = useAuthStore((s) => s.user);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [profile, setProfile] = useState({ name: '', phone: '', address: '', bedCapacity: '', profileImage: '' as string | null, latitude: null as number | null, longitude: null as number | null });
    const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });

    useEffect(() => {
        (async () => {
            try {
                const res = await hospitalApi.getProfile();
                if (res.success) {
                    const p = (res.data as any)?.profile || (res.data as any) || {};
                    setProfile({
                        name: p.name || user?.name || '',
                        phone: p.phone || '',
                        address: p.address || '',
                        bedCapacity: p.bed_capacity?.toString() || '',
                        profileImage: p.profile_image || p.profileImage || p.avatar_url || null,
                        latitude: p.latitude ?? null,
                        longitude: p.longitude ?? null,
                    });
                }
            } catch { /* use defaults */ }
            setIsLoading(false);
        })();
    }, []);

    const handleSaveProfile = async () => {
        setIsSaving(true);
        setSaveStatus(null);
        if (!profile.phone.trim()) {
            setSaveStatus({ type: 'error', message: 'Phone is required for approval and patient contact.' });
            setIsSaving(false);
            return;
        }
        if (profile.latitude == null || profile.longitude == null) {
            setSaveStatus({ type: 'error', message: 'Location is required so patients can find your hospital on map.' });
            setIsSaving(false);
            return;
        }
        try {
            const res = await hospitalApi.updateProfile({
                name: profile.name, phone: profile.phone, address: profile.address,
                bed_capacity: Number(profile.bedCapacity) || undefined,
                profile_image: profile.profileImage || undefined,
                ...(profile.latitude != null && profile.longitude != null ? { latitude: profile.latitude, longitude: profile.longitude } : {}),
            });
            setSaveStatus(res.success
                ? { type: 'success', message: 'Hospital profile updated!' }
                : { type: 'error', message: res.error || 'Failed to update profile' });
        } catch { setSaveStatus({ type: 'error', message: 'Network error.' }); }
        setIsSaving(false);
        setTimeout(() => setSaveStatus(null), 4000);
    };

    const handleChangePassword = async () => {
        if (passwords.new !== passwords.confirm) { setSaveStatus({ type: 'error', message: 'Passwords do not match.' }); return; }
        if (passwords.new.length < 6) { setSaveStatus({ type: 'error', message: 'Password must be at least 6 characters.' }); return; }
        setIsSaving(true);
        try {
            const res = await authApi.changePassword(passwords.current, passwords.new);
            if (res.success) { setSaveStatus({ type: 'success', message: 'Password changed!' }); setPasswords({ current: '', new: '', confirm: '' }); }
            else { setSaveStatus({ type: 'error', message: (res as any).error || 'Failed' }); }
        } catch { setSaveStatus({ type: 'error', message: 'Network error.' }); }
        setIsSaving(false);
        setTimeout(() => setSaveStatus(null), 4000);
    };

    if (isLoading) return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div>;

    return (
        <div className="space-y-6">
            <div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1><p className="text-gray-600 dark:text-gray-400 mt-1">Hospital configuration</p></div>

            {saveStatus && (
                <div className={`px-4 py-3 rounded-lg text-sm border ${saveStatus.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>{saveStatus.message}</div>
            )}

            <Card>
                <CardHeader><CardTitle>Hospital Information</CardTitle></CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <ProfileImageUpload
                            currentImage={profile.profileImage}
                            name={profile.name}
                            onUploadComplete={(url) => setProfile(p => ({ ...p, profileImage: url }))}
                            accentColor="teal"
                        />
                        <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hospital Name</label><Input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} /></div>
                        <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label><Input value={user?.email || ''} readOnly /></div>
                        <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label><Input value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="+91..." /></div>
                        <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label><Input value={profile.address} onChange={e => setProfile(p => ({ ...p, address: e.target.value }))} placeholder="Full address" /></div>
                        <LocationPicker
                            latitude={profile.latitude}
                            longitude={profile.longitude}
                            address={profile.address}
                            onLocationChange={(lat, lng) => {
                                if (lat === 0 && lng === 0) {
                                    setProfile(p => ({ ...p, latitude: null, longitude: null }));
                                } else {
                                    setProfile(p => ({ ...p, latitude: lat, longitude: lng }));
                                }
                            }}
                            accentColor="teal"
                            label="Hospital Location"
                            height="250px"
                        />
                        <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bed Capacity</label><Input type="number" value={profile.bedCapacity} onChange={e => setProfile(p => ({ ...p, bedCapacity: e.target.value }))} /></div>
                        <Button onClick={handleSaveProfile} isLoading={isSaving} leftIcon={<Save className="h-4 w-4" />}>Save Profile</Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password</label><Input type="password" value={passwords.current} onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))} /></div>
                        <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label><Input type="password" value={passwords.new} onChange={e => setPasswords(p => ({ ...p, new: e.target.value }))} /></div>
                        <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm Password</label><Input type="password" value={passwords.confirm} onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))} /></div>
                        <Button variant="outline" onClick={handleChangePassword} isLoading={isSaving}>Change Password</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
