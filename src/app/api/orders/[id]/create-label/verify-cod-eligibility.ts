import 'server-only'
import { quotations } from '@/lib/shipping/easyparcel/client'
import { mapSubdivisionCode, aggregateWeightKg, rmStringToSen } from '@/lib/shipping/easyparcel/normalize'
import { evaluateCodEligibility, type CodIneligibleReason } from '@/lib/shipping/cod-eligibility'
import type { RateOption } from '@/lib/shipping/easyparcel/types'

export type CodVerifyResult = { ok: true } | { ok: false; reason: CodIneligibleReason }

/**
 * Live COD re-validation before submit_orders (PD-021 mirror gate).
 *
 * The order's courier was COD-eligible when the order was created, but limits and
 * cod.available are per-route LIVE values that can change before the merchant creates
 * the label — and EP's submit API accepts ineligible COD silently (money never gets
 * collected). Re-quote and check R1/R2/R3 for the stored service_id.
 *
 * Fail-open on quotation errors or when the service is absent from the quote:
 * submit_orders remains the authority for those failures — this gate only blocks a
 * shipment EP would create but never collect on.
 */
export async function verifyCodEligibilityLive(args: {
    token: string
    senderPostcode: string
    senderState: string
    receiverPostcode: string
    receiverState: string
    weightGrams: number
    parcelValueRm: number
    codAmountSen: number
    serviceId: string
}): Promise<CodVerifyResult> {
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
        console.warn('[create-label] COD re-check quotation failed — proceeding (fail-open):', (err as Error).message)
        return { ok: true }
    }

    const firstResult = resp.data?.[0]
    if (!firstResult || firstResult.status === 'error') return { ok: true }

    const quote = (firstResult.quotations ?? []).find((q) => q.courier.service_id === args.serviceId)
    if (!quote) return { ok: true }

    const codFeature = quote.features?.find((f) => f.cod != null)?.cod
    const rate: RateOption = {
        courier: quote.courier.courier_id,
        serviceId: quote.courier.service_id,
        courierName: quote.courier.courier_name,
        serviceName: quote.courier.service_name,
        // Same basis as checkout/create-label (shipment_price + shipment_tax, prefix-tolerant),
        // not total_amount. evaluateCodEligibility reads only the cod fields, but keep it aligned.
        priceSen: (rmStringToSen(quote.pricing.shipment_price) ?? NaN) + (rmStringToSen(quote.pricing.shipment_tax) ?? 0),
        codAvailable: codFeature?.available ?? false,
        // NaN-safe: EP sometimes sends ""/non-numeric limits → treated as no limit
        codMinSen: rmStringToSen(codFeature?.min_cod_amount),
        codMaxSen: rmStringToSen(codFeature?.max_cod_amount),
        estDelivery: quote.courier.delivery_duration ?? '',
    }

    const check = evaluateCodEligibility([rate], args.codAmountSen)
    if (check.eligible.length > 0) return { ok: true }
    return { ok: false, reason: check.reason ?? 'no_cod_courier' }
}
