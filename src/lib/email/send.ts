/**
 * Email service utility.
 * Uses Payload's configured SMTP transport (AWS SES).
 * Falls back to console logging when MAIL_HOST is not set (dev mode).
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { getTemplateConfig } from './get-template-config'
import type { EmailTemplateType, EmailRecipient } from './types'

interface SendEmailOptions {
    to: string
    subject: string
    html: string
    // Optional: where a reply to this email goes (nodemailer passes it through Payload's sendEmail)
    replyTo?: string
    // Optional: when all 3 present, lookup tenant config + check enabled flag
    templateType?: EmailTemplateType
    recipient?: EmailRecipient
    tenantId?: string | number
}

export async function sendEmail({ to, subject, html, replyTo, templateType, recipient, tenantId }: SendEmailOptions): Promise<boolean> {
    try {
        const payload = await getPayload({ config })

        // Tenant-aware enabled check: suppress send when admin has disabled this template
        if (tenantId && templateType && recipient) {
            const templateConfig = await getTemplateConfig(tenantId, templateType, recipient)
            if (templateConfig?.enabled === false) {
                console.log(`[Email] Suppressed (disabled): ${templateType}`)
                return false
            }
        }

        // Retry up to 2 times for transient SMTP/SES failures (500ms, 1000ms backoff).
        // Last attempt rethrows to outer catch — the unreachable branch after the loop is intentionally absent.
        const MAX_ATTEMPTS = 3
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                await payload.sendEmail({ to, subject, html, ...(replyTo ? { replyTo } : {}) })
                console.log(`[Email] Sent to ${to}: ${subject}${attempt > 1 ? ` (attempt ${attempt})` : ''}`)
                return true
            } catch (err) {
                if (attempt === MAX_ATTEMPTS) throw err
                console.warn(`[Email] Attempt ${attempt} failed, retrying in ${500 * attempt}ms...`)
                await new Promise(r => setTimeout(r, 500 * attempt))
            }
        }
        /* istanbul ignore next — rethrow on final attempt exits loop via throw, not here */
        return false
    } catch (error) {
        console.error('[Email] Failed after 3 attempts:', error)
        return false
    }
}
