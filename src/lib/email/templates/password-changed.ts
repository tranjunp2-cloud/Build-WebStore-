import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'
import { mergeTemplateConfig } from '../merge-template-config'
import type { EmailLocale } from './welcome'
import type { EmailTemplateConfig } from '../types'

const locales = { en: en.email, ms: ms.email } as Record<string, typeof en.email>

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
}

interface PasswordChangedEmailData {
    userName: string
    locale?: EmailLocale
}

export function passwordChangedEmail(data: PasswordChangedEmailData, config?: EmailTemplateConfig): { subject: string; html: string } {
    const { userName, locale = 'en' } = data
    const base = (locales[locale] || locales.en).passwordChanged
    const vars = { userName }
    const t = mergeTemplateConfig(base, config ?? null, vars, {
        subject: 'subject',
        greeting: 'greeting',
        closing: 'footer',
    })
    const safeUserName = escapeHtml(userName)

    return {
        subject: t.subject,
        html: `
<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 40px 32px; text-align: center;">
                <div style="width: 56px; height: 56px; margin: 0 auto 16px; background: rgba(255,255,255,0.15); border-radius: 50%; line-height: 56px; font-size: 24px;">🔐</div>
                <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0 0 8px;">${t.heading}</h1>
                <p style="color: rgba(255,255,255,0.85); font-size: 14px; margin: 0;">${t.subheading}</p>
            </div>

            <!-- Body -->
            <div style="padding: 32px;">
                <p style="font-size: 16px; font-weight: 500; color: #1a1a1a; margin: 0 0 16px;">${t.greeting},</p>
                <p style="font-size: 14px; color: #555555; line-height: 1.7; margin: 0 0 24px;">${t.body}</p>

                <!-- Warning -->
                <div style="background: #fef3c7; border-radius: 8px; padding: 12px 16px;">
                    <p style="font-size: 13px; color: #92400e; margin: 0; line-height: 1.5;">
                        ⚠️ ${t.warning}
                    </p>
                </div>
            </div>

            <!-- Footer -->
            <div style="background: #fafafa; padding: 24px 32px; text-align: center; border-top: 1px solid #eeeeee;">
                <p style="font-size: 12px; color: #999999; margin: 0;">${t.footer}</p>
            </div>
        </div>
    </div>
</body>
</html>
        `.trim()
    }
}
