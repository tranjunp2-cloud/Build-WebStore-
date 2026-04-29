/**
 * TC-GH-727-03a..03d — image-library-resolver unit tests
 * GH-727 Phase 04: resolveImageLibraryS3Map returns slot→url map keyed by
 * slot name (gallery[0], hero[0], etc.) using per-site prefix imglib:s{siteId}:
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Imports ──────────────────────────────────────────────────────────────────

import { resolveImageLibraryS3Map } from '@/lib/images/image-library-resolver'

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildPayload(docs: Array<{ alt?: string; url?: string; filename?: string }>) {
    return {
        find: vi.fn().mockResolvedValue({ docs }),
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('resolveImageLibraryS3Map', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-GH-727-03a: happy path — returns map keyed by slot name (Phase 04 format)', async () => {
        // Arrange — Phase 04 alt format: imglib:s{siteId}:{slot}
        const docs = [
            { alt: 'imglib:s42:hero[0]', url: 'https://s3.example.com/imglib-hero.jpg' },
            { alt: 'imglib:s42:gallery[0]', url: 'https://s3.example.com/imglib-gallery.jpg' },
        ]
        const payload = buildPayload(docs)

        // Act
        const result = await resolveImageLibraryS3Map(payload as never, 42)

        // Assert — map keyed by slot name, not full altKey
        expect(result['hero[0]']).toBe('https://s3.example.com/imglib-hero.jpg')
        expect(result['gallery[0]']).toBe('https://s3.example.com/imglib-gallery.jpg')
        expect(payload.find).toHaveBeenCalledOnce()
        // Payload.find query must use per-site prefix
        expect(payload.find).toHaveBeenCalledWith(
            expect.objectContaining({ where: { alt: { like: 'imglib:s42:' } } }),
        )
    })

    it('TC-GH-727-03b: empty result — no docs returns {}', async () => {
        // Arrange
        const payload = buildPayload([])

        // Act
        const result = await resolveImageLibraryS3Map(payload as never, 99)

        // Assert
        expect(result).toEqual({})
    })

    it('TC-GH-727-03c: payload.find throws — returns {}, does not throw', async () => {
        // Arrange
        const payload = { find: vi.fn().mockRejectedValue(new Error('DB timeout')) }

        // Act + Assert (no throw)
        const result = await resolveImageLibraryS3Map(payload as never, 7)
        expect(result).toEqual({})
    })

    it('TC-GH-727-03d: doc with non-matching siteId prefix is excluded by startsWith guard', async () => {
        // Arrange — two docs: one matches siteId=1, one matches siteId=10 (different site)
        // Payload.find WHERE clause filters by prefix, but secondary guard covers partial matches
        const docs = [
            { alt: 'imglib:s10:gallery[0]', url: 'https://s3.example.com/wrong-site.jpg' },
            { alt: 'imglib:s1:about', url: 'https://s3.example.com/valid.jpg' },
        ]
        const payload = buildPayload(docs)

        // Act — querying for siteId=1
        const result = await resolveImageLibraryS3Map(payload as never, 1)

        // Assert — only 'imglib:s1:about' starts with 'imglib:s1:'; s10 doc is excluded
        expect(Object.keys(result)).toHaveLength(1)
        expect(result['about']).toBe('https://s3.example.com/valid.jpg')
        expect(result['imglib:s1:about']).toBeUndefined() // key is slot name, not full altKey
    })
})
