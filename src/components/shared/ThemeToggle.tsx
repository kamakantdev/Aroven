'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/components/shared/ThemeProvider';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
    const { theme, setTheme, resolvedTheme } = useTheme();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const options = [
        { value: 'light' as const, icon: Sun, label: 'Light' },
        { value: 'dark' as const, icon: Moon, label: 'Dark' },
        { value: 'system' as const, icon: Monitor, label: 'System' },
    ];

    const CurrentIcon = resolvedTheme === 'dark' ? Moon : Sun;

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(!open)}
                className={cn(
                    'p-2 rounded-lg transition-colors',
                    'hover:bg-gray-100 dark:hover:bg-gray-700',
                    'text-gray-600 dark:text-gray-300'
                )}
                aria-label="Toggle theme"
            >
                <CurrentIcon className="h-5 w-5" />
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                    {options.map((opt) => {
                        const Icon = opt.icon;
                        const isActive = theme === opt.value;
                        return (
                            <button
                                key={opt.value}
                                onClick={() => { setTheme(opt.value); setOpen(false); }}
                                className={cn(
                                    'flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors',
                                    isActive
                                        ? 'text-primary-600 bg-gray-50 dark:bg-gray-700/50 font-medium'
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
