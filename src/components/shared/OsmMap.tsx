'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';

export interface MapMarker {
    id: string;
    lat: number;
    lng: number;
    title: string;
    popup?: string;
    color?: string;
    /** If true, show a pulsing animation (for live tracking) */
    pulse?: boolean;
}

interface OsmMapProps {
    /** Map center latitude */
    lat?: number;
    /** Map center longitude */
    lng?: number;
    /** Zoom level (1-19, 15 is street level) */
    zoom?: number;
    /** Array of markers to display */
    markers?: MapMarker[];
    /** CSS class for the container */
    className?: string;
    /** Height of the map */
    height?: string;
    /** Whether to auto-fit bounds to markers */
    fitBounds?: boolean;
    /** Callback when a marker is clicked */
    onMarkerClick?: (marker: MapMarker) => void;
}

/**
 * Reusable OpenStreetMap component using Leaflet.
 * No API key required — uses free OSM tiles.
 */
export default function OsmMap({
    lat = 20.5937,
    lng = 78.9629,
    zoom = 13,
    markers = [],
    className = '',
    height = '400px',
    fitBounds = false,
    onMarkerClick,
}: OsmMapProps) {
    const mapRef = useRef<L.Map | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const markersLayerRef = useRef<L.LayerGroup | null>(null);

    // Initialize map
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
            center: [lat, lng],
            zoom,
            scrollWheelZoom: true,
            zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
        }).addTo(map);

        markersLayerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;

        // Fix Leaflet icon paths for Next.js bundling
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        });

        return () => {
            map.remove();
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update center & zoom
    useEffect(() => {
        if (!mapRef.current) return;
        mapRef.current.setView([lat, lng], zoom);
    }, [lat, lng, zoom]);

    // Update markers
    useEffect(() => {
        if (!mapRef.current || !markersLayerRef.current) return;
        markersLayerRef.current.clearLayers();

        markers.forEach((m) => {
            const icon = createColoredIcon(m.color || '#D32F2F', m.pulse);
            const marker = L.marker([m.lat, m.lng], { icon, title: m.title });

            if (m.popup) {
                marker.bindPopup(`<strong>${m.title}</strong><br/>${m.popup}`);
            } else {
                marker.bindPopup(`<strong>${m.title}</strong>`);
            }

            if (onMarkerClick) {
                marker.on('click', () => onMarkerClick(m));
            }

            markersLayerRef.current!.addLayer(marker);
        });

        // Auto-fit bounds if enabled and markers exist
        if (fitBounds && markers.length > 0) {
            const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
            mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
        }
    }, [markers, fitBounds, onMarkerClick]);

    return (
        <div
            ref={containerRef}
            className={`rounded-xl overflow-hidden ${className}`}
            style={{ height, width: '100%' }}
        />
    );
}

/**
 * Create a colored circle marker icon using SVG data URI.
 */
function createColoredIcon(color: string, pulse?: boolean): L.DivIcon {
    const size = 28;
    const pulseRing = pulse
        ? `<div style="position:absolute;top:-6px;left:-6px;width:${size + 12}px;height:${size + 12}px;border-radius:50%;background:${color}33;animation:pulse-ring 1.5s ease-out infinite;"></div>`
        : '';

    return L.divIcon({
        className: 'custom-marker',
        html: `
            <div style="position:relative;width:${size}px;height:${size}px;">
                ${pulseRing}
                <div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
            </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
    });
}
