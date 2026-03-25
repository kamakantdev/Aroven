import { create } from 'zustand';
import { hospitalApi } from '../lib/api';

// ==================== Types ====================

export interface HospitalDashboardStats {
    totalDoctors: number;
    todayAppointments: number;
    totalAppointments: number;
    totalPatients: number;
    /** Legacy aliases for UI compatibility */
    departments?: number;
    todaysAppointments?: number;
    bedCapacity?: string;
}

export interface Department {
    id: string;
    name: string;
    doctors: number;
    appointments: number;
    head?: string;
}

export interface HospitalDoctor {
    id: string;
    name: string;
    specialization: string;
    department: string;
    status: 'active' | 'on-leave' | 'inactive';
    appointmentsToday: number;
}

function normalizeHospitalAppointment(raw: Record<string, any>): Record<string, unknown> {
    return {
        ...raw,
        patientName: raw.patientName || raw.patient?.name || 'Patient',
        doctorName: raw.doctorName || raw.doctor?.name || 'Doctor',
        date: raw.date || raw.appointment_date || null,
        time: raw.time || raw.time_slot || null,
    };
}

interface HospitalState {
    stats: HospitalDashboardStats | null;
    departments: Department[];
    doctors: HospitalDoctor[];
    appointments: Record<string, unknown>[];
    isLoading: boolean;
    loadingDashboard: boolean;
    loadingDepartments: boolean;
    loadingDoctors: boolean;
    loadingAppointments: boolean;
    error: string | null;

    fetchDashboardData: () => Promise<void>;
    fetchDepartments: () => Promise<void>;
    fetchDoctors: () => Promise<void>;
    fetchAppointments: () => Promise<void>;
    inviteDoctor: (data: Record<string, unknown>) => Promise<boolean>;
    removeDoctor: (doctorId: string) => Promise<boolean>;
    addDepartment: (data: Record<string, unknown>) => Promise<boolean>;
    updateDepartment: (departmentId: string, data: Record<string, unknown>) => Promise<boolean>;
    deleteDepartment: (departmentId: string) => Promise<boolean>;
    clearError: () => void;
    reset: () => void;
}

// ==================== Store ====================

const hospitalInitialState = {
    stats: null as HospitalDashboardStats | null,
    departments: [] as Department[],
    doctors: [] as HospitalDoctor[],
    appointments: [] as Record<string, unknown>[],
    isLoading: false,
    loadingDashboard: false,
    loadingDepartments: false,
    loadingDoctors: false,
    loadingAppointments: false,
    error: null as string | null,
};

