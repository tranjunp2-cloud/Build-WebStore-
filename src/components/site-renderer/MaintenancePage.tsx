'use client'

import { STORE_UNAVAILABLE_COPY, type StoreUnavailableLocale } from '@/lib/storefront/store-unavailable'

/**
 * Maintenance mode page (AC-3: US-F05-10)
 * Shown to public visitors when site is unpublished (was previously published).
 * `variant="unavailable"`: banned or expired store (#2179) — fixed copy, no store name, no reason.
 * HTTP 503 status is set by middleware for SEO crawlers; this page is the fallback render.
 */
export function MaintenancePage({ siteName, variant = 'maintenance', locale = 'en' }: {
    siteName?: string
    variant?: 'maintenance' | 'unavailable'
    locale?: StoreUnavailableLocale
}) {
    if (variant === 'unavailable') {
        const copy = STORE_UNAVAILABLE_COPY[locale] ?? STORE_UNAVAILABLE_COPY.en
        return (
            <div lang={locale} className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="mx-4 max-w-md text-center">
                    <h1 className="mb-3 text-2xl font-bold text-slate-900">{copy.title}</h1>
                    <p className="text-base leading-relaxed text-slate-600">{copy.message}</p>
                </div>
            </div>
        )
    }
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
