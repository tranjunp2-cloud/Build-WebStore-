/**
 * Unit tests for buildBlockFromLibrary — Plan 07 biz-aware threading.
 *
 * Coverage: TC-F01-W.45 — library blocks weave user biz (hero / about /
 * features / contact / cta / footer / newsletter) when `ctx.userBiz` is
 * provided; empty userBiz falls back to canned content unchanged.
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-07-variety-retrofit.md
 */

import { describe, it, expect } from 'vitest'
import { buildBlockFromLibrary } from '@/lib/ai/content-injection'
import type { BusinessSample } from '@/lib/ai/content'
import { THEME_MOODS } from '@/lib/ai/theme-moods'

function buildUserBiz(overrides: Partial<BusinessSample> = {}): Partial<BusinessSample> {
  return {
    name: 'Ramen Ichiban',
    description: 'Authentic Sapporo-style ramen served in a cozy 12-seat counter in Bukit Bintang.',
    phone: '+60 3-1234 5678',
    email: 'hello@ramen-ichiban.my',
    address: 'No. 12, Jalan Bukit Bintang, 55100 Kuala Lumpur',
    tagline: 'Slurp-worthy bowls since 2019.',
    products: ['tonkotsu ramen', 'miso ramen', 'gyoza'],
    ...overrides,
  }
}

