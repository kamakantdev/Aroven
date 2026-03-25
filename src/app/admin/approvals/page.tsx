'use client';

import { useEffect, useState } from 'react';
import {
    Search, Filter, Stethoscope, Building2, Building, Pill, Siren, Microscope,
    CheckCircle, XCircle, FileText, Download, ChevronRight, Loader2, RefreshCw,
    ChevronDown, MapPin, Phone, Mail
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAdminStore } from '@/stores/adminStore';
import type { PendingProvider } from '@/stores/adminStore';
import LocationPicker from '@/components/shared/LocationPickerDynamic';
import Link from 'next/link';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';

type ProviderType = 'all' | 'doctors' | 'hospitals' | 'clinics' | 'pharmacies' | 'diagnostic_centers' | 'ambulances';

const PROVIDER_ICONS: Record<string, React.ElementType> = {
    doctors: Stethoscope, hospitals: Building2, clinics: Building,
    pharmacies: Pill, diagnosticCenters: Microscope, diagnostic_centers: Microscope, ambulances: Siren,
};

const PROVIDER_COLORS: Record<string, string> = {
    doctors: 'bg-emerald-100 text-emerald-700', hospitals: 'bg-teal-100 text-teal-700',
    clinics: 'bg-pink-100 text-pink-700', pharmacies: 'bg-orange-100 text-orange-700',
    diagnosticCenters: 'bg-purple-100 text-purple-700', diagnostic_centers: 'bg-purple-100 text-purple-700',
    ambulances: 'bg-red-100 text-red-700',
};

