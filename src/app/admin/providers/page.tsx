'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    Search, Stethoscope, Building2, Building, Pill, Siren,
    Loader2, RefreshCw
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { useAdminStore } from '@/stores/adminStore';
import { adminApi } from '@/lib/api';

type ProviderType = 'all' | 'doctors' | 'hospitals' | 'clinics' | 'pharmacies' | 'diagnostic_centers' | 'ambulances';

interface Provider {
    id: string;
    name: string;
    type: string;
    email?: string;
    status: string;
    joinedAt?: string;
}

const PROVIDER_ICONS: Record<string, React.ElementType> = {
    doctors: Stethoscope, hospitals: Building2, clinics: Building,
    pharmacies: Pill, diagnostic_centers: Building2, ambulances: Siren,
};

const PROVIDER_COLORS: Record<string, string> = {
    doctors: 'bg-emerald-100 text-emerald-700', hospitals: 'bg-teal-100 text-teal-700',
    clinics: 'bg-pink-100 text-pink-700', pharmacies: 'bg-orange-100 text-orange-700',
    diagnostic_centers: 'bg-purple-100 text-purple-700', ambulances: 'bg-red-100 text-red-700',
};

const PROVIDER_ROLE_SET = new Set([
    'doctor',
    'hospital_owner',
    'hospital_manager',
    'clinic_owner',
    'pharmacy_owner',
    'diagnostic_center_owner',
    'ambulance_operator',
    'ambulance_driver',
]);

const getProviderTypeFromRole = (role?: string): string => {
    const r = (role || '').toLowerCase();
    if (r === 'doctor') return 'doctors';
    if (r === 'hospital_owner' || r === 'hospital_manager') return 'hospitals';
    if (r === 'clinic_owner') return 'clinics';
    if (r === 'pharmacy_owner') return 'pharmacies';
    if (r === 'diagnostic_center_owner') return 'diagnostic_centers';
    if (r === 'ambulance_operator' || r === 'ambulance_driver') return 'ambulances';
    return '';
};

const getRoleFilterForTab = (tab: ProviderType): string | null => {
    const map: Record<Exclude<ProviderType, 'all'>, string> = {
        doctors: 'doctor',
        hospitals: 'hospital_owner',
        clinics: 'clinic_owner',
        pharmacies: 'pharmacy_owner',
        diagnostic_centers: 'diagnostic_center_owner',
        ambulances: 'ambulance_operator',
    };
    if (tab === 'all') return null;
    return map[tab];
};

export default function ProvidersPage() {
    const [activeFilter, setActiveFilter] = useState<ProviderType>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [providers, setProviders] = useState<Provider[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const { stats, providerCounts, fetchDashboardData } = useAdminStore();

    useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

    const fetchProviders = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const filters: Record<string, unknown> = {};
            const roleFilter = getRoleFilterForTab(activeFilter);
            if (roleFilter) filters.role = roleFilter;
            filters.isActive = true;

            const result = await adminApi.getUsers(filters);
            if (!result.success) throw new Error(result.error || 'Failed to fetch providers');
            const data = (result.data as any)?.data || (result.data as any) || [];
            const normalized = (Array.isArray(data) ? data : [])
                .filter((item: any) => PROVIDER_ROLE_SET.has((item.role || '').toLowerCase()))
                .map((item: any) => {
                    const type = item.provider_type || getProviderTypeFromRole(item.role);
                    return {
                        id: item.id,
                        name: item.name || item.email || 'Unknown',
                        type,
                        email: item.email || '',
                        status: item.approval_status || item.status || (item.is_active === false ? 'suspended' : 'approved'),
                        joinedAt: item.created_at || item.joinedAt,
                    };
                })
                .filter((item: Provider) => item.type && (activeFilter === 'all' || item.type === activeFilter));
            setProviders(normalized);
        } catch {
            setError('Failed to load providers');
        }
        setIsLoading(false);
    }, [activeFilter]);

    useEffect(() => { fetchProviders(); }, [fetchProviders]);

    const filteredProviders = providers.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const { totalPages, totalItems, itemsPerPage, paginate } = usePagination(filteredProviders, 15);
    const paginatedProviders = paginate(page);

    // Reset page when filters change
    useEffect(() => { setPage(1); }, [searchQuery, activeFilter]);

    const FILTER_TABS = [
        { id: 'all', label: 'All Providers', count: stats?.totalProviders ?? 0 },
        { id: 'doctors', label: 'Doctors', count: providerCounts?.doctors?.total ?? 0 },
        { id: 'hospitals', label: 'Hospitals', count: providerCounts?.hospitals?.total ?? 0 },
        { id: 'clinics', label: 'Clinics', count: providerCounts?.clinics?.total ?? 0 },
        { id: 'pharmacies', label: 'Pharmacies', count: providerCounts?.pharmacies?.total ?? 0 },
        { id: 'diagnostic_centers', label: 'Diagnostic Centers', count: providerCounts?.diagnosticCenters?.total ?? 0 },
        { id: 'ambulances', label: 'Ambulances', count: providerCounts?.ambulances?.total ?? 0 },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">All Providers</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Manage all registered healthcare providers</p>
                </div>
                <Button variant="outline" onClick={fetchProviders} leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
            </div>

            <div className="flex flex-wrap gap-2">
                {FILTER_TABS.map((tab) => (
                    <button key={tab.id} onClick={() => setActiveFilter(tab.id as ProviderType)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            activeFilter === tab.id ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        }`}>
                        {tab.label}
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${activeFilter === tab.id ? 'bg-blue-500' : 'bg-gray-100 dark:bg-gray-700'}`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            <Card padding="sm">
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <Input placeholder="Search providers..." value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)} leftIcon={<Search className="h-5 w-5" />} />
                    </div>
                </div>
            </Card>

            <Card padding="none">
                {isLoading ? (
                    <div className="flex items-center justify-center p-12">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                        <span className="ml-2 text-gray-500 dark:text-gray-400">Loading providers...</span>
                    </div>
                ) : error ? (
                    <div className="p-8 text-center">
                        <p className="text-red-600">{error}</p>
                        <Button className="mt-4" onClick={fetchProviders} leftIcon={<RefreshCw className="h-4 w-4" />}>Retry</Button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Provider</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Type</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400 hidden md:table-cell">Email</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400 hidden sm:table-cell">Status</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400 hidden lg:table-cell">Joined</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {filteredProviders.length === 0 ? (
                                    <tr><td colSpan={5} className="py-8 text-center text-gray-500 dark:text-gray-400">No providers found</td></tr>
                                ) : (
                                    paginatedProviders.map((provider) => {
                                        const pType = provider.type?.replace(/s$/, '') + 's';
                                        const Icon = PROVIDER_ICONS[pType] || Stethoscope;
                                        const colorClass = PROVIDER_COLORS[pType] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
                                        return (
                                            <tr key={provider.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg ${colorClass}`}><Icon className="h-4 w-4" /></div>
                                                        <span className="font-medium text-gray-900 dark:text-gray-100">{provider.name}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 capitalize">{provider.type}</td>
                                                <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 hidden md:table-cell">{provider.email || '—'}</td>
                                                <td className="py-3 px-4 hidden sm:table-cell">
                                                    <StatusBadge status={provider.status as any} size="sm" />
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                                                    {provider.joinedAt ? new Date(provider.joinedAt).toLocaleDateString('en-IN') : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                        <Pagination
                            currentPage={page}
                            totalPages={totalPages}
                            onPageChange={setPage}
                            totalItems={totalItems}
                            itemsPerPage={itemsPerPage}
                        />
                    </div>
                )}
            </Card>
        </div>
    );
}
