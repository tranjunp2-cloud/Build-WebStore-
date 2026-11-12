import config from '@payload-config'
import { getPayload, type User } from 'payload'

/** The fields AI routes read from a site; the full doc comes back at runtime. */
export type AccessibleSite = { id: string | number; name?: string | null; tenant?: unknown; seo?: unknown; [key: string]: unknown }

type TenantRef = string | number | { id: string | number } | null | undefined

export function tenantRefId(value: unknown): string | null {
    const ref = value as TenantRef
    if (ref == null) return null
    return String(typeof ref === 'object' ? ref.id : ref)
}

/** Workspaces the user is an active member of. */
export function activeTenantIds(user: unknown): Set<string> {
    const memberships = (user as { tenants?: Array<{ tenant?: unknown; status?: string }> }).tenants ?? []
    return new Set(
        memberships.flatMap((membership) => {
            const id = tenantRefId(membership.tenant)
            return membership.status === 'active' && id ? [id] : []
        }),
    )
}

// Same rule as `requirePermission` (permission-guard.ts): legacy full roles, or a custom role holding the permission.
const FULL_ACCESS_ROLES = new Set(['owner', 'admin', 'editor', 'viewer'])

/** Whether the user's active membership of this workspace may use the website builder. */
export function canBuildSite(user: unknown, tenantId: string): boolean {
    const memberships = (user as { tenants?: Array<{ tenant?: unknown; role?: string; status?: string; permissions?: string[] }> }).tenants ?? []
    const membership = memberships.find((m) => tenantRefId(m.tenant) === tenantId && m.status === 'active')
    if (!membership) return false
    const role = membership.role ?? 'viewer'
    if (FULL_ACCESS_ROLES.has(role)) return true
    return role === 'custom' && Array.isArray(membership.permissions) && membership.permissions.includes('builder')
}

export type SiteAccess =
    | { ok: true; site: AccessibleSite; tenantId: string }
    | { ok: false; status: 403 | 404 }

/**
 * A site the user may work on: read with their own access, and owned by a
 * workspace they are an active member of. Platform staff are not members of
 * merchant workspaces, so they are refused here too — AI and edits on a site
 * always run (and bill) inside that site's workspace.
 */
export async function resolveSiteForUser(user: User | unknown, siteId: string | number): Promise<SiteAccess> {
    const payload = await getPayload({ config })
    const site = await payload.findByID({
        collection: 'sites',
        id: siteId,
        depth: 0,
        overrideAccess: false,
        user: user as User,
        disableErrors: true,
    }).catch(() => null)
    if (!site) return { ok: false, status: 404 }
    const tenantId = tenantRefId(site.tenant)
    if (!tenantId || !activeTenantIds(user).has(tenantId)) return { ok: false, status: 403 }
    return { ok: true, site: site as unknown as AccessibleSite, tenantId }
}
