import { cookies } from 'next/headers'
import { getPayload, type BasePayload, type User } from 'payload'
import config from '@payload-config'
import { NextRequest } from 'next/server'

interface AuthResult {
    user: User | null
    payload: BasePayload
}

/**
 * Shared utility to authenticate users in Next.js App Router API routes.
 */
export async function getAuthUser(req: NextRequest): Promise<AuthResult> {
    const payload = await getPayload({ config })
    
    // 1. Check cookies for payload-token
    const cookieStore = await cookies()
    const token = cookieStore.get('payload-token')?.value

    if (!token) {
        return { user: null, payload }
    }

    // 2. Authenticate using payload.auth
    // We need to pass the token in Authorization header for payload.auth() to pick it up
    const authHeaders = new Headers(req.headers)
    authHeaders.set('Authorization', `JWT ${token}`)

    try {
        const { user } = await payload.auth({ headers: authHeaders })
        return { user, payload }
    } catch (error) {
        return { user: null, payload }
    }
}
