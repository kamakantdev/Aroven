'use client';

export default function HospitalLoading() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-28 bg-gray-200 dark:bg-gray-800 rounded-xl" />
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl" />
                <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl" />
            </div>
            <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl" />
        </div>
    );
}
