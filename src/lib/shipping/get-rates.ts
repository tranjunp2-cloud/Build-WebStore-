import 'server-only'
import type { ShippingConfig } from './types'
import { getShippingRate } from './calculate-fee'
import { quotations } from './easyparcel/client'
import type { RateOption } from './easyparcel/types'
import { mapSubdivisionCode, aggregateWeightKg } from './easyparcel/normalize'

interface GetRatesParams {
    weightGrams: number
    destPostcode: string
    destState: string
    senderState?: string    // for subdivision_code mapping on sender side
    destCountry?: string
    senderPostcode: string
    subtotalSen: number      // for flat-rate free-shipping threshold check
    codAmountSen?: number    // 0 or undefined = non-COD; >0 = COD order (sen)
}

interface GetRatesResult {
    rates: RateOption[]
    degraded: boolean  // true = EP failed or disabled, flat-rate used
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

        const rates: RateOption[] = (firstResult.quotations ?? []).map((q) => {
            const codFeature = q.features?.find((f: any) => f.cod != null)?.cod
            return {
                courier: q.courier.courier_id,
                serviceId: q.courier.service_id,
                courierName: q.courier.courier_name,
                serviceName: q.courier.service_name,
                priceSen: Math.round(parseFloat(q.pricing.total_amount) * 100),
                codAvailable: codFeature?.available ?? false,
                codMaxSen: codFeature?.max_cod_amount != null
                    ? Math.round(parseFloat(codFeature.max_cod_amount) * 100)
                    : undefined,
                estDelivery: q.courier.delivery_duration ?? '3–5 business days',
            }
        })

        // Exclude BYOC ("Bring Your Own Contract") couriers from auto-selection. They only ship on
        // the merchant's own carrier contract, which isn't linked here — auto-picking one would fail
        // at submit_orders. This mirrors how Shippo/EasyPost/ShipStation keep bring-your-own carriers
        // opt-in rather than in the default cheapest-rate pool.
        const usableRates = rates.filter((r) => !isByocCourier(r))

        if (usableRates.length > 0) {
            // COD filter: if this is a COD order, keep only COD-capable couriers.
            let candidates = usableRates
            if (params.codAmountSen != null && params.codAmountSen > 0) {
                candidates = usableRates.filter((r) => r.codAvailable === true)
            }

            const best = pickCheapest(candidates)
            if (best) return { rates: [best], degraded: false }

            // No candidate survived (no COD-capable courier serves this route).
            console.warn(`[get-rates] no COD-capable courier serves this route; available=[${usableRates.map((r) => r.courier).join(', ')}] → flat fallback`)
            return { rates: [buildFlatRateOption(params, flatConfig, destState)], degraded: true }
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
