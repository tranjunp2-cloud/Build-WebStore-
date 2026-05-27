import { getCurrentUser } from '@/lib/auth'
import type { PlatformUser } from '@/types/user'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

// Customers has no permissionId — guard by role: owner/admin/editor/viewer have access,
// custom roles do not (customers not in ALLOWED_PERMISSIONS).
const ALLOWED_ROLES = new Set(['owner', 'admin', 'editor', 'viewer'])

export default async function CustomersLayout({ children }: { children: ReactNode }) {
    const user = await getCurrentUser()
    if (!user) redirect('/login')

    const typedUser = user as PlatformUser
    if (typedUser?.roles?.includes('super-admin')) return <>{children}</>

    const tenantEntry = typedUser?.tenants?.[0] as
        | { role?: string; status?: string }
        | undefined

    if (!tenantEntry || tenantEntry.status === 'pending') redirect('/forbidden')

    const role = tenantEntry.role ?? ''
    if (!ALLOWED_ROLES.has(role)) redirect('/forbidden')

    return <>{children}</>
}
