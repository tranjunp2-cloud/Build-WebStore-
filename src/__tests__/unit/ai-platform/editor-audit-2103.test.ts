/**
 * TC-AIAUD-078..079 — the copilot's product sections and diffs, audit #2103 (B1, B3):
 * - site_read "products" lists the site's own active, not deleted products with stock and a photo flag;
 * - a section's chosen products are checked against the storefront's rule and reported as "shows N of M";
 * - a second products section of the same kind on a page is refused (a swap and other kinds are fine);
 * - text with inline markup is shown as plain words in the before → after lines.
 * Real: site-read.ts, site-prepare.ts, site-products.ts, site-blocks.ts, the block registry. Faked: the Payload Local API.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FAQ, HERO, LAYOUT, NAV, OWNER, PAGE_ID, PRODUCTS, SITE_ID, page, site } from './web-builder-fixtures'
import { readSite } from '@/lib/ai-platform/site/site-read'
import { preparePagePatch } from '@/lib/ai-platform/site/site-prepare'
import { previewValue } from '@/lib/ai-platform/site/site-blocks'

type Row = Record<string, unknown>
const db = vi.hoisted(() => ({
    site: null as Row | null,
    page: null as Row | null,
    /** products of the workspace (the "known" read) */
    known: [] as Row[],
    /** products on sale on the site (the storefront read) */
    onSale: [] as Row[],
    wheres: [] as unknown[],
    /** what a category lookup finds */
    categories: [] as Row[],
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        findByID: vi.fn(async ({ collection }: { collection: string }) => (collection === 'sites' ? db.site : db.page)),
        find: vi.fn(async ({ collection, where }: { collection: string; where?: unknown }) => {
            if (collection === 'categories') return { docs: db.categories, totalDocs: db.categories.length }
            if (collection !== 'products') return { docs: [], totalDocs: 0 }
            db.wheres.push(where)
            // the storefront rule filters by status; the workspace read does not
            const storefront = JSON.stringify(where).includes('"status"')
            const docs = storefront ? db.onSale : db.known
            return { docs, totalDocs: docs.length }
        }),
    })),
}))

beforeEach(() => {
    db.site = site()
    db.page = page([NAV, HERO, FAQ, FOOTER_BLOCK()])
    db.known = []
    db.onSale = []
    db.wheres = []
    db.categories = []
})

function FOOTER_BLOCK() {
    return { blockType: 'footer', id: '00000000-0000-4000-8000-0000000000e1', variant: 'simple', copyrightText: '© Kedai Batik' }
}

const FEATURED = { blockType: 'products-featured', id: '00000000-0000-4000-8000-0000000000f1', variant: 'hero-product', headline: 'Featured', productIds: ['1'] }

const patch = (ops: unknown[]) =>
    preparePagePatch(OWNER, { siteId: String(SITE_ID), pageId: String(PAGE_ID), why: 'Show products', ops }) as Promise<Record<string, unknown> & { error?: { code: string; message: string }; guardrails?: Array<{ rule: string; ok: boolean; detail: string }> }>

// chosen products are a Products Grid in fixed mode (selectedProductIds); Featured Products shows the newest
const insertGrid = (selectedProductIds: string[]) => ({ op: 'insert_block', afterBlockId: HERO.id, block: { blockType: 'products-grid', variant: 'grid-3', headline: 'Our picks', selectedProductIds } })
const insertFeatured = (extra: Record<string, unknown> = {}) => ({ op: 'insert_block', afterBlockId: HERO.id, block: { blockType: 'products-featured', variant: 'hero-product', headline: 'Our picks', ...extra } })

