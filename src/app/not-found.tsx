import Link from 'next/link';

/**
 * Custom 404 page shown when a route is not found.
 */
export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="text-7xl font-bold text-gray-200 dark:text-gray-800">404</div>
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                        Page Not Found
                    </h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                        The page you&apos;re looking for doesn&apos;t exist or has been moved.
                    </p>
                </div>
                <Link
                    href="/"
                    className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                    Back to Home
                </Link>
            </div>
        </div>
    );
}
