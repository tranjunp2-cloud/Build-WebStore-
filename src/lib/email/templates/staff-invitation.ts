/**
 * Staff Invitation email HTML template.
 * Sent when a user is invited to join a PrimeWeb workspace.
 */

import { mergeTemplateConfig } from '../merge-template-config'
import type { EmailTemplateConfig } from '../types'

export type EmailLocale = 'en' | 'ms'

interface StaffInvitationEmailData {
    userName: string
    workspaceName: string
    loginUrl?: string
    locale?: EmailLocale
    temporaryPassword?: string
}

export function staffInvitationEmail(data: StaffInvitationEmailData, config?: EmailTemplateConfig): { subject: string; html: string } {
    const { userName, workspaceName, loginUrl = 'https://primeweb.app/login', locale = 'en', temporaryPassword } = data

    const base = {
        // Hardcoded en for now
        subject: `You've been invited to join ${workspaceName} on PrimeWeb`,
        heading: 'Workspace Invitation',
        subheading: 'Join your team on PrimeWeb',
        greeting: 'Hello {inviteeName}',
        body: `You have been invited to join the workspace <strong>${workspaceName}</strong> as a staff member. Please log in to accept the invitation and access the workspace dashboard.`,
        cta: 'Log In to Accept',
        footer: 'PrimeWeb \u00A9 2026. All rights reserved.',
    }
    const vars = { inviteeName: userName, inviterName: '', brandName: 'PrimeWeb', dashboardUrl: loginUrl }
    const t = mergeTemplateConfig(base, config ?? null, vars, {
        subject: 'subject',
        greeting: 'greeting',
        ctaLabel: 'cta',
        closing: 'footer',
    })

    const subject = t.subject
    const heading = t.heading
    const subheading = t.subheading
    const greeting = t.greeting
    const body = t.body
    const cta = t.cta
    const footer = t.footer

    const passwordBlock = temporaryPassword ? `
        <div style="background: rgba(13, 148, 136, 0.1); border-left: 4px solid #0d9488; padding: 16px; margin: 24px 0; border-radius: 4px;">
            <p style="margin: 0 0 8px; font-size: 14px; color: #555;"><strong>Your Temporary Password:</strong></p>
            <p style="margin: 0; font-family: monospace; font-size: 18px; color: #0d9488; letter-spacing: 1px;">${temporaryPassword}</p>
            <p style="margin: 8px 0 0; font-size: 12px; color: #777;">Please use this to log in, you will then receive a 6-digit OTP code to your email.</p>
        </div>
    ` : ''

    return {
        subject,
        html: `
<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #0d9488, #6366f1); padding: 40px 32px; text-align: center;">
                <h1 style="color: white; font-size: 28px; margin: 0 0 8px;">${heading}</h1>
                <p style="color: rgba(255,255,255,0.85); font-size: 15px; margin: 0;">${subheading}</p>
            </div>

            <!-- Body -->
            <div style="padding: 32px;">
                <p style="font-size: 16px; margin: 0 0 16px;">${greeting},</p>
                <p style="font-size: 14px; color: #555; line-height: 1.7; margin: 0;">
                    ${body}
                </p>
                ${passwordBlock}

                <!-- CTA -->
                <div style="text-align: center;">
                    <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #0d9488, #0891b2); color: white; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none;">
                        ${cta}
                    </a>
                </div>
            </div>

            <!-- Footer -->
            <div style="background: #fafafa; padding: 24px 32px; text-align: center; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #999; margin: 0;">${footer}</p>
            </div>
        </div>
    </div>
</body>
</html>
        `.trim()
    }
}
