/**
 * Server-side auth guard for Studio admin routes.
 * Defense-in-depth: middleware checks JWT role, this checks DB role.
 * Usage: `const { user } = await requireSuperAdmin()` (write / AI settings pages) or
 * `await requireStudioAccess()` (read pages a studio-viewer may open) in server components.
 */
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import type { PlatformUser } from '@/types/user'
import { canViewStudio, isStudioReadOnly, isSuperAdmin } from './studio-roles'

export type AdminUser = {
    id: string
    email: string
    name: string
    roles: string[]
    /** studio-viewer without a work seat: Studio shows data but every write is refused. */
    readOnly: boolean
}

function toAdminUser(user: PlatformUser): AdminUser {
    return {
        id: String(user.id),
        email: user.email,
        name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0],
        roles: user.roles ?? [],
        readOnly: isStudioReadOnly(user.roles),
    }
}

async function requireStudioRole(allowed: (roles: string[] | undefined) => boolean): Promise<{ user: AdminUser }> {
    const rawUser = await getCurrentUser()
    if (!rawUser) redirect('/admin')

    const user = rawUser as unknown as PlatformUser
    // A signed-in viewer on a super-admin page goes back to the Studio home, not the Payload login.
    if (!allowed(user.roles)) redirect(canViewStudio(user.roles) ? '/studio' : '/admin')

    return { user: toAdminUser(user) }
}

/**
 * Require super-admin role. Redirects to Payload login if not authenticated or not
 * a Studio user, and a studio-viewer to the Studio home.
 */
export function requireSuperAdmin(): Promise<{ user: AdminUser }> {
    return requireStudioRole((roles) => isSuperAdmin(roles))
}

/** Require any Studio role (super-admin or the read-only studio-viewer). */
export function requireStudioAccess(): Promise<{ user: AdminUser }> {
    return requireStudioRole((roles) => canViewStudio(roles))
}
