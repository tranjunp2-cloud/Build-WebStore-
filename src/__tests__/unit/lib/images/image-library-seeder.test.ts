/**
 * TC-GH-727-01 — image-library-seeder unit tests
 * GH-727 Phase 04: seeder searches Unsplash per category, uploads 17 fixed slots per site.
 * Alt keys: imglib:s{siteId}:{slot} — no category or photoId in the key.
 *
 * Coverage: happy path, idempotency, partial failure, unknown category fallback.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Top-level mocks ──────────────────────────────────────────────────────────

const {
    mockReadSiteStockAssignments,
    mockReplaceSiteStockAssignments,
    mockResolveF38ImageDemand,
} = vi.hoisted(() => ({
    mockReadSiteStockAssignments: vi.fn(),
    mockReplaceSiteStockAssignments: vi.fn(),
    mockResolveF38ImageDemand: vi.fn(),
}))

vi.mock('@/lib/media/stock-adapter', () => ({
    createF38StockInfrastructure: vi.fn(() => ({
        readSiteStockAssignments: mockReadSiteStockAssignments,
        replaceSiteStockAssignments: mockReplaceSiteStockAssignments,
    })),
}))

vi.mock('@/lib/ai/image-sourcing', () => ({
    createF38RuntimeResolver: vi.fn(() => ({
        resolveF38ImageDemand: mockResolveF38ImageDemand,
    })),
}))

vi.mock('@/lib/ai/pixabay-client', () => ({
    searchPhotos: vi.fn(),
    downloadPhotoBuffer: vi.fn(),
    // GH-1185: empty map → no category filter in these tests (param behavior
    // covered by pixabay-client TC-F38-RAW-11/12)
    PIXABAY_CATEGORY_BY_COMPOSER: {},
}))

vi.mock('@/lib/ai/media-pipeline', () => ({
    uploadBufferToMedia: vi.fn(),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import {
    persistF38ImageLibraryAssignments,
    seedImageLibraryForSite,
} from '@/lib/images/image-library-seeder'
import { searchPhotos, downloadPhotoBuffer } from '@/lib/ai/pixabay-client'
import { uploadBufferToMedia } from '@/lib/ai/media-pipeline'

// ── Helpers ──────────────────────────────────────────────────────────────────

const mockSearch = searchPhotos as ReturnType<typeof vi.fn>
const mockDownload = downloadPhotoBuffer as ReturnType<typeof vi.fn>
const mockUpload = uploadBufferToMedia as ReturnType<typeof vi.fn>

/** Return N fake Pixabay photo objects with unique, stable URLs. */
function makePhotos(count: number) {
    return Array.from({ length: count }, (_, i) => ({
        id: String(i),
        url: `https://pixabay.com/get/photo-${i}_1280.jpg`,
        alt: `tags-${i}`,
        photographer: `User${i}`,
        width: 1280,
        height: 853,
    }))
}

/** Payload mock whose idempotency find returns empty (site not yet seeded). */
function buildPayload(findOverride?: () => { docs: unknown[]; totalDocs?: number }) {
    return {
        find: vi.fn().mockImplementation(findOverride ?? (() => ({ docs: [], totalDocs: 0 }))),
        create: vi.fn().mockResolvedValue({ id: 999 }),
        logger: { error: vi.fn(), warn: vi.fn() },
    }
}

const FAKE_BUFFER = Buffer.from('fake-image-data')
const FAKE_MIMETYPE = 'image/jpeg'

// Phase 04: seeder always uploads exactly 17 slots per site
// 6 gallery + 3 hero + 1 about + 4 team + 3 features = 17
const TOTAL_SLOTS = 17

