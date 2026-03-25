'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

/**
 * Layout for consultation video call pages.
 * Provides a minimal fullscreen wrapper — the video consultation page
 * manages its own back-navigation and controls.
 * SECURITY FIX #71: Added auth guard — only doctors and patients can access consultations.
 */
export default function ConsultationLayout({ children }: { children: ReactNode }) {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();

    useEffect(() => {
        if (_hasHydrated && (!isAuthenticated || !user?.role || !['doctor', 'patient'].includes(user.role))) {
            router.push('/');
        }
    }, [isAuthenticated, _hasHydrated, user, router]);

    if (!_hasHydrated || !isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900">
                <div className="animate-spin h-8 w-8 border-4 border-gray-600 border-t-blue-400 rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            {children}
        </div>
    );
}
