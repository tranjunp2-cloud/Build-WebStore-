/** Minimal shape of a user's tenant membership returned by Payload queries */
export interface TenantMembership {
    id?: string
    tenant: string | number | { id: string | number }
    role: string
    status?: string
    permissions?: string[]
}

/** Normalize populated tenant objects → extract relationship IDs for safe Payload updates.
 *  Preserves Payload array item `id` to prevent row churn (delete+re-insert) on updates. */
export function normalizeTenants(tenants: TenantMembership[]): TenantMembership[] {
    return tenants.map((t: TenantMembership) => ({
        ...(t.id ? { id: t.id } : {}),
        tenant: (t.tenant && typeof t.tenant === 'object') ? t.tenant.id : t.tenant,
        role: t.role,
        // Null/undefined status → 'active' (schema defaultValue). ?? only applies when null/undefined;
        // 'pending' and 'suspended' pass through unchanged. Omitting the field instead doesn't help
        // because Payload merges with the existing document (which has null) before validating.
        status: t.status ?? 'active',
        // Filter null/non-string items (value column has no NOT NULL constraint) and deduplicate.
        // Payload's select hasMany update appends rows without deleting old ones when no FK CASCADE
        // is in place, so the same value can appear multiple times in the DB.
        permissions: [...new Set((t.permissions ?? []).filter((p): p is string => typeof p === 'string'))],
    }))
}
