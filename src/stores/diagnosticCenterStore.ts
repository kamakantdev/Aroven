import { create } from 'zustand';
import { diagnosticCenterApi } from '../lib/api';

// ==================== Types ====================

export interface DiagnosticDashboardStats {
    totalTests: number;
    todaysBookings: number;
    pendingResults: number;
    totalPatients: number;
}

export interface DiagnosticTest {
    id: string;
    name: string;
    category: string;
    description?: string;
    price: number;
    discounted_price?: number;
    turnaround_hours: number;
    sample_type?: string;
    preparation_instructions?: string;
    is_active: boolean;
    created_at: string;
}

export interface DiagnosticBooking {
    id: string;
    patient_id: string;
    patient_name?: string;
    patient_email?: string;
    test_id: string;
    test_name?: string;
    booking_date: string;
    booking_time?: string;
    collection_type: 'walk_in' | 'home_collection';
    collection_address?: string;
    notes?: string;
    status: 'booked' | 'sample_collected' | 'processing' | 'completed' | 'cancelled';
    result_status: 'pending' | 'processing' | 'completed' | 'delivered';
    result_url?: string;
    result_notes?: string;
    amount?: number;
    created_at: string;
}

function normalizeDiagnosticBooking(raw: Record<string, any>): DiagnosticBooking {
    return {
        ...raw,
        patient_name: raw.patient_name || raw.patient?.name,
        patient_email: raw.patient_email || raw.patient?.email,
        test_name: raw.test_name || raw.test?.name,
        amount: raw.amount || raw.test?.price || null,
    } as DiagnosticBooking;
}

interface DiagnosticCenterState {
    stats: DiagnosticDashboardStats | null;
    tests: DiagnosticTest[];
    bookings: DiagnosticBooking[];
    results: DiagnosticBooking[];
    todaysBookings: DiagnosticBooking[];
    selectedBooking: DiagnosticBooking | null;
    isLoading: boolean;
    loadingDashboard: boolean;
    loadingTests: boolean;
    loadingBookings: boolean;
    loadingResults: boolean;
    loadingSelectedBooking: boolean;
    error: string | null;

    fetchDashboardData: () => Promise<void>;
    fetchTests: (category?: string) => Promise<void>;
    addTest: (data: Record<string, unknown>) => Promise<boolean>;
    updateTest: (testId: string, data: Record<string, unknown>) => Promise<boolean>;
    deleteTest: (testId: string) => Promise<boolean>;
    fetchBookings: (status?: string) => Promise<void>;
    fetchResults: (resultStatus?: string) => Promise<void>;
    fetchBookingById: (bookingId: string) => Promise<void>;
    updateBookingStatus: (bookingId: string, status: string) => Promise<boolean>;
    uploadResult: (bookingId: string, data: { result_url: string; result_notes?: string }) => Promise<boolean>;
    clearError: () => void;
    reset: () => void;
}

// ==================== Store ====================

const diagnosticInitialState = {
    stats: null as DiagnosticDashboardStats | null,
    tests: [] as DiagnosticTest[],
    bookings: [] as DiagnosticBooking[],
    results: [] as DiagnosticBooking[],
    todaysBookings: [] as DiagnosticBooking[],
    selectedBooking: null as DiagnosticBooking | null,
    isLoading: false,
    loadingDashboard: false,
    loadingTests: false,
    loadingBookings: false,
    loadingResults: false,
    loadingSelectedBooking: false,
    error: null as string | null,
};

