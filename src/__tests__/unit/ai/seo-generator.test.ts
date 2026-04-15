/**
 * Phase 06 SEO generator + JSON-LD template tests.
 *
 * Coverage:
 *   TC-F01-W.27 — every page has unique meta description (no more shared tagline)
 *   TC-F01-W.28 — home title uses tagline, sub-page title uses "{page} · {biz}"
 *   TC-F01-W.29 — title + description respect length caps (60 / 155)
 *   TC-F01-W.30 — LocalBusiness JSON-LD embeds user phone/email/address
 *   TC-F01-W.31 — category → schema.org @type mapping (Restaurant, MedicalClinic…)
 *   TC-F01-W.32 — FAQPage schema attached only to pages with FAQ block
 *   TC-F01-W.33 — ogImage falls back to site-wide hero when page has no image
 *   TC-F01-W.34 — dedupe: identical mined descriptions get disambiguated
 *   TC-F01-W.35 — fallback-adapter integration: unique desc per page + jsonLd present
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-06-seo-consistency-guard.md
 */

import { describe, it, expect } from 'vitest'
import {
  generatePageSeo,
  generateAllPageSeo,
  type PageForSeo,
} from '@/lib/ai/seo-generator'
import {
  buildLocalBusinessJsonLd,
  buildFaqJsonLd,
} from '@/lib/ai/json-ld-templates'
import type { BusinessSample } from '@/lib/ai/content/types'
import { composeFallbackResult } from '@/lib/ai/fallback-adapter'
import type { BusinessInfoInput } from '@/lib/ai/system-prompt'

function ramenBiz(): BusinessSample {
  return {
    name: 'Ramen Ichiban',
    tagline: 'Authentic Tokyo ramen in KL',
    description: 'Authentic Japanese ramen crafted from scratch, bringing Tokyo techniques to Malaysian diners every day.',
    address: '123 Jalan Bukit Bintang, Kuala Lumpur, MY',
    phone: '+60 12-345 6789',
    email: 'hello@ramenichiban.my',
    heroHeadline: 'Welcome',
    heroSubheadline: 'Est 2019',
    products: ['tonkotsu ramen', 'sushi', 'gyoza'],
  }
}

function makePage(title: string, blocks: Array<Record<string, unknown>>, isHomepage = false): PageForSeo {
  return { title, slug: title.toLowerCase(), blocks, isHomepage }
}

describe('TC-F01-W.27 — unique meta description per page', () => {
  it('home + about + contact generate 3 different descriptions', () => {
    const biz = ramenBiz()
    const pages: PageForSeo[] = [
      makePage('Home', [
        { blockType: 'hero', subheadline: 'Slurp-worthy tonkotsu broth simmered 18 hours for the perfect bowl.' },
      ], true),
      makePage('About', [
        { blockType: 'hero', subheadline: 'Our chef trained at Tokyo’s Ippudo before opening Ramen Ichiban in KL.' },
        { blockType: 'about', body: 'We import Japanese flour and simmer pork bones overnight.' },
      ]),
      makePage('Contact', [
        { blockType: 'hero', subheadline: 'Find us in the heart of Bukit Bintang — open daily 11am–10pm.' },
      ]),
    ]

    const result = generateAllPageSeo(pages, { biz, category: 'restaurant' })
    const descriptions = result.map((r) => r.description)
    const unique = new Set(descriptions)
    expect(unique.size).toBe(descriptions.length)
  })
})

describe('TC-F01-W.28 — title formatting', () => {
  it('homepage title is "{biz.name} · {tagline}"', () => {
    const biz = ramenBiz()
    const page = makePage('Home', [{ blockType: 'hero', subheadline: 'hi' }], true)
    const seo = generatePageSeo(page, { biz, category: 'restaurant' })
    expect(seo.title).toContain('Ramen Ichiban')
    expect(seo.title).toContain('Authentic Tokyo ramen')
  })

  it('sub-page title is "{page.title} · {biz.name}"', () => {
    const biz = ramenBiz()
    const page = makePage('About', [{ blockType: 'hero', subheadline: 'hi' }], false)
    const seo = generatePageSeo(page, { biz, category: 'restaurant' })
    expect(seo.title).toBe('About · Ramen Ichiban')
  })

  it('falls back to biz.name when tagline empty', () => {
    const biz = { ...ramenBiz(), tagline: '' }
    const page = makePage('Home', [{ blockType: 'hero', subheadline: 'hi' }], true)
    const seo = generatePageSeo(page, { biz, category: 'restaurant' })
    expect(seo.title).toBe('Ramen Ichiban')
  })
})

