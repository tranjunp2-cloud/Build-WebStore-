import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'

/**
 * GET /api/v1/sso/check-email?email=...
 *
 * Checks whether an email exists in PW2.
 * Called by SSO checkUserExist before provisioning.
 *
 * Auth: Bearer token (super-admin)
 * Response: { exists: boolean }
 */
export async function GET(req: NextRequest) {
    try {
        const payload = await getPayload({ config })

        const authHeader = req.headers.get('authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ message: 'Authorization required' }, { status: 401 })
        }
        const callerUser = await getCurrentUser(req)
        if (!callerUser) return NextResponse.json({ message: 'Invalid token' }, { status: 401 })
        if (!callerUser.roles?.includes('super-admin')) {
            return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 })
        }

        const email = req.nextUrl.searchParams.get('email')
        if (!email) {
            return NextResponse.json({ message: 'email query param is required' }, { status: 400 })
        }

        const result = await payload.find({
            collection: 'users',
            where: { email: { equals: email } },
            limit: 1,
        })

        return NextResponse.json({ exists: result.docs.length > 0 }, { status: 200 })
    } catch (error) {
        console.error('[V2][SSO CheckEmail Error]', error)
        return NextResponse.json({ exists: false, error: 'service_unavailable' }, { status: 200 })
    }
}
