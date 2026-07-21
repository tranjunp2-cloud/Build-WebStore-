import type { ShippingConfig } from './types'
import { EAST_MY_STATES, SHIPPING_DEFAULTS } from './constants'

export type EastState = (typeof EAST_MY_STATES)[number]

type ShippingRatePrice = { priceSen?: unknown }

export function shippingRateToRM(
    rate: ShippingRatePrice | null | undefined,
    fallbackRM = 0,
): number {
    const priceSen = rate?.priceSen
    if (typeof priceSen !== 'number' || !Number.isSafeInteger(priceSen) || priceSen < 0) {
        return fallbackRM
    }
    return priceSen / 100
}

export function isEastState(state: string): boolean {
    return (EAST_MY_STATES as readonly string[]).includes(state)
}

export function getShippingRate(
    state: string | undefined | null,
    config: ShippingConfig | undefined | null,
    subtotalSen: number,
): number {
    const cfg = config ?? {}
    if (cfg.enabled === false) return 0
    if (cfg.freeAbove != null && subtotalSen >= cfg.freeAbove) return 0
    const east = cfg.eastRate ?? SHIPPING_DEFAULTS.eastRate
    const west = cfg.westRate ?? SHIPPING_DEFAULTS.westRate
    return state && isEastState(state) ? east : west
}
