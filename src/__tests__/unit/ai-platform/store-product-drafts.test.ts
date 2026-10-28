/**
 * TC-AIREL-177..181 — new draft products from the copilot: created as drafts waiting for review with the
 * form's defaults, pictures ingested, categories checked inside the workspace, a retry of the same approval
 * never duplicates, and the undo moves only untouched drafts to the trash.
 * Real: appliers/store-product-drafts, lib/products/save-product, appliers routing.
 * Faked: Payload, the plan gate, picture ingest, the placeholder photo.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeCms, productDoc, SHOP_ACTOR, UPDATED_AT } from './store-product-fixtures'

const state = vi.hoisted(() => ({ cms: null as unknown }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => state.cms) }))
vi.mock('@/lib/media/carton-placeholder', () => ({ findOrCreateCartonMedia: vi.fn(async () => ({ id: 5 })) }))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(async () => ({ id: 1, plan: 'PRO', status: 'active' })),
    canUse: vi.fn(async () => true),
}))
vi.mock('@/lib/ai-platform/appliers/picture-ingest', () => ({ ingestPicture: vi.fn(async () => ({ id: 77, url: '/x.jpg' })) }))

import { applyChangeSet } from '@/lib/ai-platform/appliers'
import { ingestPicture } from '@/lib/ai-platform/appliers/picture-ingest'
import { applyUndo } from '@/lib/ai-platform/appliers/record-edits'
import { draftSlug } from '@/lib/ai-platform/appliers/store-product-drafts'

type Cms = ReturnType<typeof fakeCms>
const cms = () => state.cms as Cms

const DRAFT = {
    name: 'Batik Scarf',
    shortDescription: null,
    description: 'A soft **hand-printed** scarf.',
    descriptionBM: null,
    price: 49,
    sku: null,
    inventory: null,
    weight: null,
    tags: ['batik'],
    categoryId: null,
    seo: { title: null, description: null },
    images: [],
}
const drafts = (products: Array<Record<string, unknown>>, id = 'cs_77') =>
    ({ id, action: { kind: 'shop_product.create_drafts', payload: { version: 1, status: 'draft', aiReviewPending: true, products } } }) as never
const created = () => cms().create.mock.calls.map(([args]) => args.data as Record<string, unknown>)

beforeEach(() => {
    state.cms = fakeCms({ products: [] })
    vi.mocked(ingestPicture).mockClear()
})

describe('shop_product.create_drafts [TC-AIREL-177]', () => {
    it('creates drafts waiting for review, with the form\'s defaults and no invented SKU', async () => {
        const result = await applyChangeSet(drafts([DRAFT, { ...DRAFT, name: 'Batik Bag', price: null, sku: 'BAG-1', inventory: 4, weight: 0.5 }]), SHOP_ACTOR)

        const [first, second] = created()
        expect(first).toMatchObject({ name: 'Batik Scarf', status: 'draft', aiReviewPending: true, price: 49, inventory: 0, weight: 0, tags: [{ tag: 'batik' }], tenant: 4 })
        expect(first).not.toHaveProperty('sku')
        expect(first).not.toHaveProperty('category')
        expect(second).toMatchObject({ name: 'Batik Bag', price: 0, sku: 'BAG-1', inventory: 4, weight: 0.5 })
        // no photo given: the tenant's placeholder photo, like a hand-made product
        expect(first?.images).toEqual([{ image: 5, alt: 'Batik Scarf' }])
        const description = first?.description as { root: { children: Array<{ children: Array<{ text: string; format: number }> }> } }
        expect(description.root.children[0]?.children.map((node) => [node.text, node.format])).toEqual([['A soft ', 0], ['hand-printed', 1], [' scarf.', 0]])
        expect(cms().create.mock.calls[0]?.[0]).toMatchObject({ user: SHOP_ACTOR.user, overrideAccess: false })
        expect(result.entities.map((entity) => entity.label)).toEqual(['Batik Scarf', 'Batik Bag'])
        expect(result.entities.every((entity) => entity.kind === 'product')).toBe(true)
        expect(result.links).toHaveLength(1)
        expect(result.links[0]?.href).toMatch(/^\/products\/\d+$/)
        expect(result.undo).toMatchObject({ kind: 'shop_product.trash_created', payload: { ids: result.entities.map((entity) => entity.id) } })
    })

    it('takes pictures through the shared ingest, scoped to the workspace', async () => {
        await applyChangeSet(drafts([{ ...DRAFT, images: [{ ref: 'attachment:att_9', url: '/api/agent/attachments/att_9', alt: 'Front' }] }]), SHOP_ACTOR, async () => ({ buffer: Buffer.from('x'), mime: 'image/png', name: 'a.png' }))

        expect(vi.mocked(ingestPicture).mock.calls[0]?.[1]).toMatchObject({ ref: 'attachment:att_9' })
        expect(vi.mocked(ingestPicture).mock.calls[0]?.[4]).toBe('4')
        expect(created()[0]?.images).toEqual([{ image: 77, alt: 'Front' }])
    })

    it('uses a slug that is the same for the same place of the same change set', () => {
        expect(draftSlug('Batik Scarf', 'cs_77', 0)).toBe(draftSlug('Batik Scarf', 'cs_77', 0))
        expect(draftSlug('Batik Scarf', 'cs_77', 0)).toMatch(/^batik-scarf-ai-[a-f0-9]{32}$/)
        expect(draftSlug('Batik Scarf', 'cs_77', 1)).not.toBe(draftSlug('Batik Scarf', 'cs_77', 0))
        expect(draftSlug('Batik Scarf', 'cs_78', 0)).not.toBe(draftSlug('Batik Scarf', 'cs_77', 0))
        expect(draftSlug('日本', 'cs_77', 0)).toMatch(/^product-ai-[a-f0-9]{32}$/)
    })
})

describe('retries and refusals [TC-AIREL-178..179]', () => {
    it('does not create a product twice when the same approval is retried [TC-AIREL-178]', async () => {
        const slug = draftSlug('Batik Scarf', 'cs_77', 0)
        state.cms = fakeCms({ products: [productDoc({ id: 900, slug })] })

        const result = await applyChangeSet(drafts([DRAFT]), SHOP_ACTOR)

        expect(cms().create).not.toHaveBeenCalled()
        expect(ingestPicture).not.toHaveBeenCalled()
        expect(result.entities).toEqual([{ kind: 'product', id: '900', label: 'Batik Scarf' }])
        const lookup = cms().find.mock.calls.map(([args]) => args).find((args) => args.collection === 'products')
        expect(JSON.stringify(lookup?.where)).toContain(slug)
        expect(JSON.stringify(lookup?.where)).toContain('"tenant":{"equals":4}')
    })

    it('checks every category inside the workspace before creating anything [TC-AIREL-179]', async () => {
        state.cms = fakeCms({ products: [], categories: [{ id: 3 }] })

        await expect(applyChangeSet(drafts([{ ...DRAFT, categoryId: '3' }, { ...DRAFT, name: 'Batik Bag', categoryId: '9' }]), SHOP_ACTOR)).rejects.toMatchObject({
            status: 422,
            message: expect.stringContaining('"Batik Bag"'),
        })
        expect(cms().create).not.toHaveBeenCalled()
        const lookup = cms().find.mock.calls.map(([args]) => args).find((args) => args.collection === 'categories')
        expect(JSON.stringify(lookup?.where)).toContain('"tenant":{"equals":4}')
    })

    it('files a product under a category that is the shop\'s [TC-AIREL-179]', async () => {
        state.cms = fakeCms({ products: [], categories: [{ id: 3 }] })

        await applyChangeSet(drafts([{ ...DRAFT, categoryId: '3' }]), SHOP_ACTOR)

        expect(created()[0]?.category).toEqual([3])
    })

    it('refuses a name over the form\'s limit, a bad payload, and 21 products [TC-AIREL-179]', async () => {
        await expect(applyChangeSet(drafts([{ ...DRAFT, name: 'x'.repeat(121) }]), SHOP_ACTOR)).rejects.toMatchObject({ status: 422, message: expect.stringMatching(/120/) })
        await expect(applyChangeSet(drafts([{ ...DRAFT, price: -5 }]), SHOP_ACTOR)).rejects.toMatchObject({ status: 422 })
        await expect(applyChangeSet(drafts(Array.from({ length: 21 }, (_, i) => ({ ...DRAFT, name: `Scarf ${i}` }))), SHOP_ACTOR)).rejects.toMatchObject({ status: 422 })
        expect(cms().create).not.toHaveBeenCalled()
    })

    it('says which product failed and that earlier ones exist [TC-AIREL-179]', async () => {
        cms().create.mockImplementationOnce(async ({ data }: { data: Record<string, unknown> }) => ({ id: 901, updatedAt: UPDATED_AT, ...data }))
        cms().create.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'ValidationError', data: { errors: [{ message: 'bad', path: 'site' }] } }))

        await expect(applyChangeSet(drafts([DRAFT, { ...DRAFT, name: 'Batik Bag' }]), SHOP_ACTOR)).rejects.toMatchObject({
            status: 422,
            message: expect.stringMatching(/"Batik Bag".*1 product was already created/),
        })
    })

    it('refuses a plan without product management', async () => {
        const { canUse } = await import('@/lib/subscriptions/plan-subscription')
        vi.mocked(canUse).mockResolvedValueOnce(false)

        await expect(applyChangeSet(drafts([DRAFT]), SHOP_ACTOR)).rejects.toMatchObject({ status: 403 })
        expect(cms().create).not.toHaveBeenCalled()
    })
})

describe('undo of drafts [TC-AIREL-180]', () => {
    const undoOf = (ids: string[], expect: Record<string, string>) => ({
        kind: 'shop_product.trash_created',
        payload: { ids, expect },
        until: new Date(Date.now() + 86_400_000).toISOString(),
    })

    it('moves untouched drafts to the trash (soft delete)', async () => {
        state.cms = fakeCms({ products: [productDoc({ id: 900 })] })

        const result = await applyUndo(undoOf(['900'], { '900': UPDATED_AT }), SHOP_ACTOR, 'cs_77')

        expect(cms().update).toHaveBeenCalledTimes(1)
        const call = cms().update.mock.calls[0]?.[0] as { id: number | string; data: Record<string, unknown>; overrideAccess: boolean }
        expect(call).toMatchObject({ id: 900, overrideAccess: false })
        expect(Object.keys(call.data)).toEqual(['deletedAt'])
        expect(result.entities).toHaveLength(1)
    })

    it('removes nothing when any draft was edited since (opening one for review counts)', async () => {
        state.cms = fakeCms({ products: [productDoc({ id: 900, updatedAt: '2026-10-21T08:00:00.000Z' })] })

        await expect(applyUndo(undoOf(['900'], { '900': UPDATED_AT }), SHOP_ACTOR, 'cs_77')).rejects.toMatchObject({ status: 409 })
        expect(cms().update).not.toHaveBeenCalled()
    })

    it('skips a draft that is already in the trash or gone', async () => {
        state.cms = fakeCms({ products: [productDoc({ id: 900, deletedAt: '2026-10-21T09:00:00.000Z' })] })

        await applyUndo(undoOf(['900'], { '900': UPDATED_AT }), SHOP_ACTOR, 'cs_77')

        expect(cms().update).not.toHaveBeenCalled()
    })
})

describe('routing [TC-AIREL-181]', () => {
    it('still refuses kinds it does not know, and the old Product Master ones', async () => {
        await expect(applyChangeSet({ id: 'x', action: { kind: 'product.create_drafts', payload: {} } } as never, SHOP_ACTOR)).rejects.toThrow(/can't be applied/)
        await expect(applyChangeSet({ id: 'x', action: { kind: 'shop_product.delete', payload: {} } } as never, SHOP_ACTOR)).rejects.toThrow(/can't be applied/)
        await expect(applyUndo({ kind: 'product.restore', payload: {}, until: new Date(Date.now() + 1e6).toISOString() }, SHOP_ACTOR, 'x')).rejects.toMatchObject({ status: 422 })
    })
})
