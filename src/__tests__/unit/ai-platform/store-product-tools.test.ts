/**
 * TC-AIREL-160..165 — the copilot's read tools for the shop's own Payload products: scoped to the workspace,
 * soft-deleted products out of lists, the detail the model edits from, the snapshot's version guard, and the
 * facade routing (`kind:"product"` served; foreign / malformed ids are a 404).
 * Real: store-product-tools / -doc, product-rich-text, handle-agent-tool routing.
 * Faked: Payload (records every query), the forwarded merchant, the agent flag.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeCms, populated, productDoc, SHOP_ACTOR, UPDATED_AT } from './store-product-fixtures'

const state = vi.hoisted(() => ({ cms: null as unknown }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => state.cms) }))
vi.mock('@/lib/ai-platform/config', () => ({ isAiAgentEnabled: vi.fn(() => true) }))
vi.mock('@/lib/ai-platform/agent-tools/tool-actor', () => ({ resolveToolActor: vi.fn(async () => SHOP_ACTOR) }))

import { handleAgentTool } from '@/lib/ai-platform/agent-tools/handle-agent-tool'
import { readShopProduct, searchShopProducts, snapshotShopProduct } from '@/lib/ai-platform/agent-tools/store-product-tools'

type Cms = ReturnType<typeof fakeCms>
const cms = () => state.cms as Cms
const productFinds = () => cms().find.mock.calls.map(([args]) => args).filter((args) => args.collection === 'products')
const flat = (where: unknown): string => JSON.stringify(where)

function call(tool: string, body: unknown) {
    return handleAgentTool(new Request(`http://localhost:3000/api/agent-tools/${tool}`, { method: 'POST', body: JSON.stringify(body) }), tool)
}

beforeEach(() => {
    state.cms = fakeCms({ products: [populated(productDoc())] })
})

describe('search_items kind product [TC-AIREL-160]', () => {
    it('lists only the workspace\'s products, with the user\'s own access, plus the shop\'s categories', async () => {
        const result = await searchShopProducts(SHOP_ACTOR, { query: 'batik', status: 'any', limit: 10 })

        const [query] = productFinds()
        expect(query).toMatchObject({ overrideAccess: false, user: SHOP_ACTOR.user, limit: 10 })
        expect(flat(query.where)).toContain('"tenant":{"equals":4}')
        expect(flat(query.where)).toContain('"name":{"like":"batik"}')
        expect(result).toEqual({
            total: 1,
            items: [{ kind: 'product', id: '42', title: 'Batik Scarf', status: 'draft', meta: 'RM 49.00 · stock 12 · Scarves', updatedAt: UPDATED_AT }],
            categories: [{ id: '3', name: 'Scarves' }],
            shop: { currency: 'MYR' },
        })
        const categoryQuery = cms().find.mock.calls.map(([args]) => args).find((args) => args.collection === 'categories')
        expect(flat(categoryQuery?.where)).toContain('"tenant":{"equals":4}')
        expect(categoryQuery).toMatchObject({ overrideAccess: false })
    })

    it('maps the status words to Payload filters and never returns deleted products except in the trash', async () => {
        await searchShopProducts(SHOP_ACTOR, { status: 'draft' })
        await searchShopProducts(SHOP_ACTOR, { status: 'published' })
        await searchShopProducts(SHOP_ACTOR, { status: 'any' })
        await searchShopProducts(SHOP_ACTOR, { status: 'trash' })

        const [draft, published, any, trash] = productFinds().map((query) => flat(query.where))
        expect(draft).toContain('"status":{"equals":"draft"}')
        expect(draft).toContain('"deletedAt":{"exists":false}')
        expect(published).toContain('"status":{"equals":"active"}')
        expect(published).toContain('"deletedAt":{"exists":false}')
        expect(any).toContain('"deletedAt":{"exists":false}')
        expect(any).not.toContain('"status"')
        expect(trash).toContain('"deletedAt":{"exists":true}')
        expect(trash).toContain('"status":{"equals":"archived"}')
        expect(trash).not.toContain('"exists":false')
    })

    it('shows a soft-deleted product as trash and caps the page at 10', async () => {
        state.cms = fakeCms({ products: [populated(productDoc({ deletedAt: '2026-10-20T00:00:00.000Z', status: 'active' }))] })

        const result = await searchShopProducts(SHOP_ACTOR, { status: 'trash', limit: 99 })

        expect(result.items[0]?.status).toBe('trash')
        expect(productFinds()[0]?.limit).toBe(10)
    })
})

describe('read_item kind product [TC-AIREL-161]', () => {
    it('gives the facts, the description as markdown, photo refs and the category list', async () => {
        const detail = await readShopProduct(SHOP_ACTOR, '42')

        expect(detail).toMatchObject({ kind: 'product', id: '42', title: 'Batik Scarf', status: 'draft', text: 'A soft scarf.', updatedAt: UPDATED_AT })
        // the chat's record card opens it in the app [TC-AICP-133]
        expect(detail.url).toBe('/products/42')
        const facts = Object.fromEntries(detail.facts.map((fact) => [fact.label, fact.value]))
        expect(facts).toMatchObject({
            SKU: 'BAT-001',
            Price: 'RM 49.00',
            'Compare-at price': 'not set',
            Stock: '12',
            Weight: '0.2 kg',
            Category: 'Scarves (id 3)',
            Tags: 'batik',
            'Has options': 'no',
            'AI review pending': 'no',
        })
        expect(detail.lists.find((list) => list.label === 'Photos')?.items).toEqual(['photo 1 · media:11 · Front'])
        expect(detail.lists.find((list) => list.label === 'Categories')?.items).toEqual(['3 · Scarves'])
        expect(detail.media).toEqual([{ url: '/api/media/file/11.jpg', alt: 'Front', label: 'photo 1' }])
    })

    it('lists the options of a product that has them, and the Malay text after the English', async () => {
        state.cms = fakeCms({
            products: [
                populated(
                    productDoc({
                        hasVariants: true,
                        variantConfigs: [{ name: 'Colour', options: [{ value: 'Red' }] }, { name: 'Size', options: [{ value: 'S' }] }],
                        variants: [{ name: 'Red / S', sku: 'BAT-R-S', price: 49, stock: 3 }],
                        descriptionBM: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Skaf lembut.', format: 0 }] }] } },
                    }),
                ),
            ],
        })

        const detail = await readShopProduct(SHOP_ACTOR, '42')

        expect(detail.facts.find((fact) => fact.label === 'Has options')?.value).toBe('yes: Colour × Size')
        expect(detail.lists.find((list) => list.label === 'Options')?.items).toEqual(['Red / S · BAT-R-S · RM 49.00 · stock 3'])
        expect(detail.text).toBe('A soft scarf.\n\nBahasa Melayu:\nSkaf lembut.')
    })
})

describe('snapshot kind product [TC-AIREL-162]', () => {
    it('is the exact stored state with updatedAt as the version, ready to draft an edit from', async () => {
        const snapshot = await snapshotShopProduct(SHOP_ACTOR, '42')

        expect(snapshot).toMatchObject({
            kind: 'product',
            id: '42',
            title: 'Batik Scarf',
            status: 'draft',
            version: UPDATED_AT,
            removed: false,
            fields: {},
            shopProduct: {
                name: 'Batik Scarf',
                shortDescription: null,
                description: 'A soft scarf.',
                price: 49,
                compareAtPrice: null,
                currency: 'MYR',
                sku: 'BAT-001',
                inventory: 12,
                weight: 0.2,
                hasVariants: false,
                tags: ['batik'],
                category: { id: '3', name: 'Scarves' },
                categories: [{ id: '3', name: 'Scarves' }],
                seo: { title: null, description: null },
                images: [{ ref: 'media:11', url: '/api/media/file/11.jpg', alt: 'Front' }],
            },
        })
    })

    it('marks a trashed product removed and keeps its stored status', async () => {
        state.cms = fakeCms({ products: [populated(productDoc({ status: 'active', deletedAt: '2026-10-20T00:00:00.000Z' }))] })

        const snapshot = await snapshotShopProduct(SHOP_ACTOR, '42')

        expect(snapshot).toMatchObject({ removed: true, status: 'active' })
    })
})

describe('scope and ids [TC-AIREL-163]', () => {
    it('answers a 404 for a product that is not in this workspace', async () => {
        state.cms = fakeCms({ products: [] })

        await expect(readShopProduct(SHOP_ACTOR, '42')).rejects.toMatchObject({ status: 404 })
        expect(flat(productFinds()[0]?.where)).toContain('"tenant":{"equals":4}')
    })

    it.each(['abc', '0', '-3', '12; DROP', '1e5', '9999999999999'])('rejects the id %s before any query', async (id) => {
        await expect(snapshotShopProduct(SHOP_ACTOR, id)).rejects.toMatchObject({ status: 404 })
        expect(cms().find).not.toHaveBeenCalled()
    })
})

describe('list meta [TC-AIREL-165]', () => {
    it('says a product has options in its stock, and a product without a category lists none', async () => {
        state.cms = fakeCms({ products: [{ ...populated(productDoc({ hasVariants: true, inventory: 7 })), category: [] }] })

        const result = await searchShopProducts(SHOP_ACTOR, {})

        // options listed nowhere: the product's own price and stock stand in
        expect(result.items[0]?.meta).toBe('RM 49.00 · stock 7 (options)')
    })
})

describe('price and stock of a product with options [TC-AIAUD-130]', () => {
    const options = [
        { name: 'Red / S', sku: 'R-S', price: 79, stock: 2 },
        { name: 'Red / M', sku: 'R-M', price: 59, stock: 3 },
        { name: 'Blue / M', sku: 'B-M', price: 69, stock: null },
    ]
    const withOptions = () => ({ ...populated(productDoc({ hasVariants: true, price: 0, inventory: 0, variants: options })), category: [] })

    it('lists "From RM 59.00" and the options\' stock added up, not the base price 0 and stock 0', async () => {
        state.cms = fakeCms({ products: [withOptions()] })

        const result = await searchShopProducts(SHOP_ACTOR, {})

        expect(result.items[0]?.meta).toBe('From RM 59.00 · stock 5 (options)')
    })

    it('asks Payload for the options\' price and stock, so the list is not read from the base fields', async () => {
        state.cms = fakeCms({ products: [withOptions()] })

        await searchShopProducts(SHOP_ACTOR, {})

        expect(productFinds()[0]?.select).toMatchObject({ hasVariants: true, variants: { price: true, stock: true } })
    })

    it('says the same in read_item: the cheapest option as the price and the stock sum', async () => {
        state.cms = fakeCms({ products: [withOptions()] })

        const detail = await readShopProduct(SHOP_ACTOR, '42')

        const facts = Object.fromEntries(detail.facts.map((fact) => [fact.label, fact.value]))
        expect(facts.Price).toBe('From RM 59.00')
        expect(facts.Stock).toBe("5 (the options' stock added up)")
    })

    it('keeps a plain product as it was: its own price and stock, no "From"', async () => {
        const result = await searchShopProducts(SHOP_ACTOR, {})

        expect(result.items[0]?.meta).toBe('RM 49.00 · stock 12 · Scarves')
    })
})

describe('where each photo came from [TC-AIAUD-131]', () => {
    const media = (id: number, flags: Record<string, unknown> = {}) => ({ image: { id, url: `/api/media/file/${id}.jpg`, ...flags }, alt: `Photo ${id}` })
    const mixed = () => ({
        ...populated(productDoc()),
        images: [media(11), media(12, { sourceProvider: 'pixabay' }), media(13, { aiGenerated: true }), media(14, { sourceProvider: 'ai' }), media(15, { sourceProvider: 'wikimedia' })],
    })

    it('marks upload, stock and ai on the snapshot the copilot drafts from', async () => {
        state.cms = fakeCms({ products: [mixed()] })

        const snapshot = await snapshotShopProduct(SHOP_ACTOR, '42')

        expect(snapshot.shopProduct.images.map((image) => [image.ref, image.source])).toEqual([
            ['media:11', 'upload'],
            ['media:12', 'stock'],
            ['media:13', 'ai'],
            ['media:14', 'ai'],
            ['media:15', 'stock'],
        ])
    })

    it('tells read_item which photos are not the merchant\'s own, and says nothing extra about their uploads', async () => {
        state.cms = fakeCms({ products: [mixed()] })

        const detail = await readShopProduct(SHOP_ACTOR, '42')

        const photos = detail.lists.find((list) => list.label === 'Photos')?.items ?? []
        expect(photos[0]).toBe('photo 1 · media:11 · Photo 11')
        expect(photos[1]).toBe("photo 2 · media:12 · Photo 12 · stock photo (not the merchant's own)")
        expect(photos[2]).toContain('made or picked by AI')
    })
})

describe('facade routing [TC-AIREL-164]', () => {
    it('serves kind product for read, snapshot and search', async () => {
        const read = await call('content.read_item', { kind: 'product', id: '42' })
        const snapshot = await call('content.snapshot', { kind: 'product', id: '42' })
        const search = await call('content.search_items', { kind: 'product', query: 'batik', status: 'any', limit: 5 })

        expect(read.status).toBe(200)
        expect(await read.json()).toMatchObject({ kind: 'product', title: 'Batik Scarf' })
        expect(await snapshot.json()).toMatchObject({ version: UPDATED_AT, shopProduct: { sku: 'BAT-001' } })
        expect(await search.json()).toMatchObject({ total: 1, categories: [{ id: '3', name: 'Scarves' }] })
    })

    it('answers 404 for an unknown product', async () => {
        state.cms = fakeCms({ products: [] })

        const res = await call('content.snapshot', { kind: 'product', id: '77' })

        expect(res.status).toBe(404)
    })
})
