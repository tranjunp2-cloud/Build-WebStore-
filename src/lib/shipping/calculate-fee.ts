import type { ShippingConfig } from './types'
import { EAST_MY_STATES, SHIPPING_DEFAULTS } from './constants'

export type EastState = (typeof EAST_MY_STATES)[number]

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
