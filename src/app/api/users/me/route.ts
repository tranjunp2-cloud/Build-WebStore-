import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { profilePatchSchema } from '@/lib/profile/schemas'
import { blockOwner, type UserLike } from '@/lib/profile/role-guard'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const payload = await getPayload({ config: configPromise })
        const doc = await payload.findByID({
            collection: 'users',
            id: user.id,
            depth: 1,
        }) as unknown as Record<string, unknown>

        return NextResponse.json({
            id: doc.id,
            email: doc.email,
            firstName: doc.firstName,
            lastName: doc.lastName,
            phone: doc.phone,
            avatar: doc.avatar,
            roles: doc.roles,
            tenants: doc.tenants,
            createdAt: doc.createdAt,
            lastLoginAt: doc.lastLoginAt,
        })
    } catch (err) {
        console.error('[users/me] GET error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const guard = blockOwner(user as UserLike)
        if (guard) return guard

        const body = await req.json()
        const parsed = profilePatchSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'invalidInput', details: parsed.error.flatten() },
                { status: 400 },
            )
        }

        const payload = await getPayload({ config: configPromise })
        const updated = await payload.update({
            collection: 'users',
            id: user.id,
            data: parsed.data,
        }) as unknown as Record<string, unknown>

        return NextResponse.json({
            id: updated.id,
            firstName: updated.firstName,
            lastName: updated.lastName,
            phone: updated.phone,
        })
    } catch (err) {
        console.error('[users/me] PATCH error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
