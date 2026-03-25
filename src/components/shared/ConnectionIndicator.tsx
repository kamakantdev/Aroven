'use client';

import { useSocket } from '@/hooks/useSocket';
import { Wifi, WifiOff } from 'lucide-react';

/**
 * Tiny indicator dot + tooltip showing WebSocket connection status.
 * Drop this into any layout header — it auto-hooks into the singleton socket.
 */
export function ConnectionIndicator() {
    const { isConnected } = useSocket();

    return (
        <div className="relative group flex items-center" title={isConnected ? 'Real-time connected' : 'Reconnecting…'}>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors select-none cursor-default"
                style={{ background: isConnected ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }}>
                {isConnected ? (
                    <>
                        <Wifi className="h-3 w-3 text-green-500" />
                        <span className="text-green-700 dark:text-green-400 hidden sm:inline">Live</span>
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                        </span>
                    </>
                ) : (
                    <>
                        <WifiOff className="h-3 w-3 text-red-500" />
                        <span className="text-red-700 dark:text-red-400 hidden sm:inline">Offline</span>
                        <span className="relative flex h-2 w-2">
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                        </span>
                    </>
                )}
            </div>
        </div>
    );
}
