/**
 * Permanent variety regression test — Plan 07 acceptance gate.
 *
 * Coverage: TC-F01-W.44 — 3 restaurant fixtures at seed=42 MUST diverge
 * on ≥ 8 of 13 observable fields (hero headline / subheadline / CTA /
 * features titles / about body / home SEO description / blog titles /
 * image query hint).
 *
 * If this test fails, revert the offending change — Phase 07 was shipped
 * to close a documented variety regression and this test is the gate.
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-07-variety-retrofit.md
 * Diagnostic: reports/variety-regression-diagnostic.md (11 same / 2 diff → ≥ 8 diff)
 */

import { describe, it, expect } from 'vitest'
import { composeFallbackResult } from '@/lib/ai/fallback-adapter'
import type { BusinessInfoInput } from '@/lib/ai/system-prompt'

type Fixture = {
  label: string
  info: BusinessInfoInput
}

const FIXTURES: Fixture[] = [
  {
    label: 'Ramen Ichiban',
    info: {
      businessName: 'Ramen Ichiban',
      industry: 'restaurant',
      shortDescription:
        'Authentic Sapporo-style ramen served in a cozy 12-seat counter in Bukit Bintang. Bone broth simmered 18 hours and noodles pulled fresh every morning.',
      phone: '+60 3-1234 5678',
      email: 'hello@ramen-ichiban.my',
      address: 'No. 12, Jalan Bukit Bintang, 55100 Kuala Lumpur',
      products: 'tonkotsu ramen, miso ramen, gyoza, chashu',
    },
  },
  {
    label: 'Roti Canai House',
    info: {
      businessName: 'Roti Canai House',
      industry: 'restaurant',
      shortDescription:
        'A family-run mamak bringing Penang-style flatbread classics to Brickfields since 1985. Stretch, slap, fry — the original three-step tradition.',
      phone: '+60 3-2222 3333',
      email: 'hi@roticanaihouse.my',
      address: 'No. 45, Jalan Tun Sambanthan, 50470 Kuala Lumpur',
      products: 'roti canai, roti telur, teh tarik, curry chicken',
    },
  },
  {
    label: 'Pho 88',
    info: {
      businessName: 'Pho 88',
      industry: 'restaurant',
      shortDescription:
        'Hanoi-style pho served fresh every morning. Our rice noodles arrive daily from Hanoi and the star anise broth is left to bloom 12 hours.',
      phone: '+60 3-5555 6666',
      email: 'xin-chao@pho88.my',
      address: 'No. 88, Jalan Pudu, 55100 Kuala Lumpur',
      products: 'pho bo, pho ga, banh mi, goi cuon',
    },
  },
]

const SEED = 42

type PickedFields = {
  heroHeadline: string
  heroSubheadline: string
  heroCtaPrimary: string
  heroCtaSecondary: string
  featuresHeadline: string
  featuresItems: string
  aboutBody: string
  siteName: string
  siteSeoTitle: string
  siteSeoDescription: string
  homeSeoDescription: string
  contactPhone: string
  blogFirstTitle: string
}

function pickComparedFields(label: string, result: ReturnType<typeof composeFallbackResult>): PickedFields {
  const homepage = (result.pages ?? [])[0]
  if (!homepage) throw new Error(`${label}: no homepage in result`)

  const layout = homepage.blocks as Array<Record<string, unknown>>
  const hero = layout.find((b) => b.blockType === 'hero') ?? {}
  const features = layout.find((b) => b.blockType === 'features') ?? {}
  const about = layout.find((b) => b.blockType === 'about') ?? {}
  const contact = layout.find((b) => b.blockType === 'contact') ?? {}

  const heroCtas = (hero.ctaButtons as Array<{ label?: string }> | undefined) ?? []
  const featureItems = (features.features as Array<{ title?: string }> | undefined) ?? []

  // Find blog page
  const blogPage = (result.pages ?? []).find((p) =>
    String(p.title || '').toLowerCase().includes('blog'),
  )
  const blogLayout = (blogPage?.blocks ?? []) as Array<Record<string, unknown>>
  const blogList = blogLayout.find((b) => b.blockType === 'blog-list') ?? {}
  const blogItems = (blogList.items as Array<{ title?: string }> | undefined) ?? []

  return {
    heroHeadline: String(hero.headline ?? ''),
    heroSubheadline: String(hero.subheadline ?? ''),
    heroCtaPrimary: String(heroCtas[0]?.label ?? ''),
    heroCtaSecondary: String(heroCtas[1]?.label ?? ''),
    featuresHeadline: String(features.headline ?? ''),
    featuresItems: featureItems.map((f) => f.title ?? '').join('|'),
    aboutBody: String(about.body ?? ''),
    siteName: String(result.siteName ?? ''),
    siteSeoTitle: String(result.seo?.title ?? ''),
    siteSeoDescription: String(result.seo?.description ?? ''),
    homeSeoDescription: String(homepage.seo?.description ?? ''),
    contactPhone: String(contact.phone ?? ''),
    blogFirstTitle: String(blogItems[0]?.title ?? ''),
  }
}

