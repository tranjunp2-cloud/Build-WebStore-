/**
 * Server-side auth guard for Studio admin routes.
 * Defense-in-depth: middleware checks JWT role, this checks DB role.
 * Usage: `const { user } = await requireSuperAdmin()` in server components.
 */
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import type { PlatformUser } from '@/types/user'

export type AdminUser = {
    id: string
    email: string
    name: string
    roles: string[]
}

/**
 * Require super-admin role. Redirects to Payload login if:
 * - Not authenticated
 * - Authenticated but role is not 'super-admin'
 */
export async function requireSuperAdmin(): Promise<{ user: AdminUser }> {
    const rawUser = await getCurrentUser()

    if (!rawUser) {
        redirect('/admin')
    }

    const user = rawUser as unknown as PlatformUser

    if (!user.roles?.includes('super-admin')) {
        redirect('/admin')
    }

    return {
        user: {
            id: String(user.id),
            email: user.email,
            name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0],
            roles: user.roles ?? [],
        },
    }
}
