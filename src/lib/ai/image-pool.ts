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

import { searchPhotos, detectQueryLang, photoMatchesTerms, PIXABAY_CATEGORY_BY_COMPOSER, PixabayError, type PixabayPhoto } from './pixabay-client'
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
  /**
   * GH-1611: the subset of `products` the USER actually typed — what the relevance
   * gate is allowed to trust. `products` also carries LLM-extracted visual keywords
   * (route.ts mergeKeywords ← extractImageKeywords), and those may be adjectives
   * ("artisan", "minimalist"). A 1-word term needs a single tag hit, so gating on an
   * adjective re-opens the exact hole this issue is about: a photo tagged
   * "jeans, flatlay, minimalist" would enter a bakery's pool.
   *
   * Absent → fall back to `products` (callers with no LLM keywords: tests, legacy).
   */
  gateProducts?: string[]
  /** Deterministic seed — same seed returns same query (query-level stability). */
  seed: number
  /** Optional sizes; defaults match typical block needs per home page. */
  landscapeSize?: number
  squareSize?: number
  /**
   * GH-1611: how many photos a bucket must hold before it counts as FILLED —
   * i.e. the largest single-block need mapping to that bucket (gallery = 6).
   *
   * Previously a bucket declared itself full at half its size (4 of 9), so the
   * fallback ladder stopped early, gallery came up 2 short, and media-injector
   * patched the deficit with an off-pool legacy search whose photos were
   * appended AFTER the pool ones — the "first 4 right, last 2 wrong" pattern in
   * the bug report. Defaults to the legacy half-size heuristic when absent.
   */
  landscapeMin?: number
  squareMin?: number
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export const DEFAULT_LANDSCAPE_SIZE = 12
export const DEFAULT_SQUARE_SIZE = 6


/**
 * GH-1611: a composer category is an internal KEY ('fnb', 'realestate'), not a
 * word anyone tags a photo with — searching Pixabay for q="fnb" returns
 * nothing. Only 'business' happens to also be a real word, which is exactly why
 * the fnb→business drift produced retail/fashion photos instead of no photos.
 * Always search with the category's natural-language phrase instead.
 */
function categoryPhrase(category: string): string {
  return Object.hasOwn(CATEGORY_BASE_KEYWORDS, category)
    ? CATEGORY_BASE_KEYWORDS[category]?.[0] ?? category
    : category
}

/**
 * Build the Pixabay search TERMS from the context.
 *
 * GH-1611: terms are kept as an array, not pre-joined. The relevance gate must
 * know where one product term ends and the next begins — AND-matching the
 * joined string would demand a single photo be both a cake and a baguette (see
 * `photoMatchesTerms`). `buildPoolQuery` still joins them for Pixabay's `q`.
 *
 * Pixabay `q` is AND-matched on image tags (every word must match), so the
 * query must stay tight — mixing raw user-language product terms with English
 * mood adjectives guarantees zero results (GH-1185).
 *
 * Rules:
 *   - Raw keyword present (products/topProduct, user language, UNtranslated)
 *     → terms = raw terms ONLY (max 3). No English scaffolding mixed in.
 *   - No raw keyword → scaffolding: category phrase + 1 mood adjective.
 *   - relaxed=true → genuinely broaden: products[0] only; if already ≤1 term,
 *     fall to the category phrase so the underfill retry produces a DIFFERENT
 *     query.
 */
export function buildPoolTerms(ctx: BuildPoolCtx, relaxed: boolean = false): string[] {
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
      // fall to the category PHRASE so the retry query differs from the primary
      // one AND is actually searchable (GH-1611 — the composer key was not).
      const first = productTerms[0] ?? ctx.topProduct
      if (productTerms.length > 1) {
        push(first)
      } else {
        push(categoryPhrase(ctx.category))
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
    push(categoryPhrase(ctx.category))
    if (!relaxed && ctx.mood) {
      push(ctx.mood.imageryKeywords[0])
    }
  }

  return terms
}

/** The Pixabay `q` string — terms joined. See `buildPoolTerms` for the array. */
export function buildPoolQuery(ctx: BuildPoolCtx, relaxed: boolean = false): string {
  return buildPoolTerms(ctx, relaxed).join(' ').trim()
}

/**
 * The SUBJECT terms the relevance gate may judge a photo against: the user's
 * products, and nothing else.
 *
 * Search terms ≠ gate terms. A search query may legitimately carry a mood
 * adjective ("coffee shop minimalist") to bias Pixabay's ranking, but gating on
 * an adjective is a hole: a 1-word term needs one hit, so "minimalist" would
 * admit a photo tagged "jeans, flatlay, minimalist" into a bakery's pool — the
 * exact cross-industry image GH-1611 is about.
 *
 * Empty when the user gave no products (scaffolding path). The gate is then
 * skipped entirely: the query is already the curated category phrase and the
 * Pixabay `category` filter keeps it on-domain, so gating that phrase against
 * itself would only empty the bucket.
 */
