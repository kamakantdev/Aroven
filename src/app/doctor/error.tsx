'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function DoctorError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Doctor dashboard error:', error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 p-8">
            <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full">
                <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Something went wrong
                </h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-md">
                    An error occurred while loading this page. Please try again.
                </p>
                {error.digest && (
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        Error ID: {error.digest}
                    </p>
                )}
            </div>
            <div className="flex gap-3">
                <button
                    onClick={reset}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
                >
                    <RefreshCw className="h-4 w-4" />
                    Try Again
                </button>
                <a
                    href="/doctor"
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
                >
                    <Home className="h-4 w-4" />
                    Doctor Home
                </a>
            </div>
        </div>
    );
}
