import Link from 'next/link'

export default function ForbiddenPage() {
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
            <h1 className="text-7xl font-bold text-white">403</h1>
            <p className="mt-3 text-lg text-white/60">Access denied</p>
            <p className="mt-1 text-sm text-white/40">
                You don&apos;t have permission to access this page. Contact your store owner to request access.
            </p>
            <Link
                href="/dashboard"
                className="mt-6 rounded-lg bg-[linear-gradient(90deg,#3b82f6_0%,#2dd4bf_100%)] px-5 py-2.5 text-sm font-medium !text-white transition-colors hover:opacity-90"
            >
                Go to Dashboard
            </Link>
        </div>
    )
}
