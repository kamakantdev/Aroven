'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { API_BASE_URL } from '@/lib/api';

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('No verification token provided. Please check your email link.');
            return;
        }

        const verifyEmail = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/auth/verify-email?token=${encodeURIComponent(token)}`);
                const data = await response.json();

                if (response.ok && data.success) {
                    setStatus('success');
                    setMessage(data.message || 'Your email has been verified successfully!');
                    // Try to extract role from response for redirect
                    if (data.user?.role) {
                        setUserRole(data.user.role);
                    }
                } else {
                    setStatus('error');
                    setMessage(data.message || 'Email verification failed. The link may have expired.');
                }
            } catch {
                setStatus('error');
                setMessage('Network error. Please check your connection and try again.');
            }
        };

        verifyEmail();
    }, [token]);

    // Map role to login URL slug
    const getLoginPath = (role: string | null): string => {
        if (!role) return '/';
        const roleMap: Record<string, string> = {
            admin: 'admin',
            doctor: 'doctor',
            patient: 'patient',
            hospital_owner: 'hospital',
            clinic_owner: 'clinic',
            diagnostic_center_owner: 'diagnostic-center',
            pharmacy_owner: 'pharmacy',
        };
        return `/login/${roleMap[role] || 'doctor'}`;
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 px-4 py-12">
            <div className="w-full max-w-md">
                <Card className="shadow-xl">
                    <div className="text-center py-6">
                        {status === 'loading' && (
                            <>
                                <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Verifying Your Email</h1>
                                <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">Please wait...</p>
                            </>
                        )}

                        {status === 'success' && (
                            <>
                                <div className="inline-flex p-3 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                                    <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
                                </div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Email Verified!</h1>
                                <p className="text-gray-600 dark:text-gray-400 mt-3 text-sm leading-relaxed">
                                    {message}
                                </p>
                                <div className="mt-6">
                                    <Link href={getLoginPath(userRole)}>
                                        <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                                            Continue to Login
                                        </Button>
                                    </Link>
                                </div>
                            </>
                        )}

                        {status === 'error' && (
                            <>
                                <div className="inline-flex p-3 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                                    <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
                                </div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Verification Failed</h1>
                                <p className="text-gray-600 dark:text-gray-400 mt-3 text-sm leading-relaxed">
                                    {message}
                                </p>
                                <div className="mt-6 space-y-3">
                                    <Link href="/">
                                        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                                            Go to Home
                                        </Button>
                                    </Link>
                                    <p className="text-gray-500 dark:text-gray-500 text-xs">
                                        If your link expired, try logging in — we&apos;ll offer to resend the verification email.
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </Card>

                <p className="text-center text-gray-500 dark:text-gray-500 text-sm mt-6">
                    © {new Date().getFullYear()} Swastik Healthcare. All rights reserved.
                </p>
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
                <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
            </div>
        }>
            <VerifyEmailContent />
        </Suspense>
    );
}