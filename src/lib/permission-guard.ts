import { getCurrentUser } from '@/lib/auth'
import type { PlatformUser } from '@/types/user'
import { redirect } from 'next/navigation'

const FULL_ACCESS_ROLES = new Set(['owner', 'admin', 'editor', 'viewer'])

type TenantEntry = {
    tenant: string | number | { id: string | number }
    role?: string
    permissions?: string[]
    status?: string
}

export async function requirePermission(permission: string): Promise<void> {
    const user = await getCurrentUser()
    if (!user) redirect('/login')

    const typedUser = user as PlatformUser

    // Super-admin platform role bypasses all tenant-level permission checks
    if (typedUser?.roles?.includes('super-admin')) return

    // ASSUMPTION: single-tenant users only. If multi-tenant staff is ever supported,
    // pass tenantId here and .find() the matching entry instead of using index 0.
    const tenantEntry = typedUser?.tenants?.[0] as TenantEntry | undefined

    // No tenant entry → user was never assigned to a tenant (e.g. orphaned account).
    // Do not fall back to any default role — deny immediately.
    if (!tenantEntry) redirect('/forbidden')

    // Pending staff have not accepted the invite yet — block access
    if (tenantEntry.status === 'pending') redirect('/forbidden')

    const role = tenantEntry.role ?? 'viewer'

    // editor/viewer are legacy roles — treat as full access to avoid silently
    // breaking existing staff assigned before custom permissions were introduced.
    if (FULL_ACCESS_ROLES.has(role)) return

    const permissions = Array.isArray(tenantEntry?.permissions) ? tenantEntry.permissions : []
    if (role === 'custom' && permissions.includes(permission)) return

    redirect('/forbidden')
}
