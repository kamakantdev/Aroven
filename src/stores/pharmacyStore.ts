import { create } from 'zustand';
import { pharmacyApi } from '../lib/api';

// ==================== Types ====================

export interface PharmacyDashboardStats {
    newPrescriptions: number;
    pendingOrders: number;
    lowStockItems: number;
    todaysRevenue: number;
}

export interface InventoryItem {
    id: string;
    name: string;
    genericName?: string;
    quantity: number;
    minQuantity: number;
    unit: string;
    price?: number;
    expiryDate?: string;
    isLowStock: boolean;
    requiresPrescription?: boolean;
}

export interface OrderItem {
    medicineId?: string;
    inventoryItemId?: string;
    name: string;
    quantity: number;
    price: number;
    subtotal: number;
}

export interface Order {
    id: string;
    patientName: string;
    patientId: string;
    items: OrderItem[];
    total_amount?: number;
    total?: number;
    time: string;
    created_at?: string;
    delivery_address?: string;
    payment_status?: string;
    status: 'pending' | 'confirmed' | 'processing' | 'ready' | 'dispatched' | 'delivered' | 'cancelled';
}

export interface Prescription {
    id: string;
    patientName: string;
    doctorName: string;
    items: number;
    time: string;
    status: string;
    medications?: Record<string, unknown>[];
    date?: string;
}

function normalizeOrder(raw: Record<string, any>): Order {
    const items = Array.isArray(raw.items) ? raw.items : [];
    const derivedTotal = items.reduce((sum: number, item: any) => sum + (item.subtotal || ((item.price || 0) * (item.quantity || 1))), 0);

    return {
        ...raw,
        patientName: raw.patientName || raw.patient?.name || 'Patient',
        patientId: raw.patientId || raw.patient_id || raw.patient?.id || '',
        items,
        total: raw.total || raw.total_amount || derivedTotal,
        time: raw.time || raw.created_at || '',
        status: raw.status || 'pending',
    } as Order;
}

interface PharmacyState {
    stats: PharmacyDashboardStats | null;
    inventory: InventoryItem[];
    orders: Order[];
    prescriptions: Prescription[];
    pendingPrescriptions: Prescription[];
    lowStockItems: InventoryItem[];
    isLoading: boolean;
    loadingDashboard: boolean;
    loadingInventory: boolean;
    loadingOrders: boolean;
    loadingPrescriptions: boolean;
    error: string | null;

    fetchDashboardData: () => Promise<void>;
    fetchInventory: (search?: string) => Promise<void>;
    fetchOrders: (status?: string) => Promise<void>;
    fetchPrescriptions: (status?: string) => Promise<void>;
    fetchLowStockItems: () => Promise<void>;
    addInventoryItem: (data: Record<string, unknown>) => Promise<boolean>;
    updateInventoryItem: (id: string, data: Record<string, unknown>) => Promise<boolean>;
    deleteInventoryItem: (id: string) => Promise<boolean>;
    updateOrderStatus: (orderId: string, status: string) => Promise<boolean>;
    clearError: () => void;
    reset: () => void;
}

// ==================== Store ====================

const pharmacyInitialState = {
    stats: null as PharmacyDashboardStats | null,
    inventory: [] as InventoryItem[],
    orders: [] as Order[],
    prescriptions: [] as Prescription[],
    pendingPrescriptions: [] as Prescription[],
    lowStockItems: [] as InventoryItem[],
    isLoading: false,
    loadingDashboard: false,
    loadingInventory: false,
    loadingOrders: false,
    loadingPrescriptions: false,
    error: null as string | null,
};

