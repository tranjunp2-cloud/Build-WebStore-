/**
 * Consistency validator — post-generation quality checks.
 *
 * Runs after enforcement but before save. WARN-ONLY: emits a list of
 * `{ rule, message }` findings; the generation pipeline still saves the
 * site regardless of how many warnings fire. Auto-retry is explicitly
 * out of scope for Phase 06.
 *
 * Rules implemented:
 *   C1 palette adherence     — theme exposes primary/secondary/heading/body
 *   C2 image mood consistency — all hero/section images share one Unsplash query hint
 *   C3 headline length        — every hero/section headline ≤ 10 words
 *   C4 CTA rhythm             — each page has ≥ 3 CTA-bearing blocks
 *   C5 layout recipe adherence — (stub) block sequence sanity: nav/hero/footer present on homepage
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-06-seo-consistency-guard.md
 */

import type { GenerationResult, GeneratedPage, GeneratedBlock } from './generate-blocks'

// ── Types ───────────────────────────────────────────────────────────────────

export type ConsistencyRule = 'C1' | 'C2' | 'C3' | 'C4' | 'C5'

export interface ConsistencyWarning {
  rule: ConsistencyRule
  /** Human-readable diagnostic. Safe to log and show in dev UI. */
  message: string
  /** Page title (when applicable) for quick triage. */
  page?: string
  /** Block type (when applicable) for pinpointing the offender. */
  block?: string
}

export interface ConsistencyReport {
  warnings: ConsistencyWarning[]
  /** Convenience — true when warnings[].length === 0. */
  passed: boolean
}

// ── Constants ───────────────────────────────────────────────────────────────

const MAX_HEADLINE_WORDS = 10
const MIN_CTAS_PER_PAGE = 3

/** Blocks that are expected to carry a primary headline field. */
const HEADLINE_BEARING_BLOCKS = new Set([
  'hero',
  'features',
  'services',
  'stats',
  'about',
  'cta',
  'team',
  'gallery',
  'faq',
  'testimonials',
  'contact',
  'blog-list',
  'newsletter',
])

/** Blocks that count toward CTA rhythm — they render a visible button/link. */
const CTA_BEARING_BLOCKS = new Set([
  'hero',
  'cta',
  'features',
  'services',
  'newsletter',
  'booking-widget',
  'contact',
  'pricing',
])

// ── Helpers ────────────────────────────────────────────────────────────────

function countWords(str: string): number {
  return str.trim().split(/\s+/).filter(Boolean).length
}

function blocksOf(page: GeneratedPage): GeneratedBlock[] {
  return (page.blocks ?? []) as GeneratedBlock[]
}

function pagesOf(result: GenerationResult): GeneratedPage[] {
  if (result.pages && result.pages.length > 0) return result.pages
  // Single-page shape: synthesize a faux homepage for rule coverage.
  return [
    {
      title: 'Home',
      slug: '/',
      isHomepage: true,
      blocks: result.blocks,
      seo: { title: result.seo.title, description: result.seo.description },
    },
  ]
}

// ── Rule implementations ────────────────────────────────────────────────────

/**
 * C1 — palette adherence. Theme object must expose the 4 core colors the
 * renderer consumes. Missing any is a regression in the theme pipeline.
 */
function checkPalette(result: GenerationResult): ConsistencyWarning[] {
  const warnings: ConsistencyWarning[] = []
  const t = result.theme
  if (!t.primaryColor) warnings.push({ rule: 'C1', message: 'theme.primaryColor missing' })
  if (!t.secondaryColor) warnings.push({ rule: 'C1', message: 'theme.secondaryColor missing' })
  if (!t.fontHeading) warnings.push({ rule: 'C1', message: 'theme.fontHeading missing' })
  if (!t.fontBody) warnings.push({ rule: 'C1', message: 'theme.fontBody missing' })
  return warnings
}

/**
 * C2 — image mood consistency. For every page collect all `image` /
 * `backgroundImage` URLs. We can't read back the Unsplash query at this
 * layer, but we can sanity-check that the homepage actually has images
 * (Phase 03 pool should guarantee this) and that sub-pages' images look
 * like they came from the same source family (http(s) URLs, not empty).
 */
function checkImageMood(result: GenerationResult): ConsistencyWarning[] {
  const warnings: ConsistencyWarning[] = []
  for (const page of pagesOf(result)) {
    const blocks = blocksOf(page)
    const images = collectImageUrls(blocks)
    if (page.isHomepage && images.length === 0) {
      warnings.push({
        rule: 'C2',
        message: 'homepage has no image — Phase 03 pool likely misconfigured',
        page: page.title,
      })
    }
    // Detect mixed-source drift: some Unsplash, some local/relative → bad.
    if (images.length > 1) {
      const httpCount = images.filter((u) => u.startsWith('http')).length
      if (httpCount > 0 && httpCount < images.length) {
        warnings.push({
          rule: 'C2',
          message: `mixed image sources on "${page.title}" (${httpCount}/${images.length} http)`,
          page: page.title,
        })
      }
    }
  }
  return warnings
}

function collectImageUrls(blocks: GeneratedBlock[]): string[] {
  const out: string[] = []
  for (const b of blocks) {
    const record = b as unknown as Record<string, unknown>
    for (const key of ['image', 'backgroundImage', 'imageUrl']) {
      const v = record[key]
      if (typeof v === 'string' && v.length > 0) out.push(v)
    }
  }
  return out
}

