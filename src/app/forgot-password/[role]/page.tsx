'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { authApi } from '@/lib/api';

interface ForgotPasswordPageProps {
    params: Promise<{ role: string }>;
}

export default function ForgotPasswordPage({ params }: ForgotPasswordPageProps) {
    const { role } = use(params);
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const result = await authApi.forgotPassword(email);
            if (result.success) {
                setSuccess(true);
            } else {
                setError(result.error || result.message || 'Failed to send reset email. Please try again.');
            }
        } catch {
            setError('Network error. Please check your connection.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 px-4 py-12">
            <div className="w-full max-w-md">
                <Link
                    href={`/login/${role}`}
                    className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-6 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to login</span>
                </Link>

                <Card className="shadow-xl">
                    {success ? (
                        <div className="text-center py-4">
                            <div className="inline-flex p-3 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Check Your Email</h1>
                            <p className="text-gray-600 dark:text-gray-400 mt-3 text-sm leading-relaxed">
                                If an account exists with <strong>{email}</strong>, we&apos;ve sent password reset instructions to that address.
                            </p>
                            <p className="text-gray-500 dark:text-gray-500 mt-4 text-xs">
                                Didn&apos;t receive the email? Check your spam folder or{' '}
                                <button
                                    onClick={() => { setSuccess(false); setEmail(''); }}
                                    className="text-blue-600 hover:underline"
                                >
                                    try again
                                </button>
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="text-center mb-8">
                                <div className="inline-flex p-3 rounded-xl bg-blue-600 text-white mb-4">
                                    <Mail className="h-8 w-8" />
                                </div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reset Password</h1>
                                <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
                                    Enter your email address and we&apos;ll send you a link to reset your password.
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                {error && (
                                    <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                                        {error}
                                    </div>
                                )}

                                <Input
                                    label="Email Address"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    leftIcon={<Mail className="h-5 w-5" />}
                                    required
                                    autoComplete="email"
                                    autoFocus
                                />

                                <Button
                                    type="submit"
                                    isLoading={isLoading}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    Send Reset Link
                                </Button>
                            </form>
                        </>
                    )}
                </Card>

                <p className="text-center text-gray-500 dark:text-gray-500 text-sm mt-6">
                    © {new Date().getFullYear()} Swastik Healthcare. All rights reserved.
                </p>
            </div>
        </div>
    );
}
