import { cn } from '@/lib/utils';
import {
    Clock,
    Eye,
    CheckCircle,
    XCircle,
    Ban,
    AlertTriangle,
    Calendar
} from 'lucide-react';
import type { ApprovalStatus } from '@/stores/authStore';

interface StatusBadgeProps {
    status: ApprovalStatus | string;
    size?: 'sm' | 'md' | 'lg';
    showIcon?: boolean;
}

const statusConfig: Record<string, {
    label: string;
    icon: typeof Clock;
    className: string;
}> = {
    pending: {
        label: 'Pending',
        icon: Clock,
        className: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700',
    },
    review: {
        label: 'Under Review',
        icon: Eye,
        className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
    },
    approved: {
        label: 'Approved',
        icon: CheckCircle,
        className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
    },
    rejected: {
        label: 'Rejected',
        icon: XCircle,
        className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
    },
    suspended: {
        label: 'Suspended',
        icon: Ban,
        className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
    },
    active: {
        label: 'Active',
        icon: CheckCircle,
        className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
    },
    inactive: {
        label: 'Inactive',
        icon: AlertTriangle,
        className: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700/30 dark:text-gray-300 dark:border-gray-600',
    },
    completed: {
        label: 'Completed',
        icon: CheckCircle,
        className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
    },
    cancelled: {
        label: 'Cancelled',
        icon: XCircle,
        className: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700/30 dark:text-gray-400 dark:border-gray-600',
    },
    confirmed: {
        label: 'Confirmed',
        icon: CheckCircle,
        className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
    },
    'in-progress': {
        label: 'In Progress',
        icon: Clock,
        className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
    },
    processing: {
        label: 'Processing',
        icon: Clock,
        className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
    },
    ready: {
        label: 'Ready',
        icon: CheckCircle,
        className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700',
    },
    'on-leave': {
        label: 'On Leave',
        icon: AlertTriangle,
        className: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
    },
    en_route: {
        label: 'En Route',
        icon: Clock,
        className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
    },
    assigned: {
        label: 'Assigned',
        icon: CheckCircle,
        className: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700',
    },
    scheduled: {
        label: 'Scheduled',
        icon: Calendar,
        className: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700',
    },
    dispensed: {
        label: 'Dispensed',
        icon: CheckCircle,
        className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
    },
    fulfilled: {
        label: 'Fulfilled',
        icon: CheckCircle,
        className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
    },
};

export function StatusBadge({ status, size = 'md', showIcon = true }: StatusBadgeProps) {
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    const sizeStyles = {
        sm: 'text-xs px-2 py-0.5 gap-1',
        md: 'text-sm px-2.5 py-1 gap-1.5',
        lg: 'text-sm px-3 py-1.5 gap-2',
    };

    const iconSizes = {
        sm: 'h-3 w-3',
        md: 'h-3.5 w-3.5',
        lg: 'h-4 w-4',
    };

    return (
        <span
            className={cn(
                'inline-flex items-center font-medium rounded-full border',
                config.className,
                sizeStyles[size]
            )}
        >
            {showIcon && <Icon className={iconSizes[size]} />}
            {config.label}
        </span>
    );
}
