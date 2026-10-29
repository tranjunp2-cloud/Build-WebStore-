import type { Translations } from '@/i18n'

/** Copy for the whole landing page (namespace `landingV2` in en.json / ms.json). */
export type LvCopy = Translations['landingV2']

/** Template as the landing needs it, normalised from /api/templates/list. */
export interface LvTemplate {
  id: string
  name: string
  category: string[]
}

/** Section anchors shown in nav + footer, in page order. */
export const NAV_KEYS = ['how', 'features', 'templates', 'faq'] as const
export type NavKey = (typeof NAV_KEYS)[number]
