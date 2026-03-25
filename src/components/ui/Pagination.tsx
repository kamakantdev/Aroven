'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems?: number;
    itemsPerPage?: number;
    className?: string;
}

export function Pagination({
    currentPage,
    totalPages,
    onPageChange,
    totalItems,
    itemsPerPage,
    className,
}: PaginationProps) {
    if (totalPages <= 1) return null;

    const getVisiblePages = () => {
        const pages: (number | 'ellipsis')[] = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible + 2) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
            return pages;
        }

        pages.push(1);

        if (currentPage > 3) pages.push('ellipsis');

        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);

        for (let i = start; i <= end; i++) pages.push(i);

        if (currentPage < totalPages - 2) pages.push('ellipsis');

        pages.push(totalPages);

        return pages;
    };

    const startItem = totalItems != null && itemsPerPage != null
        ? (currentPage - 1) * itemsPerPage + 1
        : null;
    const endItem = totalItems != null && itemsPerPage != null
        ? Math.min(currentPage * itemsPerPage, totalItems)
        : null;

    return (
        <div className={cn('flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3', className)}>
            {/* Item count */}
            {startItem != null && endItem != null && totalItems != null && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Showing <span className="font-medium">{startItem}</span>–<span className="font-medium">{endItem}</span> of{' '}
                    <span className="font-medium">{totalItems}</span>
                </p>
            )}

            {/* Page controls */}
            <div className="flex items-center gap-1">
                {/* First page */}
                <button
                    onClick={() => onPageChange(1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="First page"
                >
                    <ChevronsLeft className="h-4 w-4" />
                </button>

                {/* Previous */}
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Previous page"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>

                {/* Page numbers */}
                {getVisiblePages().map((page, idx) =>
                    page === 'ellipsis' ? (
                        <span key={`ellipsis-${idx}`} className="px-1 text-gray-400 dark:text-gray-500">…</span>
                    ) : (
                        <button
                            key={page}
                            onClick={() => onPageChange(page)}
                            className={cn(
                                'min-w-[32px] h-8 rounded-md text-sm font-medium transition-colors',
                                currentPage === page
                                    ? 'bg-primary-600 text-white shadow-sm'
                                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                            )}
                        >
                            {page}
                        </button>
                    )
                )}

                {/* Next */}
                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Next page"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>

                {/* Last page */}
                <button
                    onClick={() => onPageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Last page"
                >
                    <ChevronsRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

/** Client-side pagination helper. Call with your filtered array. */
export function usePagination<T>(items: T[], itemsPerPage = 10) {
    const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
    const paginate = (page: number) => {
        const start = (page - 1) * itemsPerPage;
        return items.slice(start, start + itemsPerPage);
    };
    return { totalPages, totalItems: items.length, itemsPerPage, paginate };
}
