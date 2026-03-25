'use client';

import { ReactNode } from 'react';
import {
    LayoutDashboard,
    Calendar,
    Video,
    Users,
    Clock,
    Settings,
    Stethoscope,
    ClipboardList,
    Activity,
} from 'lucide-react';
import DashboardLayout, { type DashboardConfig } from '@/components/shared/DashboardLayout';

const DOCTOR_CONFIG: DashboardConfig = {
    role: 'doctor',
    loginPath: '/login/doctor',
    portalTitle: 'Doctor Portal',
    portalSubtitle: 'Clinical Workstation',
    portalIcon: Stethoscope,
    theme: { color: 'emerald', dataTheme: 'doctor' },
    showApprovalBanner: true,
    showFullDropdown: true,
    settingsHref: '/doctor/settings',
    userDisplayName: 'Doctor',
    navItems: [
        { name: 'Dashboard', href: '/doctor', icon: LayoutDashboard },
        { name: 'Appointments', href: '/doctor/appointments', icon: Calendar },
        { name: 'Consultations', href: '/doctor/consultations', icon: Video },
        { name: 'Prescriptions', href: '/doctor/prescriptions', icon: ClipboardList },
        { name: 'Patients', href: '/doctor/patients', icon: Users },
        { name: 'Vitals', href: '/doctor/vitals', icon: Activity },
        { name: 'Schedule', href: '/doctor/schedule', icon: Clock },
        { name: 'Settings', href: '/doctor/settings', icon: Settings },
    ],
};

export default function DoctorLayout({ children }: { children: ReactNode }) {
    return <DashboardLayout config={DOCTOR_CONFIG}>{children}</DashboardLayout>;
}
