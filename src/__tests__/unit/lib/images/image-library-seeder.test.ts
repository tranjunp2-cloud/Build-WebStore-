/**
 * TC-GH-727-01 — image-library-seeder unit tests
 * GH-727 Phase 04: seeder searches Unsplash per category, uploads 17 fixed slots per site.
 * Alt keys: imglib:s{siteId}:{slot} — no category or photoId in the key.
 *
 * Coverage: happy path, idempotency, partial failure, unknown category fallback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Top-level mocks ──────────────────────────────────────────────────────────

vi.mock('@/lib/ai/pixabay-client', () => ({
    searchPhotos: vi.fn(),
    downloadPhotoBuffer: vi.fn(),
}))

vi.mock('@/lib/ai/media-pipeline', () => ({
    uploadBufferToMedia: vi.fn(),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { seedImageLibraryForSite } from '@/lib/images/image-library-seeder'
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
})