export function buildGateTerms(ctx: BuildPoolCtx): string[] {
  // User-typed products only — never the LLM-extracted keywords that also live in
  // `products` (see BuildPoolCtx.gateProducts).
  const source = ctx.gateProducts ?? ctx.products
  const raw = source && source.length > 0 ? source
    : ctx.gateProducts !== undefined ? []        // caller said: trust nothing
    : [ctx.topProduct ?? '']
  const seen = new Set<string>()
  return raw
    .map((t) => (t ?? '').trim())
    .filter((t) => {
      if (!t) return false
      const lower = t.toLowerCase()
      if (seen.has(lower)) return false
      seen.add(lower)
      return true
    })
    .slice(0, 3)
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
 *   1. primary query — relevance-gated against the query TERMS (GH-1611: every
 *      language, not just Vietnamese; a photo must match at least one term)
 *   2. relaxed query (broadened by buildPoolTerms) — same gate
 *   3. trusted category phrase, ungated — curated VN phrase
 *      (VN_CATEGORY_QUERIES) for VN queries, English category base keyword
 *      (CATEGORY_BASE_KEYWORDS[category][0]) otherwise
 *
 * GH-1611: tiers are merged with de-duplication by photo id. The tiers overlap by
 * design (a broadened query re-returns the primary query's top hits), so a plain
 * concat let the SAME photo count twice toward minCount — the bucket looked full
 * while holding 4 distinct photos for a 6-slot gallery, and the gallery rendered
 * the same cake twice. Only distinct photos count as progress.
 *
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

  // Provider-outage short-circuit: every further tier is a guaranteed-fail
  // request that deepens the storm. Return thin/empty and let the caller use
  // its deterministic industry fallback.
  const isProviderUnavailable = (err: unknown): boolean =>
    err instanceof PixabayError
    && (err.code === 'RATE_LIMITED' || err.code === 'SERVER_ERROR' || err.code === 'TIMEOUT')

  try {
    photos = (await searchPhotos(query, size, { orientation, width, category })) ?? []
  } catch (err) {
    console.warn(`[image-pool] ${orientation} search failed:`, err)
    if (isProviderUnavailable(err)) return { photos, usedFallback: true }
  }
  // GH-1611: gate EVERY language, not just Vietnamese. The pool query is
  // English by default (GEN_TRANSLATE_POOL_KEYWORDS), so a VN-only gate never
  // ran in production and off-industry photos entered the pool unchecked.
  // Gate on the SUBJECT terms (products), never on the joined query and never on
  // mood adjectives — see buildGateTerms / photoMatchesTerms.
  const gateTerms = buildGateTerms(ctx)
  const gate = (candidates: PixabayPhoto[], terms: string[], label: string): PixabayPhoto[] => {
    // No products → the query IS the curated category phrase; the Pixabay
    // `category` filter is the domain guard and there is nothing to gate on.
    if (terms.length === 0) return candidates
    const kept = candidates.filter((p) => photoMatchesTerms(p.alt, terms))
    if (kept.length < candidates.length) {
      console.info(
        `[image-pool] ${orientation} relevance gate: ${kept.length}/${candidates.length} photos match "${label}"`,
      )
    }
    return kept
  }
  // GH-1611: tiers overlap (the broadened query re-returns the primary query's
  // hits), so merging must dedupe by photo id — otherwise the same photo counts
  // twice toward minCount and the gallery renders it twice.
  const seenIds = new Set<string>()
  const merge = (incoming: PixabayPhoto[]): void => {
    for (const p of incoming) {
      if (seenIds.has(p.id)) continue
      seenIds.add(p.id)
      photos.push(p)
    }
  }

  const tier1 = gate(photos, gateTerms, query)
  photos = []
  merge(tier1)
  if (photos.length >= minCount) return { photos: photos.slice(0, size), usedFallback }

  // The curated category phrase is trusted (ungated) ONLY because Pixabay's
  // `category` filter keeps its results on-domain. Four composer categories have no
  // Pixabay equivalent (ecommerce, creative, events, blog → no filter), and there
  // the curated tier is an open door: `ecommerce`'s phrase is "product photography",
  // whose top hits are the very clothing flatlays this issue is about. So gate it on
  // its own phrase when unfiltered, with no escape hatch.
  //
  // An empty bucket is a SAFE outcome — verified, not assumed:
  // cleanupNonNumericImageFields (media-injector.ts:311-315) deletes any image field
  // the pipeline could not fill, so GPT's hallucinated URL cannot survive, and the
  // block renders a curated image keyed on siteType (api/preview/renderers/images.ts
  // IMAGE_LIBRARY) — on-industry by construction. Off-industry stock beats nothing;
  // it does NOT beat the curated on-industry library. So: never admit an ungated
  // photo to avoid an empty bucket.
  const curatedGateTerms = category ? [] : [categoryPhrase(ctx.category)]

  // Tier 2 — relaxed (broadened) query, still user-derived.
  const relaxedTerms = buildPoolTerms(ctx, true)
  const relaxedQuery = relaxedTerms.join(' ').trim()
  // Single-product input broadens straight to the category phrase — same trust
  // rules as tier-3 then, not the product gate (which would reject everything the
  // broader query was fetched to add).
  const relaxedIsCurated = relaxedQuery === categoryPhrase(ctx.category)
  let tier2Failed = false
  if (relaxedQuery !== query) {
    usedFallback = true
    try {
      const extra = (await searchPhotos(relaxedQuery, size, { orientation, width, category })) ?? []
      merge(gate(extra, relaxedIsCurated ? curatedGateTerms : relaxedTerms, relaxedQuery))
    } catch (err) {
      console.warn(`[image-pool] ${orientation} relaxed retry failed:`, err)
      if (isProviderUnavailable(err)) return { photos, usedFallback: true }
      tier2Failed = true
    }
  }
  if (photos.length >= minCount) return { photos: photos.slice(0, size), usedFallback }

  // Tier 3 — curated category phrase. VN inputs use the curated Vietnamese phrase
  // (lang=vi). Non-VN inputs whose bucket is still under minCount (zero or thin hits
  // — e.g. "pen dan pensel" has no Pixabay tag coverage) top up with the English
  // category base keyword. Trusted (ungated) only where Pixabay's `category` filter
  // guards the domain; gated on the phrase itself otherwise — see curatedGateTerms.
  const vnQuery = isVietnamese ? VN_CATEGORY_QUERIES[ctx.category] : undefined
  const catQuery = vnQuery ?? CATEGORY_BASE_KEYWORDS[ctx.category]?.[0]
  // `!== relaxedQuery` guard: on the scaffolding path the tier-2 query can
  // already equal the category base keyword — re-issuing the byte-identical
  // just-failed search wastes a rate-limited Pixabay call. Unless tier-2 ERRORED
  // (transient 5xx): then the query was never actually answered, and skipping it
  // here would leave the bucket empty with no category fallback at all.
  if (catQuery && catQuery !== query && (catQuery !== relaxedQuery || tier2Failed)) {
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
      merge(gate(extra, curatedGateTerms, catQuery))
    } catch (err) {
      console.warn(`[image-pool] ${orientation} category fallback failed:`, err)
    }
  }
  if (photos.length === 0) {
    // Deliberate: the block falls back to the curated on-industry IMAGE_LIBRARY.
    console.warn(`[image-pool] ${orientation} bucket empty after all tiers — category="${ctx.category}" query="${query}"`)
  }
  // Cap at the requested bucket size: the tiers stack, and every pool entry is
  // downloaded + uploaded to Payload by preUploadPool. An uncapped bucket meant
  // ~3× the media rows and S3 objects, serialized on the gen critical path.
  return { photos: photos.slice(0, size), usedFallback }
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
    // GH-1611: "filled" = enough for the hungriest block that draws from this
    // bucket (gallery needs 6), not half the bucket size. Never BELOW the legacy
    // floor though — hero-only sizing has a base need of 1, and stopping the
    // ladder at a single photo would hand hero and about the same image.
    // Clamped to the bucket size so it can't demand more than we ever fetch.
    const landscapeMin = Math.min(
      landscapeSize,
      Math.max(ctx.landscapeMin ?? 0, Math.max(3, Math.floor(landscapeSize / 2))),
    )
    const landscape = await searchBucket(
      ctx, query, 'landscape', landscapeSize, 1200, landscapeMin,
    )
    landscapePhotos = landscape.photos
    if (landscape.usedFallback || landscapePhotos.length === 0) underfill = true
  }

  // ── Square bucket (team, product flatlay) ─────────────────────────
  let squarePhotos: PixabayPhoto[] = []
  if (squareSize > 0) {
    const squareMin = Math.min(
      squareSize,
      Math.max(ctx.squareMin ?? 0, Math.max(2, Math.floor(squareSize / 2))),
    )
    const square = await searchBucket(
      ctx, query, 'squarish', squareSize, 1000, squareMin,
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
