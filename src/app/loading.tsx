'use client';

/**
 * Global loading fallback for route transitions.
 * Shown by Next.js when navigating between routes.
 */
export default function Loading() {
    return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="animate-spin h-10 w-10 border-4 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 rounded-full" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
            </div>
        </div>
    );
}
