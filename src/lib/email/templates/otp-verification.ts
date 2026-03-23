/**
 * OTP Verification email HTML template.
 * Sent when a user needs to verify identity via 2FA on PrimeWeb.
 * Supports EN (English) and MS (Bahasa Melayu) locales.
 *
 * Design: Teal gradient header · White card body · Teal OTP box · Amber notice · Light footer
 */

import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'
import type { EmailLocale } from './welcome'

const locales = { en: en.email, ms: ms.email } as Record<string, typeof en.email>

interface OTPEmailOptions {
    userName: string
    otpCode: string
    locale?: EmailLocale
}

export function otpVerificationEmail({ userName, otpCode, locale = 'en' }: OTPEmailOptions) {
    const t = (locales[locale] || locales.en).otp || {
        subject: 'Your PrimeWeb verification code 🔐',
        heading: 'Email Verification',
        subheading: 'Verify your identity to continue',
        greeting: 'Hi',
        body: 'Enter this code to verify your identity:',
        expiry: 'This code expires in 5 minutes',
        security: "If you didn't request this code, please ignore this email. Someone may have entered your email by mistake.",
        footer: 'Powered by PrimeWeb — AI Website Builder for Malaysian SMEs',
        copyright: `© ${new Date().getFullYear()} PrimeWeb · Kuala Lumpur, Malaysia`,
    }

    const subject = t.subject || 'Your PrimeWeb verification code 🔐'

    // Format OTP code with letter spacing for readability
    const formattedOtp = otpCode.split('').join('  ')

    const html = `
<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #0d9488, #0891b2); padding: 40px 32px; text-align: center;">
                <div style="width: 56px; height: 56px; margin: 0 auto 16px; background: rgba(255,255,255,0.15); border-radius: 50%; line-height: 56px; font-size: 24px;">🔐</div>
                <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0 0 8px; font-family: Inter, -apple-system, sans-serif;">${t.heading}</h1>
                <p style="color: rgba(255,255,255,0.85); font-size: 14px; margin: 0; font-family: Inter, -apple-system, sans-serif;">${t.subheading}</p>
            </div>

            <!-- Body -->
            <div style="padding: 32px;">
                <p style="font-size: 16px; font-weight: 500; color: #1a1a1a; margin: 0 0 16px;">${t.greeting} <strong>${userName}</strong>,</p>
                <p style="font-size: 14px; color: #555555; line-height: 1.7; margin: 0 0 24px;">
                    ${t.body}
                </p>

                <!-- OTP Code Box -->
                <div style="text-align: center; padding: 28px 24px; background: #f0fdfa; border: 1px solid rgba(13,148,136,0.2); border-radius: 12px; margin-bottom: 24px;">
                    <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #0d9488; font-family: 'Courier New', monospace;">${formattedOtp}</div>
                    <p style="color: #94a3b8; font-size: 12px; margin: 12px 0 0; font-family: Inter, -apple-system, sans-serif;">${t.expiry}</p>
                </div>

                <!-- Security notice -->
                <div style="background: #fef3c7; border-radius: 8px; padding: 12px 16px;">
                    <p style="font-size: 13px; color: #92400e; margin: 0; line-height: 1.5;">
                        ⚠️ ${t.security}
                    </p>
                </div>
            </div>

            <!-- Footer -->
            <div style="background: #fafafa; padding: 24px 32px; text-align: center; border-top: 1px solid #eeeeee;">
                <p style="font-size: 12px; color: #999999; margin: 0 0 8px; font-family: Inter, -apple-system, sans-serif;">${t.footer}</p>
                <p style="font-size: 11px; color: #bbbbbb; margin: 0; font-family: Inter, -apple-system, sans-serif;">${t.copyright}</p>
            </div>
        </div>
    </div>
</body>
</html>`

    return { subject, html }
}
