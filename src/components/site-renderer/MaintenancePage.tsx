'use client'

/**
 * Maintenance mode page (AC-3: US-F05-10)
 * Shown to public visitors when site is unpublished (was previously published).
 * HTTP 503 status is set by middleware for SEO crawlers.
 */
export function MaintenancePage({ siteName }: { siteName?: string }) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="mx-4 max-w-md text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-100">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                </div>
                <h1 className="mb-3 text-2xl font-bold text-slate-900">
                    {siteName ? `${siteName} is under maintenance` : 'Website is under maintenance'}
                </h1>
                <p className="text-base leading-relaxed text-slate-600">
                    We&apos;re updating the website. Please check back later.
                </p>
            </div>
        </div>
    )
}
