/** Extract the dashboard's primary tenant ID from an already-fetched user. */
export function extractTenantId(user: unknown): string | null {
    if (!user || typeof user !== 'object') return null
    const tenants = (user as { tenants?: Array<{ tenant: string | number | { id: string | number } | null }> | null }).tenants
    if (!Array.isArray(tenants) || tenants.length === 0) return null
    const first = tenants[0]?.tenant
    if (typeof first === 'string') return first
    if (typeof first === 'number') return String(first)
    if (first?.id != null) return String(first.id)
    return null
}

/** Coerce numeric tenant IDs for PostgreSQL integer relationship columns. */
export function tenantIdForQuery(user: unknown): string | number | null {
    const raw = extractTenantId(user)
    if (raw === null) return null
    if (/^\d+$/.test(raw)) return Number(raw)
    return raw
}