export const useDiagnosticCenterStore = create<DiagnosticCenterState>((set, get) => ({
    ...diagnosticInitialState,

    clearError: () => set({ error: null }),
    reset: () => set({ ...diagnosticInitialState }),

    fetchDashboardData: async () => {
        set({ loadingDashboard: true, isLoading: true, error: null });
        try {
            const response = await diagnosticCenterApi.getDashboard();
            if (!response.success) {
                set({ error: response.error || 'Failed to load dashboard', loadingDashboard: false, isLoading: false });
                return;
            }
            const data = response.data as Record<string, unknown>;
            const rawStats = (data.stats || {}) as Record<string, unknown>;
            const todaysRaw = ((data.todaysBookings || data.todayBookings || []) as Record<string, any>[]);
            const recentBookings = ((data.recentBookings || data.bookings || []) as Record<string, any>[]).map(normalizeDiagnosticBooking);
            // Fallback: if backend doesn't provide explicit today's rows, derive from recent list by date
            const derivedToday = recentBookings.filter((b) => {
                if (!b.booking_date) return false;
                return new Date(b.booking_date).toDateString() === new Date().toDateString();
            });
            const todaysBookings = (todaysRaw.length > 0 ? todaysRaw.map(normalizeDiagnosticBooking) : derivedToday);

            const normalizedStats: DiagnosticDashboardStats = {
                totalTests: Number(rawStats.totalTests || 0),
                todaysBookings: Number(rawStats.todaysBookings || rawStats.todayBookings || todaysBookings.length || 0),
                pendingResults: Number(rawStats.pendingResults || 0),
                totalPatients: Number(rawStats.totalPatients || 0),
            };
            set({
                stats: normalizedStats,
                todaysBookings,
                loadingDashboard: false,
                isLoading: false,
            });
        } catch (error) {
            console.error('Error fetching diagnostic center dashboard:', error);
            set({ error: 'Failed to connect to server.', loadingDashboard: false, isLoading: false });
        }
    },

    fetchTests: async (category?: string) => {
        set({ loadingTests: true, error: null });
        try {
            const response = await diagnosticCenterApi.getTests(1, category);
            if (!response.success) {
                set({ error: response.error || 'Failed to load tests', loadingTests: false });
                return;
            }
            // After fetchWithAuth unwrap, response.data IS the array
            const rawData = response.data;
            set({
                tests: (Array.isArray(rawData) ? rawData : (rawData as any)?.tests || (rawData as any)?.data || []) as DiagnosticTest[],
                loadingTests: false,
            });
        } catch (error) {
            console.error('Error fetching tests:', error);
            set({ error: 'Failed to load tests.', loadingTests: false });
        }
    },

    addTest: async (data) => {
        try {
            const response = await diagnosticCenterApi.addTest(data);
            if (response.success) {
                get().fetchTests();
                return true;
            }
            set({ error: response.error || 'Failed to add test' });
            return false;
        } catch (error) {
            console.error('Error adding test:', error);
            set({ error: 'Failed to add test.' });
            return false;
        }
    },

    updateTest: async (testId, data) => {
        try {
            const response = await diagnosticCenterApi.updateTest(testId, data);
            if (response.success) {
                get().fetchTests();
                return true;
            }
            set({ error: response.error || 'Failed to update test' });
            return false;
        } catch (error) {
            console.error('Error updating test:', error);
            set({ error: 'Failed to update test.' });
            return false;
        }
    },

    deleteTest: async (testId) => {
        try {
            const response = await diagnosticCenterApi.deleteTest(testId);
            if (response.success) {
                get().fetchTests();
                return true;
            }
            set({ error: response.error || 'Failed to delete test' });
            return false;
        } catch (error) {
            console.error('Error deleting test:', error);
            set({ error: 'Failed to delete test.' });
            return false;
        }
    },

    fetchBookings: async (status?: string) => {
        set({ loadingBookings: true, error: null });
        try {
            const response = await diagnosticCenterApi.getBookings(status);
            if (!response.success) {
                set({ error: response.error || 'Failed to load bookings', loadingBookings: false });
                return;
            }
            // After fetchWithAuth unwrap, response.data IS the array
            const rawData = response.data;
            const raw = (Array.isArray(rawData) ? rawData : (rawData as any)?.bookings || (rawData as any)?.data || []) as DiagnosticBooking[];
            // I16: Deduplicate by booking ID
            const seen = new Set<string>();
            const deduped = raw
                .map(booking => normalizeDiagnosticBooking(booking as Record<string, any>))
                .filter(b => {
                if (seen.has(b.id)) return false;
                seen.add(b.id);
                return true;
                });
            set({
                bookings: deduped,
                loadingBookings: false,
            });
        } catch (error) {
            console.error('Error fetching bookings:', error);
            set({ error: 'Failed to load bookings.', loadingBookings: false });
        }
    },

    fetchResults: async (resultStatus?: string) => {
        set({ loadingResults: true, error: null });
        try {
            const response = await diagnosticCenterApi.getResults(resultStatus);
            if (!response.success) {
                set({ error: response.error || 'Failed to load results', loadingResults: false });
                return;
            }
            // After fetchWithAuth unwrap, response.data IS the array
            const rawData = response.data;
            const raw = (Array.isArray(rawData) ? rawData : (rawData as any)?.bookings || (rawData as any)?.data || []) as DiagnosticBooking[];
            // I16: Deduplicate by booking ID — API may return duplicates
            const seen = new Set<string>();
            const deduped = raw
                .map(result => normalizeDiagnosticBooking(result as Record<string, any>))
                .filter(r => {
                if (seen.has(r.id)) return false;
                seen.add(r.id);
                return true;
                });
            set({
                results: deduped,
                loadingResults: false,
            });
        } catch (error) {
            console.error('Error fetching results:', error);
            set({ error: 'Failed to load results.', loadingResults: false });
        }
    },

    // M6: Fetch single booking by ID
    fetchBookingById: async (bookingId: string) => {
        set({ loadingSelectedBooking: true, error: null });
        try {
            const response = await diagnosticCenterApi.getBookingById(bookingId);
            if (!response.success) {
                set({ error: response.error || 'Failed to load booking', loadingSelectedBooking: false });
                return;
            }
            set({
                selectedBooking: normalizeDiagnosticBooking((response.data || {}) as Record<string, any>),
                loadingSelectedBooking: false,
            });
        } catch (error) {
            console.error('Error fetching booking:', error);
            set({ error: 'Failed to load booking.', loadingSelectedBooking: false });
        }
    },

    updateBookingStatus: async (bookingId, status) => {
        try {
            const response = await diagnosticCenterApi.updateBookingStatus(bookingId, status);
            if (response.success) {
                get().fetchBookings();
                return true;
            }
            set({ error: response.error || 'Failed to update booking status' });
            return false;
        } catch (error) {
            console.error('Error updating booking:', error);
            set({ error: 'Failed to update booking.' });
            return false;
        }
    },

    uploadResult: async (bookingId, data) => {
        try {
            const response = await diagnosticCenterApi.uploadResult(bookingId, data);
            if (response.success) {
                get().fetchBookings();
                return true;
            }
            set({ error: response.error || 'Failed to upload result' });
            return false;
        } catch (error) {
            console.error('Error uploading result:', error);
            set({ error: 'Failed to upload result.' });
            return false;
        }
    },
}));
