/**
 * Phase 05 multi-page completeness tests.
 *
 * Coverage:
 *   TC-F01-W.22 — About page weaves biz.description
 *   TC-F01-W.23 — Contact page shows user phone/email/address verbatim + map + FAQ
 *   TC-F01-W.24 — Blog page renders seeded posts (≥3 items)
 *   TC-F01-W.25 — 5-page gen: every page ≥4 blocks
 *   TC-F01-W.26 — Empty-input regression: canned content fills gaps
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-05-multipage-completeness.md
 */

import { describe, it, expect } from 'vitest'
import { composeFallbackResult } from '@/lib/ai/fallback-adapter'
import type { BusinessInfoInput } from '@/lib/ai/system-prompt'
import type { GenerationResult } from '@/lib/ai/generate-blocks'

type Page = {
  title: string
  blocks?: Array<Record<string, unknown>>
  layout?: Array<Record<string, unknown>>
}

function getPage(result: GenerationResult, title: string): Page | undefined {
  const pages = (result.pages ?? []) as unknown as Page[]
  return pages.find((p) => p.title?.toLowerCase() === title.toLowerCase())
}

function getBlocks(page: Page | undefined): Array<Record<string, unknown>> {
  return page?.blocks ?? page?.layout ?? []
}

function ramenInfo(): BusinessInfoInput {
  return {
    businessName: 'Ramen Ichiban',
    industry: 'restaurant',
    products: 'ramen, sushi, gyoza',
    shortDescription: 'Authentic Japanese ramen crafted from scratch — Tokyo techniques, Malaysian ingredients.',
    phone: '+60 12-345 6789',
    email: 'hello@ramenichiban.my',
    address: '123 Jalan Bukit Bintang, 55100 KL',
  }
}

describe('TC-F01-W.22 — About page weaves biz.description', () => {
  it('About page has ≥5 blocks when user provides description', () => {
    const result = composeFallbackResult('ramen restaurant', 42, 'en', ramenInfo())
    const about = getPage(result, 'About')
    expect(about).toBeDefined()
    const blocks = getBlocks(about)
    expect(blocks.length).toBeGreaterThanOrEqual(5)
  })

  it('mini-hero subheadline contains user description excerpt', () => {
    const info = ramenInfo()
    const result = composeFallbackResult('ramen restaurant', 42, 'en', info)
    const about = getPage(result, 'About')
    const blocks = getBlocks(about)
    const hero = blocks.find((b) => b.blockType === 'hero')
    expect(hero).toBeDefined()
    // Subheadline should contain part of the user description
    const sub = String(hero!.subheadline ?? '')
    expect(sub.toLowerCase()).toMatch(/authentic|japanese|tokyo|malaysian/)
  })

  it('about block body field reads biz.description', () => {
    const result = composeFallbackResult('ramen restaurant', 42, 'en', ramenInfo())
    const about = getPage(result, 'About')
    const blocks = getBlocks(about)
    const aboutBlock = blocks.find((b) => b.blockType === 'about')
    expect(aboutBlock).toBeDefined()
    expect(String(aboutBlock!.body ?? '')).toContain('Authentic Japanese')
  })
})

