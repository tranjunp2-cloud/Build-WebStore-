/**
 * TC-F38-RAW-17 — getMediaForBlock VN tier-3 fallback error containment.
 *
 * GH-1185 review fix (PR #1481, finding H1): `return vnCategoryFallback()`
 * without `await` let a PixabayError thrown INSIDE the fallback escape
 * getMediaForBlock's own try/catch — hero lost its guaranteed curated
 * fallback exactly under rate-limit pressure. This test pins the contract:
 * a throwing tier-3 search must still resolve (hero → fallback media,
 * non-hero → empty result), never reject.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getMediaForBlock } from '@/lib/ai/media-pipeline'
import { searchPhotos, downloadPhotoBuffer, PixabayError } from '@/lib/ai/pixabay-client'

vi.mock('@/lib/ai/pixabay-client', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    searchPhotos: vi.fn(),
    downloadPhotoBuffer: vi.fn(),
}))

const ctx = {
    businessName: 'Cơm Ba Má',
    tenantId: '1',
    category: 'restaurant',
    language: 'vi' as const,
}

// Minimal payload stub — only `create` is exercised (via uploadBufferToMedia).
const createMock = vi.fn().mockResolvedValue({ id: 7 })
const payloadStub = { create: createMock } as never

beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    createMock.mockClear()
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('TC-F38-RAW-17 — VN tier-3 fallback throw is contained', () => {
    it('hero: tier-3 search throws → resolves with curated hero fallback, no rejection', async () => {
        // Arrange — primary query "phở bò" (single raw term → broaden skipped)
        // returns 0 hits; the VN category fallback search then rate-limits.
        vi.mocked(searchPhotos)
            .mockResolvedValueOnce([]) // primary
            .mockRejectedValueOnce(new PixabayError('RATE_LIMITED', 429, true)) // tier-3
        vi.mocked(downloadPhotoBuffer).mockResolvedValue({
            buffer: Buffer.from('img'),
            mimetype: 'image/jpeg',
        } as never)

        // Act — must NOT reject (pre-fix: unhandled rejection escaped the catch)
        const result = await getMediaForBlock('hero', ['phở bò'], 1, ctx as never, payloadStub)

        // Assert — hero fallback chain still delivered a media row
        expect(result.mediaIds).toEqual([7])
        expect(vi.mocked(searchPhotos)).toHaveBeenCalledTimes(2)
    })

    it('non-hero: tier-3 search throws → resolves empty with failure entry, no rejection', async () => {
        // Arrange
        vi.mocked(searchPhotos)
            .mockResolvedValueOnce([]) // primary
            .mockRejectedValueOnce(new PixabayError('RATE_LIMITED', 429, true)) // tier-3

        // Act
        const result = await getMediaForBlock('gallery', ['phở bò'], 3, ctx as never, payloadStub)

        // Assert — graceful empty, error surfaced as failure not rejection
        expect(result.mediaIds).toEqual([])
        expect(result.failures.length).toBeGreaterThan(0)
    })
})