export default function ApprovalsPage() {
    const [activeFilter, setActiveFilter] = useState<ProviderType>('all');
    const toast = useToast();
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const { pendingProviders, isLoading, fetchPendingApprovals, fetchDashboardData, stats, providerCounts } = useAdminStore();

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    useEffect(() => {
        fetchPendingApprovals(activeFilter);
    }, [activeFilter, fetchPendingApprovals]);

    const filteredApprovals = pendingProviders.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.email || '').toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
    });

    const { totalPages, totalItems, itemsPerPage, paginate } = usePagination(filteredApprovals, 10);
    const paginatedApprovals = paginate(page);

    const FILTER_TABS = [
        { id: 'all', label: 'All', count: stats?.pendingApprovals ?? 0 },
        { id: 'doctors', label: 'Doctors', count: providerCounts?.doctors?.pending ?? 0 },
        { id: 'hospitals', label: 'Hospitals', count: providerCounts?.hospitals?.pending ?? 0 },
        { id: 'clinics', label: 'Clinics', count: providerCounts?.clinics?.pending ?? 0 },
        { id: 'pharmacies', label: 'Pharmacies', count: providerCounts?.pharmacies?.pending ?? 0 },
        { id: 'diagnostic_centers', label: 'Diagnostic Centers', count: providerCounts?.diagnosticCenters?.pending ?? 0 },
        { id: 'ambulances', label: 'Ambulances', count: providerCounts?.ambulances?.pending ?? 0 },
    ];

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    const [expandedId, setExpandedId] = useState<string | null>(null);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Pending Approvals</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Review and approve provider registrations</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={() => fetchPendingApprovals(activeFilter)}
                        leftIcon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
                </div>
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
                        <Input placeholder="Search by name or email..." value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} leftIcon={<Search className="h-5 w-5" />} />
                    </div>
                </div>
            </Card>

            <Card padding="none">
                {isLoading ? (
                    <div className="flex items-center justify-center p-12">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                        <span className="ml-2 text-gray-500 dark:text-gray-400">Loading approvals...</span>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {filteredApprovals.length === 0 ? (
                            <div className="p-8 text-center">
                                <p className="text-gray-500 dark:text-gray-400">No pending approvals found</p>
                            </div>
                        ) : (
                            paginatedApprovals.map((approval) => {
                                const provType = approval.provider_type || 'doctors';
                                const Icon = PROVIDER_ICONS[provType] || Stethoscope;
                                const colorClass = PROVIDER_COLORS[provType] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
                                const isFacility = ['hospitals', 'clinics', 'pharmacies', 'diagnostic_centers'].includes(provType);
                                const isLocationBasedProvider = isFacility;
                                const missingPhone = isLocationBasedProvider && !(approval.phone || '').trim();
                                const missingLocation = isLocationBasedProvider && (approval.latitude == null || approval.longitude == null);
                                const approvalBlockReason = missingPhone
                                    ? 'Phone is required before approval.'
                                    : (missingLocation ? 'Location coordinates are required before approval.' : null);
                                const canApprove = !approvalBlockReason;
                                const isExpanded = expandedId === approval.id;
                                return (
                                    <div key={approval.id}>
                                        <div
                                            className={`flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${isFacility ? 'cursor-pointer' : ''}`}
                                            onClick={() => isFacility && setExpandedId(isExpanded ? null : approval.id)}
                                        >
                                            <div className="flex items-center gap-4">
                                                {isFacility && (
                                                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                                                )}
                                                <div className={`p-2.5 rounded-xl ${colorClass}`}><Icon className="h-5 w-5" /></div>
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-gray-100">{approval.name}</p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">{approval.email || 'No email'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="hidden sm:block text-right">
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">Submitted</p>
                                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatDate(approval.created_at)}</p>
                                                </div>
                                                {approval.registration_number && (
                                                    <div className="hidden sm:flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                                        <FileText className="h-4 w-4" />
                                                        <span className="text-sm">{approval.registration_number}</span>
                                                    </div>
                                                )}
                                                <StatusBadge status="pending" size="sm" />
                                                <ApprovalActions
                                                    id={approval.id}
                                                    type={provType}
                                                    canApprove={canApprove}
                                                    approveBlockedReason={approvalBlockReason}
                                                    onActionToast={(kind, message) => {
                                                    if (kind === 'success') {
                                                        toast.success('Success', message);
                                                    } else {
                                                        toast.error('Action failed', message);
                                                    }
                                                }} />
                                            </div>
                                        </div>
                                        {approvalBlockReason && (
                                            <div className="px-4 pb-2 text-xs text-amber-700 dark:text-amber-300">
                                                ⚠ {approvalBlockReason}
                                            </div>
                                        )}
                                        {/* Expanded detail panel with map preview for facilities */}
                                        {isFacility && isExpanded && (
                                            <ApprovalDetailPanel approval={approval} />
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </Card>
            <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
            />
        </div>
    );
}

function ApprovalActions({
    id,
    type,
    canApprove,
    approveBlockedReason,
    onActionToast,
}: {
    id: string;
    type: string;
    canApprove: boolean;
    approveBlockedReason: string | null;
    onActionToast?: (kind: 'success' | 'error', message: string) => void;
}) {
    const { approveProvider, rejectProvider } = useAdminStore();
    const [acting, setActing] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    const handleApprove = async () => {
        setActing(true);
        const ok = await approveProvider(id, type);
        const latestError = useAdminStore.getState().error;
        onActionToast?.(
            ok ? 'success' : 'error',
            ok ? 'Provider approved successfully.' : (latestError || 'Approve failed. Please refresh and retry.')
        );
        setActing(false);
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) return;
        setActing(true);
        const ok = await rejectProvider(id, type, rejectReason);
        onActionToast?.(ok ? 'success' : 'error', ok ? 'Provider rejected successfully.' : 'Reject failed. Please retry.');
        setActing(false);
        if (ok) {
            setShowRejectModal(false);
            setRejectReason('');
        }
    };

    return (
        <>
            <div className="flex gap-2">
                <Button
                    size="sm"
                    variant="primary"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleApprove();
                    }}
                    disabled={acting || !canApprove}
                    title={approveBlockedReason || undefined}
                >
                    {acting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                    <span className="ml-1">Approve</span>
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowRejectModal(true);
                    }}
                    disabled={acting}
                >
                    <XCircle className="h-3 w-3" />
                    <span className="ml-1">Reject</span>
                </Button>
            </div>

            {/* Rejection Reason Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowRejectModal(false); }}>
                    <Card padding="lg" className="w-full max-w-md">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Rejection Reason</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Please provide a reason for rejecting this provider.</p>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Enter reason for rejection..."
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                            rows={3}
                            autoFocus
                        />
                        <div className="flex justify-end gap-2 mt-4">
                            <Button size="sm" variant="outline" onClick={() => { setShowRejectModal(false); setRejectReason(''); }}>Cancel</Button>
                            <Button size="sm" variant="primary" onClick={handleReject} disabled={!rejectReason.trim() || acting} isLoading={acting}>Reject</Button>
                        </div>
                    </Card>
                </div>
            )}
        </>
    );
}

/** Expanded detail panel showing provider info + map preview */
function ApprovalDetailPanel({ approval }: { approval: PendingProvider }) {
    const hasLocation = approval.latitude != null && approval.longitude != null;

    return (
        <div className="px-6 pb-4 pt-0 bg-gray-50/50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-3">
                {/* Provider details */}
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Provider Details</h4>
                    {approval.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Phone className="h-4 w-4 text-gray-400" />
                            {approval.phone}
                        </div>
                    )}
                    {approval.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Mail className="h-4 w-4 text-gray-400" />
                            {approval.email}
                        </div>
                    )}
                    {approval.address && (
                        <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                            {approval.address}
                        </div>
                    )}
                    {approval.registration_number && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <FileText className="h-4 w-4 text-gray-400" />
                            Reg: {approval.registration_number}
                        </div>
                    )}
                    {!hasLocation && (
                        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                            <MapPin className="h-3.5 w-3.5" />
                            No GPS coordinates provided — location cannot be verified on map.
                        </div>
                    )}
                </div>

                {/* Map preview */}
                <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Location Preview
                    </h4>
                    {hasLocation ? (
                        <LocationPicker
                            latitude={approval.latitude}
                            longitude={approval.longitude}
                            readOnly
                            height="200px"
                            label=""
                        />
                    ) : (
                        <div className="flex items-center justify-center h-[200px] rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-sm text-gray-400">
                            No location data available
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
