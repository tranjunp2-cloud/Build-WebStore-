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
    const role = tenantEntry?.role ?? 'viewer'

    // Pending staff have not accepted the invite yet — block access
    if (tenantEntry?.status === 'pending') redirect('/forbidden')

    if (FULL_ACCESS_ROLES.has(role)) return

    const permissions = Array.isArray(tenantEntry?.permissions) ? tenantEntry.permissions : []
    if (role === 'custom' && permissions.includes(permission)) return

    redirect('/forbidden')
}
