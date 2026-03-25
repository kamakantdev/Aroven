import { create } from 'zustand';
import { doctorApi, appointmentsApi, consultationsApi } from '../lib/api';

// ==================== Types ====================

export interface DoctorDashboardStats {
    totalPatientsToday: number;
    completedToday: number;
    earningsToday: number;
    /** Legacy aliases for UI compatibility */
    todaysAppointments?: number;
    completed?: number;
    pending?: number;
    todaysEarnings?: number;
}

export interface Appointment {
    id: string;
    patientName: string;
    patientId: string;
    time: string;
    date?: string;
    appointment_date?: string;
    time_slot?: string;
    timeSlot?: string;
    type: 'In-Person' | 'Video' | 'video' | 'clinic';
    status: string;
    reason?: string;
    fee?: number;
    notes?: string;
    patient?: { id: string; name: string; phone?: string };
    doctor?: { id: string; name: string; specialization?: string };
}

export interface Consultation {
    id: string;
    appointmentId: string;
    patientName: string;
    status: string;
    type?: string;
    startedAt?: string;
    endedAt?: string;
    created_at?: string;
    appointment?: {
        id?: string;
        appointment_date?: string;
        time_slot?: string;
        type?: string;
    };
}

export interface DoctorPatient {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    age?: number;
    gender?: string;
    lastVisit?: string;
    totalVisits?: number;
}

export interface TimeSlot {
    id?: string;
    day: string;
    startTime: string;
    endTime: string;
    isAvailable: boolean;
}

export interface Prescription {
    id: string;
    patientName?: string;
    patientId?: string;
    consultationId?: string;
    medications?: Record<string, unknown>[];
    diagnosis?: string;
    notes?: string;
    status?: string;
    followUpDate?: string;
    created_at?: string;
}

export interface PatientVitals {
    id: string;
    patientName?: string;
    patientId?: string;
    heartRate?: number;
    bloodPressure?: string;
    temperature?: number;
    oxygenSaturation?: number;
    oxygenLevel?: number;
    respiratoryRate?: number;
    bloodSugar?: number;
    weight?: number;
    notes?: string;
    recordedAt?: string;
    created_at?: string;
}

interface DoctorState {
    stats: DoctorDashboardStats | null;
    todaysAppointments: Appointment[];
    upcomingAppointments: Appointment[];
    appointments: Appointment[];
    consultations: Consultation[];
    patients: DoctorPatient[];
    schedule: TimeSlot[];
    prescriptions: Prescription[];
    vitals: PatientVitals[];
    isLoading: boolean;
    loadingDashboard: boolean;
    loadingAppointments: boolean;
    loadingConsultations: boolean;
    loadingPatients: boolean;
    loadingSchedule: boolean;
    loadingPrescriptions: boolean;
    loadingVitals: boolean;
    error: string | null;

    // Pagination state
    appointmentsPagination: { page: number; totalPages: number; total: number; hasMore: boolean };
    prescriptionsPagination: { page: number; totalPages: number; total: number; hasMore: boolean };
    vitalsPagination: { page: number; totalPages: number; total: number; hasMore: boolean };
    patientsPagination: { page: number; totalPages: number; total: number; hasMore: boolean };

    clearError: () => void;
    reset: () => void;
    fetchDashboardData: () => Promise<void>;
    fetchAppointments: (status?: string, date?: string, page?: number) => Promise<void>;
    fetchConsultations: () => Promise<void>;
    fetchPatients: (page?: number) => Promise<void>;
    fetchSchedule: () => Promise<void>;
    fetchPrescriptions: (page?: number) => Promise<void>;
    fetchVitals: (page?: number, patientId?: string) => Promise<void>;
    loadMoreAppointments: (status?: string, date?: string) => Promise<void>;
    loadMorePrescriptions: () => Promise<void>;
    loadMoreVitals: (patientId?: string) => Promise<void>;
    loadMorePatients: () => Promise<void>;
    recordVitals: (patientId: string, data: Record<string, unknown>) => Promise<boolean>;
    updateSchedule: (slots: Record<string, unknown>[]) => Promise<boolean>;
    startConsultation: (appointmentId: string) => Promise<string | false>;
    completeAppointment: (appointmentId: string) => Promise<boolean>;
    cancelAppointment: (appointmentId: string, reason?: string) => Promise<boolean>;
    updateAvailability: (isAvailable: boolean) => Promise<boolean>;
}

