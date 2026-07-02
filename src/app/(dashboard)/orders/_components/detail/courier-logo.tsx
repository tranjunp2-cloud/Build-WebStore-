'use client'

// Ported from design-reference atoms.jsx (window.COURIERS + window.CourierLogo)
// Used in fulfillment-zone, print-label-modal, tracking sections.

export interface CourierDef {
  id: string
  name: string
  mono: string   // monogram (2-3 chars)
  color: string  // background color for the tile
}

export const COURIERS: CourierDef[] = [
  { id: 'jnt',      name: 'J&T Express',       mono: 'J&T',  color: '#e53e3e' },
  { id: 'poslaju',  name: 'Pos Laju',           mono: 'POS',  color: '#1a6d2a' },
  { id: 'dhl',      name: 'DHL eCommerce',      mono: 'DHL',  color: '#ffcc00' },
  { id: 'ninjavan', name: 'Ninja Van',           mono: 'NV',   color: '#6b21a8' },
  { id: 'citylink', name: 'City-Link Express',   mono: 'CL',   color: '#1e40af' },
  { id: 'skynet',   name: 'Skynet',              mono: 'SKY',  color: '#0891b2' },
  { id: 'gdex',     name: 'GDEX',                mono: 'GDX',  color: '#dc2626' },
  { id: 'abxexpress', name: 'ABX Express',       mono: 'ABX',  color: '#7c3aed' },
  { id: 'teleport', name: 'Teleport',            mono: 'TP',   color: '#059669' },
]

/** Lookup by id (case-insensitive). Returns undefined if not found. */
export function courierById(id: string | null | undefined): CourierDef | undefined {
  if (!id) return undefined
  const lower = id.toLowerCase()
  return COURIERS.find(c => c.id === lower || c.name.toLowerCase() === lower)
}

/**
 * Fuzzy lookup by courier display name (e.g. "J&T Express" → jnt).
 * Tries exact match first, then substring containment in either direction.
 * Use when courierId is an opaque EP code that won't match COURIERS[].id.
 */
export function courierByName(name: string | null | undefined): CourierDef | undefined {
  if (!name) return undefined
  const lower = name.toLowerCase()
  // Exact name match
  const exact = COURIERS.find(c => c.name.toLowerCase() === lower)
  if (exact) return exact
  // Fuzzy: stored name contains known name, or known name is contained in stored name
  return COURIERS.find(c => lower.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(lower))
}

/**
 * Monogram tile that mirrors the design .cl-logo class.
 * Falls back to a 2-char substring of courierName when id is unknown.
 */
export function CourierLogo({
  courierId,
  courierName,
  size = 34,
}: {
  courierId?: string | null
  courierName?: string | null
  size?: number
}) {
  // Try id lookup first; fall back to fuzzy name match for opaque EP codes (e.g. "EP-CR0DW")
  const def = courierById(courierId) ?? courierByName(courierName)
  const mono = def?.mono ?? (courierName ?? 'EP').slice(0, 3).toUpperCase()
  const bg   = def?.color ?? '#3b82f6'
  const name = def?.name  ?? courierName ?? courierId ?? 'EP'

  return (
    <span
      className="cl-logo"
      title={name}
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: size * 0.32,
      }}
    >
      {mono}
    </span>
  )
}
