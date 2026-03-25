'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: Theme;
    resolvedTheme: 'light' | 'dark';
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: 'system',
    resolvedTheme: 'light',
    setTheme: () => {},
    toggleTheme: () => {},
});

export function useTheme() {
    return useContext(ThemeContext);
}

function getSystemTheme(): 'light' | 'dark' {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('system');
    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
    const [mounted, setMounted] = useState(false);

    // Load saved theme on mount
    useEffect(() => {
        const saved = localStorage.getItem('swastik-theme') as Theme | null;
        if (saved && ['light', 'dark', 'system'].includes(saved)) {
            setThemeState(saved);
        }
        setMounted(true);
    }, []);

    // Resolve theme and apply to <html>
    useEffect(() => {
        if (!mounted) return;

        const resolved = theme === 'system' ? getSystemTheme() : theme;
        setResolvedTheme(resolved);

        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(resolved);

        // Also set a color-scheme meta for native UI elements
        root.style.colorScheme = resolved;
    }, [theme, mounted]);

    // Listen for system theme changes when in 'system' mode
    useEffect(() => {
        if (!mounted || theme !== 'system') return;

        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => {
            setResolvedTheme(e.matches ? 'dark' : 'light');
            const root = document.documentElement;
            root.classList.remove('light', 'dark');
            root.classList.add(e.matches ? 'dark' : 'light');
            root.style.colorScheme = e.matches ? 'dark' : 'light';
        };

        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [theme, mounted]);

    const setTheme = (t: Theme) => {
        setThemeState(t);
        localStorage.setItem('swastik-theme', t);
    };

    const toggleTheme = () => {
        const next = resolvedTheme === 'light' ? 'dark' : 'light';
        setTheme(next);
    };

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}