describe('site_read products — the storefront rule [TC-AIAUD-078]', () => {
    it('TC-AIAUD-078: asks for this site\'s active, not deleted products of the workspace', async () => {
        db.onSale = [{ id: 1, name: 'Batik scarf', price: 40, status: 'active', inventory: 0, images: [{ image: 7 }] }, { id: 2, name: 'Tudung', price: 25, status: 'active', inventory: 5, images: [] }]

        const result = (await readSite(OWNER, { view: 'products', siteId: String(SITE_ID) })) as { products: Array<Record<string, unknown>>; note: string; total: number }

        const where = JSON.stringify(db.wheres[0])
        expect(where).toContain(`"site":{"equals":${SITE_ID}}`)
        expect(where).toContain('"status":{"equals":"active"}')
        expect(where).toContain('"deletedAt":{"exists":false}')
        expect(where).toContain('"tenant":{"equals":"1"}')
        expect(result.products).toEqual([
            { id: '1', name: 'Batik scarf', price: 40, status: 'active', stock: 0, inStock: false, hasPhoto: true },
            { id: '2', name: 'Tudung', price: 25, status: 'active', stock: 5, inStock: true, hasPhoto: false },
        ])
        expect(result.note).toMatch(/Products Grid[^.]*"fixed"[^.]*selectedProductIds/)
        expect(result.note).toMatch(/Sold out/)
        expect(result.total).toBe(2)
    })
})

describe('chosen products are checked against the storefront [TC-AIAUD-078]', () => {
    it('TC-AIAUD-078: reports "shows N of M", names the product that will not show, and flags no photo / sold out', async () => {
        db.known = [{ id: 1, name: 'Batik scarf' }, { id: 2, name: 'Tudung' }, { id: 3, name: 'Old shawl' }]
        db.onSale = [{ id: 1, name: 'Batik scarf', inventory: 0, images: [{ image: 7 }] }, { id: 2, name: 'Tudung', inventory: 5, images: [] }]

        const result = await patch([insertGrid(['1', '2', '3'])])

        expect(result.error).toBeUndefined()
        const shown = result.guardrails?.find((g) => g.rule === 'products_shown')
        expect(shown?.ok).toBe(false)
        expect(shown?.detail).toContain('shows 2 of 3 chosen products')
        expect(shown?.detail).toContain('Not shown')
        expect(shown?.detail).toContain('“Old shawl”')
        expect(shown?.detail).toMatch(/No photo[^.]*“Tudung”/)
        expect(shown?.detail).toMatch(/Sold out[^.]*“Batik scarf”/)
    })

    it('TC-AIAUD-078: every chosen product on sale is an ok note with the count', async () => {
        db.known = [{ id: 1, name: 'Batik scarf' }]
        db.onSale = [{ id: 1, name: 'Batik scarf', inventory: 3, images: [{ image: 7 }] }]

        const result = await patch([insertGrid(['1'])])

        expect(result.guardrails).toEqual(expect.arrayContaining([{ rule: 'products_shown', ok: true, detail: 'Products Grid shows 1 of 1 chosen product on the live site.' }]))
    })

    it('TC-AIAUD-078: an id that is not a product of this workspace is still refused', async () => {
        db.known = [{ id: 1, name: 'Batik scarf' }]
        db.onSale = [{ id: 1, name: 'Batik scarf', inventory: 3, images: [] }]

        const result = await patch([insertGrid(['1', '99'])])

        expect(result.error).toMatchObject({ code: 'unknown_products' })
    })
})

