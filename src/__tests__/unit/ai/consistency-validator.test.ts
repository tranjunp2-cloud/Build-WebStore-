/**
 * Phase 06 consistency validator tests.
 *
 * Coverage:
 *   TC-F01-W.36 — C1 palette adherence: missing theme color emits warning
 *   TC-F01-W.37 — C2 image mood: homepage w/o image emits warning
 *   TC-F01-W.38 — C3 headline length: >10 word headline emits warning
 *   TC-F01-W.39 — C4 CTA rhythm: page with <3 CTA blocks emits warning
 *   TC-F01-W.40 — C5 recipe: homepage missing nav/hero/footer emits warning
 *   TC-F01-W.41 — clean result passes with zero warnings
 *   TC-F01-W.42 — runConsistencyCheck never throws on degenerate input
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-06-seo-consistency-guard.md
 */

import { describe, it, expect } from 'vitest'
import {
  runConsistencyCheck,
  logConsistencyReport,
  emitConsistencyEvents,
} from '@/lib/ai/consistency-validator'
import type { GenerationResult, GeneratedBlock, GeneratedPage } from '@/lib/ai/generate-blocks'

function baseTheme(): GenerationResult['theme'] {
  return {
    primaryColor: '#c2410c',
    secondaryColor: '#ea580c',
    fontHeading: 'Playfair Display',
    fontBody: 'Inter',
    colorMode: 'light',
  }
}

function heroBlock(headline = 'Short headline', image = 'https://images.unsplash.com/x'): GeneratedBlock {
  return { blockType: 'hero', headline, subheadline: 'Sub copy', image } as GeneratedBlock
}
function navBlock(): GeneratedBlock {
  // gen-perf phase-09: C5 now checks the REAL registered blockType
  // ('navigation'); the old 'nav' literal never matched anything in prod.
  return { blockType: 'navigation' } as GeneratedBlock
}
function footerBlock(): GeneratedBlock {
  return { blockType: 'footer' } as GeneratedBlock
}
function ctaBlock(): GeneratedBlock {
  return { blockType: 'cta', headline: 'Book now' } as GeneratedBlock
}
function featuresBlock(): GeneratedBlock {
  return { blockType: 'features', headline: 'Why us' } as GeneratedBlock
}

function cleanHomepage(): GeneratedPage {
  return {
    title: 'Home',
    slug: '/',
    isHomepage: true,
    blocks: [navBlock(), heroBlock(), featuresBlock(), ctaBlock(), footerBlock()],
    seo: { title: 'Home · Shop', description: 'welcome' },
  }
}

function cleanResult(): GenerationResult {
  return {
    siteName: 'Ramen Ichiban',
    siteType: 'restaurant',
    blocks: cleanHomepage().blocks,
    pages: [cleanHomepage()],
    seo: { title: 'Ramen Ichiban', description: 'desc' },
    theme: baseTheme(),
  }
}

describe('TC-F01-W.36 — C1 palette adherence', () => {
  it('emits warning when primaryColor is empty', () => {
    const r = cleanResult()
    r.theme.primaryColor = ''
    const report = runConsistencyCheck(r)
    expect(report.warnings.some((w) => w.rule === 'C1')).toBe(true)
  })

  it('emits warning when fontBody is missing', () => {
    const r = cleanResult()
    r.theme.fontBody = ''
    const report = runConsistencyCheck(r)
    expect(report.warnings.some((w) => w.rule === 'C1' && /fontBody/.test(w.message))).toBe(true)
  })
})

describe('TC-F01-W.37 — C2 image mood consistency', () => {
  it('warns when homepage has no image', () => {
    const r = cleanResult()
    r.pages![0]!.blocks = [
      navBlock(),
      { blockType: 'hero', headline: 'Hi', subheadline: 'sub' } as GeneratedBlock,
      featuresBlock(),
      ctaBlock(),
      footerBlock(),
    ]
    const report = runConsistencyCheck(r)
    expect(report.warnings.some((w) => w.rule === 'C2')).toBe(true)
  })

  it('warns when a page mixes http and non-http image sources', () => {
    const r = cleanResult()
    r.pages![0]!.blocks = [
      navBlock(),
      heroBlock('Hi', 'https://images.unsplash.com/a'),
      { blockType: 'about', image: '/local/asset.jpg', headline: 'About' } as GeneratedBlock,
      featuresBlock(),
      ctaBlock(),
      footerBlock(),
    ]
    const report = runConsistencyCheck(r)
    expect(report.warnings.some((w) => w.rule === 'C2' && /mixed image/.test(w.message))).toBe(true)
  })
})

describe('TC-F01-W.38 — C3 headline length', () => {
  it('flags hero headline > 10 words', () => {
    const r = cleanResult()
    const longHeadline = 'This is a very long hero headline that absolutely exceeds the ten word cap'
    r.pages![0]!.blocks = [
      navBlock(),
      heroBlock(longHeadline),
      featuresBlock(),
      ctaBlock(),
      footerBlock(),
    ]
    const report = runConsistencyCheck(r)
    expect(report.warnings.some((w) => w.rule === 'C3')).toBe(true)
  })

  it('accepts headline ≤ 10 words', () => {
    const r = cleanResult()
    const report = runConsistencyCheck(r)
    expect(report.warnings.some((w) => w.rule === 'C3')).toBe(false)
  })
})

