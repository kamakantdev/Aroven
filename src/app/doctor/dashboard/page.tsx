'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect /doctor/dashboard → /doctor
 * The main doctor dashboard is at /doctor/page.tsx
 */
export default function DoctorDashboardRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/doctor');
    }, [router]);

    return (
        <div className="min-h-[400px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
    );
}
