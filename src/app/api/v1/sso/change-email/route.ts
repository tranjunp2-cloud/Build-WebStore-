import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'

/**
 * POST /api/v1/sso/change-email
 *
 * Updates a user's email address.
 * Called by SSO ChangeEmailProductUser job (extends JobBase — has retry, must be idempotent).
 *
 * Idempotency: if old email not found but new_email already exists → 200 (already applied).
 *
 * Auth: Bearer token (super-admin)
 * Body: { email, new_email }
 */
export async function POST(req: NextRequest) {
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

        const { email, new_email } = await req.json()
        if (!email || !new_email) {
            return NextResponse.json({ message: 'email and new_email are required' }, { status: 400 })
        }

        const userResult = await payload.find({
            collection: 'users',
            where: { email: { equals: email } },
            limit: 1,
        })

        if (userResult.docs.length === 0) {
            // Idempotency: check if new_email already applied from a prior retry
            const alreadyApplied = await payload.find({
                collection: 'users',
                where: { email: { equals: new_email } },
                limit: 1,
            })
            if (alreadyApplied.docs.length > 0) {
                return NextResponse.json(
                    { message: 'Email already updated', userId: alreadyApplied.docs[0].id },
                    { status: 200 },
                )
            }
            return NextResponse.json({ message: 'User not found' }, { status: 404 })
        }

        const userId = userResult.docs[0].id

        // Conflict check: new_email in use by a different user
        const conflict = await payload.find({
            collection: 'users',
            where: { email: { equals: new_email } },
            limit: 1,
        })
        if (conflict.docs.length > 0 && conflict.docs[0].id !== userId) {
            return NextResponse.json({ message: 'Email already in use' }, { status: 409 })
        }

        await payload.update({ collection: 'users', id: userId, data: { email: new_email } })

        console.log(`[V2][SSO ChangeEmail] Updated email for user ${userId}: ${email} → ${new_email}`)
        return NextResponse.json({ message: 'Email updated', userId }, { status: 200 })
    } catch (error) {
        console.error('[V2][SSO ChangeEmail Error]', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}
