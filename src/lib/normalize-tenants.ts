/** Minimal shape of a user's tenant membership returned by Payload queries */
export interface TenantMembership {
    tenant: string | { id: string }
    role: string
    status?: string
    permissions?: string[]
}

/** Normalize populated tenant objects → extract relationship IDs for safe Payload updates */
export function normalizeTenants(tenants: TenantMembership[]): TenantMembership[] {
    return tenants.map((t: TenantMembership) => ({
        tenant: (t.tenant && typeof t.tenant === 'object') ? t.tenant.id : t.tenant,
        role: t.role,
        status: t.status,
        permissions: t.permissions || [],
    }))
}
