/**
 * TC-F38-RAW-17 — getMediaForBlock VN tier-3 fallback error containment.
 * TC-F38-RAW-24 — getMediaForBlock non-VN tier-3 EN category fallback.
 *
 * GH-1185 review fix (PR #1481, finding H1): `return vnCategoryFallback()`
 * without `await` let a PixabayError thrown INSIDE the fallback escape
 * getMediaForBlock's own try/catch — hero lost its guaranteed curated
 * fallback exactly under rate-limit pressure. This test pins the contract:
 * a throwing tier-3 search must still resolve (hero → fallback media,
 * non-hero → empty result), never reject.
 *
 * GH-1185 QC retest (Malay gap): tier-3 only fired for VN queries — a Malay
 * business whose keywords zero-hit got an EMPTY result, so GPT-hallucinated
 * stock URLs (off-topic fashion for `ecommerce`) survived injection. Non-VN
 * queries now fall to the English category base keyword.
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

describe('TC-F38-RAW-24 — non-VN zero-hit falls back to EN category base keyword', () => {
    it('gallery: Malay keywords 0-hit on primary + broaden → tier-3 EN category search delivers media', async () => {
        // Arrange — Malay terms zero-hit on both user-derived tiers; the EN
        // category base keyword ("product photography" for ecommerce) has
        // wide Pixabay coverage and fills the slot.
        const tier3Photo = {
            id: 'cat-1',
            url: 'https://pixabay.com/get/cat-1_1280.jpg',
            alt: 'stationery flatlay',
            photographer: 'Bob',
            width: 1920,
            height: 1080,
        }
        vi.mocked(searchPhotos)
            .mockResolvedValueOnce([]) // primary "pen dan pensel buku nota"
            .mockResolvedValueOnce([]) // broadened "pen dan pensel"
            .mockResolvedValueOnce([tier3Photo] as never) // tier-3 EN category
        vi.mocked(downloadPhotoBuffer).mockResolvedValue({
            buffer: Buffer.from('img'),
            mimetype: 'image/jpeg',
        } as never)
        // Re-arm: afterEach's restoreAllMocks wipes the module-scope
        // mockResolvedValue after the first test runs.
        createMock.mockResolvedValue({ id: 7 })
        const msCtx = {
            businessName: 'Kedai Seri Bestari',
            tenantId: '1',
            category: 'ecommerce',
            language: 'ms' as const,
        }

        // Act
        const result = await getMediaForBlock(
            'gallery', ['pen dan pensel', 'buku nota'], 1, msCtx as never, payloadStub,
        )

        // Assert — tier-3 query = CATEGORY_BASE_KEYWORDS['ecommerce'][0],
        // default lang (no vi), and the slot gets a real media ID (pre-fix:
        // empty result → GPT-hallucinated URL survived).
        expect(vi.mocked(searchPhotos)).toHaveBeenCalledTimes(3)
        expect(vi.mocked(searchPhotos).mock.calls[2]![0]).toBe('product photography')
        const tier3Opts = vi.mocked(searchPhotos).mock.calls[2]![2] as { lang?: string }
        expect(tier3Opts?.lang).toBeUndefined()
        expect(result.failures).toEqual([])
        expect(result.mediaIds).toEqual([7])
    })

    it('non-hero non-VN: tier-3 also returns 0 → resolves empty (no infinite ladder)', async () => {
        // Arrange — every tier misses (thin category coverage).
        vi.mocked(searchPhotos).mockResolvedValue([])
        const msCtx = {
            businessName: 'Kedai Seri Bestari',
            tenantId: '1',
            category: 'ecommerce',
            language: 'ms' as const,
        }

        // Act
        const result = await getMediaForBlock(
            'gallery', ['pen dan pensel', 'buku nota'], 1, msCtx as never, payloadStub,
        )

        // Assert — graceful empty, exactly 3 searches (primary, broaden, tier-3)
        expect(result.mediaIds).toEqual([])
        expect(vi.mocked(searchPhotos)).toHaveBeenCalledTimes(3)
    })
})
