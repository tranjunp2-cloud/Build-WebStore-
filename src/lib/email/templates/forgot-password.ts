/**
 * Forgot Password email HTML template.
 * Sent when a user requests a password reset on PrimeWeb.
 * Supports EN (English) and MS (Bahasa Melayu) locales.
 */

import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'
import type { EmailLocale } from './welcome'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const locales = { en: en.email, ms: ms.email } as any

interface ForgotPasswordEmailData {
    userName: string
    resetUrl: string
    locale?: EmailLocale
}

export function forgotPasswordEmail(data: ForgotPasswordEmailData): { subject: string; html: string } {
    const { userName, resetUrl, locale = 'en' } = data
    const t = (locales[locale] || locales.en).forgotPassword

    return {
        subject: t.subject,
        html: `
<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #2563eb, #0891b2); padding: 40px 32px; text-align: center;">
                <div style="width: 56px; height: 56px; margin: 0 auto 16px; background: rgba(255,255,255,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <img src="https://img.icons8.com/fluency/48/lock-2.png" width="32" height="32" alt="lock" style="display: block;" />
                </div>
                <h1 style="color: white; font-size: 24px; margin: 0 0 8px;">${t.heading}</h1>
                <p style="color: rgba(255,255,255,0.85); font-size: 14px; margin: 0;">${t.subheading}</p>
            </div>

            <!-- Body -->
            <div style="padding: 32px;">
                <p style="font-size: 16px; margin: 0 0 16px;">${t.greeting} <strong>${userName}</strong>,</p>
                <p style="font-size: 14px; color: #555; line-height: 1.7; margin: 0 0 24px;">
                    ${t.body}
                </p>

                <!-- CTA -->
                <div style="text-align: center; margin-bottom: 24px;">
                    <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #0891b2); color: white; padding: 14px 40px; border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
                        ${t.cta}
                    </a>
                </div>

                <!-- Fallback URL -->
                <p style="font-size: 12px; color: #999; line-height: 1.6; margin: 0 0 16px; word-break: break-all;">
                    ${t.fallback}<br/>
                    <a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a>
                </p>

                <!-- Expiry notice -->
                <div style="background: #fef3c7; border-radius: 8px; padding: 12px 16px; border-left: 3px solid #f59e0b;">
                    <p style="font-size: 13px; color: #92400e; margin: 0;">
                        ⏱ ${t.expiry}
                    </p>
                </div>
            </div>

            <!-- Footer -->
            <div style="background: #fafafa; padding: 24px 32px; text-align: center; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #999; margin: 0 0 8px;">${t.footer}</p>
                <p style="font-size: 11px; color: #bbb; margin: 0;">${t.ignore}</p>
            </div>
        </div>
    </div>
</body>
</html>
        `.trim()
    }
}
