import { describe, it, expect } from 'vitest'
import { ProductQuickViewConfigSchema } from '@/blocks/product-quick-view/config'
import { pairImagesWithAlts } from '@/blocks/product-quick-view/index'

// ─── TC-F08-01-15: Alt text carried through product block data pipeline ──────

describe('ProductQuickViewConfigSchema — imageAlts backward compat [TC-F08-01-15]', () => {
    it('defaults imageAlts to [] when not provided (old CMS block data)', () => {
        const result = ProductQuickViewConfigSchema.safeParse({
            blockType: 'product-quick-view',
            headline: 'Products',
            products: [{
                name: 'Test Product',
                price: 99,
                imageUrls: ['https://example.com/img.jpg'],
                // imageAlts intentionally omitted (old saved block config)
            }],
        })
        expect(result.success).toBe(true)
        expect(result.data!.products[0].imageAlts).toEqual([])
    })

    it('preserves imageAlts when provided', () => {
        const result = ProductQuickViewConfigSchema.safeParse({
            blockType: 'product-quick-view',
            headline: 'Products',
            products: [{
                name: 'Test Product',
                price: 99,
                imageUrls: ['https://example.com/img.jpg'],
                imageAlts: ['Custom alt text'],
            }],
        })
        expect(result.success).toBe(true)
        expect(result.data!.products[0].imageAlts).toEqual(['Custom alt text'])
    })

    it('defaults imageAlts to [] for empty products array', () => {
        const result = ProductQuickViewConfigSchema.safeParse({
            blockType: 'product-quick-view',
            headline: 'Products',
            products: [],
        })
        expect(result.success).toBe(true)
        expect(result.data!.products).toEqual([])
    })
})

// ─── TC-F08-01-15: imgPairs mapping keeps imageUrls/imageAlts index-aligned ──

describe('product-quick-view live API mapping — imageUrls and imageAlts aligned [TC-F08-01-15]', () => {
    it('maps alt alongside url, preserving index alignment', () => {
        const raw = [
            { image: { url: 'https://cdn/a.jpg' }, alt: 'First image alt' },
            { image: { url: 'https://cdn/b.jpg' }, alt: 'Second image alt' },
        ]
        const { imageUrls, imageAlts } = pairImagesWithAlts(raw)
        expect(imageUrls).toEqual(['https://cdn/a.jpg', 'https://cdn/b.jpg'])
        expect(imageAlts).toEqual(['First image alt', 'Second image alt'])
    })

    it('filters null-url entries and keeps alt index aligned with remaining urls', () => {
        const raw = [
            { image: { url: 'https://cdn/a.jpg' }, alt: 'Alt A' },
            { image: undefined, alt: 'Alt B — no url, should be filtered' },
            { image: { url: 'https://cdn/c.jpg' }, alt: 'Alt C' },
        ]
        const { imageUrls, imageAlts } = pairImagesWithAlts(raw)
        expect(imageUrls).toEqual(['https://cdn/a.jpg', 'https://cdn/c.jpg'])
        expect(imageAlts).toEqual(['Alt A', 'Alt C'])
        expect(imageUrls.length).toBe(imageAlts.length)
    })

    it('falls back to empty string when alt is missing', () => {
        const raw = [
            { image: { url: 'https://cdn/a.jpg' } },
        ]
        const { imageUrls, imageAlts } = pairImagesWithAlts(raw)
        expect(imageUrls).toEqual(['https://cdn/a.jpg'])
        expect(imageAlts).toEqual([''])
    })

    it('returns empty arrays for empty images input', () => {
        const { imageUrls, imageAlts } = pairImagesWithAlts([])
        expect(imageUrls).toEqual([])
        expect(imageAlts).toEqual([])
    })
})

// ─── TC-F08-01-15: products-grid / products-featured single-image alt mapping ─

describe('products-grid and products-featured single-image alt extraction [TC-F08-01-15]', () => {
    // Simulate the mapping used in both blocks: images?.[0]?.alt
    function extractFirstImageAlt(rawImages: Array<{ image?: { url?: string }; alt?: string }> | undefined) {
        return rawImages?.[0]?.alt
    }

    it('extracts alt from first image', () => {
        const images = [
            { image: { url: 'https://cdn/a.jpg' }, alt: 'Product hero shot' },
            { image: { url: 'https://cdn/b.jpg' }, alt: 'Side view' },
        ]
        expect(extractFirstImageAlt(images)).toBe('Product hero shot')
    })

    it('returns undefined when first image has no alt', () => {
        const images = [{ image: { url: 'https://cdn/a.jpg' } }]
        expect(extractFirstImageAlt(images)).toBeUndefined()
    })

    it('returns undefined when images array is empty', () => {
        expect(extractFirstImageAlt([])).toBeUndefined()
    })

    it('returns undefined when images is undefined', () => {
        expect(extractFirstImageAlt(undefined)).toBeUndefined()
    })

})
