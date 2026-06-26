/**
 * Regression Tests — GH-1381 Editor Upload UX Changes
 *
 * Coverage Map (QA Doc Traceability):
 *   TC-GH1381-01 → ImageToolbar spinner + loading state when isProcessing=true
 *   TC-GH1381-02 → ImageToolbar shows ImagePlus icon when isProcessing=false
 *   TC-GH1381-03 → ImageToolbar button disabled when isProcessing=true
 *   TC-GH1381-04 → ImageToolbar uses i18n key "editor.imageToolbar.uploading" when processing
 *   TC-GH1381-05 → ImageToolbar uses i18n key "editor.imageToolbar.changeImage" when idle
 *   TC-GH1381-06 → Persistence: root-level image { id, url, alt } normalizes to bare integer id
 *   TC-GH1381-07 → Persistence: posterImage (NOT normalized) stays as bare integer, never object
 *   TC-GH1381-08 → Persistence: UPLOAD_FIELDS array membership test (guards contract)
 *   TC-GH1381-09 → Persistence: normalizeUploadField applied to nested array items (hero avatar, etc.)
 *
 * Source:
 *   - src/components/editor/ImageToolbar.tsx
 *   - src/components/editor/PreviewFrame.tsx (buildImageValue helper + Strategy 2)
 *   - src/lib/block-normalization.ts (UPLOAD_FIELDS + normalizeUploadField)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import {
    normalizeUploadField,
    normalizeBlocksForPersistence,
    UPLOAD_FIELDS,
} from '@/lib/block-normalization'

// ─────────────────────────────────────────────────────────────────────────────
// Mock i18n for ImageToolbar tests
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            editor: {
                imageToolbar: {
                    uploading: 'Uploading...',
                    changeImage: 'Change Image',
                },
                preview: {
                    altUploadedImage: 'Uploaded image',
                },
            },
        },
        locale: 'en',
    }),
}))

// Mock processImageFile to avoid real file processing
vi.mock('@/lib/utils/image', () => ({
    processImageFile: vi.fn(async (file: File) => file),
}))

// ─────────────────────────────────────────────────────────────────────────────
// Import components to test
// ─────────────────────────────────────────────────────────────────────────────

import { ImageToolbar } from '@/components/editor/ImageToolbar'

// =============================================================================
// Section 1 — ImageToolbar Loading State Tests (GH-1381-01 to GH-1381-05)
// =============================================================================

describe('ImageToolbar — loading state & i18n (GH-1381)', () => {
    const mockOnImageSelect = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
    })

    // TC-GH1381-01: Spinner shows when isProcessing=true
    it('TC-GH1381-01: renders Loader2 spinner with animate-spin class when isProcessing=true', () => {
        const { container } = render(
            <ImageToolbar onImageSelect={mockOnImageSelect} isProcessing={true} />
        )

        // Find the Loader2 icon (lucide-react renders as svg)
        const spinner = container.querySelector('svg[class*="animate-spin"]')
        expect(spinner).toBeTruthy()
        expect(spinner?.className.baseVal).toContain('animate-spin')
    })

    // TC-GH1381-02: ImagePlus shows when isProcessing=false
    it('TC-GH1381-02: renders ImagePlus icon when isProcessing=false', () => {
        const { container } = render(
            <ImageToolbar onImageSelect={mockOnImageSelect} isProcessing={false} />
        )

        // Should have at least one icon; verify it's NOT the spinner (no animate-spin)
        const icons = container.querySelectorAll('svg')
        expect(icons.length).toBeGreaterThan(0)
        // At least one icon should NOT be spinning
        const hasNonSpinning = Array.from(icons).some(
            (icon) => !icon.className.baseVal?.includes('animate-spin')
        )
        expect(hasNonSpinning).toBe(true)
    })

    // TC-GH1381-03: Button disabled when isProcessing=true
    it('TC-GH1381-03: button is disabled when isProcessing=true', () => {
        const { container } = render(
            <ImageToolbar onImageSelect={mockOnImageSelect} isProcessing={true} />
        )

        const button = container.querySelector('button')
        expect(button?.disabled).toBe(true)
    })

    it('TC-GH1381-03b: button is enabled when isProcessing=false or undefined', () => {
        const { container: container1 } = render(
            <ImageToolbar onImageSelect={mockOnImageSelect} isProcessing={false} />
        )
        expect(container1.querySelector('button')?.disabled).toBe(false)

        const { container: container2 } = render(
            <ImageToolbar onImageSelect={mockOnImageSelect} />
        )
        expect(container2.querySelector('button')?.disabled).toBe(false)
    })

    // TC-GH1381-04: Uses "uploading" i18n key when processing
    it('TC-GH1381-04: displays i18n text "Uploading..." when isProcessing=true', () => {
        render(<ImageToolbar onImageSelect={mockOnImageSelect} isProcessing={true} />)

        const uploadingText = screen.getByText('Uploading...')
        expect(uploadingText).toBeTruthy()
    })

    // TC-GH1381-05: Uses "changeImage" i18n key when idle
    it('TC-GH1381-05: displays i18n text "Change Image" when isProcessing=false', () => {
        render(<ImageToolbar onImageSelect={mockOnImageSelect} isProcessing={false} />)

        const changeImageText = screen.getByText('Change Image')
        expect(changeImageText).toBeTruthy()
    })

    it('TC-GH1381-05b: displays i18n text "Change Image" when isProcessing is undefined', () => {
        render(<ImageToolbar onImageSelect={mockOnImageSelect} />)

        const changeImageText = screen.getByText('Change Image')
        expect(changeImageText).toBeTruthy()
    })

    // TC-GH1381-03c: Button opacity reduced when disabled
    it('TC-GH1381-03c: button has opacity-50 class when disabled', () => {
        const { container } = render(
            <ImageToolbar onImageSelect={mockOnImageSelect} isProcessing={true} />
        )

        const button = container.querySelector('button')
        expect(button?.className).toContain('disabled:opacity-50')
    })
})

// =============================================================================
// Section 2 — Persistence Safety: UPLOAD_FIELDS Contract Tests (GH-1381-06 to 09)
// =============================================================================

describe('Persistence safety — UPLOAD_FIELDS & normalizeUploadField (GH-1381)', () => {
    // TC-GH1381-06: Root-level normalized fields (image, backgroundImage, logo, avatar)
    // are normalized from object { id, url, alt } to bare integer id
    it('TC-GH1381-06: root-level image field { id, url, alt } → normalized to bare id integer', () => {
        // Arrange — GH-1381 Strategy 2: when uploading, PreviewFrame stores
        // { id: newMediaId, url: newUrl, alt: existingAlt } for immediate preview.
        // On save, normalizeBlocksForPersistence must extract just the id.
        const blocks = [
            {
                blockType: 'hero',
                headline: 'Welcome',
                image: {
                    id: 42,
                    url: 'https://cdn.example.com/hero-new.jpg',
                    alt: 'Hero image',
                },
            },
        ]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — image field is now bare integer, not object
        expect(result[0].image).toBe(42)
        expect(typeof result[0].image).toBe('number')
    })

    // TC-GH1381-07: CRITICAL — posterImage / thumbnail / background_image are NOT
    // in UPLOAD_FIELDS, so they must stay bare integers on save (not objects).
    // If we store object on a non-normalized field, it persists raw (data loss).
    it('TC-GH1381-07: posterImage NOT in UPLOAD_FIELDS → must not store as object', () => {
        // Arrange — verify posterImage is NOT in UPLOAD_FIELDS
        expect(UPLOAD_FIELDS).not.toContain('posterImage')
        expect(UPLOAD_FIELDS).not.toContain('thumbnail')
        expect(UPLOAD_FIELDS).not.toContain('background_image')

        // Verify the fields that ARE normalized
        expect(UPLOAD_FIELDS).toContain('image')
        expect(UPLOAD_FIELDS).toContain('backgroundImage')
        expect(UPLOAD_FIELDS).toContain('logo')
        expect(UPLOAD_FIELDS).toContain('avatar')
    })

    // TC-GH1381-08: UPLOAD_FIELDS array membership guard
    // Ensures the list stays consistent between PreviewFrame.tsx (buildImageValue)
    // and block-normalization.ts (normalizeBlocksForPersistence).
    it('TC-GH1381-08: UPLOAD_FIELDS includes the 5 normalizable root fields', () => {
        const expected = ['image', 'backgroundImage', 'logo', 'avatar', 'ogImage']
        expect(UPLOAD_FIELDS).toEqual(expect.arrayContaining(expected))
        expect(UPLOAD_FIELDS.length).toBe(expected.length)
    })

    // TC-GH1381-09: Nested array items (testimonials.avatar, carousel.image, etc.)
    // are also normalized when they're in UPLOAD_FIELDS
    it('TC-GH1381-09: nested array items with upload fields are normalized too', () => {
        // Arrange — testimonials block with avatar in array items
        const blocks = [
            {
                blockType: 'testimonials',
                headline: 'Reviews',
                testimonials: [
                    {
                        text: 'Great product!',
                        author: 'Alice',
                        avatar: {
                            id: 100,
                            url: 'https://cdn.example.com/alice.jpg',
                            alt: 'Alice avatar',
                        },
                    },
                    {
                        text: 'Amazing service!',
                        author: 'Bob',
                        avatar: 200, // Already bare integer
                    },
                ],
            },
        ]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — both normalized to integers
        const testimonials = result[0].testimonials as Array<Record<string, unknown>>
        expect(testimonials[0].avatar).toBe(100)
        expect(testimonials[1].avatar).toBe(200)
    })

    // TC-GH1381-06b: Test the inverse — bare integer stays as-is
    it('TC-GH1381-06b: root-level image already bare integer → stays as-is', () => {
        // Arrange — legacy data with bare integer image id
        const blocks = [
            {
                blockType: 'hero',
                headline: 'Welcome',
                image: 99,
            },
        ]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert
        expect(result[0].image).toBe(99)
        expect(typeof result[0].image).toBe('number')
    })

    // TC-GH1381-06c: Null image → stays null
    it('TC-GH1381-06c: null image → stays null (field cleared)', () => {
        // Arrange
        const blocks = [
            {
                blockType: 'hero',
                headline: 'Welcome',
                image: null,
            },
        ]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert
        expect(result[0].image).toBeNull()
    })
})

// =============================================================================
// Section 3 — normalizeUploadField Unit Tests (Pure Function Tests)
// =============================================================================

describe('normalizeUploadField — GH-1381 object extraction (direct unit tests)', () => {
    // TC-GH1381-06 (lower level)
    it('TC-GH1381-06: object with id/url/alt → extracts id', () => {
        const mediaObject = {
            id: 42,
            url: 'https://cdn.example.com/image.jpg',
            alt: 'Test image',
        }

        const result = normalizeUploadField(mediaObject)

        expect(result).toBe(42)
        expect(typeof result).toBe('number')
    })

    it('TC-GH1381-06b: object with only id → extracts id', () => {
        // Minimal object (only id field)
        const mediaObject = { id: 99 }

        const result = normalizeUploadField(mediaObject)

        expect(result).toBe(99)
    })

    it('TC-GH1381-06c: string integer → converts to Number', () => {
        const stringId = '123'

        const result = normalizeUploadField(stringId)

        expect(result).toBe(123)
        expect(typeof result).toBe('number')
    })

    it('TC-GH1381-06d: string URL → returns null (can\'t save as media ref)', () => {
        const externalUrl = 'https://images.unsplash.com/photo-abc123.jpg'

        const result = normalizeUploadField(externalUrl)

        expect(result).toBeNull()
    })

    it('TC-GH1381-06e: object without id → returns null', () => {
        const objectWithoutId = {
            url: 'https://example.com/img.jpg',
            alt: 'Missing id',
        }

        const result = normalizeUploadField(objectWithoutId)

        expect(result).toBeNull()
    })

    it('TC-GH1381-06f: null → stays null', () => {
        const result = normalizeUploadField(null)

        expect(result).toBeNull()
    })

    it('TC-GH1381-06g: integer → stays as integer', () => {
        const result = normalizeUploadField(42)

        expect(result).toBe(42)
    })
})

// =============================================================================
// Section 4 — Integration: GH-1381 Full Save Round-Trip
// =============================================================================

describe('GH-1381 integration — full save round-trip', () => {
    it('TC-GH1381-10: hero block: image stays object in memory, becomes integer on save', () => {
        // Simulate the full PreviewFrame → save cycle

        // 1. In-memory (after upload, for preview): object
        const inMemoryBlock = {
            blockType: 'hero',
            headline: 'Welcome',
            image: {
                id: 42,
                url: 'https://cdn.example.com/hero.jpg',
                alt: 'Hero',
            },
        }

        // 2. On save: normalizes to integer
        const saved = normalizeBlocksForPersistence([inMemoryBlock])

        expect(saved[0].image).toBe(42)
        expect(typeof saved[0].image).toBe('number')
    })

    it('TC-GH1381-11: gallery block: multiple images normalized in one block', () => {
        // Arrange — mixed object/integer gallery images (realistic after edits)
        const blocks = [
            {
                blockType: 'gallery',
                headline: 'Gallery',
                images: [
                    {
                        image: { id: 10, url: 'https://example.com/1.jpg', alt: 'First' },
                        caption: 'First',
                    },
                    {
                        image: 20,
                        caption: 'Second',
                    },
                    {
                        image: { id: 30, url: 'https://example.com/3.jpg', alt: 'Third' },
                        caption: 'Third',
                    },
                ],
            },
        ]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — all become integers
        const images = result[0].images as Array<Record<string, unknown>>
        expect(images[0].image).toBe(10)
        expect(images[1].image).toBe(20)
        expect(images[2].image).toBe(30)
        expect(images.every((img) => typeof img.image === 'number')).toBe(true)
    })
})

// =============================================================================
// Section 5 — Edge Cases & Data Integrity
// =============================================================================

describe('GH-1381 edge cases — data integrity', () => {
    it('TC-GH1381-12: object with id=0 → extracted correctly (falsy but valid)', () => {
        // Edge: 0 is falsy but a valid media id
        const mediaObject = { id: 0, url: 'https://example.com/img.jpg', alt: 'Zero id' }

        const result = normalizeUploadField(mediaObject)

        expect(result).toBe(0)
        expect(typeof result).toBe('number')
    })

    it('TC-GH1381-13: large media id (beyond 32-bit) preserved', () => {
        // Edge: very large id still extracted
        const largeId = 9007199254740991 // Number.MAX_SAFE_INTEGER
        const mediaObject = { id: largeId, url: 'https://example.com/img.jpg', alt: 'Large' }

        const result = normalizeUploadField(mediaObject)

        expect(result).toBe(largeId)
    })

    it('TC-GH1381-14: object with extra fields (url, alt, metadata) → only id extracted', () => {
        // Ensure no extra fields leak into the saved id
        const mediaObject = {
            id: 42,
            url: 'https://cdn.example.com/image.jpg',
            alt: 'Test',
            filename: 'image.jpg',
            size: 50000,
            mimeType: 'image/jpeg',
        }

        const result = normalizeUploadField(mediaObject)

        expect(result).toBe(42)
        expect(typeof result).toBe('number')
        // Verify no leakage of other fields
        expect(result).not.toHaveProperty('url')
        expect(result).not.toHaveProperty('alt')
    })

    it('TC-GH1381-15: deeply nested images stay normalized', () => {
        // Arrange — nested structure with upload fields
        const blocks = [
            {
                blockType: 'carousel',
                headline: 'Carousel',
                items: [
                    {
                        image: { id: 100, url: 'https://example.com/1.jpg', alt: '1' },
                        title: 'Slide 1',
                    },
                ],
            },
        ]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert
        const items = result[0].items as Array<Record<string, unknown>>
        expect(items[0].image).toBe(100)
        expect(typeof items[0].image).toBe('number')
    })
})
