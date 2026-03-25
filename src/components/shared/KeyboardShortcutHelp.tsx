'use client';

import { useState, useCallback, useMemo } from 'react';
import { X, Keyboard } from 'lucide-react';
import { useKeyboardShortcuts, Shortcut } from '@/hooks/useKeyboardShortcuts';

interface KeyboardShortcutHelpProps {
    open: boolean;
    onClose: () => void;
    shortcuts: Shortcut[];
}

function KeyLabel({ text }: { text: string }) {
    return (
        <kbd className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-xs font-mono text-gray-700 dark:text-gray-300 min-w-[1.5rem] justify-center">
            {text}
        </kbd>
    );
}

function formatKey(s: Shortcut) {
    const parts: string[] = [];
    if (s.ctrl) parts.push('⌘');
    if (s.alt) parts.push('⌥');
    if (s.shift) parts.push('⇧');
    parts.push(s.key === ' ' ? 'Space' : s.key.toUpperCase());
    return parts;
}

export function KeyboardShortcutHelp({ open, onClose, shortcuts }: KeyboardShortcutHelpProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                        <Keyboard className="h-5 w-5 text-teal-500" />
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Keyboard Shortcuts</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="overflow-y-auto p-6 space-y-2">
                    {shortcuts.map((s, i) => (
                        <div key={i} className="flex items-center justify-between py-2">
                            <span className="text-sm text-gray-700 dark:text-gray-300">{s.description}</span>
                            <div className="flex items-center gap-1">
                                {formatKey(s).map((k, j) => (
                                    <KeyLabel key={j} text={k} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500 text-center">
                    Press <KeyLabel text="?" /> anywhere to toggle this help
                </div>
            </div>
        </div>
    );
}

/**
 * Higher-level hook: defines page-specific shortcuts + the &apos;?&apos; help toggle.
 * Returns { showHelp, setShowHelp, allShortcuts } so the page can render <KeyboardShortcutHelp>.
 */
export function usePageShortcuts(pageShortcuts: Shortcut[]) {
    const [showHelp, setShowHelp] = useState(false);

    const allShortcuts: Shortcut[] = useMemo(() => [
        ...pageShortcuts,
        {
            key: '?',
            shift: true,
            description: 'Show keyboard shortcuts',
            action: () => setShowHelp((prev) => !prev),
        },
    ], [pageShortcuts]);

    useKeyboardShortcuts(allShortcuts);

    return { showHelp, setShowHelp, allShortcuts };
}
