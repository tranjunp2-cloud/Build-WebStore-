/**
 * GH-1611 — symptom-level regression test.
 *
 * Reported: a site generated for a BAKERY (form industry = "🍜 F&B / Cafe / Bakery",
 * product "bánh") rendered a Gallery of 6 images — 4 cakes/sweets, then 2 CLOTHING
 * photos (a jeans+knit-hat flatlay and a shirt rack).
 *
 * This test reproduces the whole image path for that gen at the level the bug was
 * observed (industry string in → the 6 photos gallery actually receives) and asserts
 * the issue's acceptance criterion: every gallery image belongs to the user's
 * industry, none from another one.
 *
 * The Pixabay mock below is the load-bearing part: it emulates the REAL API
 * contract — `category` is an AND filter. Ask it for food and it can only return
 * food; ask it for `business` (what the bug shipped) and clothing/retail stock is
 * fair game. That is precisely how fashion photos reached a bakery.
 *
 * TC-GH1611-30..32
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildImagePool, pickManyFromPool } from '@/lib/ai/image-pool'
import { BLOCK_IMAGE_SPEC, computePoolBucketSizes } from '@/lib/ai/media-injector'
import {
    resolveComposerCategory,
    normalizeComposerCategory,
} from '@/lib/ai/composer-category-resolver'
import type { PixabayPhoto } from '@/lib/ai/pixabay-client'

const mockSearchPhotos = vi.fn<(...args: unknown[]) => Promise<PixabayPhoto[]>>()

vi.mock('@/lib/ai/pixabay-client', async () => {
    const actual = await vi.importActual<typeof import('@/lib/ai/pixabay-client')>(
        '@/lib/ai/pixabay-client',
    )
    return { ...actual, searchPhotos: (...args: unknown[]) => mockSearchPhotos(...args) }
})

// ── Pixabay stand-in ────────────────────────────────────────────────────────

function photo(id: string, tags: string): PixabayPhoto {
    return {
        id,
        url: `https://pixabay.com/get/${id}.jpg`,
        alt: tags, // Pixabay ships tags in this field — the gate reads it
        photographer: 'Anon',
        width: 1920,
        height: 1080,
    }
}

/** Bakery stock — what `category=food` can return. */
const FOOD_STOCK = [
    photo('cake1', 'cake, chocolate, dessert'),
    photo('cake2', 'cupcake, frosting, sweet'),
    photo('cake3', 'birthday cake, candles, celebration'),
    photo('cake4', 'chocolate cake, bread, bakery'),
    photo('cake5', 'frosted cupcake, sweet, food'),
    photo('cake6', 'chocolate birthday cake, pastry, bakery'),
    photo('cake7', 'frosted cupcake, cookies, dessert'),
]
/** On-domain but off-product — what a loose `category=food` search also ships back. */
const LOOSE_FOOD_STOCK = [
    photo('loose1', 'sushi, salmon, japanese'),
    photo('loose2', 'steak, grill, meat'),
]
/** Retail/fashion stock — reachable ONLY when the category filter is not `food`. */
const RETAIL_STOCK = [
    photo('clothes1', 'jeans, knit hat, flatlay'),
    photo('clothes2', 'shirt rack, clothing store, retail'),
    photo('clothes3', 'shopping bags, boutique, sale'),
]

const isClothing = (id: string) => id.startsWith('clothes')

/**
 * Emulates Pixabay: `category` is an AND filter over uploader-assigned categories.
 * A thin keyword match is deliberate — Pixabay ranks by popularity and matches
 * loosely, which is exactly why the client-side relevance gate has to exist.
 */
function pixabay(opts: { category?: string }): PixabayPhoto[] {
    // Even inside `category=food`, Pixabay's loose keyword ranking returns photos that
    // are on-domain but NOT the merchant's product. If the mock only ever served cakes
    // to a cake query, this test would be proving its own fixture, not the gate.
    if (opts.category === 'food') return [...FOOD_STOCK, ...LOOSE_FOOD_STOCK]
    // category=business (the drift) or no filter → generic commerce stock is eligible
    return [...FOOD_STOCK.slice(0, 4), ...RETAIL_STOCK]
}

