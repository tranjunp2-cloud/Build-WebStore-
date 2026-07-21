/**
 * Pickup-address (warehouse) helpers for EasyParcel.
 *
 * The integration now supports MULTIPLE pickup addresses (`easyParcelIntegration.warehouses`), one of
 * which is the default couriers collect from. The order flow only ever needs the default one as the
 * shipment sender. Legacy tenants store a single `easyParcelIntegration.warehouse` object — this
 * module transparently falls back to it so existing configs keep working without a data migration.
 */

import { hasUsablePhone, normalizeMyPhone } from './phone'

export interface Warehouse {
    id?: string
    label?: string
    name?: string          // legacy single-warehouse shape used `name` for the label
    phone?: string
    address1?: string
    address2?: string
    city?: string
    state?: string
    postcode?: string
    country?: string
    isDefault?: boolean
}

const WAREHOUSE_STRING_LIMITS = {
    id: 100,
    label: 100,
    name: 100,
    phone: 32,
    address1: 200,
    address2: 200,
    city: 100,
    state: 100,
    postcode: 10,
} as const

function cleanString(value: unknown, maxLength: number): string | undefined {
    if (typeof value !== 'string') return undefined
    const cleaned = value.trim().slice(0, maxLength)
    return cleaned || undefined
}

/** Whitelist and normalize one warehouse received from storage or an API client. */
export function normalizeWarehouse(value: unknown): Warehouse | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const source = value as Record<string, unknown>
    const rawPhone = cleanString(source.phone, WAREHOUSE_STRING_LIMITS.phone)

    return {
        id: cleanString(source.id, WAREHOUSE_STRING_LIMITS.id),
        label: cleanString(source.label, WAREHOUSE_STRING_LIMITS.label),
        name: cleanString(source.name, WAREHOUSE_STRING_LIMITS.name),
        phone: rawPhone ? normalizeMyPhone(rawPhone) : undefined,
        address1: cleanString(source.address1, WAREHOUSE_STRING_LIMITS.address1),
        address2: cleanString(source.address2, WAREHOUSE_STRING_LIMITS.address2),
        city: cleanString(source.city, WAREHOUSE_STRING_LIMITS.city),
        state: cleanString(source.state, WAREHOUSE_STRING_LIMITS.state),
        postcode: cleanString(source.postcode, WAREHOUSE_STRING_LIMITS.postcode),
        country: 'MY',
        isDefault: source.isDefault === true,
    }
}

interface NormalizeWarehousesOptions {
    defaultFirst?: boolean
}

/** Canonicalize a list without mutating it, enforce one default, and optionally move it first. */
export function normalizeWarehouses(
    value: unknown,
    { defaultFirst = true }: NormalizeWarehousesOptions = {},
): Warehouse[] {
    if (!Array.isArray(value)) return []
    const warehouses = value
        .map(normalizeWarehouse)
        .filter((warehouse): warehouse is Warehouse => warehouse !== null)
    if (warehouses.length === 0) return []

    const defaultIndex = Math.max(0, warehouses.findIndex((warehouse) => warehouse.isDefault))
    const normalized = warehouses.map((warehouse, index) => ({
        ...warehouse,
        isDefault: index === defaultIndex,
    }))

    if (!defaultFirst || defaultIndex === 0) return normalized
    return [normalized[defaultIndex], ...normalized.filter((_, index) => index !== defaultIndex)]
}

interface EpIntegrationLike {
    warehouses?: unknown
    warehouse?: unknown
    accessToken?: unknown
    selectedCourier?: unknown
    selectedCouriers?: unknown
}

/** Normalise the stored warehouses array (guards against bad/missing data). */
export function getWarehouses(ep: EpIntegrationLike | null | undefined): Warehouse[] {
    return normalizeWarehouses(ep?.warehouses)
}

/**
 * Resolve the default pickup address used as the shipment sender. Order of preference:
 * 1. The warehouse flagged `isDefault` in `warehouses[]`.
 * 2. The first entry in `warehouses[]`.
 * 3. The legacy single `warehouse` object.
 * Returns `{}` when nothing is configured.
 */
export function getDefaultWarehouse(ep: EpIntegrationLike | null | undefined): Warehouse {
    const list = getWarehouses(ep)
    const def = list.find((w) => w.isDefault) ?? list[0]
    if (def) return def
    const legacy = ep?.warehouse
    return legacy && typeof legacy === 'object' ? (legacy as Warehouse) : {}
}

/** A pickup address is usable as an EP shipment sender only when EP's mandatory fields are present. */
export function isWarehouseComplete(w: Warehouse | null | undefined): boolean {
    if (!w) return false
    return (
        !!(w.label || w.name)?.trim() &&
        hasUsablePhone(w.phone) &&
        !!w.address1?.trim() &&
        !!w.city?.trim() &&
        !!w.state?.trim() &&
        !!w.postcode?.trim()
    )
}

/**
 * Whether EasyParcel is READY to quote/ship for a tenant — the single source of truth used by the
 * order flow. "Connected" (has token) is NOT enough: a valid default pickup address is required,
 * otherwise checkout must fall back to flat rate instead of quoting a wrong origin. Courier
 * selection is fully automatic (cheapest that serves the route); no allowlist needed. Does not
 * check token expiry — the caller's getValidToken handles that.
 */
export function isEpReady(ep: EpIntegrationLike | null | undefined): boolean {
    if (!ep?.accessToken) return false
    return isWarehouseComplete(getDefaultWarehouse(ep))
}
