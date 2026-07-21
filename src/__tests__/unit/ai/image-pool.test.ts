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
  backfillImagePool,
  pickFromPool,
  pickManyFromPool,
  mergePool,
  poolSize,
  type ImagePool,
  type PoolPhoto,
  type BuildPoolCtx,
  buildPoolQuery,
  buildPoolTerms,
  buildGateTerms,
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

// GH-1611: `alt` carries the Pixabay TAGS, and the relevance gate now runs for
// every language (it used to run for Vietnamese only). A fixture tagged
// "alt L0" is a photo Pixabay would never return for q="ramen" — the tags must
// match the query under test or the gate correctly throws the photo away.
const RAMEN_TAGS = 'ramen, noodle soup, japanese food'

function fakePhoto(id: string, w: number, h: number, alt: string = RAMEN_TAGS): PixabayPhoto {
  return {
    id,
    url: `https://pixabay.com/get/${id}_1280.jpg`,
    alt,
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

  it('query uses the category PHRASE when no product + no mood (GH-1611)', async () => {
    mockSearchPhotos.mockResolvedValueOnce(landscapeFixture).mockResolvedValueOnce(squareFixture)
    const pool = await buildImagePool({
      category: 'beauty',
      seed: 1,
    })
    // GH-1611: the composer key ('beauty', and worse: 'fnb', 'realestate') is an
    // internal identifier, not a word photos are tagged with. Search with the
    // category's natural-language phrase instead.
    expect(pool.queryUsed).toBe('spa treatment')
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

  it('falls back to the category phrase when LLM fails (no products) — GH-1611', async () => {
    mockSearchPhotos.mockResolvedValueOnce(landscapeFixture).mockResolvedValueOnce(squareFixture)
    const pool = await buildImagePool({
      category: 'tech',
      seed: 1,
    })
    // Was 'tech' (the composer key). Pixabay tags photos "modern office", never "tech".
    expect(pool.queryUsed).toBe('modern office')
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
    // First landscape call returns 1 photo (underfill), retry with relaxed returns 2.
    // GH-1611: even though the SEARCH broadens to the category phrase, accepted
    // photos must still match the merchant's product term.
    mockSearchPhotos
      .mockResolvedValueOnce([fakePhoto('L0', 1920, 1080)]) // initial landscape — underfill
      .mockResolvedValueOnce([
        fakePhoto('RL1', 1920, 1080, RAMEN_TAGS),
        fakePhoto('RL2', 1920, 1080, RAMEN_TAGS),
      ]) // relaxed retry
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

  it('relaxed query broadens from product to the category PHRASE (GH-1611)', async () => {
    mockSearchPhotos
      .mockResolvedValueOnce([fakePhoto('L0', 1920, 1080)]) // underfill initial
      .mockResolvedValueOnce([fakePhoto('RL1', 1920, 1080, 'restaurant interior, dining')]) // relaxed retry
      .mockResolvedValueOnce(squareFixture)

    await buildImagePool(baseCtx({ topProduct: 'ramen', mood: THEME_MOODS.elegant }))

    const initialQuery = mockSearchPhotos.mock.calls[0]![0] as string
    const relaxedQuery = mockSearchPhotos.mock.calls[1]![0] as string
    // Initial: raw product only = "ramen"
    // Relaxed with ≤1 term: broadens to the category PHRASE. Was the bare composer
    // key ('restaurant'), which for 'fnb'/'realestate' is not a searchable word at
    // all — q="fnb" returns nothing, and q="business" (the fnb→business drift)
    // returned retail/fashion stock. Hence "restaurant interior", not "restaurant".
    expect(initialQuery).toBe('ramen')
    expect(relaxedQuery).toBe('restaurant interior')
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

  it('[TC-GENPERF-W3-13] backfills the exact deficit without reusing existing source IDs', async () => {
    const initial: ImagePool = {
      landscape: landscapeFixture.slice(0, 6).map((photo) => ({
        ...photo,
        alt: photo.alt ?? '',
        role: 'gallery' as const,
        aspectRatio: '16:9' as const,
      })),
      square: [],
      portrait: [],
      queryUsed: 'ramen',
      underfill: true,
    }
    mockSearchPhotos.mockResolvedValueOnce(landscapeFixture.slice(0, 9))

    const result = await backfillImagePool(initial, baseCtx({ squareSize: 0 }), {
      landscape: 9,
      square: 0,
    })

    expect(mockSearchPhotos).toHaveBeenCalledTimes(1)
    expect(mockSearchPhotos.mock.calls[0]![1]).toBe(9)
    expect(result.added.landscape.map((photo) => photo.id)).toEqual(['L6', 'L7', 'L8'])
    expect(result.pool.landscape.map((photo) => photo.id)).toEqual([
      'L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8',
    ])
  })

  it('[TC-GENPERF-W3-14] skips Pixabay when the speculative pool already meets actual slots', async () => {
    const result = await backfillImagePool(basePool, baseCtx(), { landscape: 2, square: 0 })
    expect(mockSearchPhotos).not.toHaveBeenCalled()
    expect(result.pool).toBe(basePool)
    expect(result.added.landscape).toEqual([])
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
    // Tier-3 fixture carries the tags Pixabay actually returns for the curated
    // ecommerce phrase. `ecommerce` has NO Pixabay category filter, so the curated
    // tier is gated on its own phrase (GH-1611) — a fixture tagged with anything
    // else would be (correctly) thrown away and would only be testing the gate.
    const productPhotoFixture = Array.from({ length: 12 }, (_, i) =>
      fakePhoto(`P${i}`, 1920, 1080, i === 0 ? 'pen, pensel, product photography, studio' : 'product photography, studio, packaging'),
    )
    mockSearchPhotos
      .mockResolvedValueOnce([]) // primary landscape
      .mockResolvedValueOnce([]) // relaxed landscape
      .mockResolvedValueOnce(productPhotoFixture) // tier-3 landscape

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
describe('TC-F38-RAW-25 — provider outage short-circuits the pool fallback ladder', () => {
  it('tier-1 RATE_LIMITED → no tier-2/tier-3 calls, underfill=true', async () => {
    // Arrange — any further tier is a guaranteed-fail request.
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

  it('tier-1 SERVER_ERROR → no retry ladder', async () => {
    mockSearchPhotos.mockRejectedValueOnce(new PixabayError('SERVER_ERROR', 503, true))

    // Act
    const pool = await buildImagePool(
      baseCtx({ squareSize: 0, topProduct: undefined, products: ['ramen', 'gyoza'] }),
    )

    expect(mockSearchPhotos).toHaveBeenCalledTimes(1)
    expect(pool.landscape).toEqual([])
    expect(pool.underfill).toBe(true)
  })
})

// ── GH-1611: cross-industry photos must never reach the pool ────────────────

describe('TC-GH1611 — industry-correct pool (bakery gallery got clothing photos)', () => {
  // The reported gen: F&B / bakery, product "bánh", translated to EN before the
  // pool search (GEN_TRANSLATE_POOL_KEYWORDS is on by default).
  const BAKERY_CTX = (over: Partial<BuildPoolCtx> = {}): BuildPoolCtx => ({
    category: 'fnb',
    products: ['chocolate birthday cake', 'frosted cupcake'],
    seed: 7,
    squareSize: 0,
    ...over,
  })
  const CAKE = (id: string) => fakePhoto(id, 1920, 1080, 'cake, chocolate, dessert')
  const CLOTHES = (id: string) => fakePhoto(id, 1920, 1080, 'jeans, knit hat, flatlay')

  it('[TC-GH1611-01] gate drops off-industry photos from an ENGLISH query', async () => {
    // Before: the gate only ran for Vietnamese queries, but the pool query is
    // English by default → gate never ran → clothing photos entered the pool.
    mockSearchPhotos.mockResolvedValueOnce([
      CAKE('c1'), CLOTHES('x1'), CAKE('c2'), CLOTHES('x2'),
    ])

    const pool = await buildImagePool(BAKERY_CTX())

    expect(pool.landscape.map((p) => p.id)).toEqual(['c1', 'c2'])
  })

  it('[TC-GH1611-02] keeps the product, drops the look-alike', async () => {
    // Head noun + a modifier → the product. Modifiers alone (a balloon party that
    // happens to be tagged "birthday, chocolate") → not the product.
    mockSearchPhotos.mockResolvedValueOnce([
      fakePhoto('c1', 1920, 1080, 'cake, chocolate, dessert'),
      fakePhoto('x1', 1920, 1080, 'birthday, chocolate, balloons'),
    ])

    const pool = await buildImagePool(BAKERY_CTX({ landscapeSize: 1 }))

    expect(pool.landscape.map((p) => p.id)).toEqual(['c1'])
  })

  it('[TC-GH1611-03] a multi-product query does not demand one photo satisfy every product', async () => {
    // The query is "chocolate birthday cake frosted cupcake". AND-matching the
    // joined string would require a single photo be both a cake AND a cupcake —
    // no photo is, so every on-industry photo was dropped and the pool fell
    // through to the off-industry fallback tiers.
    mockSearchPhotos.mockResolvedValueOnce([
      CAKE('c1'),
      fakePhoto('c2', 1920, 1080, 'cupcake, frosted, bakery'),
    ])

    const pool = await buildImagePool(BAKERY_CTX())

    expect(pool.landscape).toHaveLength(2)
  })

  it('[TC-GH1611-04] bucket is not "filled" until the hungriest block (gallery=6) can be served', async () => {
    // landscapeMin=6 (gallery). Tier-1 returns 4 → the ladder MUST keep going.
    // Before: minCount was half the bucket (4 of 9) → ladder stopped → gallery
    // came up 2 short → media-injector patched the deficit off-pool and appended
    // those photos last ⇒ "first 4 right, last 2 wrong".
    mockSearchPhotos
      .mockResolvedValueOnce([CAKE('c1'), CAKE('c2'), CAKE('c3'), CAKE('c4')]) // tier-1: 4 < 6
      .mockResolvedValueOnce([CAKE('c5'), CAKE('c6')]) // tier-2

    const pool = await buildImagePool(BAKERY_CTX({ landscapeSize: 9, landscapeMin: 6 }))

    expect(mockSearchPhotos.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(pool.landscape).toHaveLength(6)
  })

  it('[TC-GH1611-05] tier-2 broadens to a searchable phrase, never the composer key', async () => {
    // q="fnb" returns nothing on Pixabay — 'fnb' is an internal key, not a tag.
    mockSearchPhotos
      .mockResolvedValueOnce([]) // tier-1 empty → force tier-2
      .mockResolvedValueOnce([])

    await buildImagePool(BAKERY_CTX({ products: ['banh mi'] }))

    const queries = mockSearchPhotos.mock.calls.map((c) => c[0] as string)
    expect(queries).not.toContain('fnb')
    expect(queries).toContain('coffee shop') // CATEGORY_BASE_KEYWORDS.fnb[0]
  })

  it('[TC-GH1611-07] tiers merge by photo id — a repeat hit never counts twice', async () => {
    // The broadened tier re-returns the primary tier's top hits. Concatenating
    // them let one photo count twice toward minCount: the bucket "reached" 6
    // while holding 4 distinct photos, so the gallery rendered the same cake
    // twice and still came up short.
    mockSearchPhotos
      .mockResolvedValueOnce([CAKE('c1'), CAKE('c2')]) // tier-1: 2 < min 6
      .mockResolvedValueOnce([CAKE('c1'), CAKE('c2'), CAKE('c3')]) // tier-2 repeats c1,c2
      .mockResolvedValueOnce([CAKE('c3'), CAKE('c4')]) // tier-3 repeats c3

    const pool = await buildImagePool(BAKERY_CTX({ landscapeSize: 9, landscapeMin: 6 }))

    expect(pool.landscape.map((p) => p.id)).toEqual(['c1', 'c2', 'c3', 'c4'])
  })

  it('[TC-GH1611-08] mood adjectives are search terms, never gate terms', async () => {
    // buildPoolTerms may carry a mood adjective to bias Pixabay's ranking, but the
    // gate must not judge on it: a 1-word term needs one hit, so "minimalist" would
    // admit the clothing flatlay from the bug report into an F&B pool.
    const ctx: BuildPoolCtx = {
      category: 'fnb',
      products: ['chocolate birthday cake'],
      mood: THEME_MOODS.elegant,
      seed: 3,
      squareSize: 0,
    }
    expect(buildGateTerms(ctx)).toEqual(['chocolate birthday cake']) // no adjectives

    mockSearchPhotos.mockResolvedValue([
      fakePhoto('x1', 1920, 1080, 'jeans, flatlay, minimalist'),
      CAKE('c1'),
    ])
    // landscapeSize 1 → tier-1 alone fills the bucket, so this asserts the PRODUCT
    // gate in isolation (the curated tiers have their own trust rules).
    const pool = await buildImagePool({ ...ctx, landscapeSize: 1 })
    expect(pool.landscape.map((p) => p.id)).not.toContain('x1')
  })

  it('[TC-GH1611-09] no products → no gate (the query IS the curated category phrase)', async () => {
    // Gating the curated phrase against itself empties the bucket and there is no
    // lower tier to recover from: tier-2 and tier-3 are the same query, so they are
    // skipped. The Pixabay `category` filter is the domain guard on this path.
    mockSearchPhotos.mockResolvedValue([
      fakePhoto('s1', 1920, 1080, 'wellness, massage, relax'), // real spa photo, no query word
      fakePhoto('s2', 1920, 1080, 'sauna, towel, candle'),
    ])

    const pool = await buildImagePool({ category: 'beauty', seed: 1, squareSize: 0 })

    expect(pool.queryUsed).toBe('spa treatment')
    expect(pool.landscape.map((p) => p.id)).toEqual(['s1', 's2']) // not emptied
  })

  it('[TC-GH1611-10] single-product ladder stops after a tier-2 provider outage', async () => {
    mockSearchPhotos
      .mockResolvedValueOnce([]) // tier-1: 0 hits
      .mockRejectedValueOnce(new PixabayError('SERVER_ERROR', 500, true)) // tier-2 transient

    const pool = await buildImagePool({
      category: 'fnb',
      products: ['chocolate birthday cake'],
      seed: 5,
      squareSize: 0,
    })

    expect(mockSearchPhotos).toHaveBeenCalledTimes(2)
    expect(pool.landscape).toEqual([])
  })

  it('[TC-GH1611-11] bucket never exceeds its size (every pool photo is downloaded + uploaded)', async () => {
    mockSearchPhotos.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => CAKE(`c${i}`)),
    )
    const pool = await buildImagePool(BAKERY_CTX({ landscapeSize: 5, landscapeMin: 5 }))
    expect(pool.landscape).toHaveLength(5)
  })

  it('[TC-GH1611-12] curated tier is gated when the category has NO Pixabay filter', async () => {
    // ecommerce/creative/events/blog have no Pixabay category equivalent (see
    // PIXABAY_CATEGORY_BY_COMPOSER), so nothing constrains the curated fallback
    // server-side. ecommerce's phrase is "product photography" — its top hits are
    // exactly the clothing flatlays from this bug report.
    mockSearchPhotos
      .mockResolvedValueOnce([]) // tier-1: product query, 0 hits
      .mockResolvedValue([
        fakePhoto('x1', 1920, 1080, 'jeans, knit hat, flatlay'), // off-phrase
        fakePhoto('p1', 1920, 1080, 'leather handbag, product photography, studio, light'),
      ])

    const pool = await buildImagePool({
      category: 'ecommerce',
      products: ['leather handbag'],
      seed: 2,
      squareSize: 0,
    })

    expect(pool.landscape.map((p) => p.id)).toEqual(['p1'])
  })

  it('[TC-GH1611-06] buildPoolTerms keeps term boundaries that buildPoolQuery flattens', () => {
    const ctx = BAKERY_CTX()
    expect(buildPoolTerms(ctx)).toEqual(['chocolate birthday cake', 'frosted cupcake'])
    expect(buildPoolQuery(ctx)).toBe('chocolate birthday cake frosted cupcake')
  })

  it('[TC-GH1611-13] an empty bucket is preferred over an ungated off-domain photo', async () => {
    // The gate must have NO escape hatch. `ecommerce` has no Pixabay category filter,
    // so if every tier is gated out, re-admitting the rejects "to avoid an empty
    // bucket" hands the pool the exact clothing flatlays of GH-1611. An empty bucket
    // is safe: cleanupNonNumericImageFields drops the unfilled field and the block
    // renders the curated on-industry IMAGE_LIBRARY image instead.
    mockSearchPhotos
      .mockResolvedValueOnce([fakePhoto('x1', 1920, 1080, 'jeans, flatlay, minimalist')]) // primary
      .mockResolvedValueOnce([fakePhoto('x2', 1920, 1080, 'shirt, rack, store')]) // relaxed
      .mockResolvedValueOnce([fakePhoto('x3', 1920, 1080, 'denim, hat, fashion')]) // curated tier

    const pool = await buildImagePool({
      category: 'ecommerce',
      products: ['leather handbag'],
      seed: 3,
      squareSize: 0,
    })

    expect(pool.landscape).toEqual([])
    expect(pool.underfill).toBe(true)
  })

  it('[TC-GH1611-14] the gate trusts user products only, never LLM-extracted keywords', async () => {
    // route.ts merges extractImageKeywords' output into `products` for the SEARCH
    // query. Those terms are LLM-generated and may be adjectives — and a 1-word gate
    // term needs a single tag hit, so gating on "minimalist" would admit a photo
    // tagged "jeans, flatlay, minimalist" into a bakery's pool. `gateProducts` pins
    // the gate to what the merchant actually typed.
    mockSearchPhotos
      .mockResolvedValueOnce([
        fakePhoto('j1', 1920, 1080, 'jeans, flatlay, minimalist'),
        fakePhoto('c1', 1920, 1080, 'cake, chocolate, dessert'),
      ]) // primary — the only tier the product gate polices
      .mockResolvedValue([]) // later tiers: nothing to add

    const pool = await buildImagePool({
      category: 'fnb',
      products: ['chocolate cake', 'minimalist'], // 2nd term came from the LLM
      gateProducts: ['chocolate cake'], // ...and is not trusted by the gate
      seed: 4,
      squareSize: 0,
    })

    expect(pool.landscape.map((p) => p.id)).toEqual(['c1'])
  })
  it('[TC-GH1611-15] fallback is gated by product terms when products are provided (rejecting lookalike clothing)', async () => {
    const clothingHit = fakePhoto('x1', 1920, 1080, 'dress, clothing, product photography')
    const handbagHit = fakePhoto('h1', 1920, 1080, 'leather handbag, product photography')

    mockSearchPhotos
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([clothingHit, handbagHit])

    const pool = await buildImagePool({
      category: 'ecommerce',
      products: ['leather handbag'],
      seed: 5,
      squareSize: 0,
    })

    expect(pool.landscape.map((p) => p.id)).toEqual(['h1'])
  })

  it('[TC-GH1611-16] unmapped category with empty products rejects all photos (returning empty bucket to use curated fallback)', async () => {
    const lookalikeClothing = fakePhoto('x1', 1920, 1080, 'dress, clothing, product photography')
    const productPhoto = fakePhoto('p1', 1920, 1080, 'product photography, watch, isolated')

    mockSearchPhotos
      .mockResolvedValueOnce([lookalikeClothing, productPhoto])

    const pool = await buildImagePool({
      category: 'ecommerce',
      products: [],
      gateProducts: [],
      seed: 6,
      squareSize: 0,
    })

    expect(pool.landscape).toEqual([])
  })

  it('[TC-GH1611-17] mapped F&B fallback still rejects food from the wrong product', async () => {
    // Arrange
    mockSearchPhotos
      .mockResolvedValueOnce([]) // primary product query underfills
      .mockResolvedValueOnce([
        fakePhoto('s1', 1920, 1080, 'sushi, salmon, japanese food'),
        fakePhoto('c1', 1920, 1080, 'chocolate cake, bakery, dessert'),
      ]) // relaxed category query returns mixed food products

    // Act
    const pool = await buildImagePool({
      category: 'fnb',
      products: ['chocolate cake'],
      seed: 7,
      squareSize: 0,
    })

    // Assert
    expect(pool.landscape.map((photo) => photo.id)).toEqual(['c1'])
  })
})
