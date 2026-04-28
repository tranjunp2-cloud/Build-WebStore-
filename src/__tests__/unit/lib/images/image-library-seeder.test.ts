/**
 * TC-GH-727-01 — image-library-seeder unit tests
 * GH-727: Seed IMAGE_LIBRARY photos to S3 via Payload media collection.
 *
 * Coverage: happy path, idempotency, partial failure, unknown category fallback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Top-level mocks ──────────────────────────────────────────────────────────

vi.mock('@/lib/ai/unsplash-client', () => ({
    downloadPhotoBuffer: vi.fn(),
}))

vi.mock('@/lib/ai/media-pipeline', () => ({
    uploadBufferToMedia: vi.fn(),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { seedImageLibraryForSite } from '@/lib/images/image-library-seeder'
import { IMAGE_LIBRARY } from '@/app/api/preview/renderers/images'
import { downloadPhotoBuffer } from '@/lib/ai/unsplash-client'
import { uploadBufferToMedia } from '@/lib/ai/media-pipeline'

// ── Helpers ──────────────────────────────────────────────────────────────────

const mockDownload = downloadPhotoBuffer as ReturnType<typeof vi.fn>
const mockUpload = uploadBufferToMedia as ReturnType<typeof vi.fn>

/** Build a minimal Payload mock whose find always returns empty (no existing). */
function buildPayload(findOverride?: (args: unknown) => { docs: unknown[] }) {
    return {
        find: vi.fn().mockImplementation(findOverride ?? (() => ({ docs: [] }))),
        create: vi.fn().mockResolvedValue({ id: 999 }),
        logger: { error: vi.fn(), warn: vi.fn() },
    }
}

const FAKE_BUFFER = Buffer.from('fake-image-data')
const FAKE_MIMETYPE = 'image/jpeg'

// ── Tests ────────────────────────────────────────────────────────────────────

describe('seedImageLibraryForSite [TC-GH-727-01]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // TC-GH-727-01a: Happy path — all slots upload successfully
    it('TC-GH-727-01a: happy path — uploads every slot for restaurant, returns correct mapping shape', async () => {
        const payload = buildPayload()
        mockDownload.mockResolvedValue({ buffer: FAKE_BUFFER, mimetype: FAKE_MIMETYPE, size: FAKE_BUFFER.length })
        let callCount = 0
        mockUpload.mockImplementation(async () => ++callCount)

        const result = await seedImageLibraryForSite(payload as never, 1, 10, 'restaurant')

        const images = IMAGE_LIBRARY['restaurant']!
        expect(result.hero.length).toBe(images.hero.length)
        expect(result.gallery.length).toBe(images.gallery.length)
        expect(result.about).not.toBeNull()
        expect(result.team.length).toBe(images.team.length)
        expect(result.features.length).toBe(images.features.length)

        // uploadBufferToMedia called for every slot (no existing docs)
        const totalSlots =
            images.hero.length +
            images.gallery.length +
            1 + // about
            images.team.length +
            images.features.length
        expect(mockUpload).toHaveBeenCalledTimes(totalSlots)

        // All returned IDs are numbers
        for (const id of result.hero) expect(typeof id).toBe('number')
        for (const id of result.gallery) expect(typeof id).toBe('number')
        expect(typeof result.about).toBe('number')
    })

    // TC-GH-727-01b: Idempotency — existing docs are reused, no download triggered
    it('TC-GH-727-01b: idempotency — returns existing media IDs, skips download', async () => {
        const existingId = 42
        // payload.find returns an existing doc for every query
        const payload = buildPayload(() => ({
            docs: [{ id: existingId }],
        }))

        const result = await seedImageLibraryForSite(payload as never, 1, 10, 'restaurant')

        // downloadPhotoBuffer must NOT be called for any slot
        expect(mockDownload).not.toHaveBeenCalled()
        expect(mockUpload).not.toHaveBeenCalled()

        // But mapping should still be populated with the existing IDs
        expect(result.hero.every(id => id === existingId)).toBe(true)
        expect(result.gallery.every(id => id === existingId)).toBe(true)
        expect(result.about).toBe(existingId)
    })

    // TC-GH-727-01c: Partial failure — one slot throws, seeder resolves (not rejects)
    it('TC-GH-727-01c: partial failure — gallery slot error does not reject, missing from mapping', async () => {
        const payload = buildPayload()
        // Fail specifically on the URL of gallery[2] for restaurant
        const failUrl = IMAGE_LIBRARY['restaurant']!.gallery[2]!
        mockDownload.mockImplementation(async (url: string) => {
            if (url === failUrl) {
                throw new Error('Simulated download failure for gallery[2]')
            }
            return { buffer: FAKE_BUFFER, mimetype: FAKE_MIMETYPE, size: FAKE_BUFFER.length }
        })
        let uploadId = 0
        mockUpload.mockImplementation(async () => ++uploadId)

        // Should resolve, not reject
        const result = await seedImageLibraryForSite(payload as never, 1, 10, 'restaurant')

        // gallery should be shorter than full (one slot failed)
        expect(result.gallery.length).toBeLessThan(IMAGE_LIBRARY['restaurant']!.gallery.length)
    })

    // TC-GH-727-01d: Unknown category — falls back to IMAGE_LIBRARY.business entries
    it('TC-GH-727-01d: unknown category falls back to business images', async () => {
        const payload = buildPayload()
        mockDownload.mockResolvedValue({ buffer: FAKE_BUFFER, mimetype: FAKE_MIMETYPE, size: FAKE_BUFFER.length })
        let id = 0
        mockUpload.mockImplementation(async () => ++id)

        const result = await seedImageLibraryForSite(payload as never, 1, 10, 'nonsense-category')

        // Fallback uses IMAGE_LIBRARY.business — verify slot count matches business category
        const businessImages = IMAGE_LIBRARY['business']!
        const expectedTotalSlots =
            businessImages.hero.length +
            businessImages.gallery.length +
            (businessImages.about ? 1 : 0) +
            businessImages.team.length +
            businessImages.features.length

        expect(mockUpload).toHaveBeenCalledTimes(expectedTotalSlots)

        // Alt keys use the input category string (not 'business') — verify format
        const uploadCalls = mockUpload.mock.calls
        const altTexts = uploadCalls.map((call: unknown[]) => {
            const args = call[1] as { alt?: string }
            return args?.alt ?? ''
        })
        // All alt keys should use the input category (not 'business') per seeder design
        expect(altTexts.every((alt: string) => alt.startsWith('imglib:nonsense-category:'))).toBe(true)

        // Mapping shape is valid
        expect(result.hero.length).toBe(businessImages.hero.length)
        expect(result.gallery.length).toBe(businessImages.gallery.length)
    })
})
