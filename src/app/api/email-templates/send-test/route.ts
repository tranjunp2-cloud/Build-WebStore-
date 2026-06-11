/**
 * POST /api/email-templates/send-test
 *
 * Renders an email template with fixture data + optional draft config,
 * then sends it to the authenticated user's email address.
 * Used by the Email Templates settings page "Send test" button.
 */
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'
import { EMAIL_TEMPLATE_TYPES, type EmailTemplateType, type EmailTemplateConfig } from '@/lib/email/types'
import { templateRegistry } from '@/lib/email/template-registry'
import { EMAIL_PREVIEW_FIXTURES } from '@/lib/email/preview-fixtures'
import { redis } from '@/lib/redis'
import type { User } from 'payload'

const SEND_TEST_RATE_LIMIT = 5 // max per window
const SEND_TEST_WINDOW_SECONDS = 60

export const POST = withFeatureGuard('email_template_configuration')(withAuth(async (user: User, req: Request) => {
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { templateType, locale, draftConfig } = body as {
        templateType: unknown
        locale?: unknown
        draftConfig?: unknown
    }

    if (typeof templateType !== 'string' || !EMAIL_TEMPLATE_TYPES.includes(templateType as EmailTemplateType)) {
        return NextResponse.json({ error: 'Invalid templateType' }, { status: 400 })
    }

    const recipientEmail = (user as any).email
    if (!recipientEmail) {
        return NextResponse.json({ error: 'No email address on your account' }, { status: 400 })
    }

    // Rate limit: 5 sends per user per 60s — prevents SES abuse.
    // Pipeline ensures NX+EX is atomic (no orphaned keys if server crashes after incr).
    if (redis) {
        try {
            const rlKey = `send-test-rl:${(user as any).id}`
            const pipeline = redis.pipeline()
            pipeline.set(rlKey, 0, { nx: true, ex: SEND_TEST_WINDOW_SECONDS })
            pipeline.incr(rlKey)
            const results = await pipeline.exec()
            const count = results[1] as number
            if (count > SEND_TEST_RATE_LIMIT) {
                return NextResponse.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
            }
        } catch {
            // Redis unavailable — allow through
        }
    }

    const type = templateType as EmailTemplateType
    const validLocale = typeof locale === 'string' && ['en', 'ms'].includes(locale) ? locale : 'en'
    const fixture = { ...EMAIL_PREVIEW_FIXTURES[type], locale: validLocale }

    const resolvedConfig: EmailTemplateConfig | undefined =
        draftConfig != null && typeof draftConfig === 'object' && !Array.isArray(draftConfig)
            ? (draftConfig as EmailTemplateConfig)
            : undefined

    let subject: string
    let html: string
    try {
        ({ subject, html } = templateRegistry[type](fixture, resolvedConfig))
    } catch (err) {
        console.error('[send-test] render error for type:', type, err instanceof Error ? err.message : err)
        return NextResponse.json({ error: 'Template render failed' }, { status: 500 })
    }

    const payload = await getPayload({ config })
    try {
        await payload.sendEmail({
            to: recipientEmail,
            subject: `[Test] ${subject}`,
            html,
        })
    } catch (err) {
        payload.logger.error({ err, type }, '[send-test] sendEmail failed')
        return NextResponse.json({ error: 'Failed to send email' }, { status: 502 })
    }

    return NextResponse.json({ success: true, sentTo: recipientEmail })
}))