describe('TC-F01-W.23 — Contact page user fields + FAQ (GH-820: google-maps temporarily disabled)', () => {
  it('Contact page stays compact with navigation, contact, FAQ, and footer', () => {
    const result = composeFallbackResult('ramen restaurant', 42, 'en', ramenInfo())
    const contact = getPage(result, 'Contact')
    expect(contact).toBeDefined()
    const blocks = getBlocks(contact)
    expect(blocks.length).toBeGreaterThanOrEqual(4)
    expect(blocks.length).toBeLessThanOrEqual(5)
  })

  it('contact block has user phone/email/address verbatim', () => {
    const info = ramenInfo()
    const result = composeFallbackResult('ramen restaurant', 42, 'en', info)
    const contact = getPage(result, 'Contact')
    const blocks = getBlocks(contact)
    const contactBlock = blocks.find((b) => b.blockType === 'contact')
    expect(contactBlock).toBeDefined()
    expect(contactBlock!.phone).toBe('+60 12-345 6789')
    expect(contactBlock!.email).toBe('hello@ramenichiban.my')
    expect(contactBlock!.address).toBe('123 Jalan Bukit Bintang, 55100 KL')
  })

  it('Google Maps block absent — temporarily disabled per GH-820 (embedUrl cannot be auto-generated)', () => {
    const result = composeFallbackResult('ramen restaurant', 42, 'en', ramenInfo())
    const contact = getPage(result, 'Contact')
    const blocks = getBlocks(contact)
    const maps = blocks.find((b) => b.blockType === 'google-maps')
    expect(maps).toBeUndefined()
  })

  it('FAQ block present with opening hours question', () => {
    const result = composeFallbackResult('ramen restaurant', 42, 'en', ramenInfo())
    const contact = getPage(result, 'Contact')
    const blocks = getBlocks(contact)
    const faq = blocks.find((b) => b.blockType === 'faq')
    expect(faq).toBeDefined()
    const items = faq!.items as Array<{ question: string }>
    const hasHours = items.some((i) => /hour|open/i.test(i.question))
    expect(hasHours).toBe(true)
  })
})

