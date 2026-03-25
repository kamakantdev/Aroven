'use client';

import { useEffect } from 'react';

/**
 * Global error boundary for unhandled errors.
 * Shows a user-friendly error message with retry option.
 */
export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Unhandled error:', error);
    }, [error]);

    return (
        <div className="min-h-[60vh] flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                    <svg
                        className="w-8 h-8 text-red-600 dark:text-red-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                    </svg>
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        Something went wrong
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        An unexpected error occurred. Please try again.
                    </p>
                    {error.digest && (
                        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                            Error ID: {error.digest}
                        </p>
                    )}
                </div>
                <div className="flex justify-center gap-3">
                    <button
                        onClick={reset}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                        Try Again
                    </button>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
                    >
                        Go Home
                    </button>
                </div>
            </div>
        </div>
    );
}
