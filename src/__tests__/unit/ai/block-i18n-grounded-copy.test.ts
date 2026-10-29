/**
 * TC-AIAUD-184..186 — #2103 A1 leftovers (live browser verify): the stock block strings carried claims nobody
 * checked ("Transparent pricing with no hidden fees."), and a "TRUSTED BY" heading sat above the shop's own
 * payment-method badges (COD). Block strings state no claim; payment badges are headed "Payment methods".
 */

import { describe, expect, it } from 'vitest'
import { getBlockStrings, getSectionLabels } from '@/lib/ai/block-i18n'
import { UNVERIFIABLE_CLAIMS } from '@/lib/ai/content-rules'
import { buildBlockFromLibrary } from '@/lib/ai/content-injection'
import { buildGenerationFacts } from '@/lib/ai/generation-facts'
import { groundedLogoHeadline } from '@/lib/ai/grounded-blocks'
import { normalizeLocaleStructuralStrings } from '@/lib/ai/post-ai-swap'

const LANGUAGES = ['en', 'ms', 'vi', 'ja', 'zh', 'ko', 'ar', 'th'] as const

/** Claims a stock string must never make (en / ms / vi words; the other languages are checked by value below). */
const CLAIMS =
  /trusted|dipercayai|tin tưởng|hidden fee|no hidden|tersembunyi|phí ẩn|award|anugerah|certified|diperakui|#\s?1\b|best|terbaik|guarantee|jaminan|24\s?\/\s?7|free shipping|penghantaran percuma|miễn phí vận chuyển|exclusive|eksklusif|độc quyền|leading|industry leader|pemimpin industri|lãnh đạo ngành/i

/** Every string a locale's block strings hold (the function entries are called with a sample name). */
function stringsOf(value: unknown, into: string[] = []): string[] {
  if (typeof value === 'string') into.push(value)
  else if (typeof value === 'function') into.push(String((value as (name: string) => unknown)('Acme')))
  else if (value && typeof value === 'object') for (const v of Object.values(value)) stringsOf(v, into)
  return into
}

describe('stock block strings state no unverified claim [TC-AIAUD-184]', () => {
  it.each(LANGUAGES)('TC-AIAUD-184: %s strings hold no "trusted by", "no hidden fees", "best", "exclusive"… claim', (lang) => {
    const offending = stringsOf(getBlockStrings(lang)).filter((text) => CLAIMS.test(text) || UNVERIFIABLE_CLAIMS.some((re) => re.test(text)))

    expect(offending).toEqual([])
  })

  it('TC-AIAUD-184: the English pricing line is neutral, in every language the old claim is gone', () => {
    expect(getBlockStrings('en').pricing.subheadline).toBe('What we offer and what it costs.')
    for (const lang of LANGUAGES) {
      expect(getBlockStrings(lang).pricing.subheadline, lang).not.toMatch(/hidden|tersembunyi|phí ẩn|隠れた|隐藏|숨겨진|مخفية|ซ่อนเร้น/)
    }
  })

  it('TC-AIAUD-185: the logo-cloud heading is "Payment methods" (en / ms / vi equal the grounded headline) in the strings and the section labels', () => {
    for (const lang of ['en', 'ms', 'vi'] as const) {
      expect(getBlockStrings(lang).clientLogos.headline, lang).toBe(groundedLogoHeadline(lang))
    }
    for (const lang of ['ms', 'vi', 'ja', 'zh', 'ko', 'ar', 'th']) {
      expect(getSectionLabels(lang)?.clientLogos, lang).toBe(getBlockStrings(lang).clientLogos.headline)
    }
  })
})

describe('payment badges are never headed "Trusted by" [TC-AIAUD-185..186]', () => {
  const facts = buildGenerationFacts({ businessInfo: { businessName: 'Acme' }, tenant: { payments: { payment_cod: true } } })
  const logoCloud = (headline?: string) => ({ blockType: 'logo-cloud', variant: 'row', ...(headline ? { headline } : {}), logos: [{ name: 'COD' }] })

  it.each(['en', 'ms', 'vi'] as const)('TC-AIAUD-186: the %s page-normalising pass keeps the heading "Payment methods" over a COD badge', (lang) => {
    const [block] = normalizeLocaleStructuralStrings([logoCloud(groundedLogoHeadline(lang))], lang, 'Acme')

    expect(block?.headline).toBe(groundedLogoHeadline(lang))
    expect(JSON.stringify(block)).not.toMatch(/trusted|dipercayai|tin tưởng/i)
  })

  it('TC-AIAUD-186: a model-written "Trusted By" heading is replaced in the normalising pass', () => {
    const [block] = normalizeLocaleStructuralStrings([logoCloud('Trusted By')], 'en', 'Acme')

    expect(block?.headline).toBe('Payment methods')
  })

  it('TC-AIAUD-186: the gap-fill logo cloud for a COD shop is headed "Payment methods", in English and Malay', () => {
    const english = buildBlockFromLibrary('logo-cloud', 'beauty', { seed: 3, userBiz: { name: 'Acme', facts }, language: 'en' })
    const malay = buildBlockFromLibrary('logo-cloud', 'beauty', { seed: 3, userBiz: { name: 'Acme', facts }, language: 'ms' })

    expect(english?.headline).toBe('Payment methods')
    expect((english?.logos as Array<{ name: string }>).map((l) => l.name)).toEqual(['Cash on delivery'])
    expect(malay?.headline).toBe('Kaedah pembayaran')
  })
})
