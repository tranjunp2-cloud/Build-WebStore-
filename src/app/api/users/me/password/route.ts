import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { passwordChangeSchema } from '@/lib/profile/schemas'
import { blockOwner } from '@/lib/profile/role-guard'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const guard = blockOwner(user as any)
        if (guard) return guard

        const body = await req.json()
        const parsed = passwordChangeSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'invalidInput', details: parsed.error.flatten() },
                { status: 400 },
            )
        }

        const { currentPassword, newPassword } = parsed.data
        const payload = await getPayload({ config: configPromise })

        // Verify current password via Payload login.
        // Note: Payload enforces lockout (maxLoginAttempts=5, lockTime=15min) on
        // repeated failures — document this risk to end users if needed.
        try {
            await payload.login({
                collection: 'users',
                data: { email: (user as any).email, password: currentPassword },
            })
        } catch {
            return NextResponse.json(
                { error: 'currentPasswordIncorrect' },
                { status: 401 },
            )
        }

        await payload.update({
            collection: 'users',
            id: user.id,
            data: { password: newPassword },
            overrideAccess: true,
        })

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[users/me/password] POST error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