describe('chosen products are a Products Grid in fixed mode [TC-AIAUD-081]', () => {
    beforeEach(() => {
        db.known = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id, name: `P${id}` }))
        db.onSale = db.known.map((p) => ({ ...p, inventory: 3, images: [{ image: 7 }] }))
    })
    const planFields = (result: Record<string, unknown>) => (result.plan as { ops: Array<{ block?: Record<string, unknown>; fields?: Record<string, unknown> }> }).ops[0]

    it('TC-AIAUD-081: Featured Products refuses chosen products and sends the model to a Products Grid', async () => {
        db.page = page([NAV, HERO, FEATURED, FOOTER_BLOCK()])
        const insert = await patch([{ op: 'remove_block', blockId: FEATURED.id }, insertFeatured({ productIds: ['1', '2'] })])
        const set = await patch([{ op: 'set_fields', blockId: FEATURED.id, fields: { productIds: ['1'] } }])

        for (const result of [insert, set]) {
            expect(result.error?.code).toBe('use_products_grid')
            expect(result.error?.message).toMatch(/newest/)
            expect(result.error?.message).toMatch(/selectionMode "fixed"/)
        }
    })

    it('TC-AIAUD-081: choosing products on a grid switches it to fixed mode and raises its limit to fit them all', async () => {
        const result = await patch([insertGrid(['1', '2', '3', '4', '5', '6', '7', '8'])])

        expect(result.error).toBeUndefined()
        expect(planFields(result).block).toMatchObject({ selectionMode: 'fixed', selectedProductIds: ['1', '2', '3', '4', '5', '6', '7', '8'], limit: 8 })
        expect(result.guardrails?.find((g) => g.rule === 'products_shown')?.detail).toContain('shows 8 of 8 chosen products')
    })

    it('TC-AIAUD-081: a limit that already fits is kept', async () => {
        const grid = { op: 'insert_block', afterBlockId: HERO.id, block: { blockType: 'products-grid', headline: 'Picks', selectedProductIds: ['1', '2'], limit: 12 } }

        const result = await patch([grid])

        expect(planFields(result).block).toMatchObject({ limit: 12 })
    })

    it('TC-AIAUD-081: more than 20 chosen products is refused', async () => {
        db.known = Array.from({ length: 21 }, (_, i) => ({ id: i + 1, name: `P${i + 1}` }))
        db.onSale = db.known

        const result = await patch([insertGrid(db.known.map((p) => String(p.id)))])

        expect(result.error?.code).toBe('too_many_products')
    })

    it('TC-AIAUD-081: a grid that hides sold out products does not show a chosen sold out one (said on the card)', async () => {
        db.onSale = [{ id: 1, name: 'P1', inventory: 0, images: [{ image: 7 }] }, { id: 2, name: 'P2', inventory: 4, images: [{ image: 7 }] }]
        const grid = { op: 'insert_block', afterBlockId: HERO.id, block: { blockType: 'products-grid', headline: 'Picks', selectedProductIds: ['1', '2'], includeOutOfStock: false } }

        const result = await patch([grid])

        const shown = result.guardrails?.find((g) => g.rule === 'products_shown')
        expect(shown?.ok).toBe(false)
        expect(shown?.detail).toContain('shows 1 of 2 chosen products')
        expect(shown?.detail).toMatch(/hides sold out products[^.]*“P1”/)
    })
})

describe('one Featured Products per page, no repeated grid [TC-AIAUD-079]', () => {
    beforeEach(() => {
        db.page = page([NAV, HERO, FEATURED, PRODUCTS, FOOTER_BLOCK()])
        db.known = [{ id: 1, name: 'Batik scarf' }]
        db.onSale = [{ id: 1, name: 'Batik scarf', inventory: 3, images: [{ image: 7 }] }]
    })

    it('TC-AIAUD-079: refuses a second Featured Products section and points to the one on the page', async () => {
        const result = await patch([insertFeatured()])

        expect(result.error?.code).toBe('section_exists')
        expect(result.error?.message).toContain(FEATURED.id)
        expect(result.error?.message).toMatch(/set_fields/)
    })

    it('TC-AIAUD-079: refuses a second Products Grid that lists the same products as the one on the page', async () => {
        const result = await patch([{ op: 'insert_block', afterBlockId: HERO.id, block: { blockType: 'products-grid', headline: 'Shop again' } }])

        expect(result.error?.code).toBe('section_exists')
        expect(result.error?.message).toContain(PRODUCTS.id)
    })

    it('TC-AIAUD-079: refuses two inserts of the same kind in one edit', async () => {
        db.page = page([NAV, HERO, FOOTER_BLOCK()])

        const result = await patch([insertFeatured(), insertFeatured({ headline: 'More picks' })])

        expect(result.error?.code).toBe('section_exists')
        expect(result.error?.message).toMatch(/earlier in this edit/)
    })

    it('TC-AIAUD-079: replacing the section (remove + insert) is a swap, and changing its products is an ordinary edit', async () => {
        const swap = await patch([{ op: 'remove_block', blockId: FEATURED.id }, insertFeatured()])
        const change = await patch([{ op: 'set_fields', blockId: FEATURED.id, fields: { headline: 'Best sellers' } }])

        expect(swap.error).toBeUndefined()
        expect(change.error).toBeUndefined()
    })

    it('TC-AIAUD-079: a page without one takes the first', async () => {
        db.page = page([NAV, HERO, FOOTER_BLOCK()])

        const result = await patch([insertFeatured()])

        expect(result.error).toBeUndefined()
    })
})

