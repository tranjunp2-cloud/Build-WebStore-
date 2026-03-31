import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * PUT /api/v1/sso/reset-password
 *
 * SSO Password Reset / Sync endpoint.
 * Receives payload from TM Legacy SSO system for resetting user password.
 * Payload: { email: '...', password: '...' }
 *
 * Auth: Requires Bearer token from admin login.
 *
 * Session-Safe: Payload V3 uses stateless JWT (no useSessions configured).
 * Changing password does NOT invalidate existing JWT tokens.
 * → User currently logged in with old password will NOT be kicked out
 *   on page refresh (F5). Their JWT remains valid until expiration.
 * → New password takes effect on NEXT login only.
 */
export async function PUT(req: NextRequest) {
    try {
        const payload = await getPayload({ config })

        // ── 1. Auth Check ──
        const authHeader = req.headers.get('authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { message: 'Authorization required' },
                { status: 401 },
            )
        }

        const token = authHeader.split(' ')[1]

        let callerUser: any
        try {
            const authResult = await payload.auth({
                headers: new Headers({
                    Authorization: `JWT ${token}`,
                }),
            })
            callerUser = authResult?.user || null

            // Fallback for custom jose-signed JWT (SSO service token)
            if (!callerUser) {
                const payloadSecret = process.env.PAYLOAD_SECRET
                if (payloadSecret) {
                    const { jwtVerify } = await (import('jose'))
                    const secret = new TextEncoder().encode(payloadSecret)
                    try {
                        const { payload: decoded } = await jwtVerify(token, secret)

                        const isIdValid =
                            typeof decoded.id === 'number' ||
                            (typeof decoded.id === 'string' && /^[a-zA-Z0-9-]+$/.test(decoded.id))

                        if (isIdValid && decoded.collection === 'users') {
                            const user = await payload.findByID({
                                collection: 'users',
                                id: decoded.id as string | number,
                            })
                            callerUser = user || null
                        }
                    } catch (e) {
                        // jose verification failed
                    }
                }
            }

            if (!callerUser) {
                return NextResponse.json({ message: 'Invalid token' }, { status: 401 })
            }
        } catch (error) {
            console.error('[SSO Auth Error]', error)
            return NextResponse.json({ message: 'Invalid token' }, { status: 401 })
        }

        if (!callerUser?.roles?.includes('super-admin')) {
            return NextResponse.json(
                { message: 'Insufficient permissions. Super-admin role required.' },
                { status: 403 },
            )
        }

        // ── 2. Parse Payload ──
        const rawPayload = await req.json()
        const email = rawPayload.email
        const password = rawPayload.password

        if (!email || !password) {
            return NextResponse.json(
                { message: 'Missing required fields: email, password' },
                { status: 400 },
            )
        }

        // ── 3. Find User ──
        const existingUsers = await payload.find({
            collection: 'users',
            where: { email: { equals: String(email) } },
            limit: 1,
        })

        if (existingUsers.docs.length === 0) {
            return NextResponse.json(
                { message: 'User not found' },
                { status: 404 },
            )
        }

        const targetUser = existingUsers.docs[0]

        // ── 4. Update Password ──
        await payload.update({
            collection: 'users',
            id: targetUser.id as number,
            data: {
                password: String(password),
            },
            overrideAccess: true, // Admin action — bypass user self-edit restriction
        })

        return NextResponse.json(
            { message: 'Password updated successfully' },
            { status: 200 },
        )
    } catch (error) {
        console.error('[SSO Reset Password Error]', error)
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 },
        )
    }
}
