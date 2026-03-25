import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { API_BASE_URL, setTokens as syncTokens, clearTokens as syncClearTokens } from '@/lib/api';
import { useDoctorStore } from './doctorStore';
import { useHospitalStore } from './hospitalStore';
import { useClinicStore } from './clinicStore';
import { usePharmacyStore } from './pharmacyStore';
import { useDiagnosticCenterStore } from './diagnosticCenterStore';
import { useAdminStore } from './adminStore';

/** Decode JWT payload and check if it's expired (H12 fix) */
function isJwtExpired(token: string): boolean {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (!payload.exp) return false; // no exp claim → trust the server
        return Date.now() >= payload.exp * 1000;
    } catch {
        return true; // malformed token → treat as expired
    }
}

// Web portal roles (ambulance_operator removed — uses separate Kotlin app)
export type UserRole =
    | 'admin'
    | 'super_admin'
    | 'doctor'
    | 'patient'
    | 'hospital_owner'
    | 'clinic_owner'
    | 'diagnostic_center_owner'
    | 'pharmacy_owner';

export type ApprovalStatus = 'pending' | 'review' | 'approved' | 'rejected' | 'suspended';

export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    phone?: string;
    profile_image_url?: string;
    approval_status?: ApprovalStatus;
    approval_notes?: string;
}

interface AuthState {
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    _hasHydrated: boolean;

    login: (email: string, password: string, expectedRole: UserRole, rememberMe?: boolean) => Promise<{ success: boolean; error?: string; code?: string }>;
    register: (data: RegisterData, role: UserRole) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    refreshAuth: () => Promise<boolean>;
    setLoading: (loading: boolean) => void;
    setHasHydrated: (state: boolean) => void;
}

interface RegisterData {
    email: string;
    password: string;
    name: string;
    phone: string;
    [key: string]: string;
}

export const ROLE_HOME_ROUTES: Record<UserRole, string> = {
    admin: '/admin',
    super_admin: '/admin',
    doctor: '/doctor',
    patient: '/',
    hospital_owner: '/hospital',
    clinic_owner: '/clinic',
    diagnostic_center_owner: '/diagnostic-center',
    pharmacy_owner: '/pharmacy',
};

export const ROLE_LOGIN_ROUTES: Record<UserRole, string> = {
    admin: '/login/admin',
    super_admin: '/login/admin',
    doctor: '/login/doctor',
    patient: '/',
    hospital_owner: '/login/hospital',
    clinic_owner: '/login/clinic',
    diagnostic_center_owner: '/login/diagnostic-center',
    pharmacy_owner: '/login/pharmacy',
};

// Token refresh mutex to prevent concurrent refresh calls (H6 fix)
let refreshPromise: Promise<boolean> | null = null;

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: true,
            _hasHydrated: false,

            setHasHydrated: (state) => set({ _hasHydrated: state }),

            login: async (email, password, expectedRole, rememberMe = false) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password, role: expectedRole }),
                    });

                    const data = await response.json();

                    if (!response.ok || !data.success) {
                        // Pass through error code for email verification handling
                        const errorCode = data.data?.code || data.code;
                        return { success: false, error: data.message || 'Login failed', code: errorCode };
                    }

                    const user = data.data?.user || data.user;
                    const tokens = data.data?.tokens || data.tokens || data.data;

                    const roleMatches = user.role === expectedRole || (expectedRole === 'admin' && user.role === 'super_admin');

                    if (!roleMatches) {
                        return {
                            success: false,
                            error: 'Invalid credentials for this portal. Please use the correct login page for your role.',
                        };
                    }

                    const accessTk = tokens.accessToken || tokens.token;
                    const refreshTk = tokens.refreshToken;

                    // Set role cookie for middleware route protection
                    // Set token cookie for middleware JWT expiry validation
                    // Remember me: 30 days, otherwise: session only (browser close)
                    if (typeof document !== 'undefined') {
                        const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24; // 30 days vs 1 day
                        document.cookie = `swastik-role=${user.role}; path=/; max-age=${maxAge}; SameSite=Strict`;
                        document.cookie = `swastik-token=${accessTk}; path=/; max-age=${maxAge}; SameSite=Strict`;
                    }

                    // Sync tokens to api.ts module + localStorage for fetchWithAuth
                    syncTokens(accessTk, refreshTk);

                    set({
                        user,
                        accessToken: accessTk,
                        refreshToken: refreshTk,
                        isAuthenticated: true,
                        isLoading: false,
                    });

                    return { success: true };
                } catch (error) {
                    console.error('Login error:', error);
                    return { success: false, error: 'Network error. Please try again.' };
                }
            },

            register: async (data, role) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/auth/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...data, role }),
                    });

                    const result = await response.json();

                    if (!response.ok || !result.success) {
                        return { success: false, error: result.message || 'Registration failed' };
                    }

                    return { success: true };
                } catch (error) {
                    console.error('Register error:', error);
                    return { success: false, error: 'Network error. Please try again.' };
                }
            },

            logout: () => {
                if (typeof document !== 'undefined') {
                    document.cookie = 'swastik-role=; path=/; max-age=0';
                    document.cookie = 'swastik-token=; path=/; max-age=0';
                }
                // Sync clear to api.ts module + localStorage
                syncClearTokens();
                set({
                    user: null,
                    accessToken: null,
                    refreshToken: null,
                    isAuthenticated: false,
                    isLoading: false,
                });
                // Reset all role-specific stores to prevent data flash on re-login
                useDoctorStore.getState().reset();
                useHospitalStore.getState().reset();
                useClinicStore.getState().reset();
                usePharmacyStore.getState().reset();
                useDiagnosticCenterStore.getState().reset();
                useAdminStore.getState().reset();
            },

            refreshAuth: async () => {
                // H6 fix: mutex — if a refresh is already in-flight, reuse it
                if (refreshPromise) return refreshPromise;

                const { refreshToken } = get();
                if (!refreshToken) {
                    set({ isLoading: false });
                    return false;
                }

                refreshPromise = (async () => {
                    try {
                        const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ refreshToken }),
                        });

                        const data = await response.json();

                        if (!response.ok || !data.success) {
                            get().logout();
                            return false;
                        }

                        const newAccessToken = data.data?.accessToken || data.accessToken;
                        const newRefreshToken = data.data?.refreshToken || data.refreshToken || refreshToken;

                        // Sync refreshed tokens to api.ts module + localStorage
                        if (newAccessToken) {
                            syncTokens(newAccessToken, newRefreshToken || refreshToken);
                        }

                        set({
                            accessToken: newAccessToken,
                            refreshToken: newRefreshToken || refreshToken,
                            isLoading: false,
                        });

                        return true;
                    } catch {
                        get().logout();
                        return false;
                    } finally {
                        refreshPromise = null;
                    }
                })();

                return refreshPromise;
            },

            setLoading: (loading) => set({ isLoading: loading }),
        }),
        {
            name: 'swastik-auth-storage',
            partialize: (state) => ({
                user: state.user,
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
                isAuthenticated: state.isAuthenticated,
            }),
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated(true);
                // H12: Check if persisted access token is expired on rehydration
                if (state?.accessToken && isJwtExpired(state.accessToken)) {
                    // Token expired — attempt a background refresh
                    state.refreshAuth().then((ok) => {
                        if (!ok) state.logout();
                        else state.setLoading(false);
                    });
                } else {
                    state?.setLoading(false);
                }
            },
        }
    )
);

