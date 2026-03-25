'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Stethoscope,
    Building2,
    Pill,
    Building,
    Microscope,
    Mail,
    Lock,
    User,
    Phone,
    FileText,
    MapPin,
    ArrowLeft,
    Eye,
    EyeOff,
    Briefcase,
    CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { useAuthStore, type UserRole, ROLE_HOME_ROUTES } from '@/stores/authStore';
import LocationPicker from '@/components/shared/LocationPickerDynamic';

// Role configurations (Must match Login Page for consistency)
// Note: Admin is intentionally excluded — admins are created by existing admins only
const ROLE_CONFIG: Record<string, {
    role: UserRole;
    title: string;
    subtitle: string;
    icon: any;
    color: string;
    bgColor: string;
    hoverColor: string;
}> = {
    doctor: {
        role: 'doctor',
        title: 'Doctor Registration',
        subtitle: 'Join our medical network',
        icon: Stethoscope,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-600',
        hoverColor: 'hover:bg-emerald-700',
    },
    hospital: {
        role: 'hospital_owner',
        title: 'Hospital Registration',
        subtitle: 'Register your medical facility',
        icon: Building2,
        color: 'text-teal-600',
        bgColor: 'bg-teal-600',
        hoverColor: 'hover:bg-teal-700',
    },
    clinic: {
        role: 'clinic_owner',
        title: 'Clinic Registration',
        subtitle: 'Register your clinic',
        icon: Building,
        color: 'text-pink-600',
        bgColor: 'bg-pink-600',
        hoverColor: 'hover:bg-pink-700',
    },
    pharmacy: {
        role: 'pharmacy_owner',
        title: 'Pharmacy Registration',
        subtitle: 'Register your pharmacy',
        icon: Pill,
        color: 'text-orange-600',
        bgColor: 'bg-orange-600',
        hoverColor: 'hover:bg-orange-700',
    },
    'diagnostic-center': {
        role: 'diagnostic_center_owner',
        title: 'Diagnostic Center Registration',
        subtitle: 'Register your diagnostic center',
        icon: Microscope,
        color: 'text-purple-600',
        bgColor: 'bg-purple-600',
        hoverColor: 'hover:bg-purple-700',
    },
};

interface RegisterPageProps {
    params: Promise<{
        role: string;
    }>;
}

