// @vitest-environment node
/**
 * TC-GENPERF-W2-06 / W2-09 — batchFetchFromPool consumption of the
 * pre-uploaded pool map (Phase 06, plan 260703-1341-gen-perf-async-parallel).
 *
 * Real seam: imports batchFetchFromPool from source; mocks ONLY the
 * pixabay-client download boundary + payload. Mutation contract: disabling
 * the preUploadedPool consumption in media-pipeline.ts MUST fail W2-06.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { batchFetchFromPool, getCuratedMediaForBlock, type MediaPipelineContext } from '@/lib/ai/media-pipeline'

vi.mock('@/lib/ai/pixabay-client', () => ({
    searchPhotos: vi.fn(),
    downloadPhotoBuffer: vi.fn().mockResolvedValue({
        buffer: Buffer.from('img'),
        mimetype: 'image/jpeg',
        size: 3,
    }),
    registerPixabayMediaSource: vi.fn(),
    PIXABAY_ORIENTATION_BY_BLOCK: { hero: 'landscape', gallery: 'landscape' },
    PixabayError: class PixabayError extends Error {
        constructor(public readonly code: string) { super(code) }
    },
}))

const POOL_PHOTOS = [
    { id: 'p1', url: 'https://pixabay.com/get/p1.jpg', alt: 'photo one' },
    { id: 'p2', url: 'https://pixabay.com/get/p2.jpg', alt: 'photo two' },
]

function makeCtx(preUploadedPool?: Map<string, number>): MediaPipelineContext {
    return { businessName: 'Test Biz', tenantId: '1', ...(preUploadedPool ? { preUploadedPool } : {}) }
}

function makePayload() {
    let nextId = 100
    return { create: vi.fn(async () => ({ id: nextId++ })) }
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('batchFetchFromPool × preUploadedPool', () => {
    it('[TC-GENPERF-W2-06] uses pre-uploaded media IDs — no download, no create', async () => {
        // Arrange
        const { downloadPhotoBuffer } = await import('@/lib/ai/pixabay-client')
        const payload = makePayload()
        const map = new Map([['p1', 901], ['p2', 902]])

        // Act
        const result = await batchFetchFromPool(POOL_PHOTOS, 'gallery', makeCtx(map), payload as never)

        // Assert — IDs come from the map; inline pipeline untouched
        expect([...result.mediaIds].sort()).toEqual([901, 902])
        expect(result.failures).toHaveLength(0)
        expect(vi.mocked(downloadPhotoBuffer)).not.toHaveBeenCalled()
        expect(payload.create).not.toHaveBeenCalled()
    })

    it('[TC-GENPERF-W2-06] partial map — pre-uploaded reused, misses fall back inline', async () => {
        // Arrange
        const { downloadPhotoBuffer } = await import('@/lib/ai/pixabay-client')
        const payload = makePayload()
        const map = new Map([['p1', 901]])

        // Act
        const result = await batchFetchFromPool(POOL_PHOTOS, 'gallery', makeCtx(map), payload as never)

        // Assert — p1 from map, p2 downloaded + created inline
        expect(result.mediaIds).toContain(901)
        expect(result.mediaIds).toHaveLength(2)
        expect(vi.mocked(downloadPhotoBuffer)).toHaveBeenCalledTimes(1)
        expect(payload.create).toHaveBeenCalledTimes(1)
    })

    it('[TC-GENPERF-W2-09] no map (flag off) — inline download+upload path unchanged', async () => {
        // Arrange
        const { downloadPhotoBuffer } = await import('@/lib/ai/pixabay-client')
        const payload = makePayload()

        // Act
        const result = await batchFetchFromPool(POOL_PHOTOS, 'gallery', makeCtx(), payload as never)

        // Assert — every photo goes through the legacy inline pipeline
        expect(result.mediaIds).toHaveLength(2)
        expect(vi.mocked(downloadPhotoBuffer)).toHaveBeenCalledTimes(2)
        expect(payload.create).toHaveBeenCalledTimes(2)
    })
})

describe('curated category fallback [TC-GH1611-19]', () => {
    it('uploads exactly the requested number of F&B gallery images from the curated library', async () => {
        // Arrange
        const { downloadPhotoBuffer } = await import('@/lib/ai/pixabay-client')
        const payload = makePayload()
        const ctx: MediaPipelineContext = {
            businessName: 'Tiệm Bánh QA',
            tenantId: '1',
            category: 'fnb',
        }

        // Act
        const result = await getCuratedMediaForBlock('gallery', 2, ctx, payload as never)

        // Assert — the first two checked-in F&B gallery assets are coffee/bread,
        // never ecommerce's clothing IDs.
        const requestedUrls = vi.mocked(downloadPhotoBuffer).mock.calls.map(([url]) => url)
        expect(requestedUrls).toHaveLength(2)
        expect(requestedUrls).toEqual(expect.arrayContaining([
            expect.stringContaining('photo-1495474472287-4d71bcdd2085'),
            expect.stringContaining('photo-1509440159596-0249088772ff'),
        ]))
        expect(requestedUrls.join(' ')).not.toContain('photo-1523381210434-271e8be1f52b')
        expect(result.mediaIds).toHaveLength(2)
        expect(result.failures).toHaveLength(0)
    })
})
