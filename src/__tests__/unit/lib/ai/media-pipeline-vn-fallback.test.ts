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
            alt: 'pen dan pensel stationery product photography',
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
            englishKeywords: ['pen dan pensel', 'buku nota'],
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

    it('gallery: unmapped category fallback returns off-topic photos → gates them out, returning empty', async () => {
        // Arrange — unmapped category 'ecommerce' has no Pixabay category mapping.
        // The fallback returns an off-topic photo (e.g. clothing/dress) which gets gated out.
        const offTopicPhoto = {
            id: 'off-1',
            url: 'https://pixabay.com/get/off-1_1280.jpg',
            alt: 'red dress clothing garment',
            photographer: 'Alice',
            width: 1920,
            height: 1080,
        }
        vi.mocked(searchPhotos)
            .mockResolvedValueOnce([]) // primary
            .mockResolvedValueOnce([]) // broadened
            .mockResolvedValueOnce([offTopicPhoto] as never) // tier-3 EN category fallback
        // Re-arm mock:
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

        // Assert — gated out, resolves to empty result
        expect(result.mediaIds).toEqual([])
        expect(vi.mocked(searchPhotos)).toHaveBeenCalledTimes(3)
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

    it('gallery: unmapped category fallback uses englishKeywords for gating when provided (rejecting lookalike clothing)', async () => {
        const lookalikePhoto = {
            id: 'look-1',
            url: 'https://pixabay.com/get/look-1_1280.jpg',
            alt: 'red dress clothing garment product photography',
            photographer: 'Alice',
            width: 1920,
            height: 1080,
        }
        const matchingPhoto = {
            id: 'match-1',
            url: 'https://pixabay.com/get/match-1_1280.jpg',
            alt: 'leather handbag product photography',
            photographer: 'Bob',
            width: 1920,
            height: 1080,
        }

        vi.mocked(searchPhotos)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([lookalikePhoto, matchingPhoto] as never)

        createMock.mockResolvedValue({ id: 7 })
        vi.mocked(downloadPhotoBuffer).mockResolvedValue({
            buffer: Buffer.from('img'),
            mimetype: 'image/jpeg',
        } as never)

        const msCtx = {
            businessName: 'Leather Shop',
            tenantId: '1',
            category: 'ecommerce',
            language: 'en' as const,
            englishKeywords: ['handbag'],
        }

        const result = await getMediaForBlock(
            'gallery', ['handbag'], 1, msCtx as never, payloadStub,
        )

        expect(result.mediaIds).toEqual([7])
        expect(vi.mocked(searchPhotos)).toHaveBeenCalledTimes(2)
    })

    it('gallery: unmapped category with empty products rejects all photos (returning empty)', async () => {
        const offTopicPhoto = {
            id: 'off-1',
            url: 'https://pixabay.com/get/off-1_1280.jpg',
            alt: 'product photography dress clothing flatlay',
            photographer: 'Alice',
            width: 1920,
            height: 1080,
        }
        vi.mocked(searchPhotos)
            .mockResolvedValueOnce([offTopicPhoto] as never)

        const msCtx = {
            businessName: 'Unconfigured Shop',
            tenantId: '1',
            category: 'ecommerce',
            language: 'en' as const,
            englishKeywords: [],
        }

        const result = await getMediaForBlock(
            'gallery', [], 1, msCtx as never, payloadStub,
        )

        expect(result.mediaIds).toEqual([])
    })

    it('[TC-GH1611-18] mapped F&B category fallback rejects a different food product', async () => {
        // Arrange
        const sushiPhoto = {
            id: 'sushi-1',
            url: 'https://pixabay.com/get/sushi-1_1280.jpg',
            alt: 'sushi salmon japanese food',
            photographer: 'Alice',
            width: 1920,
            height: 1080,
        }
        const cakePhoto = {
            id: 'cake-1',
            url: 'https://pixabay.com/get/cake-1_1280.jpg',
            alt: 'chocolate cake bakery dessert',
            photographer: 'Bob',
            width: 1920,
            height: 1080,
        }
        vi.mocked(searchPhotos)
            .mockResolvedValueOnce([]) // primary
            .mockResolvedValueOnce([]) // broadened
            .mockResolvedValueOnce([sushiPhoto, cakePhoto] as never) // category fallback
        vi.mocked(downloadPhotoBuffer).mockResolvedValue({
            buffer: Buffer.from('img'),
            mimetype: 'image/jpeg',
        } as never)
        createMock.mockResolvedValue({ id: 7 })
        const bakeryCtx = {
            businessName: 'Bun & Baguette',
            tenantId: '1',
            category: 'fnb',
            language: 'en' as const,
            englishKeywords: ['chocolate cake'],
        }

        // Act
        const result = await getMediaForBlock(
            'gallery', ['chocolate cake', 'frosted cupcake'], 1, bakeryCtx as never, payloadStub,
        )

        // Assert
        expect(result.mediaIds).toEqual([7])
        expect(vi.mocked(downloadPhotoBuffer)).toHaveBeenCalledTimes(1)
        expect(vi.mocked(downloadPhotoBuffer)).toHaveBeenCalledWith(cakePhoto.url)
    })

    it('[TC-GH1611-19] mapped F&B broadened tier keeps the full product gate', async () => {
        // Arrange
        const sushiPhoto = {
            id: 'sushi-tier2',
            url: 'https://pixabay.com/get/sushi-tier2_1280.jpg',
            alt: 'sushi salmon japanese food',
            photographer: 'Alice',
            width: 1920,
            height: 1080,
        }
        vi.mocked(searchPhotos)
            .mockResolvedValueOnce([]) // primary multi-term query
            .mockResolvedValueOnce([sushiPhoto] as never) // broadened tier
            .mockResolvedValueOnce([]) // category fallback
        const bakeryCtx = {
            businessName: 'Bun & Baguette',
            tenantId: '1',
            category: 'fnb',
            language: 'en' as const,
            englishKeywords: ['chocolate cake', 'frosted cupcake'],
        }

        // Act
        const result = await getMediaForBlock(
            'gallery', ['food', 'bakery'], 1, bakeryCtx as never, payloadStub,
        )

        // Assert
        expect(result.mediaIds).toEqual([])
        expect(vi.mocked(searchPhotos)).toHaveBeenCalledTimes(3)
        expect(vi.mocked(downloadPhotoBuffer)).not.toHaveBeenCalled()
    })
})
