import 'server-only'
import type { ShippingConfig } from './types'
import { getShippingRate } from './calculate-fee'
import { quotations } from './easyparcel/client'
import type { RateOption } from './easyparcel/types'
import { mapSubdivisionCode, aggregateWeightKg, rmStringToSen } from './easyparcel/normalize'
import { evaluateCodEligibility, type CodIneligibleReason } from './cod-eligibility'

interface GetRatesParams {
    weightGrams: number
    destPostcode: string
    destState: string
    senderState?: string    // for subdivision_code mapping on sender side
    destCountry?: string
    senderPostcode: string
    subtotalSen: number      // for flat-rate free-shipping threshold check
    codAmountSen?: number    // 0 or undefined = non-COD; >0 = COD order (sen)
    /**
     * Probe-only COD amount (sen): evaluate the R1/R2/R3 verdict for this amount WITHOUT
     * COD-filtering the rate pick. Lets the storefront learn COD eligibility on the first
     * rate fetch (before the buyer touches the payment method). Defaults to codAmountSen.
     */
    codProbeSen?: number
}

interface GetRatesResult {
    rates: RateOption[]
    degraded: boolean  // true = EP failed or disabled, flat-rate used
    /**
     * Set when the EP quotation SUCCEEDED but no courier satisfies R1/R2/R3 (PD-021)
     * for the COD amount (codAmountSen, or the codProbeSen probe). Callers must treat
     * COD as not orderable on this route — the returned rate stays the normal EP pick
     * (display-only for a COD order; checkout hard-rejects before it is used).
     */
    codIneligible?: CodIneligibleReason
}

/**
 * Hybrid rate router.
 * - If `epToken` is null → flat-rate only (EP disabled / not connected for this tenant).
 * - If EP quotations call succeeds and returns rates → return EP rates.
 * - If EP call fails or returns empty → log + fallback to flat-rate (degraded=true).
 * Never throws to caller.
 *
 * Currency: all `sen` values are integers; EP API receives/sends RM (float).
 */