// ==================== Store ====================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAppointment(raw: any): Appointment {
    return {
        ...raw,
        patientName: raw.patientName || raw.patient?.name || 'Patient',
        patientId: raw.patientId || raw.patient_id || raw.patient?.id || '',
        time: raw.time || raw.time_slot || raw.timeSlot || '',
        date: raw.date || raw.appointment_date || '',
        appointment_date: raw.appointment_date || raw.date || '',
        timeSlot: raw.timeSlot || raw.time_slot || raw.time || '',
        type: raw.type || 'clinic',
        status: raw.status || 'scheduled',
    };
}

const defaultPagination = { page: 1, totalPages: 1, total: 0, hasMore: false };

const doctorInitialState = {
    stats: null as DoctorDashboardStats | null,
    todaysAppointments: [] as Appointment[],
    upcomingAppointments: [] as Appointment[],
    appointments: [] as Appointment[],
    consultations: [] as Consultation[],
    patients: [] as DoctorPatient[],
    schedule: [] as TimeSlot[],
    prescriptions: [] as Prescription[],
    vitals: [] as PatientVitals[],
    isLoading: false,
    loadingDashboard: false,
    loadingAppointments: false,
    loadingConsultations: false,
    loadingPatients: false,
    loadingSchedule: false,
    loadingPrescriptions: false,
    loadingVitals: false,
    error: null as string | null,
    appointmentsPagination: { ...defaultPagination },
    prescriptionsPagination: { ...defaultPagination },
    vitalsPagination: { ...defaultPagination },
    patientsPagination: { ...defaultPagination },
};

