/**
 * Image Pool — per-site Pixabay pool for visual cohesion.
 *
 * Problem solved: today every block calls `searchPhotos(keywords)` independently,
 * so hero / gallery / team photos come from different photographers with
 * different lighting, color, and style. Users see "5 block = 5 style ảnh rời rạc".
 *
 * Solution: build ONE pool per site (1-2 search calls total), then each block
 * picks from the pool via role-based deterministic picker. Every photo shares
 * the same query + mood filter → visual coherence by construction.
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-03-image-pool-consistency.md
 * Depends on: Phase 02 theme-moods (mood.photographyFilter + mood.imageryKeywords)
 */

import { searchPhotos, detectQueryLang, photoMatchesQuery, PIXABAY_CATEGORY_BY_COMPOSER, PixabayError, type PixabayPhoto } from './pixabay-client'
import { CATEGORY_BASE_KEYWORDS } from './image-keywords'
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
   * Top product term (RAW user language, untranslated — GH-1185).
   * Retained for backward compatibility — when `products` is absent, this is
   * the single term threaded into the Pixabay query.
   */
  topProduct?: string
  /**
   * Plan 07 — full top-N RAW products (untranslated). When provided (max 3
   * kept), the query joins them so two restaurants with similar first products
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

export const DEFAULT_LANDSCAPE_SIZE = 12
export const DEFAULT_SQUARE_SIZE = 6


/**
 * Build the Pixabay search query from the context.
 *
 * Pixabay `q` is AND-matched on image tags (every word must match), so the
 * query must stay tight — mixing raw user-language product terms with English
 * mood adjectives guarantees zero results (GH-1185).
 *
 * Rules:
 *   - Raw keyword present (products/topProduct, user language, UNtranslated)
 *     → q = raw terms ONLY (max 3). No English scaffolding mixed in.
 *   - No raw keyword → scaffolding: resolved category + 1 mood adjective.
 *   - relaxed=true → genuinely broaden: products[0] only; if already ≤1 term,
 *     fall to the category so the underfill retry produces a DIFFERENT query.
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
  // Dedupe case-insensitively BEFORE the relaxed length check so duplicate
  // inputs (e.g. ["Phở","phở"]) don't fake a multi-term query and skip the
  // category-broadening retry.
  const productSeen = new Set<string>()
  const productTerms = (ctx.products ?? [])
    .filter((p) => p && p.trim())
    .filter((p) => {
      const lower = p.trim().toLowerCase()
      if (productSeen.has(lower)) return false
      productSeen.add(lower)
      return true
    })
    .slice(0, 3)
  const hasRawKeyword = productTerms.length > 0 || Boolean(ctx.topProduct?.trim())

  if (hasRawKeyword) {
    if (relaxed) {
      // Broaden: single strongest term; if only one term existed anyway,
      // fall to category so the retry query differs from the primary one.
      const first = productTerms[0] ?? ctx.topProduct
      if (productTerms.length > 1) {
        push(first)
      } else {
        push(ctx.category)
        if (terms.length === 0) push(first)
      }
    } else {
      // Raw terms ONLY — no mood/category appended (AND-match protection).
      if (productTerms.length > 0) {
        for (const p of productTerms) push(p)
      } else {
        push(ctx.topProduct)
      }
    }
  } else {
    // Scaffolding path — no user keyword to protect, English terms are fine.
    push(ctx.category)
    if (!relaxed && ctx.mood) {
      push(ctx.mood.imageryKeywords[0])
    }
  }

  return terms.join(' ').trim()
}

/**
 * Map a raw PixabayPhoto into a PoolPhoto with derived aspect ratio + role.
 * Role is assigned defensively — "any" for landscape means the photo works
 * anywhere, the picker maps role → bucket.
 */