describe('TC-F01-W.29 — length caps', () => {
  it('title ≤ 60 chars', () => {
    const biz = ramenBiz()
    const page = makePage(
      'Very Long Page Title That Should Definitely Exceed The Sixty Character Cap',
      [{ blockType: 'hero', subheadline: 'x' }],
      false,
    )
    const seo = generatePageSeo(page, { biz, category: 'restaurant' })
    expect(seo.title.length).toBeLessThanOrEqual(60)
  })

  it('description ≤ 155 chars', () => {
    const biz = ramenBiz()
    const longSubheadline = 'A'.repeat(500)
    const page = makePage('Home', [{ blockType: 'hero', subheadline: longSubheadline }], true)
    const seo = generatePageSeo(page, { biz, category: 'restaurant' })
    expect(seo.description.length).toBeLessThanOrEqual(155)
  })
})

describe('TC-F01-W.30 — LocalBusiness JSON-LD contact fields', () => {
  it('embeds user phone, email, and address', () => {
    const biz = ramenBiz()
    const schema = buildLocalBusinessJsonLd({ biz, category: 'restaurant' })
    expect(schema.telephone).toBe('+60 12-345 6789')
    expect(schema.email).toBe('hello@ramenichiban.my')
    expect(schema.address).toBeDefined()
    expect(schema.address!.streetAddress).toBe('123 Jalan Bukit Bintang')
  })

  it('omits telephone/email when biz has none', () => {
    const biz: BusinessSample = { ...ramenBiz(), phone: '', email: '' }
    const schema = buildLocalBusinessJsonLd({ biz, category: 'restaurant' })
    expect(schema.telephone).toBeUndefined()
    expect(schema.email).toBeUndefined()
  })
})

describe('TC-F01-W.31 — category → schema @type mapping', () => {
  it.each([
    ['restaurant', 'Restaurant'],
    ['fnb', 'Restaurant'],
    ['health', 'MedicalClinic'],
    ['education', 'EducationalOrganization'],
    ['ecommerce', 'Store'],
    ['beauty', 'BeautySalon'],
    ['tech', 'LocalBusiness'],
    ['unknown-cat', 'LocalBusiness'],
  ])('%s → %s', (category, expected) => {
    const schema = buildLocalBusinessJsonLd({ biz: ramenBiz(), category })
    expect(schema['@type']).toBe(expected)
  })

  it('Restaurant schema exposes servesCuisine from biz.products', () => {
    const schema = buildLocalBusinessJsonLd({ biz: ramenBiz(), category: 'restaurant' })
    expect(schema.servesCuisine).toEqual(['tonkotsu ramen', 'sushi', 'gyoza'])
  })
})

describe('TC-F01-W.32 — FAQPage schema per-page', () => {
  it('page with faq block → FAQPage schema attached', () => {
    const biz = ramenBiz()
    const page = makePage('Contact', [
      { blockType: 'hero', subheadline: 'visit us' },
      {
        blockType: 'faq',
        items: [
          { question: 'What hours?', answer: '11am–10pm daily.' },
          { question: 'Halal?', answer: 'Yes, fully halal-certified.' },
        ],
      },
    ])
    const seo = generatePageSeo(page, { biz, category: 'restaurant' })
    expect(seo.jsonLd.length).toBe(2)
    const faqSchema = seo.jsonLd.find((s) => s['@type'] === 'FAQPage')
    expect(faqSchema).toBeDefined()
  })

  it('page without faq block → only LocalBusiness schema', () => {
    const biz = ramenBiz()
    const page = makePage('About', [{ blockType: 'hero', subheadline: 'story' }])
    const seo = generatePageSeo(page, { biz, category: 'restaurant' })
    expect(seo.jsonLd.length).toBe(1)
    expect(seo.jsonLd[0]!['@type']).toBe('Restaurant')
  })

  it('buildFaqJsonLd returns null for empty items', () => {
    expect(buildFaqJsonLd([])).toBeNull()
  })
})

