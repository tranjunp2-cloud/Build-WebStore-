/**
 * Which parts of the dashboard a member may see, by the same rule as the sidebar (`config/sidebar-nav.ts`)
 * and `requirePermission`: the legacy full roles see everything, a `custom` role only the permissions it holds.
 * Reports and the To do list use it to leave out numbers and tasks the member could not open themselves.
 */
export type ShopArea = 'orders' | 'products' | 'builder' | 'settings' | 'leads'

const FULL_ACCESS_ROLES = new Set(['owner', 'admin', 'editor', 'viewer'])

const tenantRefId = (ref: unknown): string | null => {
    const value = ref && typeof ref === 'object' ? (ref as { id?: unknown }).id : ref
    return value == null ? null : String(value)
}

type Membership = { tenant?: unknown; role?: string; status?: string; permissions?: string[] }

/** The member's active membership of `tenantId` (platform super-admins are not members of merchant workspaces). */
function membershipOf(user: unknown, tenantId: string | number): Membership | null {
    const memberships = (user as { tenants?: Membership[] } | null)?.tenants ?? []
    return memberships.find((m) => tenantRefId(m.tenant) === String(tenantId) && m.status === 'active') ?? null
}

/**
 * `leads` (Contact Leads) is full-access only, like in the sidebar; the other areas are the permission of the same
 * name. Discounts belong to `orders` (the sidebar entry uses it).
 */
export function canAccessArea(user: unknown, tenantId: string | number, area: ShopArea): boolean {
    const membership = membershipOf(user, tenantId)
    if (!membership) return false
    const role = membership.role ?? 'viewer'
    if (FULL_ACCESS_ROLES.has(role)) return true
    if (area === 'leads') return false
    return role === 'custom' && Array.isArray(membership.permissions) && membership.permissions.includes(area)
}

export function areasOf(user: unknown, tenantId: string | number): Record<ShopArea, boolean> {
    return {
        orders: canAccessArea(user, tenantId, 'orders'),
        products: canAccessArea(user, tenantId, 'products'),
        builder: canAccessArea(user, tenantId, 'builder'),
        settings: canAccessArea(user, tenantId, 'settings'),
        leads: canAccessArea(user, tenantId, 'leads'),
    }
}
