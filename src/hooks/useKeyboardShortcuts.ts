'use client';

import { useEffect, useCallback } from 'react';

export interface Shortcut {
    key: string;            // e.g. 'k', '/', '?', 'n'
    ctrl?: boolean;         // Ctrl / Cmd
    shift?: boolean;
    alt?: boolean;
    description: string;    // shown in help modal
    action: () => void;
}

/**
 * Registers global keyboard shortcuts. Ignores events originating from
 * inputs, textareas, selects, or elements with contentEditable.
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
    const handler = useCallback(
        (e: KeyboardEvent) => {
            // Skip when user is typing in form fields
            const tag = (e.target as HTMLElement)?.tagName;
            if (
                tag === 'INPUT' ||
                tag === 'TEXTAREA' ||
                tag === 'SELECT' ||
                (e.target as HTMLElement)?.isContentEditable
            ) {
                return;
            }

            for (const s of shortcuts) {
                const ctrlMatch = s.ctrl
                    ? e.ctrlKey || e.metaKey
                    : !e.ctrlKey && !e.metaKey;
                const shiftMatch = s.shift ? e.shiftKey : !e.shiftKey;
                const altMatch = s.alt ? e.altKey : !e.altKey;

                if (e.key.toLowerCase() === s.key.toLowerCase() && ctrlMatch && shiftMatch && altMatch) {
                    e.preventDefault();
                    s.action();
                    return;
                }
            }
        },
        [shortcuts]
    );

    useEffect(() => {
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [handler]);
}
