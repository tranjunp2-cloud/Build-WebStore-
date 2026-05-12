import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { passwordChangeSchema } from '@/lib/profile/schemas'
import { blockOwner, type UserLike } from '@/lib/profile/role-guard'
import { checkRateLimit } from '@/lib/rateLimit'
import { passwordChangedEmail } from '@/lib/email/templates'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const guard = blockOwner(user as UserLike)
        if (guard) return guard

        // Independent rate limit: 3 attempts / 5 min per user (separate from Payload's lockout)
        const rl = await checkRateLimit(`pwd:${user.id}`, 3, 5 * 60_000)
        if (!rl.allowed) {
            return NextResponse.json({ error: 'tooManyAttempts' }, { status: 429 })
        }

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
                data: { email: user.email, password: currentPassword },
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

        const userName = [
            (user as Record<string, unknown>).firstName,
            (user as Record<string, unknown>).lastName,
        ].filter(Boolean).join(' ') || user.email

        const { subject, html } = passwordChangedEmail({ userName, newPassword })
        payload.sendEmail({ to: user.email, subject, html })
            .catch((err: unknown) => payload.logger.error({ err }, '[users/me/password] notify email failed'))

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[users/me/password] POST error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
