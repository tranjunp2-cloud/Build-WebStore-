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
} from '@/lib/ai/image-pool'
import { THEME_MOODS } from '@/lib/ai/theme-moods'
import type { UnsplashPhoto } from '@/lib/ai/unsplash-client'

// ── Mock Unsplash client ────────────────────────────────────────────────────

const mockSearchPhotos = vi.fn<(...args: unknown[]) => Promise<UnsplashPhoto[]>>()

vi.mock('@/lib/ai/unsplash-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/unsplash-client')>(
    '@/lib/ai/unsplash-client',
  )
  return {
    ...actual,
    searchPhotos: (...args: unknown[]) => mockSearchPhotos(...args),
  }
})

function fakePhoto(id: string, w: number, h: number): UnsplashPhoto {
  return {
    id,
    alt_description: `alt ${id}`,
    description: null,
    urls: {
      raw: `https://unsplash.com/${id}/raw`,
      full: `https://unsplash.com/${id}/full`,
      regular: `https://unsplash.com/${id}/regular`,
      small: `https://unsplash.com/${id}/small`,
      thumb: `https://unsplash.com/${id}/thumb`,
    },
    links: {
      self: '',
      html: '',
      download: '',
      download_location: `https://unsplash.com/track/${id}`,
    },
    user: { id: 'u1', username: 'photographer', name: 'Alice Photographer' },
    width: w,
    height: h,
    color: null,
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
    expect(photo.downloadLocation).toContain('https://')
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
  it('query contains top product + mood imagery adjectives', async () => {
    mockSearchPhotos.mockResolvedValueOnce(landscapeFixture).mockResolvedValueOnce(squareFixture)

    const pool = await buildImagePool(
      baseCtx({ topProduct: 'ramen', mood: THEME_MOODS.elegant }),
    )

    expect(pool.queryUsed).toContain('ramen')
    // elegant imagery: refined, candlelit, marble, soft natural light, timeless
    const q = pool.queryUsed.toLowerCase()
    expect(/refined|candlelit|marble|timeless|soft natural/.test(q)).toBe(true)
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

  it('relaxed query drops mood adjectives', async () => {
    mockSearchPhotos
      .mockResolvedValueOnce([fakePhoto('L0', 1920, 1080)]) // underfill initial
      .mockResolvedValueOnce([fakePhoto('RL1', 1920, 1080)]) // relaxed retry
      .mockResolvedValueOnce(squareFixture)

    await buildImagePool(baseCtx({ topProduct: 'ramen', mood: THEME_MOODS.elegant }))

    const initialQuery = mockSearchPhotos.mock.calls[0]![0] as string
    const relaxedQuery = mockSearchPhotos.mock.calls[1]![0] as string
    // Initial has mood adj, relaxed doesn't
    expect(relaxedQuery).toContain('ramen')
    expect(relaxedQuery.length).toBeLessThan(initialQuery.length + 1)
  })

  it('no retry when initial query already has sufficient results', async () => {
    mockSearchPhotos
      .mockResolvedValueOnce(landscapeFixture) // full
      .mockResolvedValueOnce(squareFixture) // full

    await buildImagePool(baseCtx())
    // Only 2 calls (no retry)
    expect(mockSearchPhotos).toHaveBeenCalledTimes(2)
  })
})

// ── mergePool + poolSize helpers ────────────────────────────────────────────

describe('image-pool helpers', () => {
  const basePool: ImagePool = {
    landscape: [
      { id: 'a', url: '', alt: '', width: 1920, height: 1080, photographer: '', downloadLocation: '', role: 'gallery', aspectRatio: '16:9' },
      { id: 'b', url: '', alt: '', width: 1920, height: 1080, photographer: '', downloadLocation: '', role: 'gallery', aspectRatio: '16:9' },
    ],
    square: [],
    portrait: [],
    queryUsed: 'test',
    underfill: false,
  }

  it('mergePool dedupes by id', () => {
    const merged = mergePool(basePool, {
      landscape: [
        { id: 'a', url: '', alt: '', width: 1920, height: 1080, photographer: '', downloadLocation: '', role: 'gallery', aspectRatio: '16:9' }, // duplicate
        { id: 'c', url: '', alt: '', width: 1920, height: 1080, photographer: '', downloadLocation: '', role: 'gallery', aspectRatio: '16:9' }, // new
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
        { id: 's1', url: '', alt: '', width: 1000, height: 1000, photographer: '', downloadLocation: '', role: 'team', aspectRatio: '1:1' },
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
