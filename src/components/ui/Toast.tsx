'use client';

import { useEffect, useState, createContext, useContext, useCallback, ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => string;
    removeToast: (id: string) => void;
    clearToasts: () => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

// Toast icons
const icons = {
    success: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
    ),
    error: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
    ),
    warning: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
    ),
    info: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
};

// Toast styles
const styles = {
    success: 'bg-gradient-to-r from-emerald-500 to-green-500 text-white',
    error: 'bg-gradient-to-r from-red-500 to-rose-500 text-white',
    warning: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
    info: 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white',
};

// Individual Toast Component
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
    const [isLeaving, setIsLeaving] = useState(false);
    const [progress, setProgress] = useState(100);

    useEffect(() => {
        if (!toast.duration || toast.duration <= 0) return;

        const startTime = Date.now();
        const duration = toast.duration;

        const progressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
            setProgress(remaining);

            if (remaining <= 0) {
                clearInterval(progressInterval);
            }
        }, 50);

        const timeout = setTimeout(() => {
            setIsLeaving(true);
            setTimeout(onRemove, 300);
        }, duration);

        return () => {
            clearInterval(progressInterval);
            clearTimeout(timeout);
        };
    }, [toast.duration, onRemove]);

    const handleClose = () => {
        setIsLeaving(true);
        setTimeout(onRemove, 300);
    };

    return (
        <div
            className={`
        relative overflow-hidden rounded-xl shadow-2xl backdrop-blur-lg
        transform transition-all duration-300 ease-out
        ${isLeaving ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
        ${styles[toast.type]}
      `}
            role="alert"
        >
            <div className="flex items-start gap-3 p-4">
                {/* Icon */}
                <div className="flex-shrink-0 p-1 rounded-full bg-white/20">
                    {icons[toast.type]}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{toast.title}</p>
                    {toast.message && (
                        <p className="mt-1 text-sm opacity-90">{toast.message}</p>
                    )}
                    {toast.action && (
                        <button
                            onClick={toast.action.onClick}
                            className="mt-2 px-3 py-1 text-xs font-medium bg-white/20 hover:bg-white/30 rounded-md transition-colors"
                        >
                            {toast.action.label}
                        </button>
                    )}
                </div>

                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="flex-shrink-0 p-1 rounded-full hover:bg-white/20 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Progress Bar */}
            {toast.duration && toast.duration > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10">
                    <div
                        className="h-full bg-white/40 transition-all duration-100 ease-linear"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}
        </div>
    );
}

// Toast Container Component
function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return createPortal(
        <div
            className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none"
            aria-live="polite"
        >
            {toasts.map((toast) => (
                <div key={toast.id} className="pointer-events-auto">
                    <ToastItem toast={toast} onRemove={() => removeToast(toast.id)} />
                </div>
            ))}
        </div>,
        document.body
    );
}

// Toast Provider
export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newToast: Toast = {
            ...toast,
            id,
            duration: toast.duration ?? 5000,
        };

        setToasts((prev) => [...prev, newToast]);
        return id;
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const clearToasts = useCallback(() => {
        setToasts([]);
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    );
}

// Hook to use toasts
export function useToast() {
    const context = useContext(ToastContext);

    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }

    const { addToast, removeToast, clearToasts } = context;

    const toast = {
        success: (title: string, message?: string, options?: Partial<Toast>) =>
            addToast({ type: 'success', title, message, ...options }),
        error: (title: string, message?: string, options?: Partial<Toast>) =>
            addToast({ type: 'error', title, message, ...options }),
        warning: (title: string, message?: string, options?: Partial<Toast>) =>
            addToast({ type: 'warning', title, message, ...options }),
        info: (title: string, message?: string, options?: Partial<Toast>) =>
            addToast({ type: 'info', title, message, ...options }),
        custom: (toast: Omit<Toast, 'id'>) => addToast(toast),
        dismiss: removeToast,
        dismissAll: clearToasts,
    };

    return toast;
}

// Notification Bell Component with Badge
export function NotificationBell({
    count = 0,
    onClick,
}: {
    count?: number;
    onClick?: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="relative p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50"
        >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
            </svg>
            {count > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                    {count > 99 ? '99+' : count}
                </span>
            )}
        </button>
    );
}

// Real-time Notification Panel
export function NotificationPanel({
    notifications,
    isOpen,
    onClose,
    onClear,
    onNotificationClick,
}: {
    notifications: Array<{
        id?: string;
        type: string;
        title: string;
        message?: string;
        timestamp: string;
        data?: any;
    }>;
    isOpen: boolean;
    onClose: () => void;
    onClear?: () => void;
    onNotificationClick?: (notification: any) => void;
}) {
    if (!isOpen) return null;

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'success':
            case 'appointment':
                return 'bg-emerald-500';
            case 'error':
            case 'emergency':
                return 'bg-red-500';
            case 'warning':
                return 'bg-amber-500';
            case 'order':
                return 'bg-orange-500';
            case 'consultation':
                return 'bg-purple-500';
            default:
                return 'bg-blue-500';
        }
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={onClose} />

            {/* Panel */}
            <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl z-50 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
                    {notifications.length > 0 && onClear && (
                        <button
                            onClick={onClear}
                            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            Clear all
                        </button>
                    )}
                </div>

                {/* Notifications List */}
                <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 dark:text-gray-500">
                            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                            <p>No notifications</p>
                        </div>
                    ) : (
                        notifications.map((notification, index) => (
                            <div
                                key={notification.id || index}
                                onClick={() => onNotificationClick?.(notification)}
                                className="flex items-start gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer border-b border-gray-100 dark:border-gray-700/50 last:border-0 transition-colors"
                            >
                                <div className={`w-2 h-2 rounded-full mt-2 ${getTypeColor(notification.type)}`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{notification.title}</p>
                                    {notification.message && (
                                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{notification.message}</p>
                                    )}
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatTime(notification.timestamp)}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
