/**
 * TC-P03-05: Packs content stats field counter
 * Tests the pure block-field counting logic used by /api/admin/packs/[id]/stats.
 * No DB dependency — tests the JSON-scanning helpers only.
 */
import { describe, it, expect } from 'vitest'

// ── Replicate field detection logic from route.ts ─────────────────────────────

const STRING_FIELD_KEYS = new Set([
    'headline', 'title', 'subtitle', 'description', 'body', 'text',
    'content', 'label', 'caption', 'cta', 'buttonText', 'name',
    'tagline', 'summary', 'bio', 'excerpt',
])

const IMAGE_FIELD_KEYS = new Set([
    'image', 'backgroundImage', 'logo', 'avatar', 'photo', 'thumbnail',
    'coverImage', 'banner', 'src', 'url',
])

const PRODUCT_BLOCK_TYPES = new Set([
    'products-grid', 'products-featured', 'product-quick-view',
])

function countBlockFields(layout: unknown): { strings: number; images: number; products: number } {
    let strings = 0
    let images = 0
    let products = 0

    if (!Array.isArray(layout)) return { strings, images, products }

    for (const block of layout) {
        if (!block || typeof block !== 'object') continue
        const b = block as Record<string, unknown>

        if (typeof b.blockType === 'string' && PRODUCT_BLOCK_TYPES.has(b.blockType)) {
            products++
        }

        for (const [key, val] of Object.entries(b)) {
            if (key === 'blockType' || key === 'id') continue
            if (typeof val === 'string' && val.trim().length > 0) {
                if (STRING_FIELD_KEYS.has(key)) strings++
                else if (IMAGE_FIELD_KEYS.has(key)) images++
            }
        }
    }

    return { strings, images, products }
}

// ── TC-P03-05: Empty pack ─────────────────────────────────────────────────────

describe('TC-P03-05: Packs stats — empty layout', () => {
    it('returns all zeros for empty array', () => {
        expect(countBlockFields([])).toEqual({ strings: 0, images: 0, products: 0 })
    })

    it('returns all zeros for null layout', () => {
        expect(countBlockFields(null)).toEqual({ strings: 0, images: 0, products: 0 })
    })

    it('returns all zeros for non-array layout', () => {
        expect(countBlockFields({ blockType: 'hero' })).toEqual({ strings: 0, images: 0, products: 0 })
    })
})

// ── TC-P03-06: Full pack with mixed blocks ────────────────────────────────────

describe('TC-P03-06: Packs stats — mixed layout', () => {
    const layout = [
        {
            blockType: 'hero',
            id: 'b1',
            headline: 'Welcome',
            subtitle: 'Great things await',
            image: 'https://example.com/hero.jpg',
        },
        {
            blockType: 'features',
            id: 'b2',
            title: 'Our Features',
            description: 'We offer many features',
        },
        {
            blockType: 'products-grid',
            id: 'b3',
            title: 'Shop now',
        },
        {
            blockType: 'gallery',
            id: 'b4',
            src: 'https://example.com/img.jpg',
            backgroundImage: 'https://example.com/bg.jpg',
        },
    ]

    it('counts string fields correctly', () => {
        const result = countBlockFields(layout)
        // headline + subtitle + title + description + title (products-grid) = 5
        expect(result.strings).toBe(5)
    })

    it('counts image fields correctly', () => {
        const result = countBlockFields(layout)
        // image (hero) + src + backgroundImage (gallery) = 3
        expect(result.images).toBe(3)
    })

    it('counts product blocks correctly', () => {
        const result = countBlockFields(layout)
        // 1 products-grid block
        expect(result.products).toBe(1)
    })
})

// ── TC-P03-07: Multiple product blocks ───────────────────────────────────────

describe('TC-P03-07: Packs stats — multiple product blocks', () => {
    const layout = [
        { blockType: 'products-grid', id: 'p1', title: 'Grid' },
        { blockType: 'products-featured', id: 'p2', headline: 'Featured' },
        { blockType: 'product-quick-view', id: 'p3' },
    ]

    it('counts all product block variants', () => {
        const result = countBlockFields(layout)
        expect(result.products).toBe(3)
    })
})

// ── TC-P03-08: Ignores empty/non-string values ────────────────────────────────

describe('TC-P03-08: Packs stats — skips empty and non-string values', () => {
    const layout = [
        {
            blockType: 'hero',
            id: 'b1',
            headline: '',       // empty string — skip
            title: null,        // null — skip
            subtitle: 42,       // number — skip
            description: 'Real description',  // valid
        },
    ]

    it('only counts non-empty string values', () => {
        const result = countBlockFields(layout)
        expect(result.strings).toBe(1)  // only description
    })
})
