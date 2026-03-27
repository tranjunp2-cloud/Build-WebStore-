import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

const SSO_FORGOT_PASSWORD_URL =
    process.env.SSO_FORGOT_PASSWORD_URL ||
    'https://sso-dev.ech.primecommerce.asia/auth/forgot-password'

/**
 * POST /api/auth/check-reset-flow
 *
 * Before sending a reset password email, check if the user is an Owner
 * (managed by SSO) or Staff (managed internally).
 *
 * - Owner (tenant-owner role) → redirect to SSO forgot-password page
 * - Staff (editor/viewer role) → allow internal Webstore reset flow
 * - Unknown email → return "internal" to avoid leaking role info
 *
 * Security: Does NOT reveal whether an email exists.
 * Always returns 200 with a flow type.
 */
export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json()

        if (!email) {
            // Don't reveal anything — treat as internal
            return NextResponse.json({ flow: 'internal' })
        }

        const payload = await getPayload({ config })

        const result = await payload.find({
            collection: 'users',
            where: { email: { equals: String(email).toLowerCase().trim() } },
            limit: 1,
            select: {
                roles: true,
            },
        })

        if (result.docs.length === 0) {
            // Email not found — don't reveal, treat as internal
            return NextResponse.json({ flow: 'internal' })
        }

        const user = result.docs[0]
        const roles = (user.roles as string[]) || []

        // Owner accounts are created by SSO → must reset password via SSO
        if (roles.includes('tenant-owner')) {
            return NextResponse.json({
                flow: 'sso',
                redirectUrl: SSO_FORGOT_PASSWORD_URL,
            })
        }

        // Staff accounts → internal reset flow
        return NextResponse.json({ flow: 'internal' })
    } catch (error) {
        console.error('[Check Reset Flow Error]', error)
        // On error, default to internal to not block user
        return NextResponse.json({ flow: 'internal' })
    }
}
