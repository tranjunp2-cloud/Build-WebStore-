import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { SHIPPING_DEFAULTS, RATE_MAX } from '@/lib/shipping'

export const maxDuration = 60

type RouteContext = { params: Promise<{ siteId: string }> }

function hasSiteAccess(user: any, site: any): boolean {
    if (user.roles?.includes('super-admin')) return true
    const tenantIds = user.tenants?.map((t: any) =>
        t.tenant && typeof t.tenant === 'object' ? t.tenant.id : t.tenant
    ).map(String) || []
    const siteTenantId = site.tenant && typeof site.tenant === 'object' ? site.tenant.id : site.tenant
    return tenantIds.includes(String(siteTenantId))
}

// Distinguishes "missing/empty" (→ use default) from "invalid/negative" (→ reject).
function parseOptionalSen(rm: unknown): { value: number | null; invalid: boolean } {
    if (rm === null || rm === undefined || rm === '') return { value: null, invalid: false }
    const n = Number(rm)
    if (!Number.isFinite(n) || n < 0) return { value: null, invalid: true }
    return { value: Math.round(n * 100), invalid: false }
}

/**
 * GET /api/sites/[siteId]/shipping-config
 * Public read — storefront SSR may consume; no auth required.
 */
export async function GET(_request: Request, ctx: RouteContext) {
    try {
        const { siteId } = await ctx.params
        const payload = await getPayload({ config })
        const site = await payload.findByID({ collection: 'sites', id: siteId, overrideAccess: true }).catch(() => null)
        if (!site) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Site not found' } },
                { status: 404 }
            )
        }
        return NextResponse.json({ success: true, data: { shippingConfig: (site as any).shippingConfig ?? null } })
    } catch (error: any) {
        console.error('[Shipping Config GET Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch shipping config' } },
            { status: 500 }
        )
    }
}

/**
 * PATCH /api/sites/[siteId]/shipping-config
 * Updates shippingConfig for a site. Requires site access.
 * Body: { enabled, westRateRm, eastRateRm, freeAboveRm }
 */
export const PATCH = withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const { siteId } = await ctx.params

        let body: any
        try {
            body = await request.json()
        } catch {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
                { status: 400 }
            )
        }

        const { enabled, westRateRm, eastRateRm, freeAboveRm } = body

        if (typeof enabled !== 'boolean' || westRateRm === undefined || eastRateRm === undefined) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'enabled (boolean), westRateRm, and eastRateRm are required' } },
                { status: 400 }
            )
        }

        const w = parseOptionalSen(westRateRm)
        const e = parseOptionalSen(eastRateRm)
        const f = parseOptionalSen(freeAboveRm)

        if (w.invalid || e.invalid) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rate must be RM 0 – RM 1,000' } },
                { status: 422 }
            )
        }
        if (f.invalid) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'Free threshold must be ≥ RM 0.01' } },
                { status: 422 }
            )
        }

        const westRate = w.value ?? SHIPPING_DEFAULTS.westRate
        const eastRate = e.value ?? SHIPPING_DEFAULTS.eastRate
        const freeAbove = f.value

        if (westRate > RATE_MAX || eastRate > RATE_MAX) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rate exceeds RM 1000' } },
                { status: 422 }
            )
        }

        if (freeAbove !== null && (freeAbove <= 0 || freeAbove > 10_000_000)) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'Free threshold must be between RM 0.01 and RM 100,000' } },
                { status: 422 }
            )
        }

        const payload = await getPayload({ config })

        const site = await payload.findByID({ collection: 'sites', id: siteId })
        if (!site) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Site not found' } },
                { status: 404 }
            )
        }

        if (!hasSiteAccess(user, site)) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } },
                { status: 403 }
            )
        }

        const updated = await payload.update({
            collection: 'sites',
            id: siteId,
            data: { shippingConfig: { enabled: !!enabled, westRate, eastRate, freeAbove } } as any,
        })

        return NextResponse.json({
            success: true,
            data: { shippingConfig: (updated as any).shippingConfig },
        })
    } catch (error: any) {
        console.error('[Shipping Config PATCH Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update shipping config' } },
            { status: 500 }
        )
    }
})