afterEach(() => {
    vi.unstubAllEnvs()
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('seedImageLibraryForSite [TC-GH-727-01]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-GH-727-01a: happy path — uploads 17 slots, returns correct mapping shape', async () => {
        // Arrange
        const payload = buildPayload() // idempotency check returns empty → proceed
        mockSearch.mockResolvedValue(makePhotos(10))
        mockDownload.mockResolvedValue({ buffer: FAKE_BUFFER, mimetype: FAKE_MIMETYPE, size: FAKE_BUFFER.length })
        let id = 0
        mockUpload.mockImplementation(async () => ++id)

        // Act
        const result = await seedImageLibraryForSite(payload as never, 1, 10, 'restaurant')

        // Assert — fixed slot counts regardless of IMAGE_LIBRARY shape
        expect(result.hero).toHaveLength(3)
        expect(result.gallery).toHaveLength(6)
        expect(result.about).not.toBeNull()
        expect(result.team).toHaveLength(4)
        expect(result.features).toHaveLength(3)

        expect(mockUpload).toHaveBeenCalledTimes(TOTAL_SLOTS)

        // Alt keys must use per-site format: imglib:s{siteId}:{slot}
        const altKeys = (mockUpload.mock.calls as Array<[unknown, { alt?: string }]>)
            .map(([, args]) => args?.alt ?? '')
        expect(altKeys.every(k => k.startsWith('imglib:s10:'))).toBe(true)
        // Verify one concrete key
        expect(altKeys).toContain('imglib:s10:gallery[0]')
        expect(altKeys).toContain('imglib:s10:hero[0]')
        expect(altKeys).toContain('imglib:s10:about')
    })

    it('TC-GH-727-01b: idempotency — site already seeded, returns empty mapping, skips all work', async () => {
        // Arrange — idempotency check finds an existing doc
        const payload = buildPayload(() => ({ docs: [{ id: 42 }], totalDocs: 17 }))

        // Act
        const result = await seedImageLibraryForSite(payload as never, 1, 10, 'restaurant')

        // Assert — no network calls or uploads triggered
        expect(mockSearch).not.toHaveBeenCalled()
        expect(mockDownload).not.toHaveBeenCalled()
        expect(mockUpload).not.toHaveBeenCalled()

        // Returns empty mapping — caller is fire-and-forget; resolveImageLibraryS3Map fetches fresh
        expect(result).toEqual({ hero: [], gallery: [], about: null, team: [], features: [] })
    })

    it('TC-GH-727-01c: partial failure — one slot download fails, seeder resolves (no throw)', async () => {
        // Arrange
        const payload = buildPayload()
        const photos = makePhotos(10)
        mockSearch.mockResolvedValue(photos)

        // gallery[2] is assigned photo-2 (3rd slot in gallery query group, index 2)
        const failUrl = photos[2]!.url
        mockDownload.mockImplementation(async (url: string) => {
            if (url === failUrl) throw new Error('Simulated download failure')
            return { buffer: FAKE_BUFFER, mimetype: FAKE_MIMETYPE, size: FAKE_BUFFER.length }
        })
        let uploadId = 0
        mockUpload.mockImplementation(async () => ++uploadId)

        // Act — must resolve, not reject
        const result = await seedImageLibraryForSite(payload as never, 1, 10, 'restaurant')

        // Assert — gallery is shorter by 1 (slot that failed is excluded from mapping)
        expect(result.gallery.length).toBeLessThan(6)
        // All returned IDs are numbers (no nulls)
        for (const id of result.gallery) expect(typeof id).toBe('number')
        for (const id of result.hero) expect(typeof id).toBe('number')
    })

    it('TC-GH-727-01d: unknown category falls back to business queries, uploads 17 slots with slot-based alt keys', async () => {
        // Arrange
        const payload = buildPayload()
        mockSearch.mockResolvedValue(makePhotos(10))
        mockDownload.mockResolvedValue({ buffer: FAKE_BUFFER, mimetype: FAKE_MIMETYPE, size: FAKE_BUFFER.length })
        let id = 0
        mockUpload.mockImplementation(async () => ++id)

        // Act — 'nonsense-category' unknown → GALLERY_QUERIES falls back to 'business'
        const result = await seedImageLibraryForSite(payload as never, 1, 10, 'nonsense-category')

        // Assert — same 17 slots regardless of category
        expect(mockUpload).toHaveBeenCalledTimes(TOTAL_SLOTS)

        // Alt keys are site-based (imglib:s10:slot), NOT category-based
        const altKeys = (mockUpload.mock.calls as Array<[unknown, { alt?: string }]>)
            .map(([, args]) => args?.alt ?? '')
        expect(altKeys.every(k => k.startsWith('imglib:s10:'))).toBe(true)
        // No category name in keys
        expect(altKeys.every(k => !k.includes('nonsense-category'))).toBe(true)

        // Mapping shape is valid
        expect(result.hero).toHaveLength(3)
        expect(result.gallery).toHaveLength(6)

        // downloadPhotoBuffer called for photos that were successfully assigned
        expect(mockDownload).toHaveBeenCalled()
    })

    it('TC-GH-727-01e: uses product-focused search queries when productTerms are provided', async () => {
        const payload = buildPayload()
        mockSearch.mockResolvedValue(makePhotos(10))
        mockDownload.mockResolvedValue({ buffer: FAKE_BUFFER, mimetype: FAKE_MIMETYPE, size: FAKE_BUFFER.length })
        let id = 0
        mockUpload.mockImplementation(async () => ++id)

        await seedImageLibraryForSite(payload as never, 1, 10, 'creative', undefined, 'chibi animation')

        const searchQueries = mockSearch.mock.calls.map(([query]) => query)
        expect(searchQueries).toContain('chibi animation')
        expect(searchQueries).not.toContain('chibi animation creative studio art portfolio')
        expect(searchQueries).not.toContain('chibi animation creative studio artist workspace')
    })

    it('TC-GH-727-01f: retries with shorter product-focused queries when the primary search returns zero hits', async () => {
        const payload = buildPayload()
        mockSearch
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce(makePhotos(10))
            .mockResolvedValue(makePhotos(10))
        mockDownload.mockResolvedValue({ buffer: FAKE_BUFFER, mimetype: FAKE_MIMETYPE, size: FAKE_BUFFER.length })
        let id = 0
        mockUpload.mockImplementation(async () => ++id)

        const result = await seedImageLibraryForSite(payload as never, 1, 10, 'fnb', undefined, 'bread cafe coffee latte')

        expect(result.gallery).toHaveLength(6)
        expect(mockSearch.mock.calls[0]?.[0]).toBe('bread cafe coffee')
        expect(mockSearch.mock.calls[1]?.[0]).toBe('bread cafe')
        expect(mockSearch.mock.calls.some(([query]) => query === 'bread')).toBe(false)
    })
})

