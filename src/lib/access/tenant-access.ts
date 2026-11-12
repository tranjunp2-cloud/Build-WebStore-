import type { FieldAccess } from 'payload'

// Shared tenant rules for collection field access (GH-2137). No Payload config import here: collections load this.

type Membership = { tenant?: unknown; status?: string | null }

export function isSuperAdmin(user: unknown): boolean {
    return Boolean((user as { roles?: string[] } | null | undefined)?.roles?.includes('super-admin'))
}

/** A relationship value (id or populated doc) as its id. */
export function refId(value: unknown): string | number | null {
    if (value == null || value === '') return null
    if (typeof value === 'object') {
        const id = (value as { id?: unknown }).id
        return typeof id === 'string' || typeof id === 'number' ? id : null
    }
    return typeof value === 'string' || typeof value === 'number' ? value : null
}

/** Workspaces the user is an active member of (a membership without a status is active, as in Tenants.ts). */
export function memberTenantIds(user: unknown): Array<string | number> {
    const entries = (user as { tenants?: Membership[] } | null | undefined)?.tenants ?? []
    return entries.flatMap((entry) => {
        if ((entry?.status ?? 'active') !== 'active') return []
        const id = refId(entry?.tenant)
        if (id == null) return []
        return [/^\d+$/.test(String(id)) ? Number(id) : id]
    })
}

/**
 * Field access for a `tenant` relationship: a user may only write one of their own workspaces into it.
 * Collection `update` access picks which rows can be edited, not what the body writes, so without this a
 * merchant could create a row in another shop or move their own row there. Payload drops a refused value:
 * on create the row then fails the required check, on update it keeps its current tenant.
 */
export const ownTenantFieldAccess: FieldAccess = ({ req, siblingData }) => {
    if (!req.user) return false
    if (isSuperAdmin(req.user)) return true
    const requested = refId((siblingData as { tenant?: unknown } | undefined)?.tenant)
    if (requested == null) return true
    return memberTenantIds(req.user).some((id) => String(id) === String(requested))
}
