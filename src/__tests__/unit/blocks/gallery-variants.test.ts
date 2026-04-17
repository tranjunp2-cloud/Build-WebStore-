import { describe, it, expect } from 'vitest'
import { GalleryConfigSchema, galleryMeta } from '@/blocks/gallery/config'

// ── TC-S2-010: Gallery Block Variants ───────────────────────────────────────

const GALLERY_VARIANTS = [
    'grid', 'masonry', 'carousel', 'lightbox', 'filmstrip', 'justified',
] as const

const minimalGalleryConfig = (overrides: Record<string, unknown> = {}) => ({
    blockType: 'gallery',
    headline: 'Our Gallery',
    images: [
        { image: { url: 'https://example.com/1.jpg', alt: 'Image 1' }, caption: 'Caption 1' },
        { image: { url: 'https://example.com/2.jpg' } },
    ],
    ...overrides,
})

describe('[TC-S2-010] Gallery Block Variants', () => {
    describe('Config Schema', () => {
        it('validates all 6 variants', () => {
            for (const v of GALLERY_VARIANTS) {
                const result = GalleryConfigSchema.safeParse(minimalGalleryConfig({ variant: v }))
                expect(result.success, `variant '${v}' should be valid`).toBe(true)
            }
        })

        it('rejects invalid variant name', () => {
            const result = GalleryConfigSchema.safeParse(minimalGalleryConfig({ variant: 'nonexistent' }))
            expect(result.success).toBe(false)
        })

        it('defaults to "grid" when variant not specified', () => {
            const result = GalleryConfigSchema.parse(minimalGalleryConfig())
            expect(result.variant).toBe('grid')
        })

        it('accepts images with optional caption', () => {
            const result = GalleryConfigSchema.safeParse(minimalGalleryConfig({
                images: [
                    { image: { url: 'https://example.com/1.jpg' }, caption: 'Nice photo' },
                    { image: { url: 'https://example.com/2.jpg' } },
                ],
            }))
            expect(result.success).toBe(true)
        })

        it('defaults images to empty array when not provided', () => {
            const result = GalleryConfigSchema.parse({
                blockType: 'gallery',
            })
            expect(result.images).toEqual([])
        })
    })

    describe('Meta', () => {
        it('has exactly 6 variants', () => {
            expect(galleryMeta.variants).toHaveLength(6)
        })

        it('variants match schema enum', () => {
            for (const v of galleryMeta.variants) {
                const result = GalleryConfigSchema.safeParse(minimalGalleryConfig({ variant: v }))
                expect(result.success, `meta variant '${v}' should be valid in schema`).toBe(true)
            }
        })

        it('has correct block type', () => {
            expect(galleryMeta.type).toBe('gallery')
        })

        it('defaultVariant is "grid"', () => {
            expect(galleryMeta.defaultVariant).toBe('grid')
        })
    })
})