describe('buildBlockFromLibrary — Plan 07 biz threading', () => {
  describe('hero block', () => {
    it('threads user name + description into headline/subheadline when userBiz provided', () => {
      const block = buildBlockFromLibrary('hero', 'restaurant', {
        seed: 42,
        userBiz: buildUserBiz(),
      }) as Record<string, unknown>

      expect(block).not.toBeNull()
      expect(block.blockType).toBe('hero')
      // Headline references user business name, not canned "Warung Pak Ali".
      expect(String(block.headline)).toContain('Ramen Ichiban')
      // Subheadline is the truncated user description.
      expect(String(block.subheadline)).toContain('Sapporo')
      expect(String(block.subheadline).length).toBeLessThanOrEqual(140)
    })

    it('falls back to canned hero when userBiz is absent', () => {
      const block = buildBlockFromLibrary('hero', 'restaurant', { seed: 42 }) as Record<string, unknown>
      expect(block).not.toBeNull()
      // Canned headlines come from restaurant content pool — none contain "Ramen Ichiban".
      expect(String(block.headline)).not.toContain('Ramen Ichiban')
    })

    it('uses mood-derived CTA labels when mood is provided', () => {
      const block = buildBlockFromLibrary('hero', 'restaurant', {
        seed: 42,
        userBiz: buildUserBiz(),
        mood: THEME_MOODS.elegant,
      }) as Record<string, unknown>

      const buttons = block.ctaButtons as Array<{ label: string }>
      expect(buttons).toHaveLength(2)
      // Elegant mood never emits "Get Started" for the restaurant category
      // (see mood-cta-coverage test). Either primary or secondary must differ.
      const labels = buttons.map((b) => b.label)
      expect(labels.every((l) => l.length > 0)).toBe(true)
      expect(labels[0]).not.toBe('Get Started')
    })

    it('produces 3 distinct headlines for 3 different userBiz at same seed', () => {
      const h1 = buildBlockFromLibrary('hero', 'restaurant', {
        seed: 42,
        userBiz: buildUserBiz({ name: 'Ramen Ichiban', description: 'Sapporo ramen in KL.' }),
      }) as Record<string, unknown>
      const h2 = buildBlockFromLibrary('hero', 'restaurant', {
        seed: 42,
        userBiz: buildUserBiz({ name: 'Roti Canai House', description: 'Mamak classics since 1985.' }),
      }) as Record<string, unknown>
      const h3 = buildBlockFromLibrary('hero', 'restaurant', {
        seed: 42,
        userBiz: buildUserBiz({ name: 'Pho 88', description: 'Hanoi-style pho every morning.' }),
      }) as Record<string, unknown>

      const headlines = [h1.headline, h2.headline, h3.headline]
      expect(new Set(headlines).size).toBe(3)
      const subs = [h1.subheadline, h2.subheadline, h3.subheadline]
      expect(new Set(subs).size).toBe(3)
    })
  })

  describe('about block', () => {
    it('uses userBiz.description when provided', () => {
      const block = buildBlockFromLibrary('about', 'restaurant', {
        seed: 42,
        userBiz: buildUserBiz(),
      }) as Record<string, unknown>

      expect(block.blockType).toBe('about')
      expect(String(block.headline)).toContain('Ramen Ichiban')
      expect(String(block.body)).toContain('Sapporo')
    })

    it('falls back to canned body when userBiz has no description', () => {
      const block = buildBlockFromLibrary('about', 'restaurant', {
        seed: 42,
        userBiz: { name: 'Ramen Ichiban' },
      }) as Record<string, unknown>

      expect(String(block.body)).not.toContain('Sapporo')
      expect(String(block.headline)).toContain('Ramen Ichiban')
    })
  })

  describe('features block', () => {
    it('replaces first cards with product-derived titles when userBiz.products ≥ 2', () => {
      const block = buildBlockFromLibrary('features', 'restaurant', {
        seed: 42,
        userBiz: buildUserBiz(),
      }) as Record<string, unknown>

      const features = block.features as Array<{ title: string; description: string }>
      expect(features.length).toBeGreaterThanOrEqual(3)
      // First 3 cards should reference the 3 products.
      const titles = features.slice(0, 3).map((f) => f.title.toLowerCase())
      expect(titles.some((t) => t.includes('tonkotsu'))).toBe(true)
      expect(titles.some((t) => t.includes('miso'))).toBe(true)
      expect(titles.some((t) => t.includes('gyoza'))).toBe(true)
      // Headline references biz name.
      expect(String(block.headline)).toContain('Ramen Ichiban')
    })

    it('keeps canned features when userBiz.products < 2', () => {
      const block = buildBlockFromLibrary('features', 'restaurant', {
        seed: 42,
        userBiz: buildUserBiz({ products: ['tonkotsu'] }),
      }) as Record<string, unknown>

      const features = block.features as Array<{ title: string }>
      // Should NOT replace — pool titles dominate.
      const joined = features.map((f) => f.title).join(' ').toLowerCase()
      expect(joined).not.toContain('tonkotsu')
    })
  })

  describe('contact block', () => {
    it('uses user phone/email/address verbatim', () => {
      const block = buildBlockFromLibrary('contact', 'restaurant', {
        seed: 42,
        userBiz: buildUserBiz(),
      }) as Record<string, unknown>

      expect(block.phone).toBe('+60 3-1234 5678')
      expect(block.email).toBe('hello@ramen-ichiban.my')
      expect(String(block.address)).toContain('Bukit Bintang')
    })

    it('falls back to canned contact when user fields are empty', () => {
      const block = buildBlockFromLibrary('contact', 'restaurant', { seed: 42 }) as Record<string, unknown>
      // Canned sample has a real Malaysian phone — just assert non-empty.
      expect(String(block.phone).length).toBeGreaterThan(0)
    })
  })

  describe('cta + newsletter + footer', () => {
    it('cta uses user tagline or description for subheadline', () => {
      const block = buildBlockFromLibrary('cta', 'restaurant', {
        seed: 42,
        userBiz: buildUserBiz(),
      }) as Record<string, unknown>

      expect(String(block.headline)).toContain('Ramen Ichiban')
      expect(String(block.subheadline)).toContain('Slurp')
    })

    it('newsletter headline references user name', () => {
      const block = buildBlockFromLibrary('newsletter', 'restaurant', {
        seed: 42,
        userBiz: buildUserBiz(),
      }) as Record<string, unknown>

      expect(String(block.headline)).toContain('Ramen Ichiban')
    })

    it('TC-F01-PAS-10: gallery and newsletter injection use structural locale strings', () => {
      // Arrange
      const context = {
        seed: 42,
        language: 'zh-CN',
        userBiz: buildUserBiz(),
      }

      // Act
      const gallery = buildBlockFromLibrary('gallery', 'ecommerce', context) as Record<string, unknown>
      const newsletter = buildBlockFromLibrary('newsletter', 'ecommerce', context) as Record<string, unknown>

      // Assert
      expect(gallery.sectionLabel).toBe('图片展示')
      expect(newsletter).toMatchObject({
        sectionLabel: '订阅通讯',
        buttonLabel: '订阅',
        placeholder: '邮箱',
      })
    })

    it('footer tagline prefers user tagline', () => {
      const block = buildBlockFromLibrary('footer', 'restaurant', {
        seed: 42,
        userBiz: buildUserBiz(),
      }) as Record<string, unknown>

      expect(String(block.tagline)).toContain('Slurp')
    })
  })

  describe('backward compatibility', () => {
    it('gallery path (no userBiz) keeps the library sample; a merchant with no data never gets its identity (#2103 A1)', () => {
      const gallery = buildBlockFromLibrary('hero', 'restaurant', { seed: 42 }) as Record<string, unknown>
      const merchant = buildBlockFromLibrary('hero', 'restaurant', { seed: 42, userBiz: {} }) as Record<string, unknown>
      // Gallery/preview callers still show the sample business.
      expect(String(gallery.headline)).toContain('Siti Nasi Kandar')
      // A real merchant (userBiz present, even empty) never sees the sample's name or description.
      expect(`${merchant.headline} ${merchant.subheadline}`).not.toContain('Siti Nasi Kandar')
    })

    it('testimonials is one invitation card and faq is skipped without facts, regardless of userBiz (#2103 A1)', () => {
      const testimonials = buildBlockFromLibrary('testimonials', 'restaurant', {
        seed: 42,
        userBiz: buildUserBiz(),
      }) as Record<string, unknown>
      const faq = buildBlockFromLibrary('faq', 'restaurant', {
        seed: 42,
        userBiz: buildUserBiz(),
      })

      expect((testimonials.testimonials as unknown[])?.length).toBe(1)
      expect(faq).toBeNull()
    })
  })
})
