/**
 * TC-GH-727-03a..03d — image-library-resolver unit tests
 * GH-727 Phase 03: resolveImageLibraryS3Map builds altKey→url map from Payload media.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Top-level mocks ──────────────────────────────────────────────────────────

// No module-level mocks needed — Payload is injected directly as a parameter.

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { resolveImageLibraryS3Map } from '@/lib/images/image-library-resolver'

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildPayload(docs: Array<{ alt?: string; url?: string }>) {
    return {
        find: vi.fn().mockResolvedValue({ docs }),
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('resolveImageLibraryS3Map', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-GH-727-03a: happy path — returns map keyed by imglib altKey', async () => {
        // Arrange
        const docs = [
            { alt: 'imglib:restaurant:hero[0]:photo-1517248135467', url: 'https://s3.example.com/imglib-hero.jpg' },
            { alt: 'imglib:restaurant:gallery[0]:photo-1504674900247', url: 'https://s3.example.com/imglib-gallery.jpg' },
        ]
        const payload = buildPayload(docs)

        // Act
        const result = await resolveImageLibraryS3Map(payload as never, 42)

        // Assert
        expect(result['imglib:restaurant:hero[0]:photo-1517248135467']).toBe('https://s3.example.com/imglib-hero.jpg')
        expect(result['imglib:restaurant:gallery[0]:photo-1504674900247']).toBe('https://s3.example.com/imglib-gallery.jpg')
        expect(payload.find).toHaveBeenCalledOnce()
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

    it('TC-GH-727-03d: doc with alt not starting with imglib: is excluded by startsWith guard', async () => {
        // Arrange — doc whose alt contains "imglib:" as substring but doesn't start with it
        const docs = [
            { alt: 'something:imglib:other', url: 'https://s3.example.com/should-not-appear.jpg' },
            { alt: 'imglib:business:about:photo-abc', url: 'https://s3.example.com/valid.jpg' },
        ]
        const payload = buildPayload(docs)

        // Act
        const result = await resolveImageLibraryS3Map(payload as never, 1)

        // Assert — the invalid alt is filtered out; valid one is present
        expect(Object.keys(result)).toHaveLength(1)
        expect(result['imglib:business:about:photo-abc']).toBe('https://s3.example.com/valid.jpg')
        expect(result['something:imglib:other']).toBeUndefined()
    })
})
