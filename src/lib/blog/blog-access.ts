// Who may read or write a blog post: members of its workspace, or a super-admin.
// Shared by the blog server actions and the editor route guard.
export type TenantEntry = { tenant: { id: string } | string; role?: string; status?: string }
export type UserWithTenants = { id: string; email: string; tenants?: TenantEntry[]; roles?: string[] }

export function getTenantId(user: UserWithTenants): string | undefined {
    const entry = user.tenants?.[0]
    if (!entry?.tenant) return undefined
    return typeof entry.tenant === 'object' ? entry.tenant?.id : entry.tenant
}

// GH-1587: `if (tenantId && ownerTenantId && mismatch)` fails OPEN when tenantId is falsy —
// reachable in production for a user just removed from their only tenant (still-valid session,
// getCurrentUser() re-fetches fresh, tenants:[]). Every tenant-ownership check must use
// `!isSuperAdmin(user) && (!tenantId || !ownerTenantId || mismatch)` — fail closed, with an
// explicit super-admin passthrough instead of relying on the fail-open gap as an accidental one.
export function isSuperAdmin(user: UserWithTenants): boolean {
    return Boolean(user.roles?.includes('super-admin'))
}
