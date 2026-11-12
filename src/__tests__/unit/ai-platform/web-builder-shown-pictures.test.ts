/**
 * TC-AIWB-47 / 48 — the copilot sees every picture the merchant sees: site_read view "block" lists under
 * `shown` each picture with its source (the section's own field, a product's photo, a sample picture) and
 * the op that changes it; view "page" says which sections have pictures. Featured Products has its own
 * picture list (`images`): shown while no product is on sale instead of samples, changed with set_pictures.
 * Real: site-shown.ts, site-samples.ts, site-read.ts, site-prepare.ts, the block registry.
 * Faked: Payload Local API (the `products` the block fetches from the storefront endpoint).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FOOTER, HERO, NAV, OWNER, PAGE_ID, SITE_ID, page, site } from './web-builder-fixtures'
import { readSite } from '@/lib/ai-platform/site/site-read'
import { describeShown, ownPictures } from '@/lib/ai-platform/site/site-shown'
import { preparePagePatch } from '@/lib/ai-platform/site/site-prepare'
import { blockRegistry } from '@/blocks/registry'

const db = vi.hoisted(() => ({
    site: null as Record<string, unknown> | null,
    page: null as Record<string, unknown> | null,
    counts: { active: 0, draft: 5, archived: 2 } as Record<string, number>,
    newest: [] as Array<Record<string, unknown>>,
    /** the where clause the products query used */
    productsWhere: null as unknown,
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        findByID: vi.fn(async ({ collection }: { collection: string }) => (collection === 'sites' ? db.site : db.page)),
        find: vi.fn(async ({ collection, where }: { collection: string; where?: unknown }) => {
            if (collection !== 'products') return { docs: [] }
            db.productsWhere = where
            return { docs: db.newest }
        }),
        count: vi.fn(async ({ where }: { where: { and: Array<{ status?: { equals: string } }> } }) => ({ totalDocs: db.counts[where.and[1]?.status?.equals ?? ''] ?? 0 })),
    })),
}))

const FEATURED_ID = '00000000-0000-4000-8000-0000000000f2'
const featured = (extra: Record<string, unknown> = {}) => ({ blockType: 'products-featured', id: FEATURED_ID, variant: 'carousel', headline: 'Bộ sưu tập nổi bật', productIds: [], ...extra })
const ctx = { siteId: String(SITE_ID), tenantId: '1' }

beforeEach(() => {
    db.site = site()
    db.page = page([NAV, HERO, featured(), FOOTER])
    db.counts = { active: 0, draft: 5, archived: 2 }
    db.newest = []
    db.productsWhere = null
})

describe('Featured Products — what it shows and where the pictures come from [TC-AIWB-47]', () => {
    it('no product on sale and no own pictures: 6 sample pictures, explained, changed with set_pictures', async () => {
        const shown = await describeShown(featured(), ctx)

        expect(shown.pictures).toHaveLength(6)
        expect(shown.pictures.every((p) => p.source === 'sample' && p.change.includes('set_pictures path "images"'))).toBe(true)
        expect(shown.notes.join(' ')).toMatch(/No product is on sale.*5 draft, 2 archived.*set_pictures path "images"/)
    })

    it('its own pictures replace the samples; a row without a picture stays a sample', async () => {
        const shown = await describeShown(featured({ images: [{ image: 43 }, { image: null, caption: 'x' }] }), ctx)

        expect(shown.pictures.map((p) => [p.where, p.source])).toEqual([['images.0.image', 'own'], ['images.1.image', 'sample']])
    })

    it('products on sale: their own photos (changed in Products); a product without a photo shows the section picture', async () => {
        db.newest = [
            { id: 'prod_a', name: 'Abaya', images: [{ image: { url: 'https://cdn/a.jpg' } }] },
            { id: 'prod_b', name: 'Hijab', images: [] },
        ]

        const shown = await describeShown(featured({ images: [{ image: 43 }] }), ctx)

        expect(shown.products).toMatchObject({ how: 'newest', list: [{ id: 'prod_a', photo: true }, { id: 'prod_b', photo: false }] })
        expect(shown.pictures.map((p) => [p.where, p.source])).toEqual([['product prod_a', 'product'], ['product prod_b', 'own']])
        expect(shown.pictures[0]!.change).toContain('edit the product in Products')
        expect(db.productsWhere).toEqual({ and: [{ site: { equals: SITE_ID } }, { status: { equals: 'active' } }, { deletedAt: { exists: false } }] })
    })
})

describe('site_read shows pictures by source [TC-AIWB-47]', () => {
    it('view "block" carries `shown`; view "page" says which sections have pictures', async () => {
        const block = (await readSite(OWNER, { view: 'block', siteId: String(SITE_ID), pageId: String(PAGE_ID), blockId: FEATURED_ID })) as { shown: { pictures: unknown[] }; editableFields: string[] }
        const pageView = (await readSite(OWNER, { view: 'page', siteId: String(SITE_ID), pageId: String(PAGE_ID) })) as { blocks: Array<{ id: string; pictures?: string }> }

        expect(block.shown.pictures).toHaveLength(6)
        expect(block.editableFields).toContain('images')
        expect(pageView.blocks.find((b) => b.id === FEATURED_ID)?.pictures).toBe('6 picture spots: 6 samples')
    })

    it('own picture fields at any depth, and gallery slots that fall back to samples', async () => {
        expect(ownPictures({ blockType: 'team', members: [{ name: 'A', image: 31 }, { name: 'B', image: null }] }).map((p) => [p.where, p.source])).toEqual([
            ['members.0.image', 'own'],
            ['members.1.image', 'empty'],
        ])
        const gallery = await describeShown({ blockType: 'gallery', images: [] }, ctx)
        expect(gallery.pictures).toHaveLength(6)
        expect(gallery.pictures.every((p) => p.source === 'sample')).toBe(true)
    })
})

describe('Featured Products own pictures [TC-AIWB-48]', () => {
    it('the block schema takes a list of pictures like a gallery', () => {
        expect(blockRegistry.validate('products-featured', { blockType: 'products-featured', variant: 'carousel', images: [{ image: { url: 'https://x/a.jpg' }, caption: 'A' }] }).success).toBe(true)
    })

    it('set_pictures on its "images" is drafted (before: sample pictures)', async () => {
        const result = (await preparePagePatch(OWNER, {
            siteId: String(SITE_ID),
            pageId: String(PAGE_ID),
            why: 'Our own photos',
            ops: [{ op: 'set_pictures', blockId: FEATURED_ID, path: 'images', items: [{ image: { ref: 'pixabay:1', name: 'Hijab' } }, { image: { ref: 'pixabay:2', name: 'Abaya' } }] }],
        })) as { error?: unknown; diffs: Array<{ field: string; before: string | null; after: string }> }

        expect(result.error).toBeUndefined()
        expect(result.diffs[0]).toMatchObject({ field: 'Images', before: 'sample pictures', after: expect.stringContaining('2 pictures: 1. Hijab; 2. Abaya') })
    })
})
