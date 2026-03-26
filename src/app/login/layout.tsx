import { Suspense, type ReactNode } from 'react';

function LoginLayoutFallback() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
            <div
                className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"
                aria-label="Loading login page"
            />
        </div>
    );
}

/**
 * Layout for login pages.
 * Wraps children in Suspense because login pages use useSearchParams().
 */
export default function LoginLayout({ children }: Readonly<{ children: ReactNode }>) {
    return (
        <Suspense fallback={<LoginLayoutFallback />}>
            {children}
        </Suspense>
    );
}
