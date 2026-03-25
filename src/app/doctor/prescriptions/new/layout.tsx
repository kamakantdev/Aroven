'use client';

import { Suspense } from 'react';

export default function NewPrescriptionLayout({ children }: { children: React.ReactNode }) {
    return (
        <Suspense
            fallback={
                <div className="space-y-6 animate-pulse">
                    <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded" />
                    <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl" />
                    <div className="h-48 bg-gray-200 dark:bg-gray-800 rounded-xl" />
                </div>
            }
        >
            {children}
        </Suspense>
    );
}
