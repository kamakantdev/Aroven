'use client';

import React, { useState, use, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
    Stethoscope,
    Building2,
    Pill,
    Shield,
    Building,
    Microscope,
    Mail,
    Lock,
    Eye,
    EyeOff,
    ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { useAuthStore, type UserRole, ROLE_HOME_ROUTES } from '@/stores/authStore';
import { authApi } from '@/lib/api';

// Role configurations
const ROLE_CONFIG: Record<string, {
    role: UserRole;
    title: string;
    subtitle: string;
    icon: typeof Stethoscope;
    color: string;
    bgColor: string;
    hoverColor: string;
}> = {
    admin: {
        role: 'admin',
        title: 'Admin Portal',
        subtitle: 'Platform control center',
        icon: Shield,
        color: 'text-blue-600',
        bgColor: 'bg-blue-600',
        hoverColor: 'hover:bg-blue-700',
    },
    doctor: {
        role: 'doctor',
        title: 'Doctor Portal',
        subtitle: 'Manage your practice',
        icon: Stethoscope,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-600',
        hoverColor: 'hover:bg-emerald-700',
    },
    hospital: {
        role: 'hospital_owner',
        title: 'Hospital Portal',
        subtitle: 'Operations management',
        icon: Building2,
        color: 'text-teal-600',
        bgColor: 'bg-teal-600',
        hoverColor: 'hover:bg-teal-700',
    },
    clinic: {
        role: 'clinic_owner',
        title: 'Clinic Portal',
        subtitle: 'Scheduling & appointments',
        icon: Building,
        color: 'text-pink-600',
        bgColor: 'bg-pink-600',
        hoverColor: 'hover:bg-pink-700',
    },
    pharmacy: {
        role: 'pharmacy_owner',
        title: 'Pharmacy Portal',
        subtitle: 'Prescriptions & inventory',
        icon: Pill,
        color: 'text-orange-600',
        bgColor: 'bg-orange-600',
        hoverColor: 'hover:bg-orange-700',
    },
    'diagnostic-center': {
        role: 'diagnostic_center_owner',
        title: 'Diagnostic Center Portal',
        subtitle: 'Tests, results & reports',
        icon: Microscope,
        color: 'text-purple-600',
        bgColor: 'bg-purple-600',
        hoverColor: 'hover:bg-purple-700',
    },
};

interface LoginPageProps {
    params: Promise<{
        role: string;
    }>;
}

export default function LoginPage({ params }: LoginPageProps) {
    // Unwrap params using React.use() for Next.js 15 compatibility
    const { role } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const isExpiredRedirect = searchParams.get('expired') === '1';
    const { login } = useAuthStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [emailNotVerified, setEmailNotVerified] = useState(false);
    const [resendingVerification, setResendingVerification] = useState(false);
    const [verificationResent, setVerificationResent] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    // Cooldown timer for resend verification
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    const config = ROLE_CONFIG[role];

    if (!config) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <Card className="max-w-md w-full text-center">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Invalid Portal</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">This portal does not exist.</p>
                    <Link href="/" className="text-blue-600 hover:underline mt-4 inline-block">
                        Go back home
                    </Link>
                </Card>
            </div>
        );
    }

    const Icon = config.icon;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setEmailNotVerified(false);
        setVerificationResent(false);
        setIsLoading(true);

        try {
            const result = await login(email, password, config.role, rememberMe);

            if (result.success) {
                router.push(ROLE_HOME_ROUTES[config.role]);
            } else {
                if (result.code === 'EMAIL_NOT_VERIFIED') {
                    setEmailNotVerified(true);
                }
                setError(result.error || 'Login failed');
            }
        } catch (err) {
            setError('An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendVerification = async () => {
        if (resendCooldown > 0) return;
        setResendingVerification(true);
        try {
            const result = await authApi.resendVerification(email);
            if (result.success) {
                setVerificationResent(true);
                setError('');
                setResendCooldown(60); // 60 second cooldown
            } else {
                setError(result.message || 'Failed to resend verification email');
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setResendingVerification(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 px-4 py-12">
            <div className="w-full max-w-md">
                {/* Back to portal selection */}
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-6 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to portal selection</span>
                </Link>

                <Card className="shadow-xl">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className={`inline-flex p-3 rounded-xl ${config.bgColor} text-white mb-4`}>
                            <Icon className="h-8 w-8" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{config.title}</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">{config.subtitle}</p>
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {verificationResent && (
                            <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm">
                                Verification email sent! Please check your inbox and click the link to verify your account.
                            </div>
                        )}

                        {isExpiredRedirect && !error && (
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
                                <p className="text-amber-700 dark:text-amber-400">Your session has expired. Please sign in again.</p>
                            </div>
                        )}

                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm">
                                <p className="text-red-700 dark:text-red-400">{error}</p>
                                {emailNotVerified && email && (
                                    <button
                                        type="button"
                                        onClick={handleResendVerification}
                                        disabled={resendingVerification || resendCooldown > 0}
                                        className="mt-2 inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium text-sm disabled:opacity-50"
                                    >
                                        <Mail className="h-3.5 w-3.5" />
                                        {resendingVerification ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend verification email'}
                                    </button>
                                )}
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
                        />

                        <Input
                            label="Password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            leftIcon={<Lock className="h-5 w-5" />}
                            rightIcon={
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            }
                            required
                            autoComplete="current-password"
                        />

                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                />
                                <span className="text-gray-600 dark:text-gray-400">Remember me</span>
                            </label>
                            <Link href={`/forgot-password/${role}`} className={`${config.color} hover:underline`}>
                                Forgot password?
                            </Link>
                        </div>

                        <Button
                            type="submit"
                            isLoading={isLoading}
                            className={`w-full ${config.bgColor} ${config.hoverColor} text-white`}
                        >
                            Sign In
                        </Button>
                    </form>

                    {/* Register Link */}
                    {role !== 'admin' && (
                        <p className="text-center text-gray-600 dark:text-gray-400 mt-6 text-sm">
                            Don&apos;t have an account?{' '}
                            <Link href={`/register/${role}`} className={`${config.color} hover:underline font-medium`}>
                                Register as {config.title.replace(' Portal', '')}
                            </Link>
                        </p>
                    )}

                </Card>

                {/* Footer */}
                <p className="text-center text-gray-500 dark:text-gray-500 text-sm mt-6">
                    © {new Date().getFullYear()} Swastik Healthcare. All rights reserved.
                </p>
            </div>
        </div>
    );
}
