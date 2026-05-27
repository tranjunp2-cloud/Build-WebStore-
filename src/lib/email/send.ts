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
    // Optional: when all 3 present, lookup tenant config + check enabled flag
    templateType?: EmailTemplateType
    recipient?: EmailRecipient
    tenantId?: string | number
}

export async function sendEmail({ to, subject, html, templateType, recipient, tenantId }: SendEmailOptions): Promise<boolean> {
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

        await payload.sendEmail({
            to,
            subject,
            html,
        })

        console.log(`[Email] Sent to ${to}: ${subject}`)
        return true
    } catch (error) {
        console.error('[Email] Failed:', error)
        return false
    }
}
