'use client';

import { useState, useCallback } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
    isLoading?: boolean;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
}

const VARIANT_CONFIG = {
    danger: {
        icon: 'bg-red-100 dark:bg-red-900/30',
        iconColor: 'text-red-600 dark:text-red-400',
        button: 'danger' as const,
    },
    warning: {
        icon: 'bg-yellow-100 dark:bg-yellow-900/30',
        iconColor: 'text-yellow-600 dark:text-yellow-400',
        button: 'primary' as const,
    },
    info: {
        icon: 'bg-blue-100 dark:bg-blue-900/30',
        iconColor: 'text-blue-600 dark:text-blue-400',
        button: 'primary' as const,
    },
};

export function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'danger',
    isLoading = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    if (!isOpen) return null;

    const config = VARIANT_CONFIG[variant];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={!isLoading ? onCancel : undefined} />

            {/* Dialog */}
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md animate-in fade-in zoom-in-95">
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-full ${config.icon}`}>
                            <AlertTriangle className={`h-6 w-6 ${config.iconColor}`} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                {title}
                            </h3>
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                {message}
                            </p>
                        </div>
                        {!isLoading && (
                            <button
                                onClick={onCancel}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            >
                                <X className="h-5 w-5 text-gray-400" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 px-6 pb-6">
                    <Button
                        variant="outline"
                        onClick={onCancel}
                        disabled={isLoading}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={config.button}
                        onClick={onConfirm}
                        isLoading={isLoading}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}

/** Hook for easy confirm dialog state management */
export function useConfirmDialog() {
    const [state, setState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        confirmLabel?: string;
        variant?: 'danger' | 'warning' | 'info';
        onConfirm: () => void | Promise<void>;
        onCancel: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
        onCancel: () => {},
    });

    const confirm = useCallback(
        (options: {
            title: string;
            message: string;
            confirmLabel?: string;
            variant?: 'danger' | 'warning' | 'info';
        }): Promise<boolean> => {
            return new Promise((resolve) => {
                setState({
                    isOpen: true,
                    ...options,
                    onConfirm: () => {
                        setState((prev) => ({ ...prev, isOpen: false }));
                        resolve(true);
                    },
                    onCancel: () => {
                        setState((prev) => ({ ...prev, isOpen: false }));
                        resolve(false);
                    },
                });
            });
        },
        []
    );

    const cancel = useCallback(() => {
        state.onCancel();
    }, [state]);

    return {
        dialogProps: {
            isOpen: state.isOpen,
            title: state.title,
            message: state.message,
            confirmLabel: state.confirmLabel,
            variant: state.variant,
            onConfirm: state.onConfirm,
            onCancel: cancel,
        },
        confirm,
    };
}
