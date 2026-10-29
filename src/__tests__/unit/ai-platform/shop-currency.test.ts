/**
 * TC-AIREL-190..193 — the shop's currency for the product copilot: `search_items` (kind product) reports the one
 * most of the shop's products are priced in, new drafts are saved in the currency the copilot names (MYR when
 * missing or not one the collection accepts), and reads keep each product's own currency.
 * Real: store-product-tools / -doc, the facade routing, appliers/store-product-drafts, lib/products/save-product,
 *   the Products collection config (currency options).
 * Faked: Payload (records every query), the plan gate, picture ingest, the forwarded merchant.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeCms, populated, productDoc, SHOP_ACTOR } from './store-product-fixtures'

const state = vi.hoisted(() => ({ cms: null as unknown }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => state.cms) }))
vi.mock('@/lib/media/carton-placeholder', () => ({ findOrCreateCartonMedia: vi.fn(async () => ({ id: 5 })) }))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(async () => ({ id: 1, plan: 'PRO', status: 'active' })),
    canUse: vi.fn(async () => true),
}))
vi.mock('@/lib/ai-platform/appliers/picture-ingest', () => ({ ingestPicture: vi.fn(async () => ({ id: 77, url: '/x.jpg' })) }))
vi.mock('@/lib/ai-platform/config', () => ({ isAiAgentEnabled: vi.fn(() => true) }))
vi.mock('@/lib/ai-platform/agent-tools/tool-actor', () => ({ resolveToolActor: vi.fn(async () => SHOP_ACTOR) }))

import { Products } from '@/collections/Products'
import { handleAgentTool } from '@/lib/ai-platform/agent-tools/handle-agent-tool'
import { SHOP_CURRENCIES, shopCurrencyOr } from '@/lib/ai-platform/agent-tools/store-product-doc'
import { readShopProduct, searchShopProducts, snapshotShopProduct } from '@/lib/ai-platform/agent-tools/store-product-tools'
import { applyChangeSet } from '@/lib/ai-platform/appliers'

type Cms = ReturnType<typeof fakeCms>
const cms = () => state.cms as Cms
const shopOf = async (products: unknown[]) => {
    state.cms = fakeCms({ products })
    return (await searchShopProducts(SHOP_ACTOR, {})).shop
}
const doc = (currency: string | null, extra: Record<string, unknown> = {}) => populated(productDoc({ currency, ...extra }))

beforeEach(() => {
    state.cms = fakeCms({ products: [] })
})

describe('search_items reports the shop currency [TC-AIREL-190]', () => {
    it('is the currency most of the shop\'s products are priced in', async () => {
        expect(await shopOf([doc('USD'), doc('USD'), doc('SGD'), doc('MYR')])).toEqual({ currency: 'USD' })
        expect(await shopOf([doc('SGD'), doc('SGD'), doc('MYR')])).toEqual({ currency: 'SGD' })
    })

    it('does not count trashed products, and counts a product with no stored currency as MYR', async () => {
        const trashed = '2026-10-20T00:00:00.000Z'
        expect(await shopOf([doc('USD', { deletedAt: trashed }), doc('USD', { deletedAt: trashed }), doc('SGD')])).toEqual({ currency: 'SGD' })
        expect(await shopOf([doc(null), doc(null), doc('USD')])).toEqual({ currency: 'MYR' })
    })

    it('is MYR for a shop with no products and when two currencies are level', async () => {
        expect(await shopOf([])).toEqual({ currency: 'MYR' })
        expect(await shopOf([doc('USD'), doc('MYR')])).toEqual({ currency: 'MYR' })
        expect(await shopOf([doc('SGD'), doc('USD')])).toEqual({ currency: 'USD' })
    })

    it('counts only this workspace\'s products with the merchant\'s own access, and the facade passes it on', async () => {
        state.cms = fakeCms({ products: [doc('USD')] })

        const res = await handleAgentTool(new Request('http://localhost:3000/api/agent-tools/content.search_items', { method: 'POST', body: JSON.stringify({ kind: 'product' }) }), 'content.search_items')

        expect(await res.json()).toMatchObject({ shop: { currency: 'USD' } })
        const counts = cms().count.mock.calls.map(([args]) => args)
        expect(counts).toHaveLength(SHOP_CURRENCIES.length)
        for (const args of counts) {
            expect(args).toMatchObject({ collection: 'products', overrideAccess: false, user: SHOP_ACTOR.user })
            expect(JSON.stringify(args.where)).toContain('"tenant":{"equals":4}')
            expect(JSON.stringify(args.where)).toContain('"deletedAt":{"exists":false}')
        }
    })
})

describe('currencies the collection accepts [TC-AIREL-191]', () => {
    it('are exactly the options of Products.currency', () => {
        const field = Products.fields.find((f) => 'name' in f && f.name === 'currency') as { options: Array<{ value: string }>; defaultValue: string }

        expect([...SHOP_CURRENCIES]).toEqual(field.options.map((option) => option.value))
        expect(field.defaultValue).toBe('MYR')
    })

    it('falls back to MYR for anything else', () => {
        expect(shopCurrencyOr('SGD')).toBe('SGD')
        expect(shopCurrencyOr(' usd ')).toBe('USD')
        for (const bad of ['EUR', '', null, undefined, 42, { code: 'USD' }]) expect(shopCurrencyOr(bad)).toBe('MYR')
    })
})

describe('shop_product.create_drafts saves each product\'s currency [TC-AIREL-192]', () => {
    const DRAFT = {
        name: 'Batik Scarf', shortDescription: null, description: null, descriptionBM: null, price: 49, sku: null, inventory: null,
        weight: null, tags: [], categoryId: null, seo: { title: null, description: null }, images: [],
    }
    const apply = (products: Array<Record<string, unknown>>) =>
        applyChangeSet({ id: 'cs_cur', action: { kind: 'shop_product.create_drafts', payload: { version: 1, status: 'draft', aiReviewPending: true, products } } } as never, SHOP_ACTOR)
    const saved = () => cms().create.mock.calls.map(([args]) => (args.data as { name: string; currency?: string }))

    it('keeps the named currency and falls back to MYR when it is missing, null or not an option', async () => {
        await apply([
            { ...DRAFT, name: 'Scarf SGD', currency: 'SGD' },
            { ...DRAFT, name: 'Scarf EUR', currency: 'EUR' },
            { ...DRAFT, name: 'Scarf none' },
            { ...DRAFT, name: 'Scarf null', currency: null },
            { ...DRAFT, name: 'Scarf lower', currency: 'usd' },
        ])

        expect(saved().map((p) => [p.name, p.currency])).toEqual([
            ['Scarf SGD', 'SGD'],
            ['Scarf EUR', 'MYR'],
            ['Scarf none', 'MYR'],
            ['Scarf null', 'MYR'],
            ['Scarf lower', 'USD'],
        ])
    })
})

describe('reads keep the product\'s own currency [TC-AIREL-193]', () => {
    it('snapshot, read and list show a USD product in USD whatever the shop mostly uses', async () => {
        state.cms = fakeCms({ products: [doc('USD', { price: 12 }), doc('MYR'), doc('MYR')] })

        const snapshot = await snapshotShopProduct(SHOP_ACTOR, '42')
        const detail = await readShopProduct(SHOP_ACTOR, '42')
        const list = await searchShopProducts(SHOP_ACTOR, {})

        expect(snapshot.shopProduct.currency).toBe('USD')
        expect(detail.facts.find((fact) => fact.label === 'Price')?.value).toBe('US$ 12.00')
        expect(list.items[0]?.meta).toMatch(/^US\$ 12\.00/)
        expect(list.shop.currency).toBe('MYR')
    })
})
