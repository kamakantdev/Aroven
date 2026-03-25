import { cn } from '@/lib/utils';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular';
    width?: string | number;
    height?: string | number;
}

export function Skeleton({ className, variant = 'text', width, height }: SkeletonProps) {
    const variantStyles = {
        text: 'rounded',
        circular: 'rounded-full',
        rectangular: 'rounded-xl',
    };

    return (
        <div
            className={cn(
                'animate-pulse bg-gray-200 dark:bg-gray-700',
                variantStyles[variant],
                className
            )}
            style={{ width, height }}
        />
    );
}

/** Skeleton for a stat card */
export function StatCardSkeleton() {
    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 p-6">
            <div className="flex items-start justify-between">
                <Skeleton variant="rectangular" className="h-10 w-10" />
                <Skeleton className="h-4 w-12" />
            </div>
            <div className="mt-4 space-y-2">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-4 w-28" />
            </div>
        </div>
    );
}

/** Skeleton for a list row */
export function ListRowSkeleton({ columns = 4 }: { columns?: number }) {
    return (
        <div className="flex items-center gap-4 p-4 border-b border-gray-100 dark:border-gray-800">
            <Skeleton variant="circular" className="h-10 w-10 shrink-0" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
            </div>
            {Array.from({ length: columns - 2 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-16 shrink-0" />
            ))}
        </div>
    );
}

/** Skeleton for a full table */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                {Array.from({ length: columns }).map((_, i) => (
                    <Skeleton key={i} className="h-4 w-24" />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, i) => (
                <ListRowSkeleton key={i} columns={columns} />
            ))}
        </div>
    );
}

/** Skeleton for a card grid */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60 p-6 space-y-3">
                    <div className="flex items-center gap-3">
                        <Skeleton variant="circular" className="h-10 w-10" />
                        <div className="space-y-2 flex-1">
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                </div>
            ))}
        </div>
    );
}

/** Skeleton for a page with stats + table */
export function PageSkeleton({ statCount = 4, tableRows = 5 }: { statCount?: number; tableRows?: number }) {
    return (
        <div className="space-y-6">
            {/* Title */}
            <div>
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-64 mt-2" />
            </div>
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: statCount }).map((_, i) => (
                    <StatCardSkeleton key={i} />
                ))}
            </div>
            {/* Table */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60">
                <TableSkeleton rows={tableRows} />
            </div>
        </div>
    );
}
