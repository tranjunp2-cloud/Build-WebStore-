import Link from 'next/link'

// Plan 260415 — static strings instead of useI18n. These components are
// rendered from a server component (preview/[siteId]/page.tsx) without an
// I18nProvider wrapper, so importing useI18n throws "must be used within
// I18nProvider" and crashes the whole preview route with a 500. Since
// these are edge-case error fallbacks (auth fail / no page / load error),
// English-only copy is acceptable until the preview tree gets its own
// provider wrapper.
export function PreviewAccessDenied() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
            <div className="p-8 bg-white rounded-lg shadow-xl max-w-md text-center">
                <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
                <p className="text-slate-600 mb-6">You do not have permission to preview this site.</p>
                <Link href="/dashboard" className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
                    Back to Dashboard
                </Link>
            </div>
        </div>
    )
}

export function PreviewNoPage() {
    return <div>No page found for this preview.</div>
}

export function PreviewLoadError() {
    return <div>Error loading preview. Please ensure you are logged in and have access to this site.</div>
}
