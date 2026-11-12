import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { passwordChangeSchema } from '@/lib/profile/schemas'
import { blockOwner, type UserLike } from '@/lib/profile/role-guard'
import { IMPERSONATION_FORBIDDEN, isMerchantAccessSession } from '@/lib/support/merchant-access-session'
import { checkRateLimit } from '@/lib/rateLimit'
import { passwordChangedEmail } from '@/lib/email/templates'
import { getTemplateConfig } from '@/lib/email/get-template-config'
import type { PlatformUser } from '@/types/user'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser(req)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Support acting as the merchant must never change their credentials (TC-F15.40)
        if (isMerchantAccessSession(req)) {
            return NextResponse.json({ error: IMPERSONATION_FORBIDDEN }, { status: 403 })
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

        let keyString: string | undefined
        try {
            const { encryptPassword } = await import('@/lib/sso/sso-api-client')
            keyString = encryptPassword(newPassword)
        } catch (err) {
            console.error('[users/me/password] keyString encryption failed:', err)
        }

        await payload.update({
            collection: 'users',
            id: user.id,
            data: { password: newPassword, ...(keyString && { keyString }) },
            overrideAccess: true,
        })

        const u = user as unknown as PlatformUser
        const userName = [u.firstName, u.lastName].filter(Boolean).join(' ') || user.email
        const locale = u.prefer_lang ?? 'en'

        // Resolve tenantId from the user's first active tenant membership for CMS config lookup
        const tenants = (u as any).tenants ?? []
        const activeTenant = tenants.find((t: any) => t.status === 'active') ?? tenants[0]
        const tenantId = activeTenant
            ? (typeof activeTenant.tenant === 'object' ? activeTenant.tenant.id : activeTenant.tenant)
            : null

        const cmsConfig = tenantId
            ? await getTemplateConfig(tenantId, 'password-changed', 'seller')
            : null

        if (cmsConfig?.enabled === false) {
            console.log('[Email] suppressed (disabled): password-changed')
        } else {
            const { subject, html } = passwordChangedEmail({ userName, locale }, cmsConfig ?? undefined)
            payload.sendEmail({ to: user.email, subject, html })
                .catch((err: unknown) => payload.logger.error({ err }, '[users/me/password] notify email failed'))
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[users/me/password] POST error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