describe('TC-F01-W.39 — C4 CTA rhythm', () => {
  it('warns when page has fewer than 3 CTA-bearing blocks', () => {
    const r = cleanResult()
    r.pages![0]!.blocks = [navBlock(), heroBlock(), footerBlock()]
    const report = runConsistencyCheck(r)
    expect(report.warnings.some((w) => w.rule === 'C4')).toBe(true)
  })

  it('passes when page has ≥ 3 CTA blocks', () => {
    const r = cleanResult()
    // hero + features + cta → 3 CTA-bearing blocks
    const report = runConsistencyCheck(r)
    expect(report.warnings.some((w) => w.rule === 'C4')).toBe(false)
  })
})

describe('TC-F01-W.40 — C5 recipe adherence', () => {
  it('warns when homepage missing nav', () => {
    const r = cleanResult()
    r.pages![0]!.blocks = [heroBlock(), featuresBlock(), ctaBlock(), footerBlock()]
    const report = runConsistencyCheck(r)
    expect(report.warnings.some((w) => w.rule === 'C5' && /nav/.test(w.message))).toBe(true)
  })

  it('warns when homepage missing footer', () => {
    const r = cleanResult()
    r.pages![0]!.blocks = [navBlock(), heroBlock(), featuresBlock(), ctaBlock()]
    const report = runConsistencyCheck(r)
    expect(report.warnings.some((w) => w.rule === 'C5' && /footer/.test(w.message))).toBe(true)
  })
})

describe('TC-F01-W.41 — clean result passes', () => {
  it('returns passed=true with zero warnings', () => {
    const report = runConsistencyCheck(cleanResult())
    expect(report.passed).toBe(true)
    expect(report.warnings.length).toBe(0)
  })
})

describe('TC-F01-W.42 — degenerate input safety', () => {
  it('does not throw on single-page shape without pages[]', () => {
    const r: GenerationResult = {
      siteName: 'X',
      siteType: 'business',
      blocks: [navBlock(), heroBlock(), featuresBlock(), ctaBlock(), footerBlock()],
      seo: { title: 'X', description: 'y' },
      theme: baseTheme(),
    }
    expect(() => runConsistencyCheck(r)).not.toThrow()
  })

  it('logConsistencyReport is a no-op when passed=true', () => {
    const report = runConsistencyCheck(cleanResult())
    expect(() => logConsistencyReport(report, 'fallback')).not.toThrow()
  })
})

describe('TC-F01-W.43 — emitConsistencyEvents SSE plumbing', () => {
  it('pushes one consistency_warning event per warning', () => {
    // Break C4 (only 1 CTA) + C5 (no nav/footer) to trigger multiple warnings
    const r: GenerationResult = {
      siteName: 'X',
      siteType: 'business',
      blocks: [],
      pages: [
        {
          title: 'Home',
          slug: '/',
          isHomepage: true,
          blocks: [
            { blockType: 'hero', headline: 'Hi', subheadline: 'sub', image: 'https://x/1' } as GeneratedBlock,
          ],
          seo: { title: 'X', description: 'y' },
        },
      ],
      seo: { title: 'X', description: 'y' },
      theme: baseTheme(),
    }
    const report = runConsistencyCheck(r)
    expect(report.warnings.length).toBeGreaterThanOrEqual(2)

    const events: Array<{ event: string; data: Record<string, unknown> }> = []
    emitConsistencyEvents(report, 'fallback', events)

    expect(events.length).toBe(report.warnings.length)
    for (const e of events) {
      expect(e.event).toBe('consistency_warning')
      expect(typeof e.data.rule).toBe('string')
      expect(typeof e.data.message).toBe('string')
      expect(e.data.source).toBe('fallback')
    }
  })

  it('is a no-op when report.passed=true', () => {
    const report = runConsistencyCheck(cleanResult())
    const events: Array<{ event: string; data: Record<string, unknown> }> = []
    emitConsistencyEvents(report, 'ai', events)
    expect(events.length).toBe(0)
  })

  it('attaches block field to C5 warnings that identify a specific block type', () => {
    const r = cleanResult()
    r.pages![0]!.blocks = [heroBlock(), featuresBlock(), ctaBlock()] // missing nav + footer
    const report = runConsistencyCheck(r)
    const c5Nav = report.warnings.find((w) => w.rule === 'C5' && /nav/.test(w.message))
    expect(c5Nav?.block).toBe('nav')
    const c5Footer = report.warnings.find((w) => w.rule === 'C5' && /footer/.test(w.message))
    expect(c5Footer?.block).toBe('footer')
  })

  it('attaches block field to C3 headline warnings', () => {
    const r = cleanResult()
    const longHeadline = 'This is a very long hero headline that absolutely exceeds the ten word cap'
    r.pages![0]!.blocks = [
      navBlock(),
      heroBlock(longHeadline),
      featuresBlock(),
      ctaBlock(),
      footerBlock(),
    ]
    const report = runConsistencyCheck(r)
    const c3 = report.warnings.find((w) => w.rule === 'C3')
    expect(c3?.block).toBe('hero')
  })

  it('emitted event data forwards page + block when present', () => {
    const r = cleanResult()
    const longHeadline = 'This is a very long hero headline that absolutely exceeds the ten word cap'
    r.pages![0]!.blocks = [
      navBlock(),
      heroBlock(longHeadline),
      featuresBlock(),
      ctaBlock(),
      footerBlock(),
    ]
    const report = runConsistencyCheck(r)
    const events: Array<{ event: string; data: Record<string, unknown> }> = []
    emitConsistencyEvents(report, 'ai', events)
    const c3Event = events.find((e) => e.data.rule === 'C3')
    expect(c3Event?.data.page).toBe('Home')
    expect(c3Event?.data.block).toBe('hero')
  })
})
