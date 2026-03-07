import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Get the currently authenticated user from Payload CMS session.
 * Use this in Server Components and Route Handlers.
 *
 * @returns The user object or null if not authenticated
 */
export async function getCurrentUser() {
    const cookieStore = await cookies()
    const token = cookieStore.get('payload-token')?.value

    if (!token) return null

    try {
        const payload = await getPayload({ config })

        const { user } = await payload.auth({
            headers: new Headers({
                Authorization: `JWT ${token}`,
            }),
        })

        return user || null
    } catch {
        return null
    }
}

/**
 * Get the current user's primary tenant ID.
 * Most users only have 1 tenant (their store).
 */
export async function getCurrentTenantId(): Promise<string | null> {
    const user = await getCurrentUser()
    if (!user) return null

    const tenants = (user as unknown as { tenants?: Array<{ tenant: string | { id: string } }> }).tenants
    if (!tenants || tenants.length === 0) return null

    const firstTenant = tenants[0].tenant
    return typeof firstTenant === 'string' ? firstTenant : firstTenant?.id || null
}
