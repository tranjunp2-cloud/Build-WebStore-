/**
 * Server-side i18n helper for email templates.
 * Reads translations from the shared locale files (src/i18n/locales/).
 *
 * Note: Emails are rendered server-side, so we can't use the React I18nProvider.
 * This module provides a lightweight alternative that reads from the same locale source.
 */

import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'

export type EmailLocale = 'en' | 'ms'

type EmailTranslations = typeof en.email

const locales: Record<EmailLocale, EmailTranslations> = {
    en: en.email,
    ms: ms.email,
}

// ─── Helper Functions ────────────────────────────────────────────────────

/** Get email translations for a locale */
export function getEmailT(locale: EmailLocale = 'en'): EmailTranslations {
    return locales[locale] || locales.en
}

/**
 * Format price based on locale per SPEC Rule 3.
 * EN: MYR 299.00 | MS: RM299.00
 */
export function formatPrice(amount: number, currency: string, locale: EmailLocale = 'en'): string {
    if (currency === 'MYR') {
        return locale === 'ms'
            ? `RM${amount.toFixed(2)}`
            : `MYR ${amount.toFixed(2)}`
    }
    return `${currency} ${amount.toFixed(2)}`
}
