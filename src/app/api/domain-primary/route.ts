import { NextRequest, NextResponse } from 'next/server'
import { getCachedTenantByDomain } from '@/lib/cache/tenant'
import { storeUnavailableResponse } from '@/lib/storefront/cached-store-availability'

/**
 * REQ-F19-06: Primary domain check API
 * Called by middleware to determine if a custom domain is the primary domain for its tenant.
 * Returns { isPrimary: boolean, primaryDomain: string | null }
 */
export async function GET(req: NextRequest) {
    const host = req.nextUrl.searchParams.get('host')
    if (!host) {
        // 400 must carry an explicit `error` key so callers can distinguish a
        // client error from valid "no primary domain" data (which is 200 below).
        // Previously returned a success-shaped body with a 400 status (GH #1519 Bug 2).
        return NextResponse.json(
            { error: { code: 'MISSING_HOST', message: 'Query param "host" is required' } },
            { status: 400 },
        )
    }

    try {
        // Find the tenant that has this custom domain: the cached, per-domain-tagged lookup the storefront page
        // reads too. The middleware calls this on every custom-domain page view; it ran ~5 uncached statements
        // (array join + COUNT + depth-2 relations) each time (TC-PERF-066).
        const tenant = await getCachedTenantByDomain(host)

        if (tenant) {
            const domains = (tenant.customDomains as Array<{ domain: string; status: string; isPrimary?: boolean }>) || []
            const match = domains.find(d => d.domain === host && d.status === 'active')
            
            if (match) {
                const isPrimary = match.isPrimary === true
                const primaryEntry = domains.find(d => d.status === 'active' && d.isPrimary)
                const primaryDomain = primaryEntry?.domain ?? null
                // #2179: a banned or expired store gets the 503 unavailable page (middleware checks it before redirecting).
                const unavailable = await storeUnavailableResponse(tenant as { id: string | number; status?: unknown })

                return NextResponse.json({ isPrimary, primaryDomain, ...unavailable })
            }
        }

        // Domain not found in any tenant — serve normally
        return NextResponse.json({ isPrimary: true, primaryDomain: null })
    } catch {
        // On error, don't block traffic
        return NextResponse.json({ isPrimary: true, primaryDomain: null })
    }
}
