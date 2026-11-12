/**
 * GH-1611 (QA Failed round 2) — wrong PRODUCT inside the right industry.
 *
 * A bakery merchant (industry `fnb`, product "bánh") got coffee-cup photos: the
 * `fnb` category phrase is "coffee shop", used by every scaffolding / relaxed /
 * category-fallback query, and a failed LLM translation fell back to that phrase
 * as the relevance gate itself.
 *
 * TC-GH1611-37 isBakeryContext lexicon (bakery vs café)
 * TC-GH1611-38 categorySearchPhrase + pool tier-3 query use a bakery phrase
 * TC-GH1611-39 getMediaForBlock gates on translated gateTerms
 * TC-GH1611-40 dictionary translates bakery terms (no "coffee shop" gate)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isBakeryContext } from '@/lib/ai/image-keywords'
import { buildImagePool, categorySearchPhrase } from '@/lib/ai/image-pool'
import { getMediaForBlock } from '@/lib/ai/media-pipeline'
import { translateKnownProductTerms } from '@/lib/ai/product-translator'
import { searchPhotos, downloadPhotoBuffer, photoMatchesTerms, type PixabayPhoto } from '@/lib/ai/pixabay-client'

vi.mock('@/lib/ai/pixabay-client', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    searchPhotos: vi.fn(),
    downloadPhotoBuffer: vi.fn(),
}))

function photo(id: string, tags: string): PixabayPhoto {
    return { id, url: `https://pixabay.com/get/${id}.jpg`, alt: tags, photographer: 'Anon', width: 1920, height: 1080 }
}

beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(searchPhotos).mockReset()
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('TC-GH1611-37 — isBakeryContext', () => {
    it.each([
        [['bánh']],
        [['Bánh kem', 'kẹo']],
        [['chocolate cake', 'cupcake']],
        [['kek', 'roti']],
        [['cake platter']], // 'platter' contains 'latte' — whole-token match only
        [['steamed cake']], // 'steamed' contains 'tea'
    ])('%j is a bakery', (terms) => {
        expect(isBakeryContext(terms)).toBe(true)
    })

    it.each([
        [['cà phê', 'bánh']],
        [['coffee', 'cake']],
        [['trà sữa']],
        [[]],
        [['phở']],
        [['bánh mì']],
    ])('%j is not a bakery (café / other / empty keeps default phrase)', (terms) => {
        expect(isBakeryContext(terms)).toBe(false)
    })
})

describe('TC-GH1611-38 — category search phrase', () => {
    it('fnb + bakery products → bakery phrase (EN and VN)', () => {
        expect(categorySearchPhrase('fnb', ['bánh'], false)).toBe('bakery pastry')
        expect(categorySearchPhrase('fnb', ['bánh'], true)).toBe('tiệm bánh')
    })

    it('fnb café and other categories keep the curated default', () => {
        expect(categorySearchPhrase('fnb', ['cà phê'], false)).toBe('coffee shop')
        expect(categorySearchPhrase('fnb', [], true)).toBe('quán cà phê')
        expect(categorySearchPhrase('restaurant', ['bánh'], false)).toBe('restaurant interior')
    })

    it('pool tier-3 fallback for a Vietnamese bakery searches "tiệm bánh", never "quán cà phê"', async () => {
        vi.mocked(searchPhotos).mockResolvedValue([])
        await buildImagePool({
            category: 'fnb',
            products: ['kẹo'],
            gateProducts: ['kẹo'],
            topProduct: 'kẹo',
            seed: 1,
            landscapeSize: 3,
            squareSize: 0,
        })
        const queries = vi.mocked(searchPhotos).mock.calls.map((c) => c[0])
        expect(queries).toContain('tiệm bánh')
        expect(queries).not.toContain('quán cà phê')
        expect(queries).not.toContain('coffee shop')
    })
})

describe('TC-GH1611-39 — per-block gate uses translated terms', () => {
    const ctx = { businessName: 'Tiệm bánh', tenantId: '1', category: 'fnb', language: 'vi' as const }
    const payloadStub = { create: vi.fn().mockResolvedValue({ id: 9 }) } as never

    it('keeps the cake photo and drops the coffee cup when raw terms are Vietnamese', async () => {
        vi.mocked(searchPhotos).mockResolvedValue([
            photo('cup', 'cup, coffee, coffee cup'),
            photo('cake', 'cake, dessert, sweet'),
        ])
        vi.mocked(downloadPhotoBuffer).mockResolvedValue({ buffer: Buffer.from('i'), mimetype: 'image/jpeg' } as never)

        const result = await getMediaForBlock(
            'gallery',
            ['chocolate cake'],
            1,
            { ...ctx, englishKeywords: ['bánh'], gateTerms: ['cake'] } as never,
            payloadStub,
        )

        expect(result.photos.map((p) => p.id)).toEqual(['cake'])
    })
})

describe('TC-GH1611-40 — dictionary covers bakery terms', () => {
    it('translates to single head words the gate can match, not "coffee shop"', () => {
        expect(translateKnownProductTerms(['bánh'])).toEqual(['cake'])
        expect(translateKnownProductTerms(['bánh kem', 'kẹo'])).toEqual(['cake', 'candy'])
        // input → fallback translation → gate: a typical cake photo passes, a cup does not
        const [gateTerm] = translateKnownProductTerms(['bánh'])
        expect(photoMatchesTerms('cake, dessert, sweet', [gateTerm!])).toBe(true)
        expect(photoMatchesTerms('cup, coffee, coffee cup', [gateTerm!])).toBe(false)
        // ambiguous generic "bánh"/"kẹo" must not rewrite savory dishes (review B1)
        expect(translateKnownProductTerms(['bánh canh cua'])).toEqual([])
        expect(translateKnownProductTerms(['bánh cuốn', 'bánh bao'])).toEqual([])
        // longer VN dish entries still win over the generic "bánh"
        expect(translateKnownProductTerms(['bánh mì'])).toEqual(['vietnamese banh mi sandwich'])
    })
})