export const useHospitalStore = create<HospitalState>((set, get) => ({
    ...hospitalInitialState,

    clearError: () => set({ error: null }),
    reset: () => set({ ...hospitalInitialState }),

    fetchDashboardData: async () => {
        set({ loadingDashboard: true, isLoading: true, error: null });
        try {
            const response = await hospitalApi.getDashboard();
            if (!response.success) {
                set({
                    error: response.error || 'Failed to load hospital dashboard',
                    loadingDashboard: false,
                    isLoading: false,
                });
                return;
            }
            // Dashboard endpoint uses spread: { success, stats, recentAppointments, departments }
            // When no `data` key exists, fetchWithAuth returns the whole body as response.data
            const data = response.data as Record<string, unknown>;
            // Also check if stats/departments came as siblings on response itself
            const resp = response as Record<string, unknown>;
            const departments = ((data.departments || resp.departments || []) as Department[]);
            const rawStats = ((data.stats || resp.stats || {}) as Record<string, unknown>);

            const normalizedStats: HospitalDashboardStats = {
                totalDoctors: Number(rawStats.totalDoctors || 0),
                totalAppointments: Number(rawStats.totalAppointments || 0),
                totalPatients: Number(rawStats.totalPatients || 0),
                // backend can send either todayAppointments or legacy todaysAppointments
                todayAppointments: Number(rawStats.todayAppointments || rawStats.todaysAppointments || 0),
                todaysAppointments: Number(rawStats.todaysAppointments || rawStats.todayAppointments || 0),
                // if backend omits departments count, derive from list length
                departments: Number(rawStats.departments || departments.length || 0),
                bedCapacity: (rawStats.bedCapacity as string)
                    || (rawStats.bed_capacity != null ? `${rawStats.bed_capacity} beds` : undefined),
            };

            set({
                stats: normalizedStats,
                departments,
                loadingDashboard: false,
                isLoading: false,
            });
        } catch (error) {
            console.error('Error fetching hospital dashboard:', error);
            set({
                error: 'Failed to connect to server. Please check your connection.',
                loadingDashboard: false,
                isLoading: false,
            });
        }
    },

    fetchDepartments: async () => {
        set({ loadingDepartments: true, error: null });
        try {
            const response = await hospitalApi.getDepartments();
            if (response.success) {
                const data = response.data as Record<string, unknown>;
                set({
                    departments: (data.departments as Department[]) || [],
                    loadingDepartments: false,
                });
            } else {
                // Fallback to dashboard data
                const dashResponse = await hospitalApi.getDashboard();
                if (dashResponse.success) {
                    const dData = dashResponse.data as Record<string, unknown>;
                    const dResp = dashResponse as Record<string, unknown>;
                    set({
                        departments: ((dData.departments || dResp.departments || []) as Department[]),
                        loadingDepartments: false,
                    });
                } else {
                    set({ error: response.error || 'Failed to load departments', loadingDepartments: false });
                }
            }
        } catch (error) {
            console.error('Error fetching departments:', error);
            set({ error: 'Failed to connect to server.', loadingDepartments: false });
        }
    },

    addDepartment: async (data) => {
        set({ error: null });
        try {
            const response = await hospitalApi.addDepartment(data);
            if (response.success) {
                get().fetchDepartments();
                get().fetchDashboardData();
                return true;
            }
            set({ error: response.error || 'Failed to add department' });
            return false;
        } catch (error) {
            console.error('Error adding department:', error);
            set({ error: 'Failed to connect to server.' });
            return false;
        }
    },

    updateDepartment: async (departmentId, data) => {
        set({ error: null });
        try {
            const response = await hospitalApi.updateDepartment(departmentId, data);
            if (response.success) {
                get().fetchDepartments();
                return true;
            }
            set({ error: response.error || 'Failed to update department' });
            return false;
        } catch (error) {
            console.error('Error updating department:', error);
            set({ error: 'Failed to connect to server.' });
            return false;
        }
    },

    deleteDepartment: async (departmentId) => {
        set({ error: null });
        try {
            const response = await hospitalApi.deleteDepartment(departmentId);
            if (response.success) {
                get().fetchDepartments();
                get().fetchDashboardData();
                return true;
            }
            set({ error: response.error || 'Failed to delete department' });
            return false;
        } catch (error) {
            console.error('Error deleting department:', error);
            set({ error: 'Failed to connect to server.' });
            return false;
        }
    },

    fetchDoctors: async () => {
        set({ loadingDoctors: true, error: null });
        try {
            const response = await hospitalApi.getDoctors();
            if (!response.success) {
                set({ error: response.error || 'Failed to load doctors', loadingDoctors: false });
                return;
            }
            // After fetchWithAuth unwrap, response.data IS the array
            const rawData = response.data;
            set({
                doctors: (Array.isArray(rawData) ? rawData : (rawData as any)?.doctors || (rawData as any)?.data || []) as HospitalDoctor[],
                loadingDoctors: false,
            });
        } catch (error) {
            console.error('Error fetching doctors:', error);
            set({ error: 'Failed to load doctors.', loadingDoctors: false });
        }
    },

    fetchAppointments: async () => {
        set({ loadingAppointments: true, error: null });
        try {
            const response = await hospitalApi.getAppointments();
            if (!response.success) {
                set({ error: response.error || 'Failed to load appointments', loadingAppointments: false });
                return;
            }
            // After fetchWithAuth unwrap, response.data IS the array
            const rawData = response.data;
            const appointments = (Array.isArray(rawData) ? rawData : (rawData as any)?.appointments || (rawData as any)?.data || []) as Record<string, any>[];
            set({
                appointments: appointments.map(normalizeHospitalAppointment),
                loadingAppointments: false,
            });
        } catch (error) {
            console.error('Error fetching appointments:', error);
            set({ error: 'Failed to load appointments.', loadingAppointments: false });
        }
    },

    inviteDoctor: async (data) => {
        try {
            const response = await hospitalApi.inviteDoctor(data);
            if (response.success) {
                get().fetchDoctors();
                return true;
            }
            set({ error: response.error || 'Failed to invite doctor' });
            return false;
        } catch (error) {
            console.error('Error inviting doctor:', error);
            set({ error: 'Failed to invite doctor.' });
            return false;
        }
    },

    removeDoctor: async (doctorId) => {
        try {
            const response = await hospitalApi.removeDoctor(doctorId);
            if (response.success) {
                get().fetchDoctors();
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