/**
 * TC-GENPERF-W1-03 — imglib seeder idempotency in Wave 1 context
 * Thin addition verifying integration point: gen-perf-wave1.test.ts has full coverage.
 * This verifies the seeder is called idempotently from the after() task.
 */
describe('TC-GENPERF-W1-03 — imglib seeder idempotency (Wave 1 integration)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-GENPERF-W1-03: second regeneration with same site → returns empty, skips uploads', async () => {
        // Arrange: First call finds nothing (new site) → proceeds
        const payload = buildPayload(() => ({ docs: [], totalDocs: 0 }))
        mockSearch.mockResolvedValue(makePhotos(10))
        mockDownload.mockResolvedValue({ buffer: FAKE_BUFFER, mimetype: FAKE_MIMETYPE, size: FAKE_BUFFER.length })
        let id = 0
        mockUpload.mockImplementation(async () => ++id)

        // First call: happy path
        const result1 = await seedImageLibraryForSite(payload as never, 1, 10, 'restaurant')
        expect(result1.gallery.length).toBeGreaterThan(0)
        const searchCallsAfterFirst = mockSearch.mock.calls.length
        const downloadCallsAfterFirst = mockDownload.mock.calls.length
        const uploadCountAfterFirst = mockUpload.mock.calls.length

        // Arrange: Second call finds existing media (idempotent) → skips
        const payloadSecondGen = buildPayload(() => ({ docs: [{ id: 42, alt: 'imglib:s10:gallery[0]' }], totalDocs: TOTAL_SLOTS }))

        // Second call: should skip all work
        const result2 = await seedImageLibraryForSite(payloadSecondGen as never, 1, 10, 'restaurant')

        // Assert: Second call returns empty (idempotent)
        expect(result2).toEqual({ hero: [], gallery: [], about: null, team: [], features: [] })
        // No new calls after second invocation (idempotency check found existing media)
        expect(mockUpload.mock.calls.length).toBe(uploadCountAfterFirst)
        expect(mockSearch.mock.calls.length).toBe(searchCallsAfterFirst) // No new searches
        expect(mockDownload.mock.calls.length).toBe(downloadCallsAfterFirst) // No new downloads
    })
})