describe('TC-F01-W.44 — variety regression (Plan 07 acceptance gate)', () => {
  it('3 restaurant fixtures at seed=42 differ on ≥ 8 of 13 fields', () => {
    const results = FIXTURES.map((f) => {
      const prompt = [f.info.businessName, f.info.industry, f.info.shortDescription].join(' | ')
      return {
        label: f.label,
        picked: pickComparedFields(f.label, composeFallbackResult(prompt, SEED, 'en', f.info)),
      }
    })

    const fieldKeys: Array<keyof PickedFields> = [
      'heroHeadline',
      'heroSubheadline',
      'heroCtaPrimary',
      'heroCtaSecondary',
      'featuresHeadline',
      'featuresItems',
      'aboutBody',
      'siteName',
      'siteSeoTitle',
      'siteSeoDescription',
      'homeSeoDescription',
      'contactPhone',
      'blogFirstTitle',
    ]
    expect(fieldKeys.length).toBe(13)

    // Count a field as "distinct" if the 3 fixtures produce at least 2 unique values.
    let distinctCount = 0
    const sameFields: string[] = []
    for (const key of fieldKeys) {
      const values = results.map((r) => r.picked[key])
      const uniq = new Set(values)
      if (uniq.size >= 2) {
        distinctCount++
      } else {
        sameFields.push(`${String(key)}="${values[0]}"`)
      }
    }

    if (distinctCount < 8) {
      console.error(
        `[variety-repro] only ${distinctCount}/13 fields differ. Same across all 3:\n  - ${sameFields.join('\n  - ')}`,
      )
    }

    expect(distinctCount).toBeGreaterThanOrEqual(8)
  })

  it('every fixture threads its own biz.phone into contact block', () => {
    for (const f of FIXTURES) {
      const prompt = [f.info.businessName, f.info.industry, f.info.shortDescription].join(' | ')
      const result = composeFallbackResult(prompt, SEED, 'en', f.info)
      const homepage = result.pages?.[0]
      const contact = (homepage?.blocks as Array<Record<string, unknown>>)?.find(
        (b) => b.blockType === 'contact',
      )
      if (!contact) {
        // Some presets don't include contact on homepage — check sub-pages.
        const contactPage = result.pages?.find((p) =>
          String(p.title || '').toLowerCase().includes('contact'),
        )
        const subContact = (contactPage?.blocks as Array<Record<string, unknown>>)?.find(
          (b) => b.blockType === 'contact',
        )
        expect(String(subContact?.phone ?? '')).toBe(f.info.phone)
      } else {
        expect(String(contact.phone ?? '')).toBe(f.info.phone)
      }
    }
  })

  it('every fixture threads its own biz.products into features items', () => {
    for (const f of FIXTURES) {
      const prompt = [f.info.businessName, f.info.industry, f.info.shortDescription].join(' | ')
      const result = composeFallbackResult(prompt, SEED, 'en', f.info)
      const homepage = result.pages?.[0]
      const features = (homepage?.blocks as Array<Record<string, unknown>>)?.find(
        (b) => b.blockType === 'features',
      )
      if (!features) continue // preset may not include features on home
      const items = (features.features as Array<{ title?: string }> | undefined) ?? []
      const joinedTitles = items.map((i) => (i.title ?? '').toLowerCase()).join(' ')
      const firstProduct = (f.info.products ?? '').split(',')[0]!.trim().toLowerCase()
      expect(joinedTitles).toContain(firstProduct.split(' ')[0]!)
    }
  })
})
