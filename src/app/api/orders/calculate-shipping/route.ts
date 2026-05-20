import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
    getShippingRate,
    classifyRegion,
    MY_STATES,
    HINT_HIGHLIGHT_THRESHOLD,
} from '@/lib/shipping'

export const maxDuration = 60

function badRequest(code: string, message: string, status = 400) {
    return NextResponse.json({ success: false, error: { code, message } }, { status })
}

/**
 * POST /api/orders/calculate-shipping
 * Public — no auth required (storefront checkout context).
 * Body: { siteId, state, subtotalSen }
 */
export async function POST(request: Request) {
    try {
        let body: any
        try {
            body = await request.json()
        } catch {
            return badRequest('VALIDATION_ERROR', 'Invalid JSON body')
        }

        if (body === null || typeof body !== 'object' || Array.isArray(body)) {
            return badRequest('VALIDATION_ERROR', 'Request body must be a JSON object')
        }

        const { siteId, state, subtotalSen } = body

        if (typeof siteId !== 'string' || siteId.length === 0 || siteId.length > 100) {
            return badRequest('VALIDATION_ERROR', 'siteId required')
        }
        if (typeof state !== 'string' || !(MY_STATES as readonly string[]).includes(state)) {
            return badRequest('INVALID_STATE', 'Invalid Malaysia state')
        }
        if (typeof subtotalSen !== 'number' || !Number.isFinite(subtotalSen) || subtotalSen < 0 || !Number.isInteger(subtotalSen)) {
            return badRequest('VALIDATION_ERROR', 'subtotalSen must be a non-negative integer (sen)')
        }

        const payload = await getPayload({ config })
        const site = await payload.findByID({ collection: 'sites', id: siteId, overrideAccess: true }).catch(() => null)
        if (!site) {
            return badRequest('NOT_FOUND', 'Site not found', 404)
        }

        const shippingConfig = (site as any).shippingConfig ?? null
        const fee = getShippingRate(state, shippingConfig, subtotalSen)
        const region = classifyRegion(state)
        const shippingEnabled = shippingConfig?.enabled !== false
        const isFree =
            fee === 0 &&
            shippingEnabled &&
            shippingConfig?.freeAbove != null &&
            subtotalSen >= shippingConfig.freeAbove

        let hint: { tier: 'highlight' | 'neutral'; gap: number } | undefined
        if (shippingEnabled && shippingConfig?.freeAbove != null && subtotalSen < shippingConfig.freeAbove) {
            const gap = shippingConfig.freeAbove - subtotalSen
            const tier = gap <= HINT_HIGHLIGHT_THRESHOLD ? 'highlight' : 'neutral'
            hint = { tier, gap }
        }

        return NextResponse.json({
            success: true,
            data: { fee, isFree, region, ...(hint ? { hint } : {}) },
        })
    } catch (error: any) {
        console.error('[Calculate Shipping Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to calculate shipping' } },
            { status: 500 }
        )
    }
}
