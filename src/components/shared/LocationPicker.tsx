'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { MapPin, Search, Loader2, Navigation, X } from 'lucide-react';

interface LocationPickerProps {
    /** Current latitude */
    latitude?: number | null;
    /** Current longitude */
    longitude?: number | null;
    /** Callback when location changes */
    onLocationChange?: (lat: number, lng: number) => void;
    /** Current address text — used for auto-geocode */
    address?: string;
    /** Map height */
    height?: string;
    /** Accent color class */
    accentColor?: string;
    /** Whether location is read-only (just preview) */
    readOnly?: boolean;
    /** Label text */
    label?: string;
}

/**
 * Interactive Location Picker using OpenStreetMap + Nominatim (free geocoding).
 * - Click map to set pin
 * - Search by address
 * - Auto-geocode from address text
 * - "Use my location" button for GPS
 */
export default function LocationPicker({
    latitude,
    longitude,
    onLocationChange: _onLocationChange,
    address,
    height = '300px',
    accentColor = 'blue',
    readOnly = false,
    label = 'Facility Location',
}: LocationPickerProps) {
    // Provide a safe no-op default for read-only usage
    const onLocationChange = _onLocationChange || (() => {});

    // Tailwind CSS purges dynamic class names at build time, so we must use
    // a pre-computed mapping of color → full class strings.
    const accentClasses: Record<string, { bg: string; hover: string }> = {
        blue:   { bg: 'bg-blue-600',   hover: 'hover:bg-blue-700' },
        teal:   { bg: 'bg-teal-600',   hover: 'hover:bg-teal-700' },
        green:  { bg: 'bg-green-600',  hover: 'hover:bg-green-700' },
        purple: { bg: 'bg-purple-600', hover: 'hover:bg-purple-700' },
        red:    { bg: 'bg-red-600',    hover: 'hover:bg-red-700' },
        amber:  { bg: 'bg-amber-600',  hover: 'hover:bg-amber-700' },
        cyan:   { bg: 'bg-cyan-600',   hover: 'hover:bg-cyan-700' },
    };
    const accent = accentClasses[accentColor] || accentClasses.blue;
    const mapRef = useRef<L.Map | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const markerRef = useRef<L.Marker | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [geocodeError, setGeocodeError] = useState('');
    const [displayLat, setDisplayLat] = useState<number | null>(latitude ?? null);
    const [displayLng, setDisplayLng] = useState<number | null>(longitude ?? null);

    // Default center: India
    const defaultLat = 20.5937;
    const defaultLng = 78.9629;
    const defaultZoom = latitude && longitude ? 15 : 5;

    // Fix Leaflet icon paths (Next.js bundling issue)
    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        });
    }, []);

    // Initialize map
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
            center: [latitude ?? defaultLat, longitude ?? defaultLng],
            zoom: defaultZoom,
            scrollWheelZoom: true,
            zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
        }).addTo(map);

        // Add marker if coordinates exist
        if (latitude && longitude) {
            markerRef.current = L.marker([latitude, longitude], { draggable: !readOnly }).addTo(map);
            if (!readOnly && markerRef.current) {
                markerRef.current.on('dragend', () => {
                    const pos = markerRef.current!.getLatLng();
                    setDisplayLat(pos.lat);
                    setDisplayLng(pos.lng);
                    onLocationChange(pos.lat, pos.lng);
                });
            }
        }

        // Click to place marker (if not read-only)
        if (!readOnly) {
            map.on('click', (e: L.LeafletMouseEvent) => {
                const { lat, lng } = e.latlng;
                setMarkerPosition(lat, lng);
                onLocationChange(lat, lng);
            });
        }

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
            markerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update marker position externally
    useEffect(() => {
        if (latitude && longitude && mapRef.current) {
            setMarkerPosition(latitude, longitude);
            mapRef.current.setView([latitude, longitude], 15);
        }
    }, [latitude, longitude]);

    const setMarkerPosition = useCallback((lat: number, lng: number) => {
        setDisplayLat(lat);
        setDisplayLng(lng);

        if (!mapRef.current) return;

        if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
        } else {
            markerRef.current = L.marker([lat, lng], { draggable: !readOnly }).addTo(mapRef.current);
            if (!readOnly) {
                markerRef.current.on('dragend', () => {
                    const pos = markerRef.current!.getLatLng();
                    setDisplayLat(pos.lat);
                    setDisplayLng(pos.lng);
                    onLocationChange(pos.lat, pos.lng);
                });
            }
        }

        mapRef.current.setView([lat, lng], Math.max(mapRef.current.getZoom(), 15));
    }, [readOnly, onLocationChange]);

    // Geocode address text via Nominatim
    const geocodeAddress = useCallback(async (query: string) => {
        if (!query || query.length < 5) return;
        setIsGeocoding(true);
        setGeocodeError('');
        try {
            const encoded = encodeURIComponent(query);
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=in`,
                { headers: { 'User-Agent': 'SwastikHealthApp/1.0' } }
            );
            const data = await res.json();
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lng = parseFloat(data[0].lon);
                setMarkerPosition(lat, lng);
                onLocationChange(lat, lng);
            } else {
                setGeocodeError('Could not find this address. Try placing the pin manually.');
            }
        } catch {
            setGeocodeError('Geocoding service unavailable. Place pin manually.');
        }
        setIsGeocoding(false);
    }, [setMarkerPosition, onLocationChange]);

    // Search handler
    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        setGeocodeError('');
        try {
            const encoded = encodeURIComponent(searchQuery);
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=in`,
                { headers: { 'User-Agent': 'SwastikHealthApp/1.0' } }
            );
            const data = await res.json();
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lng = parseFloat(data[0].lon);
                setMarkerPosition(lat, lng);
                onLocationChange(lat, lng);
            } else {
                setGeocodeError('Location not found. Try a different search term.');
            }
        } catch {
            setGeocodeError('Search failed. Check your connection.');
        }
        setIsSearching(false);
    };

    // Use GPS location
    const handleUseMyLocation = () => {
        if (!navigator.geolocation) {
            setGeocodeError('Geolocation not supported by your browser.');
            return;
        }
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude: lat, longitude: lng } = pos.coords;
                setMarkerPosition(lat, lng);
                onLocationChange(lat, lng);
                setIsLocating(false);
            },
            () => {
                setGeocodeError('Could not get your location. Please allow location access.');
                setIsLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    // Auto-geocode when address prop changes (debounced)
    useEffect(() => {
        if (!address || readOnly || (displayLat && displayLng)) return;
        const timer = setTimeout(() => {
            geocodeAddress(address);
        }, 1500); // Wait 1.5s after user stops typing
        return () => clearTimeout(timer);
    }, [address, readOnly, geocodeAddress]); // intentionally not including displayLat/displayLng

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                <MapPin className="inline h-4 w-4 mr-1" />
                {label}
            </label>

            {/* Search bar + GPS button */}
            {!readOnly && (
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Search location"
                            className="w-full px-3 py-2 pl-9 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={handleSearch}
                        disabled={isSearching}
                        className={`px-3 py-2 ${accent.bg} text-white text-sm rounded-lg ${accent.hover} disabled:opacity-50 flex items-center gap-1`}
                    >
                        {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        Search
                    </button>
                    <button
                        onClick={handleUseMyLocation}
                        disabled={isLocating}
                        className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center gap-1"
                        title="Use my current location"
                    >
                        {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                    </button>
                </div>
            )}

            {/* Auto-geocode indicator */}
            {isGeocoding && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Auto-detecting location from address...
                </div>
            )}

            {/* Error */}
            {geocodeError && (
                <p className="text-xs text-amber-600 dark:text-amber-400">{geocodeError}</p>
            )}

            {/* Map */}
            <div
                ref={containerRef}
                className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700"
                style={{ height, width: '100%' }}
            />

            {/* Coordinate display */}
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                {displayLat && displayLng ? (
                    <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-green-500" />
                        {displayLat.toFixed(6)}, {displayLng.toFixed(6)}
                    </span>
                ) : (
                    <span className="text-amber-500">
                        {readOnly ? 'No coordinates available' : 'Click the map or search to set location'}
                    </span>
                )}
                {!readOnly && displayLat && displayLng && (
                    <button
                        onClick={() => {
                            setDisplayLat(null);
                            setDisplayLng(null);
                            if (markerRef.current && mapRef.current) {
                                mapRef.current.removeLayer(markerRef.current);
                                markerRef.current = null;
                            }
                            onLocationChange(0, 0);
                        }}
                        className="text-red-500 hover:text-red-600 text-xs"
                    >
                        Clear
                    </button>
                )}
            </div>

            {!readOnly && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                    Click the map to place a pin, drag it to adjust, or search for your address. Accurate location helps patients find you.
                </p>
            )}
        </div>
    );
}
