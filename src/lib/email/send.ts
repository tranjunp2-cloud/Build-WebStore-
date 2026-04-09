/**
 * Email service utility.
 * Uses Payload's configured SMTP transport (AWS SES).
 * Falls back to console logging when MAIL_HOST is not set (dev mode).
 */
import { getPayload } from 'payload'
import config from '@payload-config'

interface SendEmailOptions {
    to: string
    subject: string
    html: string
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
    try {
        const payload = await getPayload({ config })

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
