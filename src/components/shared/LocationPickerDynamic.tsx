'use client';

import dynamic from 'next/dynamic';

/**
 * Dynamically imported LocationPicker — prevents SSR issues with Leaflet.
 * Usage: import LocationPicker from '@/components/shared/LocationPickerDynamic';
 */
const LocationPicker = dynamic(() => import('./LocationPicker'), {
    ssr: false,
    loading: () => (
        <div className="space-y-2">
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-xl animate-pulse border border-gray-200 dark:border-gray-700" style={{ height: '300px' }}>
                <span className="text-gray-400 text-sm">Loading map...</span>
            </div>
        </div>
    ),
});

export default LocationPicker;
