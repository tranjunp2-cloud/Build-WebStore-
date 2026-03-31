import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'

/**
 * POST /api/user/dismiss-wizard
 * Mark the current user's AI Discovery Wizard as seen.
 * Uses withAuth() HOC which supports both Payload native JWT and custom MFA JWT.
 */
export const POST = withAuth(async (user) => {
    const payload = await getPayload({ config })

    await payload.update({
        collection: 'users',
        id: user.id,
        data: { has_seen_ai_wizard: true },
    })

    return NextResponse.json({ success: true })
})