describe('TC-F01-W.33 — ogImage fallback', () => {
  it('uses page first image when present', () => {
    const biz = ramenBiz()
    const page = makePage('Home', [
      { blockType: 'hero', subheadline: 'hi', image: 'https://images.unsplash.com/photo-aaa' },
    ], true)
    const seo = generatePageSeo(page, {
      biz,
      category: 'restaurant',
      siteHeroImage: 'https://images.unsplash.com/photo-site',
    })
    expect(seo.ogImage).toBe('https://images.unsplash.com/photo-aaa')
  })

  it('falls back to siteHeroImage when page has no image', () => {
    const biz = ramenBiz()
    const page = makePage('About', [{ blockType: 'hero', subheadline: 'story' }])
    const seo = generatePageSeo(page, {
      biz,
      category: 'restaurant',
      siteHeroImage: 'https://images.unsplash.com/photo-site',
    })
    expect(seo.ogImage).toBe('https://images.unsplash.com/photo-site')
  })
})

describe('TC-F01-W.34 — dedupe identical descriptions', () => {
  it('appends page title to disambiguate duplicates', () => {
    const biz = ramenBiz()
    // Two pages with identical hero subheadline → would mine identical text
    const pages: PageForSeo[] = [
      makePage('Services', [{ blockType: 'hero', subheadline: 'Everything you need under one roof.' }]),
      makePage('Products', [{ blockType: 'hero', subheadline: 'Everything you need under one roof.' }]),
    ]
    const result = generateAllPageSeo(pages, { biz, category: 'restaurant' })
    expect(result[0]!.description).not.toBe(result[1]!.description)
  })
})

describe('TC-F01-W.35 — fallback-adapter integration', () => {
  function ramenInfo(): BusinessInfoInput {
    return {
      businessName: 'Ramen Ichiban',
      industry: 'restaurant',
      products: 'ramen, sushi, gyoza',
      shortDescription: 'Authentic Japanese ramen with Tokyo techniques and Malaysian heart.',
      phone: '+60 12-345 6789',
      email: 'hello@ramenichiban.my',
      address: '123 Jalan Bukit Bintang, 55100 KL',
    }
  }

  it('every fallback page has unique description', () => {
    const result = composeFallbackResult('ramen restaurant', 42, 'en', ramenInfo())
    const pages = result.pages ?? []
    const descs = pages.map((p) => p.seo.description)
    const unique = new Set(descs)
    expect(unique.size).toBe(descs.length)
  })

  it('every fallback page carries jsonLd array with LocalBusiness schema', () => {
    const result = composeFallbackResult('ramen restaurant', 42, 'en', ramenInfo())
    const pages = result.pages ?? []
    for (const page of pages) {
      expect(page.seo.jsonLd).toBeDefined()
      expect(Array.isArray(page.seo.jsonLd)).toBe(true)
      expect(page.seo.jsonLd!.length).toBeGreaterThanOrEqual(1)
      const first = page.seo.jsonLd![0] as Record<string, unknown>
      expect(first['@context']).toBe('https://schema.org')
      // Category=restaurant → should be Restaurant schema
      expect(first['@type']).toBe('Restaurant')
    }
  })

  it('LocalBusiness schema includes user phone + email verbatim', () => {
    const result = composeFallbackResult('ramen restaurant', 42, 'en', ramenInfo())
    const homepage = (result.pages ?? []).find((p) => p.isHomepage)
    const schema = homepage!.seo.jsonLd![0] as Record<string, unknown>
    expect(schema.telephone).toBe('+60 12-345 6789')
    expect(schema.email).toBe('hello@ramenichiban.my')
  })
})