function normalize(photo: PixabayPhoto, defaultRole: ImageRole): PoolPhoto {
  const ar = photo.width / Math.max(photo.height, 1)
  let aspectRatio: PoolPhoto['aspectRatio'] = '16:9'
  if (ar >= 1.6) aspectRatio = '16:9'
  else if (ar >= 1.2) aspectRatio = '4:3'
  else if (ar >= 0.9) aspectRatio = '1:1'
  else aspectRatio = '3:4'

  return {
    id: photo.id,
    url: photo.url,
    alt: photo.alt ?? '',
    width: photo.width,
    height: photo.height,
    photographer: photo.photographer || 'Unknown',
    role: defaultRole,
    aspectRatio,
  }
}

/**
 * GH-1185: Vietnamese cuisine/scene phrases per composer category — the
 * third-tier fallback when a raw Vietnamese query survives the relevance
 * gate with too few photos. Verified live: "ẩm thực việt nam" returns phở,
 * chả giò, bánh chưng — far better than either the raw dish name (anchovy
 * mismatches) or the English category term (generic interiors).
 * Vietnamese by design — keeps the "no translation to English" decision.
 */
export const VN_CATEGORY_QUERIES: Readonly<Record<string, string>> = {
  restaurant: 'ẩm thực việt nam',
  fnb:        'quán cà phê',
  ecommerce:  'cửa hàng mua sắm',
  beauty:     'spa làm đẹp',
  fitness:    'phòng tập thể dục',
  health:     'chăm sóc sức khỏe',
  education:  'lớp học giáo dục',
  realestate: 'nhà đẹp nội thất',
  events:     'tiệc cưới sự kiện',
  travel:     'du lịch việt nam',
  creative:   'sáng tạo nghệ thuật',
  tech:       'công nghệ văn phòng',
  business:   'văn phòng làm việc',
  blog:       'góc làm việc',
}

/**
 * Search one orientation bucket with the GH-1185 fallback ladder:
 *   1. primary query — Vietnamese queries are relevance-gated (every query
 *      word must appear in the photo tags; kills "cá cơm" false positives)
 *   2. relaxed query (broadened by buildPoolQuery) — same gate
 *   3. trusted category phrase, ungated — curated VN phrase
 *      (VN_CATEGORY_QUERIES) for VN queries, English category base keyword
 *      (CATEGORY_BASE_KEYWORDS[category][0]) otherwise
 * Returns the photos plus whether any fallback tier fired (underfill signal).
 */