beforeEach(() => {
    mockSearchPhotos.mockReset()
    mockSearchPhotos.mockImplementation(
        (_q: unknown, _n: unknown, opts: unknown) => Promise.resolve(pixabay(opts as { category?: string })),
    )
})

// The exact gen from the report: form posts the composer key, product is Vietnamese
// "bánh", translated to English before the pool search (GEN_TRANSLATE_POOL_KEYWORDS
// defaults to on).
const FORM_INDUSTRY = 'fnb'
const TRANSLATED_PRODUCTS = ['chocolate birthday cake', 'frosted cupcake']
const GALLERY_SLOTS = BLOCK_IMAGE_SPEC.gallery!.nestedArray![0]!.minCount! // 6

async function galleryPhotosFor(category: string) {
    const sizes = computePoolBucketSizes(new Set(['hero', 'gallery', 'about']))
    const pool = await buildImagePool({
        category,
        products: TRANSLATED_PRODUCTS,
        seed: 7,
        landscapeSize: sizes.landscape,
        squareSize: 0,
        landscapeMin: sizes.landscapeMin,
    })
    return { pool, ids: pickManyFromPool(pool, 'gallery', 99, GALLERY_SLOTS).map((p) => p.id) }
}

describe('TC-GH1611-30 — bakery gallery must not contain clothing', () => {
    it('product gate blocks clothing even if an old caller supplies the drifted category', async () => {
        // resolveComposerCategory('fnb') → 'business' (the key is absent from its own
        // keyword list) → Pixabay filtered on business → retail stock eligible.
        const drifted = resolveComposerCategory(FORM_INDUSTRY)
        expect(drifted).toBe('business')

        const sizes = computePoolBucketSizes(new Set(['hero', 'gallery', 'about']))
        const pool = await buildImagePool({
            category: drifted,
            products: TRANSLATED_PRODUCTS,
            seed: 7,
            landscapeSize: sizes.landscape,
            squareSize: 0,
        })

        // Defense in depth: category normalization is still load-bearing for search
        // quality, but every tier now keeps the merchant product gate. A stale caller
        // therefore cannot reintroduce the original clothing leak.
        const searchOpts = mockSearchPhotos.mock.calls[0]![2] as { category?: string }
        expect(searchOpts.category).toBe('business') // ← not 'food'
        expect(pool.landscape.some((p) => isClothing(p.id))).toBe(false)
    })

    it('[TC-GH1611-31] fixed path: all 6 gallery images are on-industry', async () => {
        const category = normalizeComposerCategory(FORM_INDUSTRY)
        expect(category).toBe('fnb')

        const { pool, ids } = await galleryPhotosFor(category)

        // Every Pixabay call for this gen is domain-filtered to food.
        for (const call of mockSearchPhotos.mock.calls) {
            expect((call[2] as { category?: string }).category).toBe('food')
        }
        // The issue's acceptance criterion, literally.
        expect(ids).toHaveLength(GALLERY_SLOTS)
        expect(ids.filter(isClothing)).toEqual([])
        // ...and the gate, not just the category filter, is doing work: the merchant's
        // own products lead the pool, ahead of the loose on-domain stock (sushi/steak)
        // that the same `category=food` search also returns.
        expect(pool.landscape.slice(0, 3).map((p) => p.id)).toEqual(['cake1', 'cake2', 'cake3'])
    })

    it('[TC-GH1611-32] gallery is filled from the pool alone — no off-pool deficit patch', async () => {
        // The reported ordering (4 right, then 2 wrong) came from media-injector topping
        // gallery up with a separate legacy search and APPENDING those photos. The pool
        // must therefore hand over all 6 slots by itself.
        const { ids } = await galleryPhotosFor(normalizeComposerCategory(FORM_INDUSTRY))
        expect(new Set(ids).size).toBe(GALLERY_SLOTS) // 6 distinct, no shortfall
    })
})