/**
 * C3 — headline length. Any headline > MAX_HEADLINE_WORDS is a warning.
 * Checks `headline`, `title` fields on known headline-bearing block types.
 */
function checkHeadlineLength(result: GenerationResult): ConsistencyWarning[] {
  const warnings: ConsistencyWarning[] = []
  for (const page of pagesOf(result)) {
    for (const block of blocksOf(page)) {
      if (!HEADLINE_BEARING_BLOCKS.has(block.blockType)) continue
      const record = block as unknown as Record<string, unknown>
      const headline = (record.headline ?? record.title) as unknown
      if (typeof headline !== 'string' || !headline.trim()) continue
      const words = countWords(headline)
      if (words > MAX_HEADLINE_WORDS) {
        warnings.push({
          rule: 'C3',
          message: `${block.blockType} headline has ${words} words (>${MAX_HEADLINE_WORDS}): "${headline.slice(0, 60)}"`,
          page: page.title,
          block: block.blockType,
        })
      }
    }
  }
  return warnings
}

/**
 * C4 — CTA rhythm. Each page should expose at least MIN_CTAS_PER_PAGE
 * CTA-bearing blocks (hero, cta, features, etc.). Flags "flat" pages that
 * give visitors nothing to click.
 */
function checkCtaRhythm(result: GenerationResult): ConsistencyWarning[] {
  const warnings: ConsistencyWarning[] = []
  for (const page of pagesOf(result)) {
    const blocks = blocksOf(page)
    const ctaCount = blocks.filter((b) => CTA_BEARING_BLOCKS.has(b.blockType)).length
    if (ctaCount < MIN_CTAS_PER_PAGE) {
      warnings.push({
        rule: 'C4',
        message: `"${page.title}" has ${ctaCount} CTA blocks (<${MIN_CTAS_PER_PAGE})`,
        page: page.title,
      })
    }
  }
  return warnings
}

/**
 * C5 — layout recipe adherence (light stub). Homepage must contain nav,
 * hero, and footer. Recipes module (Phase 04) defines fuller sequences;
 * wiring that in is deferred until the recipe ID ships on GenerationResult.
 */
function checkRecipeAdherence(result: GenerationResult): ConsistencyWarning[] {
  const warnings: ConsistencyWarning[] = []
  for (const page of pagesOf(result)) {
    if (!page.isHomepage) continue
    const types = new Set(blocksOf(page).map((b) => b.blockType))
    // gen-perf phase-09 fix: the registered blockType is 'navigation' —
    // checking 'nav' made this warning fire on EVERY ai-first gen (latent).
    if (!types.has('navigation')) {
      warnings.push({ rule: 'C5', message: 'homepage missing nav block', page: page.title, block: 'nav' })
    }
    if (!types.has('hero')) {
      warnings.push({ rule: 'C5', message: 'homepage missing hero block', page: page.title, block: 'hero' })
    }
    if (!types.has('footer')) {
      warnings.push({ rule: 'C5', message: 'homepage missing footer block', page: page.title, block: 'footer' })
    }
  }
  return warnings
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Run all 5 consistency rules against a GenerationResult. Pure function —
 * does NOT mutate `result` and never throws. Returns `{ warnings, passed }`.
 */
export function runConsistencyCheck(result: GenerationResult): ConsistencyReport {
  const warnings: ConsistencyWarning[] = [
    ...checkPalette(result),
    ...checkImageMood(result),
    ...checkHeadlineLength(result),
    ...checkCtaRhythm(result),
    ...checkRecipeAdherence(result),
  ]
  return { warnings, passed: warnings.length === 0 }
}

/**
 * Log warnings to the server console. Thin helper so both gen paths share
 * the same formatting. Does NOT throw. Safe to call with `passed: true`
 * (it becomes a no-op).
 */
export function logConsistencyReport(report: ConsistencyReport, source: 'fallback' | 'ai'): void {
  if (report.passed) return
  for (const w of report.warnings) {
    const prefix = `[consistency:${source}:${w.rule}]`
    const suffix = w.page ? ` (page: ${w.page})` : ''
    console.warn(`${prefix} ${w.message}${suffix}`)
  }
}

/**
 * Structural SSE event shape. We intentionally do NOT import the
 * `SSEEvent` type from `openai-generator` to avoid a circular dep —
 * this helper only needs the `event` + `data` keys, matching the
 * caller's concrete type via structural subtyping.
 */
type ConsistencyEventSink = Array<{ event: string; data: Record<string, unknown> }>

/**
 * Phase 06 FR-12 — emit one `consistency_warning` SSE event per finding
 * so the client sees every rule violation in real time. Caller owns the
 * event array; this helper only pushes. Safe to call with passed=true
 * (becomes a no-op).
 */
export function emitConsistencyEvents(
  report: ConsistencyReport,
  source: 'fallback' | 'ai',
  events: ConsistencyEventSink,
): void {
  if (report.passed) return
  for (const w of report.warnings) {
    events.push({
      event: 'consistency_warning',
      data: {
        rule: w.rule,
        message: w.message,
        source,
        ...(w.page ? { page: w.page } : {}),
        ...(w.block ? { block: w.block } : {}),
      },
    })
  }
}
