/**
 * GET /api/admin/me
 * Returns safe admin user fields for the Studio topbar avatar.
 * Never returns password hash, token, or refresh token.
 */
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import type { PlatformUser } from '@/types/user'

export async function GET() {
    const rawUser = await getCurrentUser()

    if (!rawUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = rawUser as unknown as PlatformUser

    if (!user.roles?.includes('super-admin')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({
        id: String(user.id),
        email: user.email,
        name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0],
        roles: user.roles ?? [],
    })
}
