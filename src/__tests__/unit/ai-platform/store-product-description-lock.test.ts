/**
 * TC-AIREL-213..215 — a description with pictures (or other content markdown can't hold) is never rewritten by the
 * copilot: the read and the snapshot say so up front, and an approved description change is refused (422, nothing
 * written) instead of dropping the pictures. Links survive an edit, and the undo puts the original document back.
 * Real: store-product-tools / -doc, appliers/store-product, lib/products/save-product (patch mode), product-rich-text.
 * Faked: Payload, the plan gate, picture ingest.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeCms, populated, productDoc, SHOP_ACTOR, UPDATED_AT } from './store-product-fixtures'

const state = vi.hoisted(() => ({ cms: null as unknown }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => state.cms) }))
vi.mock('@/lib/media/carton-placeholder', () => ({ findOrCreateCartonMedia: vi.fn(async () => ({ id: 5 })) }))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(async () => ({ id: 1, plan: 'PRO', status: 'active' })),
    canUse: vi.fn(async () => true),
}))
vi.mock('@/lib/ai-platform/appliers/picture-ingest', () => ({ ingestPicture: vi.fn(async () => ({ id: 77, url: '/x.jpg' })) }))

import { readShopProduct, snapshotShopProduct } from '@/lib/ai-platform/agent-tools/store-product-tools'
import { applyChangeSet } from '@/lib/ai-platform/appliers'
import { applyUndo } from '@/lib/ai-platform/appliers/record-edits'

type Cms = ReturnType<typeof fakeCms>
const cms = () => state.cms as Cms
const BOLD = 1
const PICTURES = 'This description has pictures inside; change it in the product form.'
const text = (value: string, format = 0) => ({ type: 'text', text: value, format })
const withPicture = { root: { type: 'root', children: [{ type: 'paragraph', children: [text('Soft cotton.')] }, { type: 'upload', relationTo: 'media', value: { id: 9 } }] } }
const withLink = {
    root: { type: 'root', children: [{ type: 'paragraph', children: [text('Wash '), text('cold', BOLD), text(', see '), { type: 'link', fields: { linkType: 'custom', url: 'https://shop.my/care', newTab: false }, children: [text('care guide')] }] }] },
}
const withQuote = { root: { type: 'root', children: [{ type: 'quote', children: [text('Loved by all')] }] } }
const update = (changes: Record<string, unknown>) => ({ id: 'cs_1', action: { kind: 'shop_product.update', payload: { id: '42', base: UPDATED_AT, changes } } }) as never
const facts = (detail: Awaited<ReturnType<typeof readShopProduct>>) => Object.fromEntries(detail.facts.map((fact) => [fact.label, fact.value]))
const setProduct = (overrides: Record<string, unknown>) => {
    state.cms = fakeCms({ products: [populated(productDoc(overrides))] })
}

beforeEach(() => {
    state.cms = fakeCms({ products: [productDoc()] })
})

describe('the read and the snapshot say whether the description can be changed [TC-AIREL-213]', () => {
    it('a plain description is editable', async () => {
        setProduct({})

        const snapshot = await snapshotShopProduct(SHOP_ACTOR, '42')
        const detail = await readShopProduct(SHOP_ACTOR, '42')

        expect(snapshot.shopProduct).toMatchObject({ descriptionEditable: true, descriptionBMEditable: true })
        expect(snapshot.shopProduct).not.toHaveProperty('descriptionNote')
        expect(facts(detail)['Description editable']).toBe('yes')
        // no Bahasa Melayu description: nothing to say about it
        expect(facts(detail)).not.toHaveProperty('Bahasa Melayu description editable')
    })

    it('a description with pictures is not: descriptionEditable false, a note and a fact the model reads before drafting', async () => {
        setProduct({ description: withPicture })

        const snapshot = await snapshotShopProduct(SHOP_ACTOR, '42')
        const detail = await readShopProduct(SHOP_ACTOR, '42')

        expect(snapshot.shopProduct).toMatchObject({ descriptionEditable: false, descriptionBMEditable: true, descriptionNote: PICTURES, description: 'Soft cotton.' })
        expect(facts(detail)['Description editable']).toBe(`no: ${PICTURES}`)
    })

    it('says the same for the Bahasa Melayu description, separately', async () => {
        setProduct({ descriptionBM: withPicture })

        const snapshot = await snapshotShopProduct(SHOP_ACTOR, '42')
        const detail = await readShopProduct(SHOP_ACTOR, '42')

        expect(snapshot.shopProduct).toMatchObject({ descriptionEditable: true, descriptionBMEditable: false, descriptionNote: PICTURES })
        expect(facts(detail)['Description editable']).toBe('yes')
        expect(facts(detail)['Bahasa Melayu description editable']).toBe(`no: ${PICTURES}`)
    })

    it('other content markdown can\'t hold gets its own sentence; a link does not lock the description and is read as [text](url)', async () => {
        setProduct({ description: withQuote })
        expect(facts(await readShopProduct(SHOP_ACTOR, '42'))['Description editable']).toMatch(/^no: This description has formatting the assistant can't keep/)

        setProduct({ description: withLink })
        const detail = await readShopProduct(SHOP_ACTOR, '42')
        expect(facts(detail)['Description editable']).toBe('yes')
        expect(detail.text).toBe('Wash **cold**, see [care guide](https://shop.my/care)')
    })
})

describe('shop_product.update with a description [TC-AIREL-214]', () => {
    it.each([
        ['description', { description: 'A new text.' }],
        ['descriptionBM', { descriptionBM: 'Teks baharu.' }],
        ['clearing the description', { description: '' }],
    ])('refuses to change %s when it holds pictures (422), writing nothing', async (_name, changes) => {
        setProduct({ description: withPicture, descriptionBM: withPicture })

        await expect(applyChangeSet(update(changes), SHOP_ACTOR)).rejects.toMatchObject({ status: 422, message: PICTURES })
        expect(cms().update).not.toHaveBeenCalled()
        expect(cms().create).not.toHaveBeenCalled()
    })

    it('refuses only the language that is locked, and leaves a plain one editable', async () => {
        setProduct({ description: withPicture, descriptionBM: null })

        await expect(applyChangeSet(update({ description: 'x' }), SHOP_ACTOR)).rejects.toMatchObject({ status: 422 })
        await applyChangeSet(update({ descriptionBM: 'Teks baharu.' }), SHOP_ACTOR)

        expect(cms().update).toHaveBeenCalledTimes(1)
    })

    it('still applies the other fields of a product whose description has pictures, and leaves that description out of the write', async () => {
        setProduct({ description: withPicture })

        await applyChangeSet(update({ price: 45, tags: ['batik', 'sale'] }), SHOP_ACTOR)

        const data = (cms().update.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data
        expect(data).toMatchObject({ price: 45 })
        expect(data).not.toHaveProperty('description')
        expect(data).not.toHaveProperty('descriptionBM')
    })

    it('rewrites a description with a link in it: the link is kept as a link node when the markdown keeps it', async () => {
        setProduct({ description: withLink })

        await applyChangeSet(update({ description: 'Wash **cold**, see the [new care guide](https://shop.my/care-2) and [mail us](mailto:hi@shop.my).' }), SHOP_ACTOR)

        const written = (cms().update.mock.calls[0]?.[0] as { data: { description: { root: { children: Array<{ children: Array<Record<string, unknown>> }> } } } }).data.description
        const links = written.root.children[0]!.children.filter((node) => node.type === 'link')
        expect(links.map((node) => (node.fields as { url: string }).url)).toEqual(['https://shop.my/care-2', 'mailto:hi@shop.my'])
    })
})

describe('undo of a description edit [TC-AIREL-215]', () => {
    it('keeps the original document (links and all) as the pre-image and puts it back', async () => {
        setProduct({ description: withLink })

        const result = await applyChangeSet(update({ description: 'Brand new text.' }), SHOP_ACTOR)

        expect((result.undo?.payload as { fields: { description: unknown } }).fields.description).toEqual(withLink)
        // the product is as the edit left it: the undo writes the original back
        state.cms = fakeCms({ products: [productDoc({ description: { root: { type: 'root', children: [] } }, updatedAt: '2026-10-21T10:00:00.000Z' })] })
        await applyUndo(result.undo as never, SHOP_ACTOR, 'cs_1')

        expect((cms().update.mock.calls[0]?.[0] as { data: { description: unknown } }).data.description).toEqual(withLink)
    })
})
