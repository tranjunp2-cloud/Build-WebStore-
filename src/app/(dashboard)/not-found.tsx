import Link from 'next/link'

export default function DashboardNotFound() {
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
            <h1 className="text-7xl font-bold text-white">404</h1>
            <p className="mt-3 text-lg text-white/60">Page not found</p>
            <p className="mt-1 text-sm text-white/40">
                The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>
            <Link
                href="/dashboard"
                className="mt-6 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
            >
                Go to Dashboard
            </Link>
        </div>
    )
}