async function searchBucket(
  ctx: BuildPoolCtx,
  query: string,
  orientation: 'landscape' | 'squarish',
  size: number,
  width: number,
  minCount: number,
): Promise<{ photos: PixabayPhoto[]; usedFallback: boolean }> {
  const isVietnamese = detectQueryLang(query) === 'vi'
  // GH-1185: Pixabay category filter keeps loose matches on-domain (a "phở
  // bò" miss is another dish, not a dairy cow). ctx.category is a resolved
  // composer key; unmapped categories get no filter.
  const category = PIXABAY_CATEGORY_BY_COMPOSER[ctx.category]
  let photos: PixabayPhoto[] = []
  let usedFallback = false

  // 429 short-circuit: once Pixabay rate-limits, every further tier is a
  // guaranteed-fail request that deepens the storm (each searchPhotos already
  // retries 429 once internally with ~2s sleep). Return thin/empty — the
  // caller marks underfill and downstream paths have their own guards.
  const isRateLimited = (err: unknown): boolean =>
    err instanceof PixabayError && err.code === 'RATE_LIMITED'

  try {
    photos = (await searchPhotos(query, size, { orientation, width, category })) ?? []
  } catch (err) {
    console.warn(`[image-pool] ${orientation} search failed:`, err)
    if (isRateLimited(err)) return { photos, usedFallback: true }
  }
  if (isVietnamese) {
    const gated = photos.filter((p) => photoMatchesQuery(p.alt, query))
    if (gated.length < photos.length) {
      console.info(
        `[image-pool] ${orientation} relevance gate: ${gated.length}/${photos.length} photos match "${query}"`,
      )
    }
    photos = gated
  }
  if (photos.length >= minCount) return { photos, usedFallback }

  // Tier 2 — relaxed (broadened) query, still user-derived.
  const relaxedQuery = buildPoolQuery(ctx, true)
  if (relaxedQuery !== query) {
    usedFallback = true
    try {
      let extra = (await searchPhotos(relaxedQuery, size, { orientation, width, category })) ?? []
      if (detectQueryLang(relaxedQuery) === 'vi') {
        extra = extra.filter((p) => photoMatchesQuery(p.alt, relaxedQuery))
      }
      photos = photos.concat(extra)
    } catch (err) {
      console.warn(`[image-pool] ${orientation} relaxed retry failed:`, err)
      if (isRateLimited(err)) return { photos, usedFallback: true }
    }
  }
  if (photos.length >= minCount) return { photos, usedFallback }

  // Tier 3 — trusted category phrase, ungated. VN inputs use the curated
  // Vietnamese phrase (lang=vi). Non-VN inputs whose bucket is still under
  // minCount (zero or thin hits — e.g. "pen dan pensel" has no Pixabay tag
  // coverage) top up with the English category base keyword instead of
  // returning an empty/thin bucket: an empty pool means media-injector
  // replaces nothing, so GPT-hallucinated stock URLs (typically off-topic
  // fashion shots for `ecommerce`) survive as-is.
  const vnQuery = isVietnamese ? VN_CATEGORY_QUERIES[ctx.category] : undefined
  const catQuery = vnQuery ?? CATEGORY_BASE_KEYWORDS[ctx.category]?.[0]
  // `!== relaxedQuery` guard: on the scaffolding path the tier-2 query can
  // already equal the category base keyword — re-issuing the byte-identical
  // just-failed search wastes a rate-limited Pixabay call.
  if (catQuery && catQuery !== query && catQuery !== relaxedQuery) {
    usedFallback = true
    try {
      // lang:'vi' explicit for VN phrases — curated phrases like "quán cà phê"
      // (fnb) carry only ambiguous diacritics, so auto-detection would miss
      // them and the search would run diacritic-stripped under Pixabay's
      // default lang=en. EN base keywords use the default lang.
      const extra = (await searchPhotos(catQuery, size, {
        orientation, width, category, ...(vnQuery ? { lang: 'vi' as const } : {}),
      })) ?? []
      if (extra.length > 0) {
        console.info(`[image-pool] ${orientation} category fallback "${catQuery}": +${extra.length}`)
      }
      photos = photos.concat(extra)
    } catch (err) {
      console.warn(`[image-pool] ${orientation} category fallback failed:`, err)
    }
  }
  return { photos, usedFallback }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Build the per-site image pool. Makes 1-2 Pixabay calls (landscape + square).
 *
 * Failure modes:
 *   - Pixabay returns 0 results → retry once with relaxed (broadened) query
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
  // Size 0 = no landscape-role block enabled for this gen — skip the Pixabay
  // call entirely (empty bucket is intentional here, NOT an underfill).
  let landscapePhotos: PixabayPhoto[] = []
  if (landscapeSize > 0) {
    const landscape = await searchBucket(
      ctx, query, 'landscape', landscapeSize, 1200, Math.max(3, Math.floor(landscapeSize / 2)),
    )
    landscapePhotos = landscape.photos
    if (landscape.usedFallback || landscapePhotos.length === 0) underfill = true
  }

  // ── Square bucket (team, product flatlay) ─────────────────────────
  let squarePhotos: PixabayPhoto[] = []
  if (squareSize > 0) {
    const square = await searchBucket(
      ctx, query, 'squarish', squareSize, 1000, Math.max(2, Math.floor(squareSize / 2)),
    )
    squarePhotos = square.photos
    if (square.usedFallback || squarePhotos.length === 0) underfill = true
  }

  return {
    landscape: landscapePhotos.map((p) => normalize(p, 'gallery')),
    // When squarish search returns 0 (Pixabay has thin coverage for niche queries
    // like "bubble tea"), reuse landscape photos instead of leaving the bucket empty.
    // Empty square bucket causes media-injector to fall back to legacy search per
    // block (extra Pixabay API calls → rate limit pressure).
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
export function bucketForRole(role: ImageRole): AspectBucket {
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
