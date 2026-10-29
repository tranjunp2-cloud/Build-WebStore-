import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'

/** The locale files only ship en / ms; vi is the third language generated shops are written in. */
const VI_SOLD_OUT = 'Hết hàng'

/**
 * "Sold out" badge text in the SITE's language (generationLocale, else locale) - the same signal the blog-list
 * block uses for its labels. A shop's visitors read the shop's language, not the dashboard's UI preference.
 */
export function soldOutLabel(site: unknown): string {
    const rec = (site ?? {}) as Record<string, unknown>
    const raw = (typeof rec.generationLocale === 'string' && rec.generationLocale)
        || (typeof rec.locale === 'string' && rec.locale)
        || 'en'
    const lang = raw.toLowerCase().split('-')[0]
    if (lang === 'vi') return VI_SOLD_OUT
    return (lang === 'ms' ? ms : en).storefront.products.soldOut
}
