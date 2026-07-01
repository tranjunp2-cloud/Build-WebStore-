/**
 * Pickup-address (warehouse) helpers for EasyParcel.
 *
 * The integration now supports MULTIPLE pickup addresses (`easyParcelIntegration.warehouses`), one of
 * which is the default couriers collect from. The order flow only ever needs the default one as the
 * shipment sender. Legacy tenants store a single `easyParcelIntegration.warehouse` object — this
 * module transparently falls back to it so existing configs keep working without a data migration.
 */

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

interface EpIntegrationLike {
    warehouses?: unknown
    warehouse?: unknown
    accessToken?: unknown
    selectedCourier?: unknown
}

/** Normalise the stored warehouses array (guards against bad/missing data). */
export function getWarehouses(ep: EpIntegrationLike | null | undefined): Warehouse[] {
    const list = Array.isArray(ep?.warehouses) ? (ep!.warehouses as Warehouse[]) : []
    return list.filter((w) => w && typeof w === 'object')
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
    const phoneDigits = (w.phone ?? '').replace(/\D/g, '')
    return (
        !!(w.label || w.name)?.trim() &&
        phoneDigits.length >= 8 &&
        !!w.address1?.trim() &&
        !!w.state?.trim() &&
        !!w.postcode?.trim()
    )
}

/**
 * Whether EasyParcel is READY to quote/ship for a tenant — the single source of truth used by the
 * order flow. "Connected" (has token) is NOT enough: a valid default pickup and a selected courier
 * are required, otherwise checkout must fall back to flat rate instead of quoting a wrong origin or
 * failing at label creation. Does not check token expiry — the caller's getValidToken handles that.
 */
export function isEpReady(ep: EpIntegrationLike | null | undefined): boolean {
    if (!ep?.accessToken) return false
    if (typeof ep.selectedCourier !== 'string' || !ep.selectedCourier.trim()) return false
    return isWarehouseComplete(getDefaultWarehouse(ep))
}