export const usePharmacyStore = create<PharmacyState>((set, get) => ({
    ...pharmacyInitialState,

    clearError: () => set({ error: null }),
    reset: () => set({ ...pharmacyInitialState }),

    fetchDashboardData: async () => {
        set({ loadingDashboard: true, isLoading: true, error: null });
        try {
            const response = await pharmacyApi.getDashboard();
            if (!response.success) {
                set({
                    error: response.error || 'Failed to load pharmacy dashboard',
                    loadingDashboard: false,
                    isLoading: false,
                });
                return;
            }
            const data = response.data as Record<string, unknown>;
            const prescriptions = (data.pendingPrescriptions || data.recentPrescriptions || []) as Prescription[];
            set({
                stats: (data.stats as PharmacyDashboardStats) || null,
                lowStockItems: (data.lowStockItems as InventoryItem[]) || [],
                pendingPrescriptions: prescriptions,
                loadingDashboard: false,
                isLoading: false,
            });
        } catch (error) {
            console.error('Error fetching pharmacy dashboard:', error);
            set({
                error: 'Failed to connect to server. Please check your connection.',
                loadingDashboard: false,
                isLoading: false,
            });
        }
    },

    fetchInventory: async (search?: string) => {
        set({ loadingInventory: true, error: null });
        try {
            const response = await pharmacyApi.getInventory(1, search);
            if (!response.success) {
                set({ error: response.error || 'Failed to load inventory', loadingInventory: false });
                return;
            }
            // After fetchWithAuth unwrap, response.data IS the array
            const rawData = response.data;
            set({
                inventory: (Array.isArray(rawData) ? rawData : (rawData as any)?.items || (rawData as any)?.inventory || (rawData as any)?.data || []) as InventoryItem[],
                loadingInventory: false,
            });
        } catch (error) {
            console.error('Error fetching inventory:', error);
            set({ error: 'Failed to load inventory.', loadingInventory: false });
        }
    },

    fetchOrders: async (status?: string) => {
        set({ loadingOrders: true, error: null });
        try {
            const response = await pharmacyApi.getOrders(status);
            if (!response.success) {
                set({ error: response.error || 'Failed to load orders', loadingOrders: false });
                return;
            }
            // After fetchWithAuth unwrap, response.data IS the array
            const rawData = response.data;
            const orders = (Array.isArray(rawData) ? rawData : (rawData as any)?.orders || (rawData as any)?.data || []) as Record<string, any>[];
            set({
                orders: orders.map(normalizeOrder),
                loadingOrders: false,
            });
        } catch (error) {
            console.error('Error fetching orders:', error);
            set({ error: 'Failed to load orders.', loadingOrders: false });
        }
    },

    fetchPrescriptions: async (status?: string) => {
        set({ loadingPrescriptions: true, error: null });
        try {
            const response = await pharmacyApi.getPrescriptions(status);
            if (!response.success) {
                set({ error: response.error || 'Failed to load prescriptions', loadingPrescriptions: false });
                return;
            }
            // After fetchWithAuth unwrap, response.data IS the array
            const rawData = response.data;
            const allPrescriptions = (Array.isArray(rawData) ? rawData : (rawData as any)?.prescriptions || (rawData as any)?.data || []) as Prescription[];
            set({
                prescriptions: allPrescriptions,
                pendingPrescriptions: allPrescriptions.filter((p: Prescription) => p.status === 'pending'),
                loadingPrescriptions: false,
            });
        } catch (error) {
            console.error('Error fetching prescriptions:', error);
            set({ error: 'Failed to load prescriptions.', loadingPrescriptions: false });
        }
    },

    fetchLowStockItems: async () => {
        set({ loadingInventory: true, error: null });
        try {
            const response = await pharmacyApi.getDashboard();
            if (!response.success) {
                set({ error: response.error || 'Failed to load low stock items', loadingInventory: false });
                return;
            }
            const data = response.data as Record<string, unknown>;
            set({
                lowStockItems: (data.lowStockItems as InventoryItem[]) || [],
                loadingInventory: false,
            });
        } catch (error) {
            console.error('Error fetching low stock items:', error);
            set({ error: 'Failed to load low stock items.', loadingInventory: false });
        }
    },

    addInventoryItem: async (data) => {
        try {
            const response = await pharmacyApi.addInventoryItem(data);
            if (response.success) {
                get().fetchInventory();
                return true;
            }
            set({ error: response.error || 'Failed to add inventory item' });
            return false;
        } catch (error) {
            console.error('Error adding inventory item:', error);
            set({ error: 'Failed to add inventory item.' });
            return false;
        }
    },

    updateInventoryItem: async (id, data) => {
        try {
            const response = await pharmacyApi.updateInventoryItem(id, data);
            if (response.success) {
                get().fetchInventory();
                return true;
            }
            set({ error: response.error || 'Failed to update inventory item' });
            return false;
        } catch (error) {
            console.error('Error updating inventory:', error);
            set({ error: 'Failed to update inventory item.' });
            return false;
        }
    },

    deleteInventoryItem: async (id) => {
        try {
            const response = await pharmacyApi.deleteInventoryItem(id);
            if (response.success) {
                get().fetchInventory();
                return true;
            }
            set({ error: response.error || 'Failed to delete inventory item' });
            return false;
        } catch (error) {
            console.error('Error deleting inventory item:', error);
            set({ error: 'Failed to delete inventory item.' });
            return false;
        }
    },

    updateOrderStatus: async (orderId, status) => {
        try {
            const response = await pharmacyApi.updateOrderStatus(orderId, status);
            if (response.success) {
                get().fetchOrders();
                get().fetchDashboardData();
                return true;
            }
            set({ error: response.error || 'Failed to update order status' });
            return false;
        } catch (error) {
            console.error('Error updating order status:', error);
            set({ error: 'Failed to update order status.' });
            return false;
        }
    },
}));
