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
    allowedCouriers?: string[] // EP courier_ids merchant allows; checkout quotes cheapest that serves route
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

        if (rates.length > 0) {
            // Allowlist: merchant may restrict to a set of EP courier_ids.
            // 'flat' sentinel is excluded — it is never a real EP courier_id.
            const allow = params.allowedCouriers?.filter((c) => c && c !== 'flat')

            let candidates = allow?.length ? rates.filter((r) => allow.includes(r.courier)) : rates

            // COD filter: if this is a COD order, keep only COD-capable couriers.
            if (params.codAmountSen != null && params.codAmountSen > 0) {
                candidates = candidates.filter((r) => r.codAvailable === true)
            }

            const best = pickCheapest(candidates)
            if (best) return { rates: [best], degraded: false }

            // No candidate survived (allowlist ∩ route empty, or no COD-capable courier).
            const reason = params.codAmountSen != null && params.codAmountSen > 0
                ? 'no COD-capable courier in allowlist serves this route'
                : 'none of the allowed couriers serve this route'
            console.warn(`[get-rates] ${reason}; available=[${rates.map((r) => r.courier).join(', ')}] → flat fallback`)
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
