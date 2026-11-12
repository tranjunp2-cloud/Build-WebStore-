export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getCachedSiteByTenant, getCachedTenantByPreviousSlug, getCachedTenantBySlug } from '@/lib/cache/tenant'
import { storeUnavailableResponse } from '@/lib/storefront/cached-store-availability'

/**
 * GET /api/slug/redirect?slug=old-slug
 * Internal endpoint called by middleware to check if a slug is in previousSlugs.
 * Returns { redirect: true, newSlug: "current-slug" } if found and not expired.
 *
 * The middleware calls this on every storefront request (subdomain), so it reads the same cached, per-shop-tagged
 * lookups the storefront page reads (src/lib/cache/tenant.ts): no database work while the shop's entries are warm.
 * It ran ~6 uncached statements per page view (tenant + site at depth 2, each with a COUNT) (TC-PERF-066).
 */
export async function GET(req: NextRequest) {
    const slug = req.nextUrl.searchParams.get('slug')
    if (!slug) {
        return NextResponse.json({ redirect: false })
    }

    try {
        // First check if slug is a current tenant — no redirect needed
        const currentTenant = await getCachedTenantBySlug(slug)
        if (currentTenant) {
            // #2179: a banned or expired store gets the 503 unavailable page (before maintenance).
            const unavailable = await storeUnavailableResponse(currentTenant as { id: string | number; status?: unknown })
            if (unavailable) return NextResponse.json({ redirect: false, ...unavailable })
            // BUG-F05-006: Also return site status for maintenance mode check
            const site = (await getCachedSiteByTenant(String(currentTenant.id))) as
                | { status?: string | null; publishedAt?: string | null; name?: string | null }
                | null
            const maintenance = site?.status === 'draft' && !!site?.publishedAt
            return NextResponse.json({
                redirect: false,
                maintenance,
                siteName: maintenance ? (site?.name || '') : undefined,
            })
        }

        // Check previousSlugs across all tenants
        const tenant = await getCachedTenantByPreviousSlug(slug)
        if (tenant) {
            const match = (tenant.previousSlugs ?? []).find((ps) => ps.slug === slug)
            if (match && new Date(match.expiresAt) > new Date()) {
                return NextResponse.json({ redirect: true, newSlug: tenant.slug })
            }
        }

        return NextResponse.json({ redirect: false })
    } catch {
        return NextResponse.json({ redirect: false })
    }
}