/** Check if a user role can access a given route path */
export function canAccessRoute(userRole: UserRole | undefined, path: string): boolean {
    if (!userRole) return false;

    const roleRoutes: Record<UserRole, string[]> = {
        admin: ['/admin'],
        super_admin: ['/admin'],
        doctor: ['/doctor'],
        patient: [],
        hospital_owner: ['/hospital'],
        clinic_owner: ['/clinic'],
        diagnostic_center_owner: ['/diagnostic-center'],
        pharmacy_owner: ['/pharmacy'],
    };

    const allowedPaths = roleRoutes[userRole] || [];
    return allowedPaths.some((allowed) => path.startsWith(allowed));
}

// ==================== Multi-Tab Token Sync via BroadcastChannel ====================
// Ensures that when one tab logs out or refreshes tokens, all other tabs stay in sync.
if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    const authChannel = new BroadcastChannel('swastik-auth-sync');

    authChannel.onmessage = (event) => {
        const { type, payload } = event.data || {};
        const store = useAuthStore.getState();

        if (type === 'LOGOUT') {
            // Another tab logged out — clear this tab too (without broadcasting back)
            if (store.isAuthenticated) {
                if (typeof document !== 'undefined') {
                    document.cookie = 'swastik-role=; path=/; max-age=0';
                    document.cookie = 'swastik-token=; path=/; max-age=0';
                }
                syncClearTokens();
                useAuthStore.setState({
                    user: null,
                    accessToken: null,
                    refreshToken: null,
                    isAuthenticated: false,
                    isLoading: false,
                });
            }
        } else if (type === 'TOKEN_REFRESH' && payload) {
            // Another tab refreshed the token — update this tab
            const { accessToken, refreshToken } = payload;
            if (accessToken) {
                syncTokens(accessToken, refreshToken || store.refreshToken || '');
                useAuthStore.setState({
                    accessToken,
                    refreshToken: refreshToken || store.refreshToken,
                });
            }
        } else if (type === 'LOGIN' && payload) {
            // Another tab logged in — update this tab
            const { user, accessToken, refreshToken } = payload;
            if (accessToken && user) {
                syncTokens(accessToken, refreshToken || '');
                useAuthStore.setState({
                    user,
                    accessToken,
                    refreshToken,
                    isAuthenticated: true,
                    isLoading: false,
                });
            }
        }
    };

    // Patch logout to broadcast — BUG-M1 Fix: guard against HMR double-patching
    const originalLogout = useAuthStore.getState().logout;
    const PATCHED_FLAG = '__swastik_broadcast_patched__';
    if (!(originalLogout as unknown as Record<string, unknown>)[PATCHED_FLAG]) {
        const patchedLogout = () => {
            originalLogout();
            try { authChannel.postMessage({ type: 'LOGOUT' }); } catch { /* ignore */ }
        };
        (patchedLogout as unknown as Record<string, unknown>)[PATCHED_FLAG] = true;
        // Override logout in the store
        useAuthStore.setState({ logout: patchedLogout } as Partial<AuthState>);
    }
    // We subscribe to store changes to broadcast token refreshes
    const unsubSync = useAuthStore.subscribe((state, prevState) => {
        if (state.accessToken && state.accessToken !== prevState.accessToken && state.isAuthenticated) {
            try {
                authChannel.postMessage({
                    type: 'TOKEN_REFRESH',
                    payload: { accessToken: state.accessToken, refreshToken: state.refreshToken },
                });
            } catch { /* ignore */ }
        }
        // If logged in (was not authenticated, now is), broadcast login
        if (state.isAuthenticated && !prevState.isAuthenticated && state.user) {
            try {
                authChannel.postMessage({
                    type: 'LOGIN',
                    payload: { user: state.user, accessToken: state.accessToken, refreshToken: state.refreshToken },
                });
            } catch { /* ignore */ }
        }
    });

    // Close channel on page unload to prevent resource leaks
    window.addEventListener('beforeunload', () => {
        unsubSync();
        authChannel.close();
    });
}
