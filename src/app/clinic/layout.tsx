'use client';

import { ReactNode } from 'react';
import {
    LayoutDashboard,
    Users,
    Calendar,
    Clock,
    Settings,
    Building,
    Stethoscope,
} from 'lucide-react';
import DashboardLayout, { type DashboardConfig } from '@/components/shared/DashboardLayout';

const CLINIC_CONFIG: DashboardConfig = {
    role: 'clinic_owner',
    loginPath: '/login/clinic',
    portalTitle: 'Clinic Portal',
    portalSubtitle: 'Scheduling Center',
    portalIcon: Building,
    theme: { color: 'pink', dataTheme: 'clinic' },
    showApprovalBanner: true,
    showFullDropdown: false,
    userDisplayName: 'Clinic',
    navItems: [
        { name: 'Dashboard', href: '/clinic', icon: LayoutDashboard },
        { name: 'Staff', href: '/clinic/staff', icon: Users },
        { name: 'Appointments', href: '/clinic/appointments', icon: Calendar },
        { name: 'Consultations', href: '/clinic/consultations', icon: Stethoscope },
        { name: 'Schedule', href: '/clinic/schedule', icon: Clock },
        { name: 'Settings', href: '/clinic/settings', icon: Settings },
    ],
};

export default function ClinicLayout({ children }: { children: ReactNode }) {
    return <DashboardLayout config={CLINIC_CONFIG}>{children}</DashboardLayout>;
}
