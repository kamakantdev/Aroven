'use client';

import { useEffect, useState } from 'react';
import {
    Settings, Bell, Shield, Globe, Mail, Smartphone,
    Database, Key, Save, RefreshCw, Loader2, CheckCircle, XCircle
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { adminApi } from '@/lib/api';

interface SettingSection {
    id: string;
    title: string;
    icon: React.ElementType;
    description: string;
}

interface SystemHealth {
    database?: { status: string };
    redis?: { status: string };
    supabase?: { status: string };
    checks?: {
        mongodb?: { status: string };
        redis?: { status: string };
        supabase?: { status: string };
    };
    uptime?: number;
}

const SETTING_SECTIONS: SettingSection[] = [
    { id: 'notifications', title: 'Notifications', icon: Bell, description: 'Configure notification preferences' },
    { id: 'security', title: 'Security', icon: Shield, description: 'Security and authentication settings' },
    { id: 'general', title: 'General', icon: Globe, description: 'General platform settings' },
    { id: 'integrations', title: 'Integrations', icon: Database, description: 'Third-party integrations' },
];

export default function SettingsPage() {
    const [activeSection, setActiveSection] = useState('notifications');
    const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
    const [healthLoading, setHealthLoading] = useState(false);
    const [saveStatus, setSaveStatus] = useState<string | null>(null);
    const [settings, setSettings] = useState({
        emailNotifications: true,
        smsNotifications: false,
        pushNotifications: true,
        twoFactorAuth: false,
        sessionTimeout: '30',
        maintenanceMode: false,
        platformName: 'Swastik Healthcare',
        supportEmail: 'support@swastik.health',
    });

    const handleToggle = (key: keyof typeof settings) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = () => {
        setSaveStatus('Settings saved locally. Backend sync is not enabled in this build.');
        setTimeout(() => setSaveStatus(null), 3000);
    };

    const fetchSystemHealth = async () => {
        setHealthLoading(true);
        try {
            const result = await adminApi.getSystemHealth();
            if (result.success) {
                const apiData = (result.data as any)?.data || result.data;
                setSystemHealth(apiData);
            }
        } catch (err) {
            console.error('Error fetching system health:', err);
        } finally {
            setHealthLoading(false);
        }
    };

    useEffect(() => {
        if (activeSection === 'integrations') {
            fetchSystemHealth();
        }
    }, [activeSection]);

    const getIntegrationStatus = (service: string): { status: string; color: string } => {
        if (!systemHealth) return { status: 'Unknown', color: 'text-gray-500 dark:text-gray-400' };
        const keyMap: Record<string, string[]> = {
            database: ['database', 'mongodb'],
            redis: ['redis'],
            supabase: ['supabase'],
        };
        const candidates = keyMap[service] || [service];

        let svc: any = null;
        for (const key of candidates) {
            svc = (systemHealth as any)[key] || (systemHealth.checks as any)?.[key];
            if (svc) break;
        }

        if (svc?.status === 'connected' || svc?.status === 'ok' || svc?.status === 'healthy') {
            return { status: 'Connected', color: 'text-green-600' };
        }
        if (svc?.status === 'unavailable') {
            return { status: 'Unavailable', color: 'text-yellow-600' };
        }
        return { status: svc?.status || 'Disconnected', color: 'text-red-600' };
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Platform Settings</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Manage system configuration and preferences</p>
                </div>
                <Button onClick={handleSave} leftIcon={<Save className="h-4 w-4" />}>Save Changes</Button>
            </div>

            {saveStatus && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" /> {saveStatus}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1">
                    <Card padding="sm">
                        <nav className="space-y-1">
                            {SETTING_SECTIONS.map((section) => {
                                const Icon = section.icon;
                                return (
                                    <button key={section.id} onClick={() => setActiveSection(section.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                                            activeSection === section.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                        }`}>
                                        <Icon className="h-5 w-5" />
                                        <span className="font-medium">{section.title}</span>
                                    </button>
                                );
                            })}
                        </nav>
                    </Card>
                </div>

                <div className="lg:col-span-3">
                    {activeSection === 'notifications' && (
                        <Card>
                            <CardHeader><CardTitle>Notification Settings</CardTitle></CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    {([
                                        { key: 'emailNotifications' as const, icon: Mail, title: 'Email Notifications', desc: 'Receive notifications via email' },
                                        { key: 'smsNotifications' as const, icon: Smartphone, title: 'SMS Notifications', desc: 'Receive notifications via SMS' },
                                        { key: 'pushNotifications' as const, icon: Bell, title: 'Push Notifications', desc: 'Receive push notifications in browser' },
                                    ]).map((item) => (
                                        <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                                            <div className="flex items-center gap-3">
                                                <item.icon className="h-5 w-5 text-gray-400" />
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">{item.desc}</p>
                                                </div>
                                            </div>
                                            <button onClick={() => handleToggle(item.key)}
                                                className={`w-12 h-6 rounded-full transition-colors ${settings[item.key] ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'}`}>
                                                <div className={`w-5 h-5 bg-white dark:bg-gray-900 rounded-full shadow transform transition-transform ${settings[item.key] ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeSection === 'security' && (
                        <Card>
                            <CardHeader><CardTitle>Security Settings</CardTitle></CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
                                        <div className="flex items-center gap-3">
                                            <Key className="h-5 w-5 text-gray-400" />
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-gray-100">Two-Factor Authentication</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">Require 2FA for admin login</p>
                                            </div>
                                        </div>
                                        <button onClick={() => handleToggle('twoFactorAuth')}
                                            className={`w-12 h-6 rounded-full transition-colors ${settings.twoFactorAuth ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'}`}>
                                            <div className={`w-5 h-5 bg-white dark:bg-gray-900 rounded-full shadow transform transition-transform ${settings.twoFactorAuth ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                        </button>
                                    </div>
                                    <div className="py-3">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Session Timeout (minutes)</label>
                                        <Input type="number" value={settings.sessionTimeout}
                                            onChange={(e) => setSettings(prev => ({ ...prev, sessionTimeout: e.target.value }))} className="max-w-xs" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeSection === 'general' && (
                        <Card>
                            <CardHeader><CardTitle>General Settings</CardTitle></CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Platform Name</label>
                                        <Input value={settings.platformName}
                                            onChange={(e) => setSettings(prev => ({ ...prev, platformName: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Support Email</label>
                                        <Input type="email" value={settings.supportEmail}
                                            onChange={(e) => setSettings(prev => ({ ...prev, supportEmail: e.target.value }))} />
                                    </div>
                                    <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-800">
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-gray-100">Maintenance Mode</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Enable to show maintenance page to users</p>
                                        </div>
                                        <button onClick={() => handleToggle('maintenanceMode')}
                                            className={`w-12 h-6 rounded-full transition-colors ${settings.maintenanceMode ? 'bg-red-600' : 'bg-gray-200 dark:bg-gray-600'}`}>
                                            <div className={`w-5 h-5 bg-white dark:bg-gray-900 rounded-full shadow transform transition-transform ${settings.maintenanceMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                        </button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeSection === 'integrations' && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>Integrations</CardTitle>
                                    <Button variant="outline" size="sm" onClick={fetchSystemHealth}
                                        leftIcon={healthLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}>
                                        Test All
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {([
                                        { key: 'database', name: 'MongoDB', bgColor: 'bg-green-100', iconColor: 'text-green-600' },
                                        { key: 'redis', name: 'Redis', bgColor: 'bg-red-100', iconColor: 'text-red-600' },
                                        { key: 'supabase', name: 'Supabase', bgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
                                    ]).map((svc) => {
                                        const healthStatus = getIntegrationStatus(svc.key);
                                        return (
                                            <div key={svc.key} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 ${svc.bgColor} rounded-lg`}>
                                                            <Database className={`h-5 w-5 ${svc.iconColor}`} />
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-gray-900 dark:text-gray-100">{svc.name}</p>
                                                            <p className={`text-sm ${healthStatus.color}`}>{healthStatus.status}</p>
                                                        </div>
                                                    </div>
                                                    <Button variant="outline" size="sm" onClick={fetchSystemHealth}
                                                        leftIcon={<RefreshCw className="h-4 w-4" />}>Test</Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
