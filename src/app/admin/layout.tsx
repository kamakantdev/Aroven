'use client';

import { ReactNode } from 'react';
import {
    LayoutDashboard,
    ClipboardCheck,
    Users,
    AlertTriangle,
    BarChart3,
    FileCheck,
    History,
    Settings,
    Shield,
} from 'lucide-react';
import DashboardLayout, { type DashboardConfig } from '@/components/shared/DashboardLayout';

const ADMIN_CONFIG: DashboardConfig = {
    role: 'admin',
    loginPath: '/login/admin',
    portalTitle: 'Admin Portal',
    portalSubtitle: 'Control Center',
    portalIcon: Shield,
    theme: { color: 'blue', dataTheme: 'admin' },
    showApprovalBanner: false,
    showFullDropdown: true,
    settingsHref: '/admin/settings',
    userDisplayName: 'Admin',
    navItems: [
        { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
        { name: 'Pending Approvals', href: '/admin/approvals', icon: ClipboardCheck },
        { name: 'All Providers', href: '/admin/providers', icon: Users },
        { name: 'Emergencies', href: '/admin/emergencies', icon: AlertTriangle },
        { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
        { name: 'Compliance', href: '/admin/compliance', icon: FileCheck },
        { name: 'Audit Trail', href: '/admin/audit', icon: History },
        { name: 'Settings', href: '/admin/settings', icon: Settings },
    ],
};

export default function AdminLayout({ children }: { children: ReactNode }) {
    return <DashboardLayout config={ADMIN_CONFIG}>{children}</DashboardLayout>;
}
