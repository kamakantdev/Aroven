'use client';

import { ReactNode } from 'react';
import {
    LayoutDashboard,
    Building2,
    Users,
    Calendar,
    AlertTriangle,
    BarChart3,
    Settings,
    Stethoscope,
    UserCog,
} from 'lucide-react';
import DashboardLayout, { type DashboardConfig } from '@/components/shared/DashboardLayout';

const HOSPITAL_CONFIG: DashboardConfig = {
    role: 'hospital_owner',
    loginPath: '/login/hospital',
    portalTitle: 'Hospital Portal',
    portalSubtitle: 'Operations Hub',
    portalIcon: Building2,
    theme: { color: 'teal', dataTheme: 'hospital' },
    showApprovalBanner: true,
    showFullDropdown: false,
    userDisplayName: 'Hospital',
    navItems: [
        { name: 'Dashboard', href: '/hospital', icon: LayoutDashboard },
        { name: 'Departments', href: '/hospital/departments', icon: Building2 },
        { name: 'Doctors', href: '/hospital/doctors', icon: Users },
        { name: 'Appointments', href: '/hospital/appointments', icon: Calendar },
        { name: 'Consultations', href: '/hospital/consultations', icon: Stethoscope },
        { name: 'Emergency', href: '/hospital/emergency', icon: AlertTriangle },
        { name: 'Managers', href: '/hospital/managers', icon: UserCog },
        { name: 'Reports', href: '/hospital/reports', icon: BarChart3 },
        { name: 'Settings', href: '/hospital/settings', icon: Settings },
    ],
};

export default function HospitalLayout({ children }: { children: ReactNode }) {
    return <DashboardLayout config={HOSPITAL_CONFIG}>{children}</DashboardLayout>;
}
