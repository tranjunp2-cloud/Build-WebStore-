/**
 * Image Pool — per-site Unsplash pool for visual cohesion.
 *
 * Problem solved: today every block calls `searchPhotos(keywords)` independently,
 * so hero / gallery / team photos come from different photographers with
 * different lighting, color, and style. Users see "5 block = 5 style ảnh rời rạc".
 *
 * Solution: build ONE pool per site (1-2 Unsplash calls total), then each block
 * picks from the pool via role-based deterministic picker. Every photo shares
 * the same query + mood filter → visual coherence by construction.
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-03-image-pool-consistency.md
 * Depends on: Phase 02 theme-moods (mood.photographyFilter + mood.imageryKeywords)
 */

import { searchPhotos, type UnsplashPhoto } from './unsplash-client'
import type { ThemeMood } from './theme-moods'

// ── Types ───────────────────────────────────────────────────────────────────

/** Image role used by a block — drives which aspect bucket to pull from. */
export type ImageRole = 'hero' | 'gallery' | 'team' | 'product' | 'any'

/** Aspect bucket the pool organizes photos into. */
export type AspectBucket = 'landscape' | 'square' | 'portrait'

export interface PoolPhoto {
  id: string
  url: string
  alt: string
  width: number
  height: number
  photographer: string
  downloadLocation: string
  role: ImageRole
  aspectRatio: '16:9' | '4:3' | '1:1' | '3:4'
}

export interface ImagePool {
  landscape: PoolPhoto[]
  square: PoolPhoto[]
  portrait: PoolPhoto[]
  /** The exact search query used — for SSE debug + test spies. */
  queryUsed: string
  /** True when any bucket had to retry with relaxed keywords. */
  underfill: boolean
}