describe('TC-F38-REUSE-01 — shared Media site-slot assignments', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('upserts site slots without creating tenant Media copies', async () => {
        // Arrange
        mockReplaceSiteStockAssignments.mockImplementation(async (
            siteId: number,
            assignments: Array<{ slot: string; mediaId: number }>,
        ) => assignments.map((assignment, index) => ({
            id: index + 1,
            siteId,
            ...assignment,
        })))
        const payload = {
            create: vi.fn(),
        }

        // Act
        const persisted = await persistF38ImageLibraryAssignments(
            payload as never,
            10,
            {
                hero: [101],
                gallery: [202, 203],
                about: 304,
                team: [],
                features: [],
            },
        )

        // Assert
        expect(persisted).toBe(4)
        expect(mockReplaceSiteStockAssignments).toHaveBeenCalledOnce()
        expect(mockReplaceSiteStockAssignments).toHaveBeenCalledWith(
            10,
            expect.arrayContaining([{ slot: 'gallery[1]', mediaId: 203 }]),
        )
        expect(payload.create).not.toHaveBeenCalled()
    })

    it('TC-F38-RES-08: clears stale site assignments when no library images remain', async () => {
        // Arrange
        mockReplaceSiteStockAssignments.mockResolvedValue([])

        // Act
        const persisted = await persistF38ImageLibraryAssignments(
            {} as never,
            10,
            {
                hero: [],
                gallery: [],
                about: null,
                team: [],
                features: [],
            },
        )

        // Assert
        expect(persisted).toBe(0)
        expect(mockReplaceSiteStockAssignments).toHaveBeenCalledOnce()
        expect(mockReplaceSiteStockAssignments).toHaveBeenCalledWith(10, [])
    })

    it('TC-F38-RES-08: standalone seed uses one F38 resolver and no direct Pixabay search', async () => {
        // Arrange
        vi.clearAllMocks()
        vi.stubEnv('F38_IMAGE_PIPELINE', 'true')
        mockReadSiteStockAssignments.mockResolvedValue([])
        const resolved = (ids: number[]) => ids.map((mediaId) => ({
            source: 'catalog',
            mediaId,
            objectKey: `stock/test/${mediaId}.jpg`,
        }))
        mockResolveF38ImageDemand.mockResolvedValue({
            attemptsUsed: 0,
            events: [],
            reservoirs: {
                landscape: resolved([1, 2, 3, 4, 5, 6, 7]),
                square: resolved([8, 9, 10, 11, 12, 13]),
                people: resolved([14, 15, 16, 17]),
                products: [],
                blogs: [],
            },
        })
        mockReplaceSiteStockAssignments.mockImplementation(async (
            siteId: number,
            assignments: Array<{ slot: string; mediaId: number }>,
        ) => assignments.map((assignment, index) => ({
            id: index + 1,
            siteId,
            ...assignment,
        })))
        const payload = { find: vi.fn(), create: vi.fn() }

        // Act
        const result = await seedImageLibraryForSite(
            payload as never,
            1,
            10,
            'restaurant',
        )

        // Assert
        expect(result.gallery).toEqual([8, 9, 10, 11, 12, 13])
        expect(result.hero).toEqual([1, 2, 3])
        expect(result.about).toBe(4)
        expect(result.team).toEqual([14, 15, 16, 17])
        expect(result.features).toEqual([5, 6, 7])
        expect(mockResolveF38ImageDemand).toHaveBeenCalledOnce()
        expect(mockSearch).not.toHaveBeenCalled()
        expect(mockReplaceSiteStockAssignments).toHaveBeenCalledOnce()
    })
})
