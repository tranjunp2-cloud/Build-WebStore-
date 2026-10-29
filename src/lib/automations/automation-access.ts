/**
 * Who may change the automations of a workspace: its active owner or admin (the people who receive the reminders).
 * Custom-role staff, even with the Settings permission, and platform super-admins (not members of merchant
 * workspaces) can look but not switch.
 */
const MANAGER_ROLES = new Set(['owner', 'admin'])

const refId = (ref: unknown): string | null => {
    const value = ref && typeof ref === 'object' ? (ref as { id?: unknown }).id : ref
    return value == null ? null : String(value)
}

export function canManageAutomations(user: unknown, tenantId: string | number): boolean {
    const memberships = (user as { tenants?: Array<{ tenant?: unknown; role?: string; status?: string }> } | null)?.tenants ?? []
    return memberships.some((m) => refId(m.tenant) === String(tenantId) && m.status === 'active' && MANAGER_ROLES.has(m.role ?? ''))
}