export interface BuildPoolCtx {
  category: string
  mood?: ThemeMood
  /**
   * Top product term from Phase 01 business-info-mapper (already translated).
   * Retained for backward compatibility — when `products` is absent, this is
   * the single term threaded into the Unsplash query.
   */
  topProduct?: string
  /**
   * Plan 07 — full top-N translated products. When provided (max 3 kept),
   * the query joins them so two restaurants with similar first products
   * (e.g. "ramen" vs "noodles") still yield distinct pool queries.
   */
  products?: string[]
  /** Deterministic seed — same seed returns same query (query-level stability). */
  seed: number
  /** Optional sizes; defaults match typical block needs per home page. */
  landscapeSize?: number
  squareSize?: number
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_LANDSCAPE_SIZE = 12
const DEFAULT_SQUARE_SIZE = 6


/**
 * Build the Unsplash search query from the context.
 *
 * Priority order for terms (max 5 kept):
 *   1. Top product term (user-supplied, already translated vi/ms → en)
 *   2. Mood imagery adjectives (top 2 from mood.imageryKeywords)
 *   3. Photography filter hint (e.g. "warm tones", "high contrast")
 *   4. Category base fallback (e.g. "restaurant interior")
 */
export function buildPoolQuery(ctx: BuildPoolCtx, relaxed: boolean = false): string {
  const terms: string[] = []
  const seen = new Set<string>()
  const push = (t: string | undefined) => {
    if (!t) return
    const trimmed = t.trim()
    if (!trimmed) return
    const lower = trimmed.toLowerCase()
    if (seen.has(lower)) return
    terms.push(trimmed)
    seen.add(lower)
  }

  // Plan 07 — when full products[] is supplied, join the top 3 into the
  // query. Two restaurants whose first parsed product collides (e.g. both
  // "noodles") still diverge because products[2]+[3] differ.
  const productTerms = (ctx.products ?? []).slice(0, 3)
  if (productTerms.length > 0) {
    for (const p of productTerms) push(p)
  } else if (ctx.topProduct) {
    push(ctx.topProduct)
  }

  if (!relaxed && ctx.mood) {
    // Top 2 mood imagery adjectives — the cohesion drivers. Cap the total
    // term count so Unsplash still has a fighting chance of matching.
    const capacity = productTerms.length >= 3 ? 4 : 4
    for (const adj of ctx.mood.imageryKeywords.slice(0, 2)) {
      if (terms.length >= capacity) break
      push(adj)
    }
  }

  // Fallback when LLM translation fails and no products supplied — use the
  // raw category name so Unsplash still gets at least one search term.
  if (terms.length === 0) {
    push(ctx.category)
  }

  return terms.join(' ').trim()
}

/**
 * Map a raw UnsplashPhoto into a PoolPhoto with derived aspect ratio + role.
 * Role is assigned defensively — "any" for landscape means the photo works
 * anywhere, the picker maps role → bucket.
 */
function normalize(photo: UnsplashPhoto, defaultRole: ImageRole): PoolPhoto {
  const ar = photo.width / Math.max(photo.height, 1)
  let aspectRatio: PoolPhoto['aspectRatio'] = '16:9'
  if (ar >= 1.6) aspectRatio = '16:9'
  else if (ar >= 1.2) aspectRatio = '4:3'
  else if (ar >= 0.9) aspectRatio = '1:1'
  else aspectRatio = '3:4'

  return {
    id: photo.id,
    url: photo.urls.regular,
    alt: photo.alt_description ?? photo.description ?? '',
    width: photo.width,
    height: photo.height,
    photographer: photo.user?.name ?? photo.user?.username ?? 'Unknown',
    downloadLocation: photo.links.download_location,
    role: defaultRole,
    aspectRatio,
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Build the per-site image pool. Makes 1-2 Unsplash calls (landscape + square).
 *
 * Failure modes:
 *   - Unsplash returns 0 results → retry once with relaxed query (no mood)
 *   - Still underfills → set `pool.underfill = true`, caller can backfill via
 *     legacy per-block searchPhotos if needed
 *   - searchPhotos throws → returns empty pool, underfill=true (non-fatal)
 */
export async function buildImagePool(ctx: BuildPoolCtx): Promise<ImagePool> {
  const landscapeSize = ctx.landscapeSize ?? DEFAULT_LANDSCAPE_SIZE
  const squareSize = ctx.squareSize ?? DEFAULT_SQUARE_SIZE

  const query = buildPoolQuery(ctx, false)
  let underfill = false

  // ── Landscape bucket (hero, gallery wide) ────────────────────────
  let landscapePhotos: UnsplashPhoto[] = []
  try {
    landscapePhotos = (await searchPhotos(query, landscapeSize, { orientation: 'landscape' })) ?? []
  } catch (err) {
    console.warn('[image-pool] landscape search failed:', err)
  }

  if (landscapePhotos.length < Math.max(3, Math.floor(landscapeSize / 2))) {
    // Underfill — retry with relaxed query (drop mood adjectives)
    const relaxedQuery = buildPoolQuery(ctx, true)
    if (relaxedQuery !== query) {
      try {
        const extra = (await searchPhotos(relaxedQuery, landscapeSize, { orientation: 'landscape' })) ?? []
        landscapePhotos = landscapePhotos.concat(extra)
        if (extra.length > 0) underfill = true
      } catch (err) {
        console.warn('[image-pool] landscape relaxed retry failed:', err)
      }
    }
    if (landscapePhotos.length === 0) underfill = true
  }

  // ── Square bucket (team, product flatlay) ─────────────────────────
  let squarePhotos: UnsplashPhoto[] = []
  try {
    squarePhotos = (await searchPhotos(query, squareSize, { orientation: 'squarish' })) ?? []
  } catch (err) {
    console.warn('[image-pool] square search failed:', err)
  }

  if (squarePhotos.length < Math.max(2, Math.floor(squareSize / 2))) {
    const relaxedQuery = buildPoolQuery(ctx, true)
    if (relaxedQuery !== query) {
      try {
        const extra = (await searchPhotos(relaxedQuery, squareSize, { orientation: 'squarish' })) ?? []
        squarePhotos = squarePhotos.concat(extra)
        if (extra.length > 0) underfill = true
      } catch (err) {
        console.warn('[image-pool] square relaxed retry failed:', err)
      }
    }
    if (squarePhotos.length === 0) underfill = true
  }

  return {
    landscape: landscapePhotos.map((p) => normalize(p, 'gallery')),
    // When squarish search returns 0 (Unsplash has thin coverage for niche queries
    // like "bubble tea"), reuse landscape photos instead of leaving the bucket empty.
    // Empty square bucket causes media-injector to fall back to legacy search per
    // block (extra Unsplash API calls → rate limit pressure on demo keys).
    square: squarePhotos.length > 0
      ? squarePhotos.map((p) => normalize(p, 'team'))
      : landscapePhotos.slice(0, squareSize).map((p) => normalize(p, 'team')),
    // Portrait not populated by default — derived from landscape if needed.
    portrait: [],
    queryUsed: query,
    underfill,
  }
}

// ── Seeded picker ───────────────────────────────────────────────────────────

/**
 * Mulberry32 PRNG — stable, tiny, deterministic. Same seed → same sequence.
 * Used to seed Fisher-Yates shuffle so picks are reproducible per (seed, role).
 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Map a block role to which aspect bucket supplies its photos.
 * `any` defaults to landscape (most flexible).
 */
function bucketForRole(role: ImageRole): AspectBucket {
  switch (role) {
    case 'hero':
    case 'gallery':
    case 'any':
      return 'landscape'
    case 'team':
    case 'product':
      return 'square'
    default:
      return 'landscape'
  }
}

/**
 * Deterministic pick from the pool given a role + seed. Same (pool, role, seed)
 * always returns the same photo — reruns are stable. Different roles on the
 * same seed pick DIFFERENT entries so a hero and a team photo never collide.
 *
 * Returns undefined when the bucket is empty (caller should fall back to
 * per-block searchPhotos in that case).
 */
export function pickFromPool(
  pool: ImagePool,
  role: ImageRole,
  seed: number,
): PoolPhoto | undefined {
  const bucket = bucketForRole(role)
  const source = pool[bucket]
  if (source.length === 0) return undefined

  // Compound seed so different roles pick distinct entries at the same seed.
  const roleSalt = roleHash(role)
  const rand = mulberry32(seed ^ roleSalt)
  const idx = Math.floor(rand() * source.length) % source.length
  const picked = source[idx]!
  // Attach the requested role so callers can log it
  return { ...picked, role }
}

function roleHash(role: ImageRole): number {
  let h = 0
  for (let i = 0; i < role.length; i++) h = (h * 31 + role.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * Pick N photos for a role in a single call. Returns fewer than N only when
 * the bucket itself has fewer entries — does NOT duplicate to reach N.
 *
 * Used by gallery block which needs 6-12 distinct images from the landscape
 * bucket.
 */
export function pickManyFromPool(
  pool: ImagePool,
  role: ImageRole,
  seed: number,
  count: number,
): PoolPhoto[] {
  const bucket = bucketForRole(role)
  const source = pool[bucket]
  if (source.length === 0 || count <= 0) return []

  // Seeded Fisher-Yates shuffle to get distinct picks.
  const indices = Array.from({ length: source.length }, (_, i) => i)
  const rand = mulberry32(seed ^ roleHash(role))
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j]!, indices[i]!]
  }
  return indices.slice(0, Math.min(count, indices.length)).map((idx) => ({
    ...source[idx]!,
    role,
  }))
}

/**
 * Merge extra photos into the pool (for backfill/padding). Deduplicates by id.
 */
export function mergePool(pool: ImagePool, extra: Partial<ImagePool>): ImagePool {
  const dedupe = (a: PoolPhoto[], b: PoolPhoto[] = []): PoolPhoto[] => {
    const seen = new Set(a.map((p) => p.id))
    const out = [...a]
    for (const photo of b) {
      if (!seen.has(photo.id)) {
        out.push(photo)
        seen.add(photo.id)
      }
    }
    return out
  }
  return {
    landscape: dedupe(pool.landscape, extra.landscape),
    square: dedupe(pool.square, extra.square),
    portrait: dedupe(pool.portrait, extra.portrait),
    queryUsed: extra.queryUsed ?? pool.queryUsed,
    underfill: pool.underfill || !!extra.underfill,
  }
}

/** Total count across all buckets — used for SSE debug events. */
export function poolSize(pool: ImagePool): number {
  return pool.landscape.length + pool.square.length + pool.portrait.length
}
