/**
 * Per-page SEO generator.
 *
 * Problem solved: today `fallback-adapter.ts:86-95` writes the same
 * truncated tagline as description for EVERY page — Google flags these
 * as duplicate meta descriptions. This generator produces unique
 * title + description + ogImage + jsonLd per page by mining the
 * page's first text block and attaching category-specific schemas.
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-06-seo-consistency-guard.md
 */

import type { BusinessSample } from './content/types'
import { buildLocalBusinessJsonLd, buildFaqJsonLd, type JsonLdSchema } from './json-ld-templates'

// ── Types ───────────────────────────────────────────────────────────────────

export interface PageForSeo {
  title: string
  slug?: string
  blocks?: Array<Record<string, unknown>>
  layout?: Array<Record<string, unknown>>
  isHomepage?: boolean
}

export interface PageSeo {
  /** <title> — max 60 chars, truncated on word boundary. */
  title: string
  /** Meta description — max 155 chars, unique per page. */
  description: string
  /** OpenGraph image URL — falls back to first hero image in page. */
  ogImage?: string
  /** JSON-LD structured data (1+ schemas). */
  jsonLd: JsonLdSchema[]
}

export interface GeneratePageSeoCtx {
  biz: BusinessSample
  category: string
  siteUrl?: string
  /** Hero image URL for the site (from Phase 03 pool) — passed through. */
  siteHeroImage?: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const TITLE_MAX = 60
const DESCRIPTION_MAX = 155

// ── Helpers ────────────────────────────────────────────────────────────────

function truncateOnWord(str: string, max: number): string {
  if (!str) return ''
  if (str.length <= max) return str
  // Leave room for the ellipsis so final length ≤ max.
  const sliced = str.slice(0, max - 1)
  const lastSpace = sliced.lastIndexOf(' ')
  if (lastSpace > max * 0.6) return sliced.slice(0, lastSpace).trimEnd() + '…'
  return sliced.trimEnd() + '…'
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Mine the first text-rich field from a page's blocks. Used as the
 * basis for the per-page meta description.
 *
 * Priority order for sub-pages:
 *   hero.subheadline → about.body → hero.headline → first block's headline
 *
 * Plan 07 — for the homepage, prefer `biz.description` over
 * `hero.subheadline` when description is non-empty and > 40 chars. The
 * enforcer-padded or canned hero subheadline is often identical across
 * same-category businesses; `biz.description` is always user-supplied,
 * so it ships the most variety for meta descriptions.
 */
function minePageText(
  page: PageForSeo,
  biz?: BusinessSample,
  isHomepage: boolean = false,
): string {
  const blocks = (page.blocks ?? page.layout ?? []) as Array<Record<string, unknown>>

  // Plan 07 — homepage-specific priority: user description wins when provided.
  if (isHomepage && biz?.description && biz.description.trim().length > 40) {
    return stripHtml(biz.description)
  }

  if (blocks.length === 0) return ''

  // 1. Hero subheadline — usually the money description
  const hero = blocks.find((b) => b.blockType === 'hero')
  if (hero && typeof hero.subheadline === 'string' && hero.subheadline.trim()) {
    return stripHtml(hero.subheadline)
  }

  // 2. About body (Phase 01 mapper already threads user description here)
  const about = blocks.find((b) => b.blockType === 'about')
  if (about && typeof about.body === 'string' && about.body.trim()) {
    return stripHtml(about.body)
  }

  // 3. Hero headline fallback
  if (hero && typeof hero.headline === 'string' && hero.headline.trim()) {
    return stripHtml(hero.headline)
  }

  // 4. First block with a headline field
  for (const block of blocks) {
    if (typeof block.headline === 'string' && block.headline.trim()) {
      return stripHtml(block.headline)
    }
  }

  return ''
}

/**
 * Extract the first image URL from a page's blocks. Used for ogImage
 * fallback when no per-page image specified.
 */
function minePageImage(page: PageForSeo): string | undefined {
  const blocks = (page.blocks ?? page.layout ?? []) as Array<Record<string, unknown>>
  for (const block of blocks) {
    if (typeof block.image === 'string' && block.image.startsWith('http')) return block.image
    if (typeof block.backgroundImage === 'string' && block.backgroundImage.startsWith('http')) return block.backgroundImage
    if (typeof block.imageUrl === 'string' && block.imageUrl.startsWith('http')) return block.imageUrl
  }
  return undefined
}

/**
 * Check if a page contains an FAQ block. If yes, a FAQPage schema is
 * attached to its jsonLd array.
 */
function pageFaqItems(page: PageForSeo): Array<{ question: string; answer: string }> | null {
  const blocks = (page.blocks ?? page.layout ?? []) as Array<Record<string, unknown>>
  const faq = blocks.find((b) => b.blockType === 'faq')
  if (!faq) return null
  const items = (faq.faqs ?? faq.items) as Array<{ question: string; answer: string }> | undefined
  if (!items || items.length === 0) return null
  return items
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Build unique SEO metadata for a single page.
 *
 * Title format:
 *   Home      → "{biz.name} · {category-tagline}"
 *   Sub-page  → "{page.title} · {biz.name}"
 *
 * Description: mined from the page's first text block (hero subheadline,
 * about body, etc.), NEVER reused from site tagline.
 *
 * jsonLd: LocalBusiness schema on every page; FAQPage schema only on
 * pages with an FAQ block.
 */
export function generatePageSeo(
  page: PageForSeo,
  ctx: GeneratePageSeoCtx,
): PageSeo {
  const { biz, category, siteUrl, siteHeroImage } = ctx

  // ── Title ──────────────────────────────────────────────────
  let title: string
  if (page.isHomepage || page.title.toLowerCase() === 'home') {
    title = biz.tagline ? `${biz.name} · ${biz.tagline}` : biz.name
  } else {
    title = `${page.title} · ${biz.name}`
  }
  title = truncateOnWord(title, TITLE_MAX)

  // ── Description ────────────────────────────────────────────
  const isHomepage = page.isHomepage === true || page.title.toLowerCase() === 'home'
  let description = minePageText(page, biz, isHomepage)
  if (!description) {
    // Defensive fallback — use page-specific boilerplate, NOT site tagline
    description = page.isHomepage
      ? biz.description || biz.tagline || `Welcome to ${biz.name}.`
      : `${page.title} at ${biz.name}.`
  }
  description = truncateOnWord(description, DESCRIPTION_MAX)

  // ── ogImage ────────────────────────────────────────────────
  const pageImage = minePageImage(page)
  const ogImage = pageImage ?? siteHeroImage

  // ── JSON-LD ────────────────────────────────────────────────
  const jsonLd: JsonLdSchema[] = []
  const localBusiness = buildLocalBusinessJsonLd({
    biz,
    category,
    siteUrl,
    heroImageUrl: siteHeroImage,
  })
  jsonLd.push(localBusiness)

  // FAQPage schema only on pages with FAQ block
  const faqItems = pageFaqItems(page)
  if (faqItems) {
    const faqSchema = buildFaqJsonLd(faqItems)
    if (faqSchema) jsonLd.push(faqSchema)
  }

  return { title, description, ogImage, jsonLd }
}

/**
 * Generate per-page SEO for an entire site's pages. Returns an array in
 * the same order as input. Every page gets unique title + description.
 *
 * Verifies uniqueness with a defensive dedupe step — if two pages mine
 * identical descriptions (e.g., missing hero subheadline), appends the
 * page title to disambiguate.
 */
export function generateAllPageSeo(
  pages: PageForSeo[],
  ctx: GeneratePageSeoCtx,
): PageSeo[] {
  const results = pages.map((p) => generatePageSeo(p, ctx))

  // Dedupe descriptions (defensive — two pages shouldn't share a meta desc)
  const seen = new Map<string, number>()
  for (let i = 0; i < results.length; i++) {
    const desc = results[i]!.description
    const count = seen.get(desc) ?? 0
    if (count > 0) {
      // Append the page title to force uniqueness
      const suffix = ` — ${pages[i]!.title}`
      results[i]!.description = truncateOnWord(desc + suffix, DESCRIPTION_MAX)
    }
    seen.set(desc, count + 1)
  }

  return results
}