export const useDoctorStore = create<DoctorState>((set, get) => ({
    ...doctorInitialState,

    clearError: () => set({ error: null }),
    reset: () => set({ ...doctorInitialState }),

    fetchDashboardData: async () => {
        set({ loadingDashboard: true, isLoading: true, error: null });
        try {
            const response = await doctorApi.getDashboard();
            if (!response.success) {
                set({
                    error: response.error || 'Failed to load dashboard',
                    loadingDashboard: false,
                    isLoading: false,
                });
                return;
            }
            const data = response.data as Record<string, unknown>;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rawToday = ((data.todayAppointments || data.todaysAppointments) as any[]) || [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rawUpcoming = (data.upcomingAppointments as any[]) || [];
            set({
                stats: (data.stats as DoctorDashboardStats) || null,
                todaysAppointments: rawToday.map(mapAppointment),
                upcomingAppointments: rawUpcoming.map(mapAppointment),
                loadingDashboard: false,
                isLoading: false,
            });
        } catch (error) {
            console.error('Error fetching doctor dashboard:', error);
            set({
                error: 'Failed to connect to server. Please check your connection.',
                loadingDashboard: false,
                isLoading: false,
            });
        }
    },

    fetchAppointments: async (status?: string, date?: string, page: number = 1) => {
        set({ loadingAppointments: true, error: null });
        try {
            const response = await doctorApi.getAppointments(status, date, page);
            if (!response.success) {
                set({ error: response.error || 'Failed to load appointments', loadingAppointments: false });
                return;
            }
            // After fetchWithAuth unwrap, response.data IS the array;
            // pagination is preserved as response.pagination
             
            const rawData = response.data;
            const rawAppointments = (Array.isArray(rawData) ? rawData : (rawData as any)?.appointments || (rawData as any)?.data || []) as any[];
            const pagination = (response as any).pagination as Record<string, number> | undefined;
            const mapped = rawAppointments.map(mapAppointment);
            set({
                appointments: page === 1 ? mapped : [...get().appointments, ...mapped],
                appointmentsPagination: pagination ? {
                    page: pagination.page || page,
                    totalPages: pagination.totalPages || 1,
                    total: pagination.total || mapped.length,
                    hasMore: (pagination.page || page) < (pagination.totalPages || 1),
                } : { page, totalPages: 1, total: mapped.length, hasMore: false },
                loadingAppointments: false,
            });
        } catch (error) {
            console.error('Error fetching appointments:', error);
            set({ error: 'Failed to load appointments.', loadingAppointments: false });
        }
    },

    fetchConsultations: async () => {
        set({ loadingConsultations: true, error: null });
        try {
            const response = await consultationsApi.getAll();
            if (!response.success) {
                set({ error: response.error || 'Failed to load consultations', loadingConsultations: false });
                return;
            }
            // After fetchWithAuth unwrap, response.data IS the array
            const rawData = response.data;
            const consultationsList = Array.isArray(rawData) ? rawData : (rawData as any)?.consultations || (rawData as any)?.data || [];
            set({
                consultations: consultationsList as Consultation[],
                loadingConsultations: false,
            });
        } catch (error) {
            console.error('Error fetching consultations:', error);
            set({ error: 'Failed to load consultations.', loadingConsultations: false });
        }
    },

    fetchPatients: async (page: number = 1) => {
        set({ loadingPatients: true, error: null });
        try {
            const response = await doctorApi.getPatients(page);
            if (!response.success) {
                set({ error: response.error || 'Failed to load patients', loadingPatients: false });
                return;
            }
            // After fetchWithAuth unwrap, response.data IS the array;
            // pagination is preserved as response.pagination
            const rawData = response.data;
            const patients = (Array.isArray(rawData) ? rawData : (rawData as any)?.patients || (rawData as any)?.data || []) as DoctorPatient[];
            const pagination = (response as any).pagination as Record<string, number> | undefined;
            set({
                patients: page === 1 ? patients : [...get().patients, ...patients],
                patientsPagination: pagination ? {
                    page: pagination.page || page,
                    totalPages: pagination.totalPages || 1,
                    total: pagination.total || patients.length,
                    hasMore: (pagination.page || page) < (pagination.totalPages || 1),
                } : { page, totalPages: 1, total: patients.length, hasMore: false },
                loadingPatients: false,
            });
        } catch (error) {
            console.error('Error fetching patients:', error);
            set({ error: 'Failed to load patients.', loadingPatients: false });
        }
    },

    fetchSchedule: async () => {
        set({ loadingSchedule: true, error: null });
        try {
            const result = await doctorApi.getSchedule();
            if (!result.success) {
                set({ error: result.error || 'Failed to load schedule', loadingSchedule: false });
                return;
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const apiData = (result.data as any)?.slots ?? result.data ?? [];
            set({ schedule: Array.isArray(apiData) ? apiData : [], loadingSchedule: false });
        } catch (error) {
            console.error('Error fetching schedule:', error);
            set({ error: 'Failed to load schedule.', loadingSchedule: false });
        }
    },

    fetchPrescriptions: async (page = 1) => {
        set({ loadingPrescriptions: true, error: null });
        try {
            const response = await doctorApi.getPrescriptions(page);
            if (!response.success) {
                set({ error: response.error || 'Failed to load prescriptions', loadingPrescriptions: false });
                return;
            }
            // After fetchWithAuth unwrap, response.data IS the array;
            // pagination is preserved as response.pagination
            const rawData = response.data;
            const prescriptions = (Array.isArray(rawData) ? rawData : (rawData as any)?.prescriptions || (rawData as any)?.data || []) as Prescription[];
            const pagination = (response as any).pagination as Record<string, number> | undefined;
            set({
                prescriptions: page === 1 ? prescriptions : [...get().prescriptions, ...prescriptions],
                prescriptionsPagination: pagination ? {
                    page: pagination.page || page,
                    totalPages: pagination.totalPages || 1,
                    total: pagination.total || prescriptions.length,
                    hasMore: (pagination.page || page) < (pagination.totalPages || 1),
                } : { page, totalPages: 1, total: prescriptions.length, hasMore: false },
                loadingPrescriptions: false,
            });
        } catch (error) {
            console.error('Error fetching prescriptions:', error);
            set({ error: 'Failed to load prescriptions.', loadingPrescriptions: false });
        }
    },

    fetchVitals: async (page = 1, patientId?: string) => {
        set({ loadingVitals: true, error: null });
        try {
            const response = await doctorApi.getPatientVitals(page, patientId);
            if (!response.success) {
                set({ error: response.error || 'Failed to load vitals', loadingVitals: false });
                return;
            }
            // After fetchWithAuth unwrap, response.data IS the array;
            // pagination is preserved as response.pagination
            const rawData = response.data;
            const vitals = (Array.isArray(rawData) ? rawData : (rawData as any)?.vitals || (rawData as any)?.data || []) as PatientVitals[];
            const pagination = (response as any).pagination as Record<string, number> | undefined;
            set({
                vitals: page === 1 ? vitals : [...get().vitals, ...vitals],
                vitalsPagination: pagination ? {
                    page: pagination.page || page,
                    totalPages: pagination.totalPages || 1,
                    total: pagination.total || vitals.length,
                    hasMore: (pagination.page || page) < (pagination.totalPages || 1),
                } : { page, totalPages: 1, total: vitals.length, hasMore: false },
                loadingVitals: false,
            });
        } catch (error) {
            console.error('Error fetching vitals:', error);
            set({ error: 'Failed to load vitals.', loadingVitals: false });
        }
    },

    // ==================== Load More Helpers ====================
    loadMoreAppointments: async (status?: string, date?: string) => {
        const { appointmentsPagination } = get();
        if (!appointmentsPagination.hasMore) return;
        await get().fetchAppointments(status, date, appointmentsPagination.page + 1);
    },

    loadMorePrescriptions: async () => {
        const { prescriptionsPagination } = get();
        if (!prescriptionsPagination.hasMore) return;
        await get().fetchPrescriptions(prescriptionsPagination.page + 1);
    },

    loadMoreVitals: async (patientId?: string) => {
        const { vitalsPagination } = get();
        if (!vitalsPagination.hasMore) return;
        await get().fetchVitals(vitalsPagination.page + 1, patientId);
    },

    loadMorePatients: async () => {
        const { patientsPagination } = get();
        if (!patientsPagination.hasMore) return;
        await get().fetchPatients(patientsPagination.page + 1);
    },

    recordVitals: async (patientId, data) => {
        try {
            const response = await doctorApi.recordPatientVitals(patientId, data);
            if (response.success) {
                get().fetchVitals();
                return true;
            }
            set({ error: response.error || 'Failed to record vitals' });
            return false;
        } catch (error) {
            console.error('Error recording vitals:', error);
            set({ error: 'Failed to record vitals.' });
            return false;
        }
    },

    updateSchedule: async (slots) => {
        try {
            const response = await doctorApi.updateSchedule(slots);
            if (response.success) {
                get().fetchSchedule();
                return true;
            }
            set({ error: response.error || 'Failed to update schedule' });
            return false;
        } catch (error) {
            console.error('Error updating schedule:', error);
            set({ error: 'Failed to update schedule.' });
            return false;
        }
    },

    startConsultation: async (appointmentId) => {
        try {
            const response = await consultationsApi.start(appointmentId);
            if (response.success) {
                const data = response.data as any;
                const consultationId = data?.id || data?.consultation?.id || data?.consultationId;
                get().fetchDashboardData();
                return consultationId || 'started';
            }
            set({ error: response.error || 'Failed to start consultation' });
            return false;
        } catch (error) {
            console.error('Error starting consultation:', error);
            set({ error: 'Failed to start consultation.' });
            return false;
        }
    },

    completeAppointment: async (appointmentId) => {
        try {
            const response = await appointmentsApi.updateStatus(appointmentId, 'completed');
            if (response.success) {
                get().fetchAppointments();
                get().fetchDashboardData();
                return true;
            }
            set({ error: response.error || 'Failed to complete appointment' });
            return false;
        } catch (error) {
            console.error('Error completing appointment:', error);
            return false;
        }
    },

    cancelAppointment: async (appointmentId, reason) => {
        try {
            const response = await appointmentsApi.updateStatus(appointmentId, 'cancelled', reason);
            if (response.success) {
                get().fetchAppointments();
                get().fetchDashboardData();
                return true;
            }
            set({ error: response.error || 'Failed to cancel appointment' });
            return false;
        } catch (error) {
            console.error('Error cancelling appointment:', error);
            return false;
        }
    },

    updateAvailability: async (isAvailable) => {
        try {
            const response = await doctorApi.updateAvailability(isAvailable);
            if (!response.success) {
                set({ error: response.error || 'Failed to update availability' });
            }
            return response.success;
        } catch (error) {
            console.error('Error updating availability:', error);
            return false;
        }
    },
}));
