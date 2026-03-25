import { create } from 'zustand';
import { clinicApi } from '../lib/api';

// ==================== Types ====================

export interface ClinicDashboardStats {
    totalStaff: number;
    todaysAppointments: number;
    walkInsToday: number;
    repeatPatients: string;
}

export interface ClinicAppointment {
    id: string;
    patientName: string;
    patientId: string;
    date?: string | null;
    time: string;
    type: string;
    status: string;
    doctorName: string;
}

export interface ClinicDoctor {
    id: string;
    name: string;
    specialization: string;
    status: 'active' | 'on-leave' | 'inactive';
}

function normalizeClinicDoctor(raw: Record<string, any>): ClinicDoctor {
    const doctor = (raw.doctor || raw) as Record<string, any>;
    return {
        id: doctor.id || raw.doctor_id || raw.id || '',
        name: doctor.name || raw.name || 'Doctor',
        specialization: doctor.specialization || raw.specialization || '',
        status: raw.is_active === false ? 'inactive' : (raw.status || 'active'),
    } as ClinicDoctor;
}

function normalizeClinicAppointment(raw: Record<string, any>): ClinicAppointment {
    return {
        ...raw,
        patientName: raw.patientName || raw.patient?.name || 'Patient',
        patientId: raw.patientId || raw.patient_id || raw.patient?.id || '',
        time: raw.time || raw.time_slot || '',
        type: raw.type || 'Scheduled',
        status: raw.status || 'pending',
        doctorName: raw.doctorName || raw.doctor?.name || 'Doctor',
        date: raw.date || raw.appointment_date || null,
    } as ClinicAppointment & { date?: string | null };
}

interface ClinicState {
    stats: ClinicDashboardStats | null;
    todaysAppointments: ClinicAppointment[];
    appointments: ClinicAppointment[];
    doctors: ClinicDoctor[];
    /** Alias for doctors — used by clinic/staff/page.tsx */
    staff: ClinicDoctor[];
    schedule: Record<string, unknown> | null;
    isLoading: boolean;
    loadingDashboard: boolean;
    loadingAppointments: boolean;
    loadingDoctors: boolean;
    loadingSchedule: boolean;
    error: string | null;

    fetchDashboardData: () => Promise<void>;
    fetchAppointments: (date?: string) => Promise<void>;
    fetchDoctors: () => Promise<void>;
    fetchSchedule: () => Promise<void>;
    updateSchedule: (schedule: Record<string, unknown>) => Promise<boolean>;
    addDoctor: (data: Record<string, string>) => Promise<boolean>;
    removeDoctor: (doctorId: string) => Promise<boolean>;
    clearError: () => void;
    reset: () => void;
}

// ==================== Store ====================

const clinicInitialState = {
    stats: null as ClinicDashboardStats | null,
    todaysAppointments: [] as ClinicAppointment[],
    appointments: [] as ClinicAppointment[],
    doctors: [] as ClinicDoctor[],
    staff: [] as ClinicDoctor[],
    schedule: null as Record<string, unknown> | null,
    isLoading: false,
    loadingDashboard: false,
    loadingAppointments: false,
    loadingDoctors: false,
    loadingSchedule: false,
    error: null as string | null,
};

