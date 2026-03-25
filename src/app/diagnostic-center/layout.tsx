'use client';

import { ReactNode } from 'react';
import {
    LayoutDashboard,
    FlaskConical,
    CalendarCheck,
    BarChart3,
    Settings,
    Microscope,
    FileCheck,
} from 'lucide-react';
import DashboardLayout, { type DashboardConfig } from '@/components/shared/DashboardLayout';

const DC_CONFIG: DashboardConfig = {
    role: 'diagnostic_center_owner',
    loginPath: '/login/diagnostic-center',
    portalTitle: 'Diagnostics',
    portalSubtitle: 'Center Portal',
    portalIcon: Microscope,
    theme: { color: 'purple', dataTheme: 'diagnostic-center' },
    showApprovalBanner: true,
    showFullDropdown: false,
    userDisplayName: 'DC',
    navItems: [
        { name: 'Dashboard', href: '/diagnostic-center', icon: LayoutDashboard },
        { name: 'Test Catalog', href: '/diagnostic-center/tests', icon: FlaskConical },
        { name: 'Bookings', href: '/diagnostic-center/bookings', icon: CalendarCheck },
        { name: 'Results', href: '/diagnostic-center/results', icon: FileCheck },
        { name: 'Reports', href: '/diagnostic-center/reports', icon: BarChart3 },
        { name: 'Settings', href: '/diagnostic-center/settings', icon: Settings },
    ],
};

export default function DiagnosticCenterLayout({ children }: { children: ReactNode }) {
    return <DashboardLayout config={DC_CONFIG}>{children}</DashboardLayout>;
}
