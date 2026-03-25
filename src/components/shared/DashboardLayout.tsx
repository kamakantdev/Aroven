'use client';

import { ReactNode, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    LogOut,
    ChevronDown,
    Menu,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { cn, getInitials } from '@/lib/utils';
import { ApprovalBanner } from '@/components/shared/ApprovalBanner';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { NotificationBell, NotificationPanel } from '@/components/ui/Toast';
import { ConnectionIndicator } from '@/components/shared/ConnectionIndicator';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import GlobalSocketToasts from '@/components/shared/GlobalSocketToasts';
import { useNotifications } from '@/hooks/useSocket';

// ----- Types -----

export interface NavItem {
    name: string;
    href: string;
    icon: LucideIcon;
    /** Optional badge count (e.g. new orders) */
    badge?: number;
    /** Callback when this nav item is clicked */
    onClick?: () => void;
}

export interface DashboardTheme {
    /** Tailwind color name: 'blue', 'emerald', 'teal', 'orange', 'pink', 'purple' */
    color: string;
    /** data-theme attribute */
    dataTheme: string;
}

export interface DashboardConfig {
    /** Role required to access this dashboard */
    role: string;
    /** Login page path for redirects */
    loginPath: string;
    /** Portal title (e.g. "Admin Portal") */
    portalTitle: string;
    /** Portal subtitle (e.g. "Control Center") */
    portalSubtitle: string;
    /** Icon shown in sidebar header */
    portalIcon: LucideIcon;
    /** Theme colors */
    theme: DashboardTheme;
    /** Navigation items */
    navItems: NavItem[];
    /** Show approval banner if not approved (default: false) */
    showApprovalBanner?: boolean;
    /** Show full user dropdown with name/email/settings (default: false) */
    showFullDropdown?: boolean;
    /** Settings page href (only used if showFullDropdown is true) */
    settingsHref?: string;
    /** Default user display name fallback */
    userDisplayName?: string;
    /**
     * Paths accessible even when approval_status !== 'approved'.
     * Only relevant when showApprovalBanner is true.
     * The dashboard root (first navItem href) and settings are always allowed.
     */
    allowedPathsWhenPending?: string[];
}

// ----- Color Mapping -----

const COLOR_CLASSES: Record<string, {
    sidebar: string;
    border: string;
    active: string;
    text: string;
    hover: string;
    avatar: string;
    spinner: string;
    logoBg: string;
}> = {
    blue: {
        sidebar: 'bg-blue-900',
        border: 'border-blue-800',
        active: 'bg-blue-700 text-white',
        text: 'text-blue-100',
        hover: 'hover:bg-blue-800',
        avatar: 'bg-blue-600',
        spinner: 'border-blue-600',
        logoBg: 'bg-blue-700',
    },
    emerald: {
        sidebar: 'bg-emerald-900',
        border: 'border-emerald-800',
        active: 'bg-emerald-700 text-white',
        text: 'text-emerald-100',
        hover: 'hover:bg-emerald-800',
        avatar: 'bg-emerald-600',
        spinner: 'border-emerald-600',
        logoBg: 'bg-emerald-700',
    },
    teal: {
        sidebar: 'bg-teal-900',
        border: 'border-teal-800',
        active: 'bg-teal-700 text-white',
        text: 'text-teal-100',
        hover: 'hover:bg-teal-800',
        avatar: 'bg-teal-600',
        spinner: 'border-teal-600',
        logoBg: 'bg-teal-700',
    },
    orange: {
        sidebar: 'bg-orange-900',
        border: 'border-orange-800',
        active: 'bg-orange-700 text-white',
        text: 'text-orange-100',
        hover: 'hover:bg-orange-800',
        avatar: 'bg-orange-600',
        spinner: 'border-orange-600',
        logoBg: 'bg-orange-700',
    },
    pink: {
        sidebar: 'bg-pink-900',
        border: 'border-pink-800',
        active: 'bg-pink-700 text-white',
        text: 'text-pink-100',
        hover: 'hover:bg-pink-800',
        avatar: 'bg-pink-600',
        spinner: 'border-pink-600',
        logoBg: 'bg-pink-700',
    },
    purple: {
        sidebar: 'bg-purple-900',
        border: 'border-purple-800',
        active: 'bg-purple-700 text-white',
        text: 'text-purple-100',
        hover: 'hover:bg-purple-800',
        avatar: 'bg-purple-600',
        spinner: 'border-purple-600',
        logoBg: 'bg-purple-700',
    },
};

// Subtitle color classes (needs dynamic shade)
const SUBTITLE_CLASSES: Record<string, string> = {
    blue: 'text-blue-300',
    emerald: 'text-emerald-300',
    teal: 'text-teal-300',
    orange: 'text-orange-300',
    pink: 'text-pink-300',
    purple: 'text-purple-300',
};

// ----- Component -----

export default function DashboardLayout({
    config,
    children,
}: {
    config: DashboardConfig;
    children: ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, isAuthenticated, _hasHydrated, logout } = useAuthStore();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const { notifications, unreadCount, clearNotifications } = useNotifications();

    const sidebarRef = useRef<HTMLDivElement>(null);
    const menuButtonRef = useRef<HTMLButtonElement>(null);

    // Close sidebar on Escape — global keyboard listener
    useEffect(() => {
        if (!sidebarOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setSidebarOpen(false);
                menuButtonRef.current?.focus();
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [sidebarOpen]);

    // Focus trap inside mobile sidebar
    useEffect(() => {
        if (!sidebarOpen || !sidebarRef.current) return;

        const sidebar = sidebarRef.current;
        const focusable = sidebar.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        // Auto-focus first focusable element (close button)
        first.focus();

        const trapFocus = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        sidebar.addEventListener('keydown', trapFocus);
        return () => sidebar.removeEventListener('keydown', trapFocus);
    }, [sidebarOpen]);

    // Return focus to menu button when sidebar closes
    const closeSidebar = useCallback(() => {
        setSidebarOpen(false);
        // Allow transition to complete, then focus menu button
        setTimeout(() => menuButtonRef.current?.focus(), 100);
    }, []);

    const colors = COLOR_CLASSES[config.theme.color] || COLOR_CLASSES.blue;
    const subtitleColor = SUBTITLE_CLASSES[config.theme.color] || 'text-blue-300';

    // The base route for this dashboard (first nav item or derive from role)
    const baseRoute = config.navItems[0]?.href || '/';
    const roleMatches = user?.role === config.role || (config.role === 'admin' && user?.role === 'super_admin');

    useEffect(() => {
        if (_hasHydrated && (!isAuthenticated || !roleMatches)) {
            router.push(config.loginPath);
        }
    }, [isAuthenticated, _hasHydrated, roleMatches, router, config.loginPath]);

    if (!_hasHydrated || !isAuthenticated || !roleMatches) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <div className={cn('animate-spin h-8 w-8 border-4 border-t-transparent rounded-full', colors.spinner)} />
            </div>
        );
    }

    const handleLogout = () => {
        logout();
        router.push(config.loginPath);
    };

    const PortalIcon = config.portalIcon;
    const displayName = user?.name || config.userDisplayName || 'User';

    // Determine active nav item
    const activeNavItem = config.navItems.find(item =>
        pathname === item.href || (item.href !== baseRoute && pathname.startsWith(item.href))
    );

    // #40: Pending doctor enforcement — block pages when not approved
    const isNotApproved = config.showApprovalBanner &&
        user?.approval_status != null &&
        user.approval_status !== 'approved';

    // Pages always accessible: dashboard root + settings + explicit allow list
    const alwaysAllowed = [baseRoute, config.settingsHref].filter(Boolean) as string[];
    const allowedPaths = [...alwaysAllowed, ...(config.allowedPathsWhenPending || [])];
    const isOnAllowedPath = allowedPaths.some(p => pathname === p);
    const isPageBlocked = isNotApproved && !isOnAllowedPath;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950" data-theme={config.theme.dataTheme}>
            {/* Socket listener — only active on dashboard pages (not login/register/etc.) */}
            <GlobalSocketToasts />

            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={closeSidebar}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar — on mobile it acts as a modal dialog */}
            <div
                ref={sidebarRef}
                className={cn(
                    'fixed top-0 left-0 z-50 h-full w-64 text-white transition-transform lg:translate-x-0',
                    colors.sidebar,
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                )}
                role={sidebarOpen ? 'dialog' : 'navigation'}
                aria-modal={sidebarOpen ? true : undefined}
                aria-label="Dashboard sidebar"
            >
                {/* Logo */}
                <div className={cn('flex items-center justify-between h-16 px-4 border-b', colors.border)}>
                    <div className="flex items-center gap-3">
                        <div className={cn('p-2 rounded-lg', colors.logoBg)}>
                            <PortalIcon className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="font-bold text-lg">{config.portalTitle}</h1>
                            <p className={cn('text-xs', subtitleColor)}>{config.portalSubtitle}</p>
                        </div>
                    </div>
                    <button
                        onClick={closeSidebar}
                        className={cn('lg:hidden p-1 rounded', colors.hover)}
                        aria-label="Close sidebar"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="p-4 space-y-1">
                    {config.navItems.map((item) => {
                        const isActive = pathname === item.href ||
                            (item.href !== baseRoute && pathname.startsWith(item.href));
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={item.onClick}
                                className={cn(
                                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative',
                                    isActive ? colors.active : cn(colors.text, colors.hover)
                                )}
                            >
                                <Icon className="h-5 w-5" />
                                {item.name}
                                {item.badge != null && item.badge > 0 && (
                                    <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1">
                                        {item.badge > 99 ? '99+' : item.badge}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Sign Out at bottom */}
                <div className={cn('absolute bottom-0 left-0 right-0 p-4 border-t', colors.border)}>
                    <button
                        onClick={handleLogout}
                        className={cn(
                            'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                            colors.text,
                            colors.hover
                        )}
                    >
                        <LogOut className="h-5 w-5" />
                        Sign Out
                    </button>
                </div>
            </div>

            {/* Main content */}
            <div className="lg:pl-64">
                {/* Header */}
                <header className="sticky top-0 z-30 h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 lg:px-6">
                    <div className="flex items-center gap-4">
                        <button
                            ref={menuButtonRef}
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                            aria-label="Open sidebar"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                        <div>
                            <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                                {activeNavItem?.name || 'Dashboard'}
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <ThemeToggle />
                        <ConnectionIndicator />

                        {/* Notifications */}
                        <div className="relative">
                            <NotificationBell
                                count={unreadCount}
                                onClick={() => setNotifOpen(!notifOpen)}
                                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                            />
                            <NotificationPanel
                                notifications={notifications.map(n => ({
                                    ...n,
                                    type: (n as any).type || 'info',
                                    title: (n as any).title || 'Notification',
                                    timestamp: (n as any).timestamp || new Date().toISOString(),
                                }))}
                                isOpen={notifOpen}
                                onClose={() => setNotifOpen(false)}
                                onClear={clearNotifications}
                            />
                        </div>

                        {/* User dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                                className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                                aria-label="User menu"
                                aria-expanded={dropdownOpen}
                                aria-haspopup="true"
                            >
                                <div className={cn(
                                    'h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-medium',
                                    colors.avatar
                                )}>
                                    {getInitials(displayName)}
                                </div>
                                {config.showFullDropdown && (
                                    <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {displayName}
                                    </span>
                                )}
                                <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            </button>

                            {dropdownOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setDropdownOpen(false)}
                                    />
                                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                                        {config.showFullDropdown && (
                                            <>
                                                <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.name}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                                                </div>
                                                {config.settingsHref && (
                                                    <Link
                                                        href={config.settingsHref}
                                                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                                    >
                                                        Settings
                                                    </Link>
                                                )}
                                            </>
                                        )}
                                        <button
                                            onClick={handleLogout}
                                            className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                                        >
                                            Sign Out
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="p-4 lg:p-6">
                    {config.showApprovalBanner && user?.approval_status && user.approval_status !== 'approved' && (
                        <ApprovalBanner
                            status={user.approval_status}
                            reason={user.approval_notes}
                            className="mb-6"
                        />
                    )}
                    <ErrorBoundary>
                        {isPageBlocked ? (
                            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 p-8 text-center">
                                <div className="p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                                    <svg className="h-12 w-12 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                                        {user?.approval_status === 'pending' && 'Approval Required'}
                                        {user?.approval_status === 'review' && 'Under Review'}
                                        {user?.approval_status === 'rejected' && 'Profile Rejected'}
                                        {user?.approval_status === 'suspended' && 'Account Suspended'}
                                    </h2>
                                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-md">
                                        {user?.approval_status === 'pending' && 'Your profile must be approved by an admin before you can access this feature. Please complete your profile and wait for approval.'}
                                        {user?.approval_status === 'review' && 'Your profile is currently being reviewed. This usually takes 24-48 hours. You will be notified once approved.'}
                                        {user?.approval_status === 'rejected' && 'Your profile was rejected. Please update your documents in Settings and resubmit for review.'}
                                        {user?.approval_status === 'suspended' && 'Your account has been suspended. Please contact support for more information.'}
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <a
                                        href={baseRoute}
                                        className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
                                    >
                                        Go to Dashboard
                                    </a>
                                    {config.settingsHref && (
                                        <a
                                            href={config.settingsHref}
                                            className={cn('px-4 py-2 text-white rounded-lg transition-colors text-sm font-medium', colors.avatar, colors.hover)}
                                        >
                                            Open Settings
                                        </a>
                                    )}
                                </div>
                            </div>
                        ) : (
                            children
                        )}
                    </ErrorBoundary>
                </main>
            </div>
        </div>
    );
}
