'use client';

import { useEffect, useState } from 'react';
import { Search, Loader2, Upload, Eye, FileCheck, Clock, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useDiagnosticCenterStore, type DiagnosticBooking } from '@/stores/diagnosticCenterStore';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';

const RESULT_STATUS_FILTERS = [
    { label: 'All', value: '', icon: FileCheck },
    { label: 'Pending', value: 'pending', icon: Clock },
    { label: 'Processing', value: 'processing', icon: AlertCircle },
    { label: 'Completed', value: 'completed', icon: CheckCircle2 },
    { label: 'Delivered', value: 'delivered', icon: Send },
];

export default function ResultsPage() {
    const { results, isLoading, error, fetchResults, uploadResult, clearError } = useDiagnosticCenterStore();
    const [page, setPage] = useState(1);
    const toast = useToast();
    const [resultStatusFilter, setResultStatusFilter] = useState('');
    const [search, setSearch] = useState('');
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const [resultForm, setResultForm] = useState({ result_url: '', result_notes: '' });

    useEffect(() => {
        fetchResults(resultStatusFilter || undefined);
    }, [fetchResults, resultStatusFilter]);

    const handleUploadResult = async (bookingId: string) => {
        if (!resultForm.result_url) return;
        clearError();
        const success = await uploadResult(bookingId, {
            result_url: resultForm.result_url,
            result_notes: resultForm.result_notes || undefined,
        });
        if (success) {
            setUploadingId(null);
            setResultForm({ result_url: '', result_notes: '' });
            fetchResults(resultStatusFilter || undefined);
        }
    };

    const filtered = results.filter(b => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            (b.patient_name || '').toLowerCase().includes(q) ||
            (b.test_name || '').toLowerCase().includes(q) ||
            b.id.toLowerCase().includes(q)
        );
    });
    const { totalPages, totalItems, itemsPerPage, paginate } = usePagination(filtered, 10);
    const paginatedItems = paginate(page);

    // Stats summary
    const totalPending = results.filter(r => r.result_status === 'pending').length;
    const totalProcessing = results.filter(r => r.result_status === 'processing').length;
    const totalCompleted = results.filter(r => r.result_status === 'completed').length;
    const totalDelivered = results.filter(r => r.result_status === 'delivered').length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Test Results</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Manage and upload test results for patient bookings</p>
            </div>

            {error && (
                <div className="px-4 py-3 rounded-lg text-sm border bg-red-50 border-red-200 text-red-700">{error}</div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard label="Pending" count={totalPending} icon={<Clock className="h-5 w-5" />} color="yellow" />
                <SummaryCard label="Processing" count={totalProcessing} icon={<AlertCircle className="h-5 w-5" />} color="blue" />
                <SummaryCard label="Completed" count={totalCompleted} icon={<CheckCircle2 className="h-5 w-5" />} color="green" />
                <SummaryCard label="Delivered" count={totalDelivered} icon={<Send className="h-5 w-5" />} color="purple" />
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by patient, test, or ID..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                </div>
                <div className="flex gap-2 flex-wrap">
                    {RESULT_STATUS_FILTERS.map(f => {
                        const Icon = f.icon;
                        return (
                            <button
                                key={f.value}
                                onClick={() => setResultStatusFilter(f.value)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    resultStatusFilter === f.value
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:bg-gray-600'
                                }`}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {f.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Results List */}
            {isLoading ? (
                <div className="flex items-center justify-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                </div>
            ) : filtered.length > 0 ? (
                <div className="space-y-4">
                    {paginatedItems.map((booking: DiagnosticBooking) => (
                        <Card key={booking.id}>
                            <div className="space-y-4">
                                {/* Booking Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                                                {booking.patient_name || 'Patient'}
                                            </h3>
                                            <StatusBadge status={booking.status} size="sm" />
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                            {booking.test_name || 'Test'} •{' '}
                                            {new Date(booking.booking_date).toLocaleDateString('en-IN')}
                                            {booking.booking_time && ` at ${booking.booking_time}`}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {booking.collection_type === 'home_collection'
                                                ? '🏠 Home Collection'
                                                : '🏥 Walk-in'}
                                        </p>
                                    </div>
                                    <div className="text-right space-y-1">
                                        <div className="flex items-center gap-2 justify-end">
                                            <span className="text-xs text-gray-500 dark:text-gray-400">Result:</span>
                                            <StatusBadge status={booking.result_status} size="sm" />
                                        </div>
                                        <p className="text-xs text-gray-400">ID: {booking.id.slice(0, 8)}</p>
                                    </div>
                                </div>

                                {/* Result Info */}
                                {booking.result_url && (
                                    <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-green-800">Result uploaded</p>
                                            {booking.result_notes && (
                                                <p className="text-xs text-green-600 mt-0.5">{booking.result_notes}</p>
                                            )}
                                        </div>
                                        <a
                                            href={booking.result_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-purple-600 hover:underline text-sm"
                                        >
                                            <Eye className="h-3.5 w-3.5" /> View Report
                                        </a>
                                    </div>
                                )}

                                {/* Upload Action — only for processing/completed bookings without a result */}
                                {(booking.status === 'processing' || booking.status === 'completed') &&
                                    !booking.result_url && (
                                        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                                            {uploadingId === booking.id ? (
                                                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
                                                    <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">
                                                        Upload Test Result
                                                    </h4>
                                                    <Input
                                                        label="Result URL *"
                                                        value={resultForm.result_url}
                                                        onChange={e =>
                                                            setResultForm(f => ({
                                                                ...f,
                                                                result_url: e.target.value,
                                                            }))
                                                        }
                                                        placeholder="https://... or upload URL"
                                                    />
                                                    <Input
                                                        label="Notes (optional)"
                                                        value={resultForm.result_notes}
                                                        onChange={e =>
                                                            setResultForm(f => ({
                                                                ...f,
                                                                result_notes: e.target.value,
                                                            }))
                                                        }
                                                        placeholder="Additional notes about the result"
                                                    />
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleUploadResult(booking.id)}
                                                            disabled={!resultForm.result_url}
                                                        >
                                                            Submit Result
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setUploadingId(null)}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setUploadingId(booking.id);
                                                        setResultForm({ result_url: '', result_notes: '' });
                                                    }}
                                                    leftIcon={<Upload className="h-3.5 w-3.5" />}
                                                >
                                                    Upload Result
                                                </Button>
                                            )}
                                        </div>
                                    )}

                                {/* Pending state hint */}
                                {booking.result_status === 'pending' &&
                                    booking.status !== 'processing' &&
                                    booking.status !== 'completed' && (
                                        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                            <Clock className="h-4 w-4 text-yellow-600" />
                                            <p className="text-sm text-yellow-700">
                                                Booking must be in &quot;processing&quot; or &quot;completed&quot; status
                                                before results can be uploaded.
                                            </p>
                                        </div>
                                    )}
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-48 text-gray-500 dark:text-gray-400">
                    <FileCheck className="h-12 w-12 text-gray-300 mb-3" />
                    <p>No results found{resultStatusFilter && ` with status "${resultStatusFilter}"`}</p>
                </div>
            )}
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

// ==================== Summary Card ====================
function SummaryCard({
    label,
    count,
    icon,
    color,
}: {
    label: string;
    count: number;
    icon: React.ReactNode;
    color: 'yellow' | 'blue' | 'green' | 'purple';
}) {
    const colorMap = {
        yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
        blue: 'bg-blue-50 text-blue-700 border-blue-200',
        green: 'bg-green-50 text-green-700 border-green-200',
        purple: 'bg-purple-50 text-purple-700 border-purple-200',
    };

    return (
        <div className={`rounded-lg border p-4 ${colorMap[color]}`}>
            <div className="flex items-center gap-2 mb-1">
                {icon}
                <span className="text-sm font-medium">{label}</span>
            </div>
            <p className="text-2xl font-bold">{count}</p>
        </div>
    );
}