export default function RegisterPage({ params }: RegisterPageProps) {
    const { role } = use(params);
    const router = useRouter();
    const { register } = useAuthStore();

    // Common State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Role Specific State
    const [licenseNumber, setLicenseNumber] = useState('');
    const [specialization, setSpecialization] = useState('');
    const [address, setAddress] = useState('');
    const [experience, setExperience] = useState('');
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);

    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [verificationSent, setVerificationSent] = useState(false);

    const config = ROLE_CONFIG[role];

    if (!config) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <Card className="max-w-md w-full text-center">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Invalid Registration Portal</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">This portal does not exist.</p>
                    <Link href="/" className="text-blue-600 hover:underline mt-4 inline-block">
                        Go back home
                    </Link>
                </Card>
            </div>
        );
    }

    const Icon = config.icon;

    // ── Form Validation ────────────────────────────────────────────
    const validate = (): boolean => {
        const errors: Record<string, string> = {};

        // Name
        if (!name.trim()) errors.name = 'Name is required';
        else if (name.trim().length < 2) errors.name = 'Name must be at least 2 characters';

        // Email
        if (!email.trim()) errors.email = 'Email is required';
        else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) errors.email = 'Invalid email address';

        // Phone (optional)
        if (phone.trim() && !/^[+]?\d{10,15}$/.test(phone.replace(/[\s-]/g, ''))) errors.phone = 'Enter a valid phone number (10–15 digits)';

        // Password
        if (!password) errors.password = 'Password is required';
        else if (password.length < 8) errors.password = 'Password must be at least 8 characters';
        else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) errors.password = 'Must include uppercase, lowercase, and a number';

        // Confirm password
        if (!confirmPassword) errors.confirmPassword = 'Please confirm your password';
        else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';

        // Role-specific
        if (config.role === 'doctor') {
            if (!licenseNumber.trim()) errors.licenseNumber = 'License number is required';
            if (!specialization.trim()) errors.specialization = 'Specialization is required';
        } else {
            if (!licenseNumber.trim()) errors.licenseNumber = 'License/Registration number is required';
            if (!address.trim()) errors.address = 'Address is required';
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!validate()) return;

        setIsLoading(true);

        try {
            // Construct data payload based on role
            const baseData = {
                name,
                email,
                phone,
                password,
            };

            let roleData = {};

            switch (config.role) {
                case 'doctor':
                    roleData = {
                        specialization,
                        license_number: licenseNumber,
                        experience_years: experience
                    };
                    break;
                case 'pharmacy_owner':
                case 'hospital_owner':
                case 'clinic_owner':
                case 'diagnostic_center_owner':
                    roleData = {
                        license_number: licenseNumber,
                        address,
                        ...(latitude && longitude ? { latitude, longitude } : {}),
                    };
                    break;
            }

            const result = await register({ ...baseData, ...roleData }, config.role);

            if (result.success) {
                // Show email verification success screen
                setVerificationSent(true);
            } else {
                setError(result.error || 'Registration failed');
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred');
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
                    <span>Back to Login</span>
                </Link>

                <Card className="shadow-xl">
                    {verificationSent ? (
                        <div className="text-center py-6">
                            <div className="inline-flex p-3 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Verify Your Email</h1>
                            <p className="text-gray-600 dark:text-gray-400 mt-3 text-sm leading-relaxed max-w-xs mx-auto">
                                We&apos;ve sent a verification link to <strong>{email}</strong>. Please check your inbox and click the link to activate your account.
                            </p>
                            <div className="mt-6 space-y-3">
                                <Link href={`/login/${role}`}>
                                    <Button className={`w-full ${config.bgColor} ${config.hoverColor} text-white`}>
                                        Go to Login
                                    </Button>
                                </Link>
                                <p className="text-gray-500 dark:text-gray-500 text-xs">
                                    Didn&apos;t receive it? Check your spam folder or try logging in — we&apos;ll offer to resend the verification email.
                                </p>
                            </div>
                        </div>
                    ) : (
                    <>
                    <div className="text-center mb-8">
                        <div className={`inline-flex p-3 rounded-xl ${config.bgColor} text-white mb-4`}>
                            <Icon className="h-8 w-8" />
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{config.title}</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">{config.subtitle}</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <Input
                            label="Full Name"
                            value={name}
                            onChange={(e) => { setName(e.target.value); setFieldErrors(p => { const { name, ...rest } = p; return rest; }); }}
                            placeholder="Enter full name"
                            leftIcon={<User className="h-5 w-5" />}
                            error={fieldErrors.name}
                            required
                        />

                        <Input
                            label="Email Address"
                            type="email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setFieldErrors(p => { const { email, ...rest } = p; return rest; }); }}
                            placeholder="Enter email"
                            leftIcon={<Mail className="h-5 w-5" />}
                            error={fieldErrors.email}
                            required
                        />

                        <Input
                            label="Phone Number (optional)"
                            value={phone}
                            onChange={(e) => { setPhone(e.target.value); setFieldErrors(p => { const { phone, ...rest } = p; return rest; }); }}
                            placeholder="Enter phone number"
                            leftIcon={<Phone className="h-5 w-5" />}
                            error={fieldErrors.phone}
                        />

                        {/* Role Specific Fields */}
                        {config.role === 'doctor' && (
                            <>
                                <Input
                                    label="Specialization"
                                    value={specialization}
                                    onChange={(e) => { setSpecialization(e.target.value); setFieldErrors(p => { const { specialization, ...rest } = p; return rest; }); }}
                                    placeholder="Enter specialization"
                                    leftIcon={<Briefcase className="h-5 w-5" />}
                                    error={fieldErrors.specialization}
                                    required
                                />
                                <Input
                                    label="Medical License Number"
                                    value={licenseNumber}
                                    onChange={(e) => { setLicenseNumber(e.target.value); setFieldErrors(p => { const { licenseNumber, ...rest } = p; return rest; }); }}
                                    placeholder="License #"
                                    leftIcon={<FileText className="h-5 w-5" />}
                                    error={fieldErrors.licenseNumber}
                                    required
                                />
                                <Input
                                    label="Years of Experience"
                                    type="number"
                                    value={experience}
                                    onChange={(e) => setExperience(e.target.value)}
                                    placeholder="Enter years of experience"
                                    required
                                />
                            </>
                        )}

                        {(config.role === 'pharmacy_owner' || config.role === 'hospital_owner' || config.role === 'clinic_owner' || config.role === 'diagnostic_center_owner') && (
                            <>
                                <Input
                                    label="License Number"
                                    value={licenseNumber}
                                    onChange={(e) => { setLicenseNumber(e.target.value); setFieldErrors(p => { const { licenseNumber, ...rest } = p; return rest; }); }}
                                    placeholder="License #"
                                    leftIcon={<FileText className="h-5 w-5" />}
                                    error={fieldErrors.licenseNumber}
                                    required
                                />
                                <Input
                                    label="Address"
                                    value={address}
                                    onChange={(e) => { setAddress(e.target.value); setFieldErrors(p => { const { address, ...rest } = p; return rest; }); }}
                                    placeholder="Full Address"
                                    leftIcon={<MapPin className="h-5 w-5" />}
                                    error={fieldErrors.address}
                                    required
                                />
                                <LocationPicker
                                    latitude={latitude}
                                    longitude={longitude}
                                    address={address}
                                    onLocationChange={(lat, lng) => {
                                        if (lat === 0 && lng === 0) {
                                            setLatitude(null);
                                            setLongitude(null);
                                        } else {
                                            setLatitude(lat);
                                            setLongitude(lng);
                                        }
                                    }}
                                    accentColor={config.bgColor.replace('bg-', '').replace('-600', '')}
                                    label="Pin your facility on the map"
                                    height="250px"
                                />
                            </>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setFieldErrors(p => { const { password, ...rest } = p; return rest; }); }}
                                placeholder="******"
                                leftIcon={<Lock className="h-5 w-5" />}
                                error={fieldErrors.password}
                                rightIcon={
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="hover:text-gray-600 dark:text-gray-400"
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                }
                                required
                            />
                            <Input
                                label="Confirm Password"
                                type={showPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors(p => { const { confirmPassword, ...rest } = p; return rest; }); }}
                                placeholder="******"
                                leftIcon={<Lock className="h-5 w-5" />}
                                error={fieldErrors.confirmPassword}
                                required
                            />
                        </div>

                        <Button
                            type="submit"
                            isLoading={isLoading}
                            className={`w-full ${config.bgColor} ${config.hoverColor} text-white mt-6`}
                        >
                            Complete Registration
                        </Button>
                    </form>

                    <p className="text-center text-gray-600 dark:text-gray-400 mt-6 text-sm">
                        Already have an account?{' '}
                        <Link href={`/login/${role}`} className={`${config.color} hover:underline font-medium`}>
                            Sign In
                        </Link>
                    </p>
                    </>
                    )}
                </Card>
            </div>
        </div>
    );
}