export async function getRates(
    params: GetRatesParams,
    epToken: string | null,
    flatConfig: ShippingConfig,
    destState?: string,
): Promise<GetRatesResult> {
    // Flat-rate path: EP disabled or not connected
    if (!epToken) {
        return {
            rates: [buildFlatRateOption(params, flatConfig, destState)],
            degraded: false,
        }
    }

    const weightKg = aggregateWeightKg(params.weightGrams)
    const effectiveDestState = destState ?? params.destState

    try {
        const resp = await quotations(epToken, {
            sender: {
                postcode: params.senderPostcode,
                subdivision_code: mapSubdivisionCode(params.senderState ?? ''),
                country: 'MY',
            },
            receiver: {
                postcode: params.destPostcode,
                subdivision_code: mapSubdivisionCode(effectiveDestState),
                country: 'MY',
            },
            parcel_value: params.subtotalSen / 100,  // sen → RM
            weight: weightKg,
        })

        const firstResult = resp.data?.[0]
        if (!firstResult || firstResult.status === 'error') {
            console.warn('[get-rates] EP quotation error, falling back to flat rate')
            return { rates: [buildFlatRateOption(params, flatConfig, destState)], degraded: true }
        }

        const rates: RateOption[] = (firstResult.quotations ?? [])
            .map((q) => {
                const codFeature = q.features?.find((f: any) => f.cod != null)?.cod
                return {
                    courier: q.courier.courier_id,
                    serviceId: q.courier.service_id,
                    courierName: q.courier.courier_name,
                    serviceName: q.courier.service_name,
                    // Charge exactly what EP bills the wallet at submit. Per the submit_orders
                    // response (docs 2026-06), the wallet debit is:
                    //   total_paid_amount = shipment_price + shipment_tax + total_features_price
                    //                     + total_features_tax + byoc_charges + byoc_tax − coupon
                    // For ECH this reduces to shipment_price + shipment_tax: all EP features are
                    // submitted OFF (feature.* = false), BYOC couriers are excluded from selection
                    // (usableRates filter below), and no EP coupon is applied. NOT pricing.total_amount
                    // — that bundles the quoted add-on features we never submit, over-quoting by the
                    // feature price (live: 6.22 quote vs 5.62 actually billed). shipment_tax may be
                    // absent → 0; an unparseable shipment_price → NaN → dropped by the filter below.
                    priceSen: Math.round(
                        (parseFloat(q.pricing.shipment_price) + (parseFloat(q.pricing.shipment_tax ?? '') || 0)) * 100,
                    ),
                    codAvailable: codFeature?.available ?? false,
                    // NaN-safe: EP sometimes sends ""/non-numeric limits → treated as no limit
                    codMinSen: rmStringToSen(codFeature?.min_cod_amount),
                    codMaxSen: rmStringToSen(codFeature?.max_cod_amount),
                    estDelivery: q.courier.delivery_duration ?? '3–5 business days',
                    // Preserve collection capability — pickup vs drop-off is a property of the
                    // SERVICE variant; create-label needs it to honor the merchant's method choice.
                    isPickup: q.courier.is_pickup,
                    isDropoff: q.courier.is_dropoff,
                }
            })
            // F10 (review #1434): EP sometimes sends "" / non-numeric total_amount →
            // parseFloat → NaN. NaN comparisons in pickCheapest() are always false, so a
            // NaN-priced rate could still be selected. Drop unparseable rates before they
            // reach usableRates/pickCheapest — same NaN-safe intent as rmStringToSen above.
            .filter((r) => Number.isFinite(r.priceSen))

        // Exclude BYOC ("Bring Your Own Contract") couriers from auto-selection. They only ship on
        // the merchant's own carrier contract, which isn't linked here — auto-picking one would fail
        // at submit_orders. This mirrors how Shippo/EasyPost/ShipStation keep bring-your-own carriers
        // opt-in rather than in the default cheapest-rate pool.
        const usableRates = rates.filter((r) => !isByocCourier(r))

        if (usableRates.length > 0) {
            // COD verdict (PD-021 R1/R2/R3): evaluated against the probe amount even when the
            // pick itself is not COD-filtered, so the storefront can disable the COD option
            // before the buyer selects it. Defaults to the real COD amount for COD orders.
            const probeSen = params.codProbeSen ?? params.codAmountSen ?? 0
            const probeCheck = evaluateCodEligibility(usableRates, probeSen)
            const codIneligible = probeSen > 0 && probeCheck.eligible.length === 0 ? probeCheck.reason : undefined

            // COD gate on the actual pick: for a COD order, keep only couriers whose live
            // cod.available + min/max limits accept this amount — never trust EP API acceptance.
            const codCheck = evaluateCodEligibility(usableRates, params.codAmountSen ?? 0)

            const best = pickCheapest(codCheck.eligible)
            if (best) return { rates: [best], degraded: false, ...(codIneligible ? { codIneligible } : {}) }

            // COD order and no courier passes R1/R2/R3: keep the normal EP pick so the buyer
            // still sees the real courier + rate (NOT a flat-rate swap) — only the codIneligible
            // flag changes: the storefront shows the error and checkout hard-rejects COD.
            console.warn(`[get-rates] COD ineligible (${codCheck.reason}); quoted=[${usableRates.map((r) => r.courier).join(', ')}] — keeping EP pick, flagging`)
            return {
                rates: [pickCheapest(usableRates)!],
                degraded: false,
                codIneligible: codCheck.reason,
            }
        }

        console.warn('[get-rates] EP returned 0 quotations, falling back to flat rate')
    } catch (err) {
        // Never throw to caller — degrade silently, surface via degraded flag
        console.error('[get-rates] EP quotation failed, falling back:', (err as Error).message)
    }

    return {
        rates: [buildFlatRateOption(params, flatConfig, destState)],
        degraded: true,
    }
}

/**
 * BYOC = "Bring Your Own Contract" courier (e.g. "BYOC FedEx", "BYOC GDEX"). EP lists them in the
 * catalog, but they only book on a merchant-linked carrier account we don't manage, so they must
 * never be auto-selected. Matched on the EP courier_name prefix.
 */
function isByocCourier(r: RateOption): boolean {
    return /^byoc\b/i.test((r.courierName ?? '').trim())
}

/** Returns the rate with the lowest priceSen, or undefined if the list is empty. */
function pickCheapest(rates: RateOption[]): RateOption | undefined {
    return rates.reduce<RateOption | undefined>(
        (best, r) => (best == null || r.priceSen < best.priceSen ? r : best),
        undefined,
    )
}

function buildFlatRateOption(
    params: GetRatesParams,
    flatConfig: ShippingConfig,
    destState?: string,
): RateOption {
    const effectiveState = destState ?? params.destState
    const priceSen = getShippingRate(effectiveState, flatConfig, params.subtotalSen)
    return {
        courier: 'flat',
        serviceId: 'flat',
        courierName: 'Standard Delivery',
        serviceName: 'Standard Delivery',
        priceSen,
        codAvailable: false,
        estDelivery: '3–5 business days',
        degraded: false,
    }
}
