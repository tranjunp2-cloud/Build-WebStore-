import 'server-only'
import { quotations } from '@/lib/shipping/easyparcel/client'
import { mapSubdivisionCode, aggregateWeightKg } from '@/lib/shipping/easyparcel/normalize'
import type { EpQuotationItem } from '@/lib/shipping/easyparcel/types'

export type CollectionMethod = 'pickup' | 'dropoff'

export type ResolveMethodResult =
    /** Stored service already supports the method; verified=false means the quote was
     *  unavailable (fail-open) — the method could NOT actually be confirmed. */
    | { ok: true; serviceId: string; changed: false; verified: boolean }
    /** Stored service can't do the method; cheapest same-courier variant that can was picked. */
    | { ok: true; serviceId: string; serviceName: string; priceRm: number | null; changed: true; verified: true }
    /** No service of this courier supports the requested method on this route. */
    | { ok: false; supported: CollectionMethod[] }

function supportsMethod(q: EpQuotationItem, method: CollectionMethod): boolean {
    return method === 'pickup' ? q.courier.is_pickup === true : q.courier.is_dropoff === true
}

/**
 * US-F36-07 correction: EP models pickup vs drop-off as separate SERVICE VARIANTS —
 * submit_orders has no method flag; the service_id alone decides how the parcel is
 * collected. The service_id stored at checkout is the cheapest (often the drop-off
 * variant), so the merchant's method choice at create-label must be resolved into a
 * matching service BEFORE submit, or the toggle is cosmetic.
 *
 * Re-quotes the route live (same pattern as verifyCodEligibilityLive):
 * - stored service supports the method → keep it (changed:false)
 * - it doesn't, but a same-courier variant does → cheapest such variant (changed:true;
 *   the EP wallet is charged that variant's price — may differ from the checkout quote)
 * - no variant of this courier supports the method → ok:false + which methods it CAN do
 *
 * Fail-open on quotation errors or when the stored service is absent from the quote:
 * submit_orders stays the authority — this resolver only redirects a booking EP would
 * otherwise create with the wrong collection method.
 */
export async function resolveServiceForMethod(args: {
    token: string
    senderPostcode: string
    senderState: string
    receiverPostcode: string
    receiverState: string
    weightGrams: number
    parcelValueRm: number
    serviceId: string
    method: CollectionMethod
    /** COD order: prefer variants whose live quote offers COD — picking a cheaper
     *  non-COD variant would trip the COD gate even though a valid variant exists. */
    codRequired?: boolean
}): Promise<ResolveMethodResult> {
    let resp
    try {
        resp = await quotations(args.token, {
            sender: {
                postcode: args.senderPostcode,
                subdivision_code: mapSubdivisionCode(args.senderState),
                country: 'MY',
            },
            receiver: {
                postcode: args.receiverPostcode,
                subdivision_code: mapSubdivisionCode(args.receiverState),
                country: 'MY',
            },
            parcel_value: args.parcelValueRm,
            weight: aggregateWeightKg(args.weightGrams),
        })
    } catch (err) {
        console.warn('[create-label] method re-quote failed — proceeding with stored service (fail-open):', (err as Error).message)
        return { ok: true, serviceId: args.serviceId, changed: false, verified: false }
    }

    const firstResult = resp.data?.[0]
    if (!firstResult || firstResult.status === 'error') {
        return { ok: true, serviceId: args.serviceId, changed: false, verified: false }
    }

    const quotes = firstResult.quotations ?? []
    const stored = quotes.find((q) => q.courier.service_id === args.serviceId)
    if (!stored) return { ok: true, serviceId: args.serviceId, changed: false, verified: false }

    if (supportsMethod(stored, args.method)) {
        return { ok: true, serviceId: args.serviceId, changed: false, verified: true }
    }

    // Same-courier variants that support the requested method, cheapest first.
    // NaN prices (EP sends ""/non-numeric sometimes) sort last and are never picked
    // over a finite price; an all-NaN candidate set is treated as unsupported.
    const candidates = quotes
        .filter((q) =>
            q.courier.courier_id === stored.courier.courier_id &&
            q.courier.service_id !== args.serviceId &&
            supportsMethod(q, args.method))
        .map((q) => ({ q, priceRm: parseFloat(q.pricing.total_amount) }))
        .filter((c) => Number.isFinite(c.priceRm))
        .sort((a, b) => a.priceRm - b.priceRm)

    // COD orders: prefer the cheapest COD-capable variant. Fall back to the plain
    // cheapest when none offers COD — the COD gate downstream then produces the
    // accurate COD_NOT_ELIGIBLE (with its recovery panel), instead of this resolver
    // returning a misleading METHOD_NOT_SUPPORTED.
    const quoteHasCod = (q: EpQuotationItem) =>
        q.features?.find((f) => f.cod != null)?.cod?.available === true
    const pool = args.codRequired
        ? (candidates.filter((c) => quoteHasCod(c.q)).length > 0
            ? candidates.filter((c) => quoteHasCod(c.q))
            : candidates)
        : candidates

    const best = pool[0]
    if (best) {
        return {
            ok: true,
            serviceId: best.q.courier.service_id,
            serviceName: best.q.courier.service_name,
            priceRm: best.priceRm,
            changed: true,
            verified: true,
        }
    }

    const courierQuotes = quotes.filter((q) => q.courier.courier_id === stored.courier.courier_id)
    const supported: CollectionMethod[] = []
    if (courierQuotes.some((q) => q.courier.is_pickup === true)) supported.push('pickup')
    if (courierQuotes.some((q) => q.courier.is_dropoff === true)) supported.push('dropoff')
    return { ok: false, supported }
}