describe('before → after lines show words, not markup [TC-AIAUD-080]', () => {
    it('TC-AIAUD-080: inline markup becomes plain text', () => {
        expect(previewValue('<b>Welcome</b> to <i>Kedai Batik</i>')).toBe('Welcome to Kedai Batik')
        expect(previewValue('<h2 style="font-size:48px">Big &amp; bold</h2>')).toBe('Big & bold')
        expect(previewValue('Line one<br>Line two')).toBe('Line one Line two')
        expect(previewValue('<ul><li>One</li><li>Two</li></ul>')).toBe('One Two')
    })

    it('TC-AIAUD-080: a formatting-only edit reads the same before and after (the card then says "Formatting changed")', () => {
        expect(previewValue('<span style="font-size:48px">Welcome</span>')).toBe(previewValue('Welcome'))
    })

    it('TC-AIAUD-080: plain text, numbers, lists and cut text work as before', () => {
        expect(previewValue('Just text')).toBe('Just text')
        expect(previewValue('a < b and c > d')).toBe('a < b and c > d')
        expect(previewValue(`<b>${'x'.repeat(50)}</b>`, 20)).toHaveLength(20)
        expect(previewValue(42)).toBe('42')
    })
})

describe('two different grids are fine, the same grid twice is not [TC-AIAUD-150, TC-AIAUD-151]', () => {
    const allGrid = { ...PRODUCTS, selectionMode: 'all' }
    const shoes = { ...PRODUCTS, id: '00000000-0000-4000-8000-0000000000d2', headline: 'Shoes', selectionMode: 'all', category: '12' }
    const grid = (block: Record<string, unknown>) => ({ op: 'insert_block', afterBlockId: HERO.id, block: { blockType: 'products-grid', variant: 'grid-3', ...block } })

    beforeEach(() => {
        db.page = page([NAV, HERO, shoes, allGrid, FOOTER_BLOCK()])
        db.known = [{ id: 1, name: 'Batik scarf' }, { id: 2, name: 'Tudung' }]
        db.onSale = [{ id: 1, name: 'Batik scarf', inventory: 3, images: [{ image: 7 }] }, { id: 2, name: 'Tudung', inventory: 3, images: [{ image: 7 }] }]
        db.categories = [{ id: '13' }]
    })

    it('TC-AIAUD-150: a Bags grid under a Shoes grid, and a fixed "Best sellers" grid above the full catalogue, are allowed', async () => {
        const bags = await patch([grid({ headline: 'Bags', category: '13' })])
        const bestSellers = await patch([grid({ headline: 'Best sellers', selectedProductIds: ['1', '2'] })])

        expect(bags.error).toBeUndefined()
        expect(bestSellers.error).toBeUndefined()
    })

    it('TC-AIAUD-151: the same category, the same unfiltered "all", the same picked set (any order), or a repeat in one edit is refused', async () => {
        db.page = page([NAV, HERO, shoes, allGrid, grid({ headline: 'Picks', selectedProductIds: ['2', '1'], selectionMode: 'fixed', id: '00000000-0000-4000-8000-0000000000d3' }).block, FOOTER_BLOCK()])
        db.categories = [{ id: '12' }]

        const sameCategory = await patch([grid({ headline: 'Shoes again', category: '12' })])
        const sameAll = await patch([grid({ headline: 'Everything' })])
        const samePicks = await patch([grid({ headline: 'Picks again', selectedProductIds: ['1', '2'] })])
        db.page = page([NAV, HERO, FOOTER_BLOCK()])
        const twice = await patch([grid({ headline: 'A', selectedProductIds: ['1'] }), grid({ headline: 'B', selectedProductIds: ['1'] })])
        const swap = await patch([grid({ headline: 'A', selectedProductIds: ['1'] })])

        expect(sameCategory.error?.code).toBe('section_exists')
        expect(sameAll.error?.code).toBe('section_exists')
        expect(samePicks.error?.code).toBe('section_exists')
        expect(twice.error?.code).toBe('section_exists')
        expect(twice.error?.message).toMatch(/earlier in this edit/)
        expect(swap.error).toBeUndefined()
    })
})