export const useClinicStore = create<ClinicState>((set, get) => ({
    ...clinicInitialState,

    clearError: () => set({ error: null }),
    reset: () => set({ ...clinicInitialState }),

    fetchDashboardData: async () => {
        set({ loadingDashboard: true, isLoading: true, error: null });
        try {
            const response = await clinicApi.getDashboard();
            if (!response.success) {
                set({
                    error: response.error || 'Failed to load clinic dashboard',
                    loadingDashboard: false,
                    isLoading: false,
                });
                return;
            }
            const data = response.data as Record<string, unknown>;
            const rawStats = (data.stats || {}) as Record<string, unknown>;
            const recentAppointments = ((data.recentAppointments || data.appointments || []) as Record<string, any>[]).map(normalizeClinicAppointment);
            const todayListRaw = ((data.todayAppointments || data.todaysAppointments || recentAppointments) as Record<string, any>[]);
            const todaysAppointments = todayListRaw
                .map(normalizeClinicAppointment)
                .filter((a) => {
                    if (!a.date) return false;
                    return new Date(a.date).toDateString() === new Date().toDateString();
                });
            const doctorsList = ((data.staff || data.doctors || []) as Record<string, any>[]).map(normalizeClinicDoctor);

            const normalizedStats: ClinicDashboardStats = {
                totalStaff: Number(rawStats.totalStaff || rawStats.totalDoctors || doctorsList.length || 0),
                todaysAppointments: Number(rawStats.todaysAppointments || rawStats.todayAppointments || todaysAppointments.length || 0),
                walkInsToday: Number(rawStats.walkInsToday || 0),
                repeatPatients: String(rawStats.repeatPatients || '0%'),
            };

            set({
                stats: normalizedStats,
                todaysAppointments,
                doctors: doctorsList,
                staff: doctorsList,
                loadingDashboard: false,
                isLoading: false,
            });
        } catch (error) {
            console.error('Error fetching clinic dashboard:', error);
            set({
                error: 'Failed to connect to server. Please check your connection.',
                loadingDashboard: false,
                isLoading: false,
            });
        }
    },

    fetchAppointments: async (date?: string) => {
        set({ loadingAppointments: true, error: null });
        try {
            const response = await clinicApi.getAppointments(date);
            if (!response.success) {
                set({ error: response.error || 'Failed to load appointments', loadingAppointments: false });
                return;
            }
            // After fetchWithAuth unwrap, response.data IS the array
            const rawData = response.data;
            const appointments = (Array.isArray(rawData) ? rawData : (rawData as any)?.appointments || (rawData as any)?.data || []) as Record<string, any>[];
            set({
                appointments: appointments.map(normalizeClinicAppointment),
                loadingAppointments: false,
            });
        } catch (error) {
            console.error('Error fetching appointments:', error);
            set({ error: 'Failed to load appointments.', loadingAppointments: false });
        }
    },

    fetchDoctors: async () => {
        set({ loadingDoctors: true, error: null });
        try {
            const response = await clinicApi.getDoctors();
            if (!response.success) {
                set({ error: response.error || 'Failed to load doctors', loadingDoctors: false });
                return;
            }
            // After fetchWithAuth unwrap, response.data IS the array
            const rawData = response.data;
            const doctorsList = (Array.isArray(rawData) ? rawData : (rawData as any)?.doctors || (rawData as any)?.data || [])
                .map((d: Record<string, any>) => normalizeClinicDoctor(d)) as ClinicDoctor[];
            set({
                doctors: doctorsList,
                staff: doctorsList,
                loadingDoctors: false,
            });
        } catch (error) {
            console.error('Error fetching doctors:', error);
            set({ error: 'Failed to load doctors.', loadingDoctors: false });
        }
    },

    fetchSchedule: async () => {
        set({ loadingSchedule: true, error: null });
        try {
            const response = await clinicApi.getSchedule();
            if (!response.success) {
                set({ error: response.error || 'Failed to load schedule', loadingSchedule: false });
                return;
            }
            const data = response.data as Record<string, unknown>;
            set({
                schedule: (data.schedule || data.data || data) as Record<string, unknown>,
                loadingSchedule: false,
            });
        } catch (error) {
            console.error('Error fetching schedule:', error);
            set({ error: 'Failed to load schedule.', loadingSchedule: false });
        }
    },

    updateSchedule: async (schedule) => {
        try {
            const response = await clinicApi.updateSchedule(schedule);
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

    addDoctor: async (data) => {
        try {
            const response = await clinicApi.addDoctor(data);
            if (response.success) {
                get().fetchDoctors();
                get().fetchDashboardData();
                return true;
            }
            set({ error: response.error || 'Failed to add doctor' });
            return false;
        } catch (error) {
            console.error('Error adding doctor:', error);
            set({ error: 'Failed to add doctor.' });
            return false;
        }
    },

    removeDoctor: async (doctorId) => {
        try {
            // Support both flattened doctor ID and nested association ID payloads
            const targetDoctorId = get().doctors.find((d) => d.id === doctorId)?.id || doctorId;
            const response = await clinicApi.removeDoctor(targetDoctorId);
            if (response.success) {
                get().fetchDoctors();
                get().fetchDashboardData();
                return true;
            }
            set({ error: response.error || 'Failed to remove doctor' });
            return false;
        } catch (error) {
            console.error('Error removing doctor:', error);
            set({ error: 'Failed to remove doctor.' });
            return false;
        }
    },
}));
