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
        // Filter null/undefined items that DB can store when value column has no NOT NULL constraint
        permissions: (t.permissions ?? []).filter((p): p is string => typeof p === 'string'),
    }))
}
