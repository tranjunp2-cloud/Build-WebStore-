/**
 * Unit tests for image-pool.ts module.
 *
 * Coverage:
 *   TC-F01-W.13 — pool shape + types
 *   TC-F01-W.14 — buildImagePool 2-search + mood query propagation
 *   TC-F01-W.15 — pickFromPool seeded determinism + role → bucket mapping
 *   TC-F01-W.16 — underfill backoff with relaxed query
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-03-image-pool-consistency.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  buildImagePool,
  pickFromPool,
  pickManyFromPool,
  mergePool,
  poolSize,
  type ImagePool,
  type PoolPhoto,
  type BuildPoolCtx,
  buildPoolQuery,
} from '@/lib/ai/image-pool'
import { deriveKeywords } from '@/lib/ai/image-keywords'
import { THEME_MOODS } from '@/lib/ai/theme-moods'
import { PixabayError, type PixabayPhoto } from '@/lib/ai/pixabay-client'

// ── Mock Pixabay client ─────────────────────────────────────────────────────

const mockSearchPhotos = vi.fn<(...args: unknown[]) => Promise<PixabayPhoto[]>>()

vi.mock('@/lib/ai/pixabay-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/pixabay-client')>(
    '@/lib/ai/pixabay-client',
  )
  return {
    ...actual,
    searchPhotos: (...args: unknown[]) => mockSearchPhotos(...args),
  }
})

function fakePhoto(id: string, w: number, h: number): PixabayPhoto {
  return {
    id,
    url: `https://pixabay.com/get/${id}_1280.jpg`,
    alt: `alt ${id}`,
    photographer: 'Alice Photographer',
    width: w,
    height: h,
  }
}

const landscapeFixture = Array.from({ length: 12 }, (_, i) => fakePhoto(`L${i}`, 1920, 1080))
const squareFixture = Array.from({ length: 6 }, (_, i) => fakePhoto(`S${i}`, 1000, 1000))

beforeEach(() => {
  mockSearchPhotos.mockReset()
})
afterEach(() => {
  vi.clearAllMocks()
})

// ── Shared ctx helper ───────────────────────────────────────────────────────

function baseCtx(overrides: Partial<BuildPoolCtx> = {}): BuildPoolCtx {
  return {
    category: 'restaurant',
    mood: THEME_MOODS.elegant,
    topProduct: 'ramen',
    seed: 42,
    ...overrides,
  }
}

// ── TC-F01-W.13: pool shape ─────────────────────────────────────────────────

describe('TC-F01-W.13 — image pool shape', () => {
  it('buildImagePool returns expected structure', async () => {
    mockSearchPhotos
      .mockResolvedValueOnce(landscapeFixture)
      .mockResolvedValueOnce(squareFixture)

    const pool = await buildImagePool(baseCtx())

    expect(pool.landscape).toHaveLength(12)
    expect(pool.square).toHaveLength(6)
    expect(pool.portrait).toEqual([])
    expect(pool.queryUsed).toBeTypeOf('string')
    expect(pool.queryUsed.length).toBeGreaterThan(0)
    expect(pool.underfill).toBe(false)
  })

  it('PoolPhoto has all required fields', async () => {
    mockSearchPhotos
      .mockResolvedValueOnce(landscapeFixture)
      .mockResolvedValueOnce(squareFixture)

    const pool = await buildImagePool(baseCtx())
    const photo = pool.landscape[0]!

    expect(photo.id).toBeDefined()
    expect(photo.url).toContain('https://')
    expect(photo.alt).toBeDefined()
    expect(photo.width).toBeGreaterThan(0)
    expect(photo.height).toBeGreaterThan(0)
    expect(photo.photographer).toBeDefined()
    expect(photo.role).toBe('gallery')
    expect(['16:9', '4:3', '1:1', '3:4']).toContain(photo.aspectRatio)
  })

  it('derives aspectRatio from width/height', async () => {
    // Use full fixture so no underfill retry fires (which would mis-consume mocks).
    const landscapeAll = [
      fakePhoto('wide', 1920, 1080), // 16:9
      fakePhoto('four-three', 1200, 900), // 4:3
      ...Array.from({ length: 10 }, (_, i) => fakePhoto(`pad${i}`, 1920, 1080)),
    ]
    const squareAll = [
      fakePhoto('sq', 1000, 1000), // 1:1
      ...Array.from({ length: 5 }, (_, i) => fakePhoto(`spad${i}`, 1000, 1000)),
    ]
    mockSearchPhotos.mockResolvedValueOnce(landscapeAll).mockResolvedValueOnce(squareAll)

    const pool = await buildImagePool(baseCtx())
    expect(pool.landscape[0]!.aspectRatio).toBe('16:9')
    expect(pool.landscape[1]!.aspectRatio).toBe('4:3')
    expect(pool.square[0]!.aspectRatio).toBe('1:1')
  })
})

// ── TC-F01-W.14: buildImagePool + mood query ────────────────────────────────

describe('TC-F01-W.14 — buildImagePool query construction', () => {
  it('query contains top product only (no mood adjectives with raw keywords)', async () => {
    mockSearchPhotos.mockResolvedValueOnce(landscapeFixture).mockResolvedValueOnce(squareFixture)

    const pool = await buildImagePool(
      baseCtx({ topProduct: 'ramen', mood: THEME_MOODS.elegant }),
    )

    // GH-1185: raw keyword present → query = raw terms ONLY (no EN mood adjectives)
    // to prevent AND-match failure on Pixabay (mixed user-language + EN = 0 results).
    expect(pool.queryUsed).toBe('ramen')
    const q = pool.queryUsed.toLowerCase()
    // No mood adjectives should be present
    expect(/refined|candlelit|marble|timeless|soft natural/.test(q)).toBe(false)
  })

  it('query uses category when no product + no mood', async () => {
    mockSearchPhotos.mockResolvedValueOnce(landscapeFixture).mockResolvedValueOnce(squareFixture)
    const pool = await buildImagePool({
      category: 'beauty',
      seed: 1,
    })
    expect(pool.queryUsed.toLowerCase()).toContain('beauty')
  })

  it('makes 2 searchPhotos calls — 1 landscape + 1 square', async () => {
    mockSearchPhotos.mockResolvedValueOnce(landscapeFixture).mockResolvedValueOnce(squareFixture)
    await buildImagePool(baseCtx())
    expect(mockSearchPhotos).toHaveBeenCalledTimes(2)
    // First call: landscape orientation
    expect(mockSearchPhotos.mock.calls[0]![2]).toMatchObject({ orientation: 'landscape' })
    // Second call: squarish orientation
    expect(mockSearchPhotos.mock.calls[1]![2]).toMatchObject({ orientation: 'squarish' })
  })

  it('deduplicates identical terms (product === mood adj)', async () => {
    mockSearchPhotos.mockResolvedValueOnce(landscapeFixture).mockResolvedValueOnce(squareFixture)
    // When product exactly matches a mood adjective, dedupe kicks in.
    const pool = await buildImagePool(
      baseCtx({ topProduct: 'candlelit', mood: THEME_MOODS.elegant }),
    )
    // elegant imagery[1] is "candlelit" — should appear once total
    const q = pool.queryUsed.toLowerCase()
    const matches = q.match(/candlelit/g) ?? []
    expect(matches.length).toBe(1)
  })

  it('query uses supplied product terms directly (GH-1185)', async () => {
    // Products arrive RAW from parseProductsString (no translation) and must
    // reach the query verbatim, without the category injected alongside.
    mockSearchPhotos.mockResolvedValueOnce(landscapeFixture).mockResolvedValueOnce(squareFixture)
    const pool = await buildImagePool({
      category: 'tech',
      products: ['software team', 'business dashboard'],
      seed: 1,
    })
    expect(pool.queryUsed).toContain('software team')
    expect(pool.queryUsed).toContain('business dashboard')
    // Category name must NOT be injected when product terms are present
    expect(pool.queryUsed).not.toContain('tech')
  })

  it('falls back to category name only when LLM fails (no products)', async () => {
    mockSearchPhotos.mockResolvedValueOnce(landscapeFixture).mockResolvedValueOnce(squareFixture)
    const pool = await buildImagePool({
      category: 'tech',
      seed: 1,
    })
    expect(pool.queryUsed).toBe('tech')
  })
})

// ── TC-F01-W.15: pickFromPool determinism ───────────────────────────────────

describe('TC-F01-W.15 — pickFromPool', () => {
  async function buildTestPool(): Promise<ImagePool> {
    mockSearchPhotos.mockResolvedValueOnce(landscapeFixture).mockResolvedValueOnce(squareFixture)
    return buildImagePool(baseCtx())
  }

  it('same (pool, role, seed) always returns same photo', async () => {
    const pool = await buildTestPool()
    const a = pickFromPool(pool, 'hero', 100)
    const b = pickFromPool(pool, 'hero', 100)
    const c = pickFromPool(pool, 'hero', 100)
    expect(a?.id).toBe(b?.id)
    expect(b?.id).toBe(c?.id)
  })

  it('different roles pick from correct bucket', async () => {
    const pool = await buildTestPool()
    const hero = pickFromPool(pool, 'hero', 1)
    const team = pickFromPool(pool, 'team', 1)

    // hero came from landscape bucket
    expect(pool.landscape.some((p) => p.id === hero?.id)).toBe(true)
    // team came from square bucket
    expect(pool.square.some((p) => p.id === team?.id)).toBe(true)
  })

  it('different roles at same seed pick DIFFERENT entries (role salt)', async () => {
    const pool = await buildTestPool()
    const hero = pickFromPool(pool, 'hero', 42)
    const gallery = pickFromPool(pool, 'gallery', 42)
    // Both map to landscape bucket, but different role salts → different indices
    // (may collide occasionally — assert not always equal across multiple seeds)
    const picks = new Set<string>()
    for (let s = 0; s < 10; s++) {
      picks.add(pickFromPool(pool, 'hero', s)?.id ?? '')
      picks.add(pickFromPool(pool, 'gallery', s)?.id ?? '')
    }
    expect(picks.size).toBeGreaterThan(5)
    void hero
    void gallery
  })

  it('returns undefined when bucket is empty', async () => {
    const emptyPool: ImagePool = {
      landscape: [],
      square: [],
      portrait: [],
      queryUsed: 'test',
      underfill: false,
    }
    expect(pickFromPool(emptyPool, 'hero', 42)).toBeUndefined()
  })

  it('"any" role defaults to landscape bucket', async () => {
    const pool = await buildTestPool()
    const pick = pickFromPool(pool, 'any', 1)
    expect(pool.landscape.some((p) => p.id === pick?.id)).toBe(true)
  })

  it('pickManyFromPool returns distinct photos up to bucket size', async () => {
    const pool = await buildTestPool()
    const picks = pickManyFromPool(pool, 'gallery', 10, 5)
    expect(picks).toHaveLength(5)
    const ids = new Set(picks.map((p) => p.id))
    expect(ids.size).toBe(5)
  })

  it('pickManyFromPool caps at bucket length when asked for too many', async () => {
    const pool = await buildTestPool()
    const picks = pickManyFromPool(pool, 'gallery', 1, 100)
    expect(picks.length).toBe(pool.landscape.length)
  })
})

// ── TC-F01-W.16: underfill backoff ──────────────────────────────────────────

describe('TC-F01-W.16 — underfill backoff', () => {
  it('retries with relaxed query when landscape underfills', async () => {
    // First landscape call returns 1 photo (underfill), retry with relaxed returns 5
    mockSearchPhotos
      .mockResolvedValueOnce([fakePhoto('L0', 1920, 1080)]) // initial landscape — underfill
      .mockResolvedValueOnce([fakePhoto('RL1', 1920, 1080), fakePhoto('RL2', 1920, 1080)]) // relaxed retry
      .mockResolvedValueOnce(squareFixture) // square OK first try

    const pool = await buildImagePool(baseCtx({ mood: THEME_MOODS.elegant }))

    expect(pool.underfill).toBe(true)
    expect(pool.landscape.length).toBeGreaterThanOrEqual(3)
  })

  it('pool.underfill = true when searchPhotos throws on all calls', async () => {
    mockSearchPhotos.mockRejectedValue(new Error('Unsplash 429'))
    const pool = await buildImagePool(baseCtx())
    expect(pool.underfill).toBe(true)
    expect(pool.landscape).toEqual([])
    expect(pool.square).toEqual([])
  })

  it('relaxed query broadens from product to category (raw keyword fallback)', async () => {
    mockSearchPhotos
      .mockResolvedValueOnce([fakePhoto('L0', 1920, 1080)]) // underfill initial
      .mockResolvedValueOnce([fakePhoto('RL1', 1920, 1080)]) // relaxed retry
      .mockResolvedValueOnce(squareFixture)

    await buildImagePool(baseCtx({ topProduct: 'ramen', mood: THEME_MOODS.elegant }))

    const initialQuery = mockSearchPhotos.mock.calls[0]![0] as string
    const relaxedQuery = mockSearchPhotos.mock.calls[1]![0] as string
    // Initial: raw product only = "ramen"
    // Relaxed with ≤1 term: falls back to category = "restaurant" (different query for retry)
    expect(initialQuery).toBe('ramen')
    expect(relaxedQuery).toBe('restaurant')
  })

  it('no retry when initial query already has sufficient results', async () => {
    mockSearchPhotos
      .mockResolvedValueOnce(landscapeFixture) // full
      .mockResolvedValueOnce(squareFixture) // full

    await buildImagePool(baseCtx())
    // Only 2 calls (no retry)
    expect(mockSearchPhotos).toHaveBeenCalledTimes(2)
  })

  it('pool.square borrows from landscape when squarish returns 0', async () => {
    // TC-F01-W.16 extension: landscape succeeds, squarish returns 0 on both
    // initial + relaxed retry → square bucket gets landscape photos as fallback.
    // This prevents media-injector from falling back to legacy search per block.
    mockSearchPhotos
      .mockResolvedValueOnce(landscapeFixture) // landscape OK
      .mockResolvedValueOnce([])               // squarish initial → 0
      .mockResolvedValueOnce([])               // squarish relaxed retry → 0

    const pool = await buildImagePool(baseCtx({ mood: THEME_MOODS.elegant }))

    expect(pool.underfill).toBe(true)
    expect(pool.landscape).toHaveLength(12)
    // Square gets landscape photos as fallback — not empty
    expect(pool.square.length).toBeGreaterThan(0)
    // IDs come from landscape fixture
    const landscapeIds = new Set(landscapeFixture.map((p) => p.id))
    expect(landscapeIds.has(pool.square[0]!.id)).toBe(true)
  })
})

// ── mergePool + poolSize helpers ────────────────────────────────────────────

describe('image-pool helpers', () => {
  const basePool: ImagePool = {
    landscape: [
      { id: 'a', url: '', alt: '', width: 1920, height: 1080, photographer: '', role: 'gallery', aspectRatio: '16:9' },
      { id: 'b', url: '', alt: '', width: 1920, height: 1080, photographer: '', role: 'gallery', aspectRatio: '16:9' },
    ],
    square: [],
    portrait: [],
    queryUsed: 'test',
    underfill: false,
  }

  it('mergePool dedupes by id', () => {
    const merged = mergePool(basePool, {
      landscape: [
        { id: 'a', url: '', alt: '', width: 1920, height: 1080, photographer: '', role: 'gallery', aspectRatio: '16:9' }, // duplicate
        { id: 'c', url: '', alt: '', width: 1920, height: 1080, photographer: '', role: 'gallery', aspectRatio: '16:9' }, // new
      ],
    })
    expect(merged.landscape.map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })

  it('mergePool propagates underfill flag', () => {
    const merged = mergePool(basePool, { underfill: true })
    expect(merged.underfill).toBe(true)
  })

  it('poolSize counts all buckets', () => {
    expect(poolSize(basePool)).toBe(2)
    const withSquare: ImagePool = {
      ...basePool,
      square: [
        { id: 's1', url: '', alt: '', width: 1000, height: 1000, photographer: '', role: 'team', aspectRatio: '1:1' },
      ],
    }
    expect(poolSize(withSquare)).toBe(3)
  })
})

describe('TC-F01-W.17 — integration cohesion spy', () => {
  it('5 runs with same seed call searchPhotos exactly 2× each (no underfill)', async () => {
    for (let i = 0; i < 5; i++) {
      mockSearchPhotos
        .mockResolvedValueOnce(landscapeFixture)
        .mockResolvedValueOnce(squareFixture)
      await buildImagePool(baseCtx({ seed: i }))
    }
    // 5 runs × 2 calls each = 10 total
    expect(mockSearchPhotos).toHaveBeenCalledTimes(10)
  })

  it('query string is stable across same-seed reruns', async () => {
    mockSearchPhotos.mockResolvedValue(landscapeFixture)

    const a = await buildImagePool(baseCtx({ seed: 42 }))
    mockSearchPhotos.mockClear()
    mockSearchPhotos.mockResolvedValue(landscapeFixture)
    const b = await buildImagePool(baseCtx({ seed: 42 }))

    expect(a.queryUsed).toBe(b.queryUsed)
  })
})

// ── TC-F38-RAW: Raw keyword regression tests (GH-1185) ──────────────────────

describe('TC-F38-RAW — raw keyword path (Pixabay + VN keywords)', () => {
  // TC-F38-RAW-01: raw products → q contains raw terms only, no EN adjective/category
  it('[TC-F38-RAW-01] buildPoolQuery with raw VN products returns raw terms only', () => {
    const q = buildPoolQuery({
      category: 'restaurant',
      mood: THEME_MOODS.elegant,
      products: ['phở bò', 'gỏi cuốn'],
      seed: 1,
    })
    expect(q).toBe('phở bò gỏi cuốn')
    // No English adjectives or category name
    expect(/refined|candlelit|marble|elegant|restaurant/.test(q)).toBe(false)
  })

  // TC-F38-RAW-02: no products → scaffolding path with category
  it('[TC-F38-RAW-02] buildPoolQuery without products uses category (scaffolding)', () => {
    const q = buildPoolQuery({
      category: 'restaurant',
      mood: THEME_MOODS.elegant,
      seed: 1,
    })
    expect(q).toContain('restaurant')
    // Scaffolding includes mood adjective
    expect(/refined|candlelit|marble|timeless|soft natural/.test(q)).toBe(true)
  })

  // TC-F38-RAW-03: relaxed with 2+ products → broadens to products[0] only
  it('[TC-F38-RAW-03] buildPoolQuery relaxed with multiple products uses first only', () => {
    const initialQ = buildPoolQuery({
      category: 'restaurant',
      mood: THEME_MOODS.elegant,
      products: ['phở bò', 'gỏi cuốn'],
      seed: 1,
    }, false)

    const relaxedQ = buildPoolQuery({
      category: 'restaurant',
      mood: THEME_MOODS.elegant,
      products: ['phở bò', 'gỏi cuốn'],
      seed: 1,
    }, true)

    expect(initialQ).toBe('phở bò gỏi cuốn')
    expect(relaxedQ).toBe('phở bò')
    expect(relaxedQ.length).toBeLessThan(initialQ.length)
  })

  // TC-F38-RAW-04: englishKeywords (raw path) returns raw only, no modifier/mood
  it('[TC-F38-RAW-04] deriveKeywords with raw englishKeywords returns verbatim', () => {
    const keywords = deriveKeywords('restaurant', 'hero', {
      englishKeywords: ['phở bò'],
      mood: THEME_MOODS.elegant,
    })
    // GH-1185: raw keyword → return verbatim, no mood/modifier/base appended
    expect(keywords).toEqual(['phở bò'])
    expect(keywords.length).toBe(1)
  })

  // TC-F38-RAW-05: no raw keywords → scaffolding with category + modifier
  it('[TC-F38-RAW-05] deriveKeywords without raw keywords uses scaffolding', () => {
    const keywords = deriveKeywords('restaurant', 'team', {
      mood: THEME_MOODS.elegant,
    })
    // Scaffolding path: category base + modifier + mood
    expect(keywords.length).toBeGreaterThan(1)
    // Should include mood imagery adjectives
    const q = keywords.join(' ').toLowerCase()
    expect(/refined|candlelit|marble|timeless|soft natural/.test(q)).toBe(true)
  })

  // TC-F38-RAW-06: raw VN keyword reaches searchPhotos verbatim.
  // URL-level behavior (lang=vi auto-detect for VN queries, no lang for
  // EN/MS) is asserted at the client level in pixabay-client.test.ts —
  // searchPhotos is mocked here so the URL is not observable.
  it('[TC-F38-RAW-06] searchPhotos receives raw VN q verbatim', async () => {
    mockSearchPhotos.mockResolvedValueOnce(landscapeFixture).mockResolvedValueOnce(squareFixture)

    await buildImagePool({
      category: 'restaurant',
      mood: THEME_MOODS.elegant,
      products: ['phở bò'],
      seed: 1,
    })

    // First call is landscape search with raw q
    // (searchPhotos signature: (query, count, opts))
    const firstCall = mockSearchPhotos.mock.calls[0]!
    const query = firstCall[0] as string
    const opts = firstCall[2] as Record<string, unknown>

    expect(query).toBe('phở bò')
    expect(opts.orientation).toBe('landscape')
  })
})

// ── TC-F01-W.18: bucket sizing — skip zero-size buckets ─────────────────────
describe('TC-F01-W.18 — buildImagePool honors explicit bucket sizes', () => {
  it('squareSize 0 → only the landscape Pixabay call runs (no square search)', async () => {
    mockSearchPhotos.mockResolvedValueOnce(landscapeFixture.slice(0, 3))
    const pool = await buildImagePool(baseCtx({ landscapeSize: 3, squareSize: 0 }))
    expect(mockSearchPhotos).toHaveBeenCalledTimes(1)
    expect(mockSearchPhotos.mock.calls[0]![2]).toMatchObject({ orientation: 'landscape' })
    // count arg forwarded from landscapeSize
    expect(mockSearchPhotos.mock.calls[0]![1]).toBe(3)
    // square bucket empty (not reused-from-landscape when size is 0)
    expect(pool.square.length).toBe(0)
    expect(pool.landscape.length).toBe(3)
  })

  it('both sizes 0 → zero Pixabay calls, empty pool, underfill stays false (intentional skip)', async () => {
    const pool = await buildImagePool(baseCtx({ landscapeSize: 0, squareSize: 0 }))
    expect(mockSearchPhotos).not.toHaveBeenCalled()
    expect(pool.landscape.length).toBe(0)
    expect(pool.square.length).toBe(0)
    expect(pool.underfill).toBe(false)
  })
})

// ── TC-F38-RAW-23: non-VN tier-3 category fallback (GH-1185 Malay gap) ──────
describe('TC-F38-RAW-23 — non-VN zero-hit falls back to EN category base keyword', () => {
  it('Malay keywords 0-hit on primary + relaxed → tier-3 queries CATEGORY_BASE_KEYWORDS[category][0]', async () => {
    // Arrange — Malay office-supplies terms have no Pixabay tag coverage:
    // primary (all terms joined, AND-matched) and relaxed (first term) both
    // return 0. Pre-fix, non-VN queries had NO tier-3 → empty pool → GPT's
    // hallucinated stock URLs survived injection untouched.
    mockSearchPhotos
      .mockResolvedValueOnce([]) // primary landscape
      .mockResolvedValueOnce([]) // relaxed landscape
      .mockResolvedValueOnce(landscapeFixture) // tier-3 landscape

    // Act — squareSize 0 keeps the mock queue landscape-only.
    const pool = await buildImagePool(baseCtx({
      category: 'ecommerce',
      topProduct: undefined,
      products: ['pen dan pensel', 'buku nota'],
      mood: undefined,
      squareSize: 0,
    }))

    // Assert — tier-3 query = EN category base keyword, default lang (no vi)
    expect(mockSearchPhotos).toHaveBeenCalledTimes(3)
    expect(mockSearchPhotos.mock.calls[2]![0]).toBe('product photography')
    const tier3Opts = mockSearchPhotos.mock.calls[2]![2] as { lang?: string }
    expect(tier3Opts.lang).toBeUndefined()
    expect(pool.landscape.length).toBeGreaterThan(0)
    expect(pool.underfill).toBe(true)
  })

  it('VN zero-hit still uses curated VN phrase with lang=vi (unchanged)', async () => {
    // Arrange
    mockSearchPhotos
      .mockResolvedValueOnce([]) // primary landscape
      .mockResolvedValueOnce([]) // relaxed landscape (broadens to category)
      .mockResolvedValueOnce(landscapeFixture) // tier-3 landscape

    // Act
    await buildImagePool(baseCtx({
      category: 'restaurant',
      topProduct: 'phở bò',
      mood: undefined,
      squareSize: 0,
    }))

    // Assert — VN path unchanged: curated phrase + explicit lang=vi
    expect(mockSearchPhotos).toHaveBeenCalledTimes(3)
    expect(mockSearchPhotos.mock.calls[2]![0]).toBe('ẩm thực việt nam')
    const tier3Opts = mockSearchPhotos.mock.calls[2]![2] as { lang?: string }
    expect(tier3Opts.lang).toBe('vi')
  })
})

// ── TC-F38-RAW-25: 429 short-circuits the fallback ladder ───────────────────
describe('TC-F38-RAW-25 — RATE_LIMITED short-circuits the pool fallback ladder', () => {
  it('tier-1 RATE_LIMITED → no tier-2/tier-3 calls, underfill=true', async () => {
    // Arrange — Pixabay rate-limits the primary search (already retried once
    // inside the client). Any further tier is a guaranteed-fail request.
    mockSearchPhotos.mockRejectedValueOnce(new PixabayError('RATE_LIMITED', 429, true))

    // Act
    const pool = await buildImagePool(baseCtx({ squareSize: 0 }))

    // Assert — ladder stops after tier-1
    expect(mockSearchPhotos).toHaveBeenCalledTimes(1)
    expect(pool.landscape).toEqual([])
    expect(pool.underfill).toBe(true)
  })

  it('tier-2 RATE_LIMITED → tier-3 skipped, tier-1 partial photos preserved', async () => {
    // Arrange — tier-1 returns a thin (below-minCount) result, tier-2 429s.
    mockSearchPhotos
      .mockResolvedValueOnce([fakePhoto('L0', 1920, 1080)]) // tier-1: partial
      .mockRejectedValueOnce(new PixabayError('RATE_LIMITED', 429, true)) // tier-2

    // Act
    const pool = await buildImagePool(baseCtx({ squareSize: 0 }))

    // Assert — no tier-3 call after the 429; the partial result is kept
    expect(mockSearchPhotos).toHaveBeenCalledTimes(2)
    expect(pool.landscape.map((p) => p.id)).toEqual(['L0'])
    expect(pool.underfill).toBe(true)
  })

  it('non-429 tier-1 error → ladder continues to tier-2 and tier-3', async () => {
    // Arrange — transient server error must NOT abort the ladder
    mockSearchPhotos
      .mockRejectedValueOnce(new PixabayError('SERVER_ERROR', 500, true)) // tier-1
      .mockResolvedValueOnce([]) // tier-2: 0 hits
      .mockResolvedValueOnce(landscapeFixture) // tier-3

    // Act
    const pool = await buildImagePool(baseCtx({ squareSize: 0 }))

    // Assert — all 3 tiers fired, tier-3 filled the bucket
    expect(mockSearchPhotos).toHaveBeenCalledTimes(3)
    expect(pool.landscape.length).toBeGreaterThan(0)
    expect(pool.underfill).toBe(true)
  })
})