describe('TC-F01-W.24 — Blog page renders seeded posts', () => {
  it('Blog page has ≥5 blocks (nav + hero + blog-list + newsletter + cta + footer)', () => {
    const result = composeFallbackResult('ramen restaurant', 42, 'en', ramenInfo())
    const blog = getPage(result, 'Blog')
    expect(blog).toBeDefined()
    const blocks = getBlocks(blog)
    expect(blocks.length).toBeGreaterThanOrEqual(5)
  })

  it('blog-list block has ≥3 items with titles + excerpts', () => {
    const result = composeFallbackResult('ramen restaurant', 42, 'en', ramenInfo())
    const blog = getPage(result, 'Blog')
    const blocks = getBlocks(blog)
    const blogList = blocks.find((b) => b.blockType === 'blog-list')
    expect(blogList).toBeDefined()
    const items = blogList!.items as Array<{ title: string; excerpt: string; slug: string }>
    expect(items.length).toBeGreaterThanOrEqual(3)
    for (const post of items) {
      expect(post.title.length).toBeGreaterThan(5)
      expect(post.excerpt.length).toBeGreaterThan(20)
      expect(post.slug).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('blog posts are restaurant-category appropriate', () => {
    const result = composeFallbackResult('ramen restaurant', 42, 'en', ramenInfo())
    const blog = getPage(result, 'Blog')
    const blocks = getBlocks(blog)
    const blogList = blocks.find((b) => b.blockType === 'blog-list')
    const items = (blogList!.items as Array<{ title: string }>) ?? []
    const titles = items.map((p) => p.title.toLowerCase()).join(' ')
    // At least one restaurant-themed keyword
    expect(/dining|kitchen|menu|ingredient|chef/.test(titles)).toBe(true)
  })
})

describe('TC-F01-W.25 — Core 5 pages have ≥4 blocks', () => {
  // The 5 canonical pages that MUST have ≥4 blocks. Category-specific
  // bonus pages (Menu, Gallery, Features, etc.) may legitimately have
  // fewer — they are supplementary.
  const CORE_PAGES = ['Home', 'About', 'Services', 'Contact', 'Blog']

  it('site has Home + About + Contact + Blog (≥4 pages)', () => {
    const result = composeFallbackResult('ramen restaurant', 42, 'en', ramenInfo())
    type P = { title: string }
    const pages = (result.pages ?? []) as unknown as P[]
    const titles = pages.map((p) => p.title.toLowerCase())
    expect(titles).toContain('home')
    expect(titles).toContain('about')
    expect(titles).toContain('contact')
    expect(titles).toContain('blog')
  })

  it('core pages have meaningful block count (≥4)', () => {
    const result = composeFallbackResult('ramen restaurant', 42, 'en', ramenInfo())
    type P = { title: string; blocks?: unknown[]; layout?: unknown[] }
    const pages = (result.pages ?? []) as unknown as P[]
    for (const page of pages) {
      if (!CORE_PAGES.includes(page.title)) continue
      const blocks = (page.blocks ?? page.layout ?? []) as unknown[]
      expect(
        blocks.length,
        `core page "${page.title}" only has ${blocks.length} blocks`,
      ).toBeGreaterThanOrEqual(4)
    }
  })
})

describe('TC-F01-W.26 — Empty-input regression', () => {
  const CORE_PAGES = ['Home', 'About', 'Services', 'Contact', 'Blog']

  it('empty BusinessInfoInput still produces site with Home + About + Contact + Blog', () => {
    const empty: BusinessInfoInput = {
      businessName: 'Empty Shop',
      industry: 'restaurant',
      products: '',
      shortDescription: '',
    }
    const result = composeFallbackResult('restaurant', 42, 'en', empty)
    type P = { title: string; blocks?: unknown[]; layout?: unknown[] }
    const pages = (result.pages ?? []) as unknown as P[]
    const titles = pages.map((p) => p.title.toLowerCase())
    expect(titles).toContain('home')
    expect(titles).toContain('about')
    expect(titles).toContain('contact')
    expect(titles).toContain('blog')
    // Core pages still have meaningful content even with empty input
    for (const page of pages) {
      if (!CORE_PAGES.includes(page.title)) continue
      const blocks = (page.blocks ?? page.layout ?? []) as unknown[]
      expect(
        blocks.length,
        `core page "${page.title}" only has ${blocks.length} blocks`,
      ).toBeGreaterThanOrEqual(4)
    }
  })

  it('blog page has seeded posts even when no user input', () => {
    const empty: BusinessInfoInput = {
      businessName: 'Empty Shop',
      industry: 'restaurant',
      products: '',
      shortDescription: '',
    }
    const result = composeFallbackResult('restaurant', 42, 'en', empty)
    const blog = getPage(result, 'Blog')
    const blocks = getBlocks(blog)
    const blogList = blocks.find((b) => b.blockType === 'blog-list')
    expect(blogList).toBeDefined()
    const items = (blogList!.items as Array<{ title: string }>) ?? []
    expect(items.length).toBeGreaterThanOrEqual(3)
  })
})

describe('TC-F01-W.27 — Footer ghost links absent in centered-stack/dark-gradient (GH-820)', () => {
  const GHOST_URLS = ['/careers', '/help', '/faq', '/privacy', '/terms', '/cookies']

  function getFooterColumns(result: GenerationResult): Array<{ title: string; links: { url: string }[] }> {
    const pages = (result.pages ?? []) as unknown as Page[]
    const home = pages.find((p) => p.title?.toLowerCase() === 'home')
    const blocks = getBlocks(home)
    const footer = blocks.find((b) => b.blockType === 'footer')
    return (footer?.columns as Array<{ title: string; links: { url: string }[] }>) ?? []
  }

  it('footer columns contain no links to non-existent pages', () => {
    const result = composeFallbackResult('ramen restaurant', 42, 'en', ramenInfo())
    const columns = getFooterColumns(result)
    const allLinks = columns.flatMap((c) => c.links.map((l) => l.url))
    for (const ghostUrl of GHOST_URLS) {
      expect(allLinks, `ghost link "${ghostUrl}" found in footer`).not.toContain(ghostUrl)
    }
  })

  it('footer Explore column only contains links to actually-generated pages', () => {
    const result = composeFallbackResult('ramen restaurant', 42, 'en', ramenInfo())
    const columns = getFooterColumns(result)
    const explore = columns.find((c) => c.title === 'Explore')
    expect(explore).toBeDefined()
    const pages = (result.pages ?? []) as unknown as Page[]
    const pageSlugs = new Set(pages.map((p) => p.title?.toLowerCase()))
    for (const link of explore!.links) {
      const slug = link.url === '/' ? 'home' : link.url.replace(/^\//, '').toLowerCase()
      expect(pageSlugs.has(slug), `Explore link "${link.url}" has no backing page`).toBe(true)
    }
  })
})
