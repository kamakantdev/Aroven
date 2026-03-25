'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

/**
 * Dynamically imported OsmMap — prevents SSR issues with Leaflet
 * (Leaflet requires `window` and `document`).
 *
 * Usage: import OsmMap from '@/components/shared/OsmMapDynamic';
 */
const OsmMap = dynamic(() => import('./OsmMap'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center bg-gray-50 rounded-xl animate-pulse" style={{ height: '400px' }}>
            <span className="text-gray-400 text-sm">Loading map...</span>
        </div>
    ),
});

export type { MapMarker } from './OsmMap';
export default OsmMap;
