import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
    getShippingRate,
    classifyRegion,
    MY_STATES,
    HINT_HIGHLIGHT_THRESHOLD,
} from '@/lib/shipping'
import { getRates } from '@/lib/shipping/get-rates'
import { productWeightToGrams, DEFAULT_ITEM_WEIGHT_GRAMS } from '@/lib/shipping/product-weight'
import { getValidToken } from '@/lib/shipping/easyparcel/token-manager'
import { getDefaultWarehouse, isEpReady } from '@/lib/shipping/easyparcel/warehouse'

export const maxDuration = 60

function badRequest(code: string, message: string, status = 400) {
    return NextResponse.json({ success: false, error: { code, message } }, { status })
}

/**
 * POST /api/orders/calculate-shipping
 * Public — no auth required (storefront checkout context).
 * Body: { siteId, state, subtotalSen, items?: [{ productId, quantity, weightG?: number }], codAmountSen?: number, codProbeSen?: number }
 *
 * When `items` is provided with EP enabled, returns live EP rates + backward-compat `fee` field.
 * When `items` is omitted or EP is disabled/fails, falls back to flat rate.
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

        const { siteId, state, subtotalSen, items, codAmountSen, codProbeSen, destPostcode } = body

        if (typeof siteId !== 'string' || siteId.length === 0 || siteId.length > 100) {
            return badRequest('VALIDATION_ERROR', 'siteId required')
        }
        // Destination postcode — required for an accurate EP quotation. Optional/ignored for flat rate.
        const receiverPostcode = typeof destPostcode === 'string' && /^\d{4,6}$/.test(destPostcode) ? destPostcode : ''
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

        // Resolve EP token via tenant integration settings
        const tenantId = typeof (site as any).tenant === 'object' ? (site as any).tenant?.id : (site as any).tenant
        let epToken: string | null = null
        let warehousePostcode = '47500'
        let warehouseState = ''

        if (tenantId) {
            const tenantDoc = await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true }).catch(() => null)
            const epIntegration = (tenantDoc as any)?.easyParcelIntegration ?? {}
            if (epIntegration.enabled && isEpReady(epIntegration)) {
                try {
                    epToken = await getValidToken(epIntegration, tenantId, payload)
                } catch {
                    // token expired or not connected — falls back to flat rate below
                }
            }
            const defaultWh = getDefaultWarehouse(epIntegration)
            warehousePostcode = defaultWh.postcode ?? '47500'
            warehouseState = defaultWh.state ?? ''
        }

        // Compute total weight from items (optional). Per-item precedence: client weightG
        // (grams) → server-side Products.weight lookup (KG per GH-1458, converted to grams)
        // → 500 g default. The lookup keeps the displayed quote consistent with the weight
        // the checkout routes charge with; on lookup failure the quote degrades to defaults.
        let totalWeightGrams = 500 // single-item fallback when items not sent
        if (Array.isArray(items) && items.length > 0) {
            const weightByProduct = new Map<string, number>()
            const lookupIds = items
                .filter((i: any) => !(typeof i.weightG === 'number' && i.weightG > 0) && i.productId != null)
                .map((i: any) => i.productId)
            if (lookupIds.length > 0) {
                try {
                    const productDocs = await payload.find({
                        collection: 'products',
                        where: { id: { in: lookupIds } },
                        limit: lookupIds.length,
                        depth: 0,
                        overrideAccess: true,
                    })
                    for (const doc of productDocs.docs as any[]) {
                        weightByProduct.set(String(doc.id), productWeightToGrams(doc.weight))
                    }
                } catch {
                    // public quote endpoint — never fail the fee calc over a weight lookup
                }
            }
            totalWeightGrams = items.reduce((acc: number, item: any) => {
                const w = typeof item.weightG === 'number' && item.weightG > 0
                    ? item.weightG
                    : weightByProduct.get(String(item.productId)) ?? DEFAULT_ITEM_WEIGHT_GRAMS
                const qty = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1
                return acc + w * qty
            }, 0)
        }

        // When items provided: use hybrid router (EP or flat fallback)
        if (Array.isArray(items) && items.length > 0 && epToken) {
            const rateResult = await getRates(
                {
                    weightGrams: totalWeightGrams,
                    destPostcode: receiverPostcode,
                    destState: state,
                    senderPostcode: warehousePostcode,
                    senderState: warehouseState,
                    subtotalSen,
                    codAmountSen: typeof codAmountSen === 'number' && codAmountSen > 0 ? codAmountSen : undefined,
                    // Probe-only COD verdict (PD-021) — lets the storefront pre-disable the COD
                    // option on the first fetch without COD-filtering this pick.
                    codProbeSen: typeof codProbeSen === 'number' && codProbeSen > 0 ? codProbeSen : undefined,
                },
                epToken,
                shippingConfig ?? {},
                state,
            )

            const bestRate = rateResult.rates[0]
            const fee = bestRate.priceSen / 100

            const region = classifyRegion(state)
            const isFree = bestRate.priceSen === 0

            return NextResponse.json({
                success: true,
                data: {
                    fee,
                    isFree,
                    region,
                    rates: rateResult.rates,
                    degraded: rateResult.degraded,
                    codAvailable: bestRate.codAvailable === true,
                    // PD-021: set when no courier passes R1/R2/R3 for the COD (probe) amount on
                    // this route — storefront disables the COD option with a reason-specific helper.
                    ...(rateResult.codIneligible ? { codIneligibleReason: rateResult.codIneligible } : {}),
                },
            })
        }

        // Flat-rate path (backward-compat: no items, or EP disabled)
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

        // Build flat RateOption for backward-compat callers
        const flatRate = {
            courier: 'flat',
            serviceId: 'flat',
            courierName: 'Standard Delivery',
            serviceName: 'Standard Delivery',
            priceSen: Math.round(fee * 100),
            codAvailable: false,
            estDelivery: '3–5 business days',
        }

        return NextResponse.json({
            success: true,
            data: { fee, isFree, region, ...(hint ? { hint } : {}), rates: [flatRate], degraded: false },
        })
    } catch (error: any) {
        console.error('[Calculate Shipping Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to calculate shipping' } },
            { status: 500 }
        )
    }
}
