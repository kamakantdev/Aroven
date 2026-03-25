import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
    return clsx(inputs);
}

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(amount);
}

export function formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

export function formatTime(date: string | Date): string {
    return new Date(date).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function formatDateTime(date: string | Date): string {
    return `${formatDate(date)} at ${formatTime(date)}`;
}

export function getInitials(name: string): string {
    if (!name || !name.trim()) return '??';
    return name
        .trim()
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

export function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
}

// Role display names
export const ROLE_DISPLAY_NAMES: Record<string, string> = {
    admin: 'Admin',
    doctor: 'Doctor',
    patient: 'Patient',
    hospital_owner: 'Hospital',
    clinic_owner: 'Clinic',
    diagnostic_center_owner: 'Diagnostic Center',
    pharmacy_owner: 'Pharmacy',
    ambulance_operator: 'Ambulance Service',
};

// Approval status colors
export const APPROVAL_STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
    review: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    approved: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    rejected: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    suspended: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

// Role theme colors
export const ROLE_THEME_COLORS: Record<string, { primary: string; bg: string; hover: string }> = {
    admin: { primary: '#1e40af', bg: 'bg-blue-600', hover: 'hover:bg-blue-700' },
    doctor: { primary: '#059669', bg: 'bg-emerald-600', hover: 'hover:bg-emerald-700' },
    patient: { primary: '#7c3aed', bg: 'bg-violet-600', hover: 'hover:bg-violet-700' },
    hospital_owner: { primary: '#0d9488', bg: 'bg-teal-600', hover: 'hover:bg-teal-700' },
    clinic_owner: { primary: '#db2777', bg: 'bg-pink-600', hover: 'hover:bg-pink-700' },
    diagnostic_center_owner: { primary: '#7c3aed', bg: 'bg-purple-600', hover: 'hover:bg-purple-700' },
    pharmacy_owner: { primary: '#ea580c', bg: 'bg-orange-600', hover: 'hover:bg-orange-700' },
    ambulance_operator: { primary: '#dc2626', bg: 'bg-red-600', hover: 'hover:bg-red-700' },
};
