import { cn } from '@/lib/utils';
import {
    Clock,
    Eye,
    CheckCircle,
    XCircle,
    Ban,
} from 'lucide-react';
import type { ApprovalStatus } from '@/stores/authStore';

interface ApprovalBannerProps {
    status: ApprovalStatus;
    reason?: string;
    className?: string;
}

const bannerConfig: Record<ApprovalStatus, {
    icon: typeof Clock;
    title: string;
    description: string;
    className: string;
    iconClassName: string;
}> = {
    pending: {
        icon: Clock,
        title: 'Pending Approval',
        description: 'Your profile is awaiting admin review. You cannot accept appointments until approved.',
        className: 'bg-yellow-50 border-yellow-200',
        iconClassName: 'text-yellow-600',
    },
    review: {
        icon: Eye,
        title: 'Under Review',
        description: 'An admin is currently reviewing your documents. This usually takes 24-48 hours.',
        className: 'bg-blue-50 border-blue-200',
        iconClassName: 'text-blue-600',
    },
    approved: {
        icon: CheckCircle,
        title: 'Profile Approved',
        description: 'Your profile is live and visible to patients. You can now accept appointments.',
        className: 'bg-green-50 border-green-200',
        iconClassName: 'text-green-600',
    },
    rejected: {
        icon: XCircle,
        title: 'Profile Rejected',
        description: 'Your profile has been rejected. Please review the reason below and update your documents.',
        className: 'bg-red-50 border-red-200',
        iconClassName: 'text-red-600',
    },
    suspended: {
        icon: Ban,
        title: 'Account Suspended',
        description: 'Your account has been suspended. Please contact support for more information.',
        className: 'bg-red-50 border-red-200',
        iconClassName: 'text-red-600',
    },
};

export function ApprovalBanner({ status, reason, className }: ApprovalBannerProps) {
    const config = bannerConfig[status];
    const Icon = config.icon;

    // Don't show banner for approved status (or make it dismissible)
    if (status === 'approved') {
        return null;
    }

    return (
        <div
            className={cn(
                'rounded-lg border p-4',
                config.className,
                className
            )}
        >
            <div className="flex items-start gap-3">
                <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', config.iconClassName)} />
                <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900">{config.title}</h4>
                    <p className="text-sm text-gray-600 mt-0.5">{config.description}</p>
                    {reason && (status === 'rejected' || status === 'suspended') && (
                        <div className="mt-2 p-2 bg-white/50 rounded border border-current/10">
                            <p className="text-sm font-medium text-gray-700">Reason:</p>
                            <p className="text-sm text-gray-600">{reason}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
