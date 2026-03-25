'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8">
                    <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full">
                        <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        Something went wrong
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
                        An unexpected error occurred. Please try refreshing the page.
                    </p>
                    {this.state.error && (
                        <pre className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg max-w-lg overflow-auto">
                            {this.state.error.message}
                        </pre>
                    )}
                    <Button
                        onClick={this.handleReset}
                        leftIcon={<RefreshCw className="h-4 w-4" />}
                    >
                        Try Again
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
