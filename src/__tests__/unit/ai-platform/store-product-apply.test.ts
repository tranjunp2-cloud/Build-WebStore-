/**
 * TC-AIREL-166..176 — applying and undoing an approved product edit or status change on the shop's Payload
 * products: the version guard (409), options/compare-at/category refusals, photos, the publish gate, typed
 * confirmation for archive/trash, trash and restore, and undo that never overwrites a later edit.
 * Real: appliers/store-product, lib/products/save-product (patch mode), product-rich-text.
 * Faked: Payload, the plan gate, picture ingest.
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
vi.mock('@/lib/ai-platform/appliers/picture-ingest', () => ({ ingestPicture: vi.fn(async (_cms: unknown, image: { ref: string }) => ({ id: image.ref === 'attachment:att_9' ? 77 : 88, url: '/x.jpg' })) }))

import { canUse } from '@/lib/subscriptions/plan-subscription'
import { applyChangeSet } from '@/lib/ai-platform/appliers'
import { ingestPicture } from '@/lib/ai-platform/appliers/picture-ingest'
import { applyUndo } from '@/lib/ai-platform/appliers/record-edits'

type Cms = ReturnType<typeof fakeCms>
const cms = () => state.cms as Cms
const NEW_STAMP = '2026-10-21T10:00:00.000Z'
const ATT = async () => ({ buffer: Buffer.from('x'), mime: 'image/jpeg', name: 'a.jpg' })

function changeSet(kind: string, payload: Record<string, unknown>, extra: Record<string, unknown> = {}) {
    return { id: 'cs_1', action: { kind, payload }, ...extra } as never
}
const update = (changes: Record<string, unknown>, base = UPDATED_AT) => changeSet('shop_product.update', { id: '42', base, changes })
const status = (from: string, to: string, extra: Record<string, unknown> = {}, base = UPDATED_AT) =>
    changeSet('shop_product.set_status', { id: '42', base, from, to }, extra)
const updateData = () => cms().update.mock.calls[0]?.[0] as { id: number; data: Record<string, unknown>; overrideAccess: boolean; user: unknown }

beforeEach(() => {
    state.cms = fakeCms({ products: [productDoc()] })
    vi.mocked(canUse).mockResolvedValue(true)
    vi.mocked(ingestPicture).mockClear()
})

describe('shop_product.update [TC-AIREL-166]', () => {
    it('writes only the changed fields through save-product, with the approver\'s access, and returns the pre-image as undo', async () => {
        const result = await applyChangeSet(update({ price: 45, tags: ['batik', 'sale'], description: '## Care\n\nHand wash **cold**.', seo: { title: 'Batik Scarf RM45' } }), SHOP_ACTOR)

        const call = updateData()
        expect(call).toMatchObject({ id: 42, overrideAccess: false, user: SHOP_ACTOR.user })
        expect(call.data).toMatchObject({ name: 'Batik Scarf', price: 45, tags: [{ tag: 'batik' }, { tag: 'sale' }], seo: { title: 'Batik Scarf RM45', description: null } })
        const root = (call.data.description as { root: { children: Array<{ type: string; tag?: string }> } }).root
        expect(root.children.map((node) => node.type + (node.tag ?? ''))).toEqual(['headingh2', 'paragraph'])
        // a copilot edit is not a review and attaches no placeholder photo
        expect(call.data).not.toHaveProperty('aiReviewPending')
        expect(call.data).not.toHaveProperty('images')
        expect(call.data).not.toHaveProperty('sku')
        expect(result.entities).toEqual([{ kind: 'product', id: '42', label: 'Batik Scarf' }])
        expect(result.links).toEqual([{ label: 'Open product', href: '/products/42' }])
        expect(result.undo).toMatchObject({
            kind: 'shop_product.restore',
            payload: { id: '42', expect: NEW_STAMP, fields: { price: 49, tags: [{ tag: 'batik' }], seo: { title: null, description: null } } },
        })
        expect(Object.keys((result.undo?.payload as { fields: object }).fields).sort()).toEqual(['description', 'price', 'seo', 'tags'])
        const days = (Date.parse(result.undo?.until ?? '') - Date.now()) / 86_400_000
        expect(days).toBeGreaterThan(6.9)
        expect(days).toBeLessThanOrEqual(7)
    })

    it('clears the compare-at price with null and keeps the SKU check of the form', async () => {
        state.cms = fakeCms({ products: [productDoc({ compareAtPrice: 60 })] })

        await applyChangeSet(update({ compareAtPrice: null, sku: 'BAT-002' }), SHOP_ACTOR)

        expect(updateData().data).toMatchObject({ compareAtPrice: null, sku: 'BAT-002' })
        expect(cms().db.drizzle.execute).toHaveBeenCalled()
    })

    it('reports a SKU another product uses', async () => {
        cms().db.drizzle.execute.mockResolvedValueOnce({ rows: [{ sku: 'taken-1' }] })

        await expect(applyChangeSet(update({ sku: 'TAKEN-1' }), SHOP_ACTOR)).rejects.toMatchObject({ status: 422, message: expect.stringMatching(/SKU already in use/) })
        expect(cms().update).not.toHaveBeenCalled()
    })

    it('re-passes the options of a product that has them, without row ids', async () => {
        state.cms = fakeCms({
            products: [productDoc({ hasVariants: true, variants: [{ id: 'r1', name: 'Red', sku: 'R', price: 49, stock: 3 }], variantConfigs: [{ id: 'c1', name: 'Colour', options: [{ id: 'o1', value: 'Red' }] }] })],
        })

        await applyChangeSet(update({ name: 'Batik Scarf Deluxe' }), SHOP_ACTOR)

        expect(updateData().data.variants).toEqual([{ name: 'Red', sku: 'R', price: 49, stock: 3 }])
        expect(updateData().data.variantConfigs).toEqual([{ name: 'Colour', options: [{ value: 'Red' }] }])
    })
})

describe('refusals [TC-AIREL-167..170]', () => {
    it('409 when the product moved since the draft, and writes nothing [TC-AIREL-167]', async () => {
        state.cms = fakeCms({ products: [productDoc({ updatedAt: '2026-10-20T09:31:00.000Z' })] })

        await expect(applyChangeSet(update({ price: 45 }), SHOP_ACTOR)).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/changed after the assistant drafted/) })
        expect(cms().update).not.toHaveBeenCalled()
        expect(cms().create).not.toHaveBeenCalled()
    })

    it('compares the versions as instants, not as text [TC-AIREL-167]', async () => {
        await applyChangeSet(update({ price: 45 }, '2026-10-20T17:30:00.000+08:00'), SHOP_ACTOR)

        expect(cms().update).toHaveBeenCalledTimes(1)
    })

    it('409 for a product that is gone or in the trash [TC-AIREL-167]', async () => {
        state.cms = fakeCms({ products: [] })
        await expect(applyChangeSet(update({ price: 45 }), SHOP_ACTOR)).rejects.toMatchObject({ status: 409 })

        state.cms = fakeCms({ products: [productDoc({ deletedAt: '2026-10-20T10:00:00.000Z' })] })
        await expect(applyChangeSet(update({ price: 45 }), SHOP_ACTOR)).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/trash/) })
    })

    it('refuses a stock edit on a product with options [TC-AIREL-168]', async () => {
        state.cms = fakeCms({ products: [productDoc({ hasVariants: true })] })

        await expect(applyChangeSet(update({ inventory: 5 }), SHOP_ACTOR)).rejects.toMatchObject({ status: 422, message: expect.stringMatching(/options/) })
        expect(cms().update).not.toHaveBeenCalled()
    })

    it('refuses a compare-at price at or under the price [TC-AIREL-169]', async () => {
        await expect(applyChangeSet(update({ compareAtPrice: 49 }), SHOP_ACTOR)).rejects.toMatchObject({ status: 422, message: expect.stringMatching(/higher than the price/) })
        state.cms = fakeCms({ products: [productDoc({ compareAtPrice: 55 })] })
        await expect(applyChangeSet(update({ price: 56 }), SHOP_ACTOR)).rejects.toMatchObject({ status: 422 })
    })

    it('refuses a category that is not one of this shop\'s, checking inside the workspace [TC-AIREL-170]', async () => {
        state.cms = fakeCms({ products: [productDoc()], categories: [] })

        await expect(applyChangeSet(update({ categoryId: '9' }), SHOP_ACTOR)).rejects.toMatchObject({ status: 422, message: expect.stringMatching(/category/) })
        const lookup = cms().find.mock.calls.map(([args]) => args).find((args) => args.collection === 'categories')
        expect(JSON.stringify(lookup?.where)).toContain('"tenant":{"equals":4}')
        expect(cms().update).not.toHaveBeenCalled()
    })

    it('refuses a plan without product management, and a malformed payload', async () => {
        vi.mocked(canUse).mockResolvedValue(false)
        await expect(applyChangeSet(update({ price: 45 }), SHOP_ACTOR)).rejects.toMatchObject({ status: 403 })
        vi.mocked(canUse).mockResolvedValue(true)
        await expect(applyChangeSet(changeSet('shop_product.update', { id: 'x', base: 'y', changes: {} }), SHOP_ACTOR)).rejects.toMatchObject({ status: 422 })
        await expect(applyChangeSet(update({ price: -1 }), SHOP_ACTOR)).rejects.toMatchObject({ status: 422 })
        await expect(applyChangeSet(update({ unknownField: 1 }), SHOP_ACTOR)).rejects.toMatchObject({ status: 422 })
    })
})

describe('photos [TC-AIREL-171]', () => {
    it('keeps the product\'s own photos as they are and ingests new ones into the shop\'s media', async () => {
        const result = await applyChangeSet(
            update({
                images: [
                    { ref: 'attachment:att_9', url: '/api/agent/attachments/att_9', alt: 'Side', existing: false },
                    { ref: 'media:11', url: '/api/media/file/11.jpg', alt: null, existing: true },
                ],
            }),
            SHOP_ACTOR,
            ATT,
        )

        expect(ingestPicture).toHaveBeenCalledTimes(1)
        expect(vi.mocked(ingestPicture).mock.calls[0]?.[1]).toMatchObject({ ref: 'attachment:att_9' })
        expect(vi.mocked(ingestPicture).mock.calls[0]?.[4]).toBe('4')
        expect(updateData().data.images).toEqual([{ image: 77, alt: 'Side' }, { image: 11, alt: 'Front' }])
        expect((result.undo?.payload as { fields: { images: unknown } }).fields.images).toEqual([{ mediaId: '11', alt: 'Front' }])
    })

    it('does not trust the existing flag: a media ref that is not on the product goes through the library check', async () => {
        await applyChangeSet(update({ images: [{ ref: 'media:99', url: '', alt: 'Other', existing: true }] }), SHOP_ACTOR)

        expect(ingestPicture).toHaveBeenCalledTimes(1)
        expect(vi.mocked(ingestPicture).mock.calls[0]?.[1]).toMatchObject({ ref: 'media:99' })
    })

    it('allows at most 5 photos', async () => {
        const images = Array.from({ length: 6 }, (_, i) => ({ ref: `pixabay:${i}`, url: 'https://cdn.pixabay.com/x.jpg', alt: 'x', existing: false }))

        await expect(applyChangeSet(update({ images }), SHOP_ACTOR)).rejects.toMatchObject({ status: 422, message: expect.stringMatching(/5 photos/) })
    })

    it('lets a product with more than 5 photos keep or trim them', async () => {
        const six = Array.from({ length: 6 }, (_, i) => ({ image: 100 + i, alt: `p${i}` }))
        state.cms = fakeCms({ products: [productDoc({ images: six })] })
        const keep = six.slice(0, 5).map((row) => ({ ref: `media:${row.image}`, url: '', alt: null, existing: true }))

        await applyChangeSet(update({ images: [...keep, { ref: 'media:105', url: '', alt: null, existing: true }].slice(0, 6).reverse() }), SHOP_ACTOR)

        expect((updateData().data.images as unknown[]).length).toBe(6)
        expect(ingestPicture).not.toHaveBeenCalled()
    })
})

describe('options stock sold during a photo upload is kept [TC-AIREL-268]', () => {
    it('reads the options again after the upload: the saved options carry the stock checkout left', async () => {
        const products = [productDoc({ hasVariants: true, variants: [{ id: 'r1', name: 'Red', sku: 'R', price: 49, stock: 5 }], variantConfigs: [{ id: 'c1', name: 'Colour', options: [{ id: 'o1', value: 'Red' }] }] })]
        state.cms = fakeCms({ products })
        // a buyer checks out while the picture uploads: raw SQL lowers the option's stock, updatedAt stays
        vi.mocked(ingestPicture).mockImplementationOnce(async () => {
            products[0] = { ...(products[0] as object), variants: [{ id: 'r1', name: 'Red', sku: 'R', price: 49, stock: 4 }] } as never
            return { id: 77, url: '/x.jpg' } as never
        })

        await applyChangeSet(update({ images: [{ ref: 'attachment:att_9', url: '/api/agent/attachments/att_9', alt: 'Side', existing: false }] }), SHOP_ACTOR, ATT)

        expect(updateData().data.variants).toEqual([{ name: 'Red', sku: 'R', price: 49, stock: 4 }])
        expect(updateData().data.images).toEqual([{ image: 77, alt: 'Side' }])
    })

    it('refuses (409, nothing written) when the product itself was saved during the upload', async () => {
        const products = [productDoc({ hasVariants: true, variants: [{ id: 'r1', name: 'Red', sku: 'R', price: 49, stock: 5 }] })]
        state.cms = fakeCms({ products })
        vi.mocked(ingestPicture).mockImplementationOnce(async () => {
            products[0] = { ...(products[0] as object), updatedAt: '2026-10-20T09:45:00.000Z' } as never
            return { id: 77, url: '/x.jpg' } as never
        })

        await expect(
            applyChangeSet(update({ images: [{ ref: 'attachment:att_9', url: '/api/agent/attachments/att_9', alt: 'Side', existing: false }] }), SHOP_ACTOR, ATT),
        ).rejects.toMatchObject({ status: 409 })
        expect(cms().update).not.toHaveBeenCalled()
    })
})

describe('undo of an edit [TC-AIREL-172]', () => {
    const restore = (fields: Record<string, unknown>, expectStamp = NEW_STAMP) => ({
        kind: 'shop_product.restore',
        payload: { id: '42', expect: expectStamp, fields },
        until: new Date(Date.now() + 86_400_000).toISOString(),
    })

    it('puts the pre-image back while the product is as the edit left it', async () => {
        state.cms = fakeCms({ products: [productDoc({ updatedAt: NEW_STAMP, price: 45 })] })

        await applyUndo(restore({ price: 49, sku: null, images: [{ mediaId: '11', alt: 'Front' }] }), SHOP_ACTOR, 'cs_1')

        expect(updateData()).toMatchObject({ id: 42, overrideAccess: false })
        expect(updateData().data).toEqual({ price: 49, sku: null, images: [{ image: 11, alt: 'Front' }] })
    })

    it('refuses once the product was edited again, and after the undo window', async () => {
        // edited again to a price that is neither the edit's nor the pre-image's
        state.cms = fakeCms({ products: [productDoc({ updatedAt: '2026-10-21T11:00:00.000Z', price: 45 })] })

        await expect(applyUndo(restore({ price: 49 }), SHOP_ACTOR, 'cs_1')).rejects.toMatchObject({ status: 409 })
        await expect(applyUndo({ ...restore({ price: 49 }), until: new Date(Date.now() - 1000).toISOString() }, SHOP_ACTOR, 'cs_1')).rejects.toMatchObject({ status: 409 })
        expect(cms().update).not.toHaveBeenCalled()
    })

    it('succeeds without writing when the product already reads as the pre-image (an undo whose record was lost) [TC-AISEC-104]', async () => {
        // the first undo wrote the pre-image (new stamp); the repeated undo finds it there
        state.cms = fakeCms({ products: [productDoc({ updatedAt: '2026-10-21T11:00:00.000Z', price: 49, sku: null })] })

        const result = await applyUndo(restore({ price: 49, sku: null }), SHOP_ACTOR, 'cs_1')

        expect(result).toMatchObject({ entities: [{ kind: 'product', id: '42' }] })
        expect(cms().update).not.toHaveBeenCalled()
    })

    it('a status undo already back where it puts the product succeeds without writing [TC-AISEC-104]', async () => {
        state.cms = fakeCms({ products: [productDoc({ updatedAt: '2026-10-21T11:00:00.000Z', status: 'draft' })] })
        const statusUndo = { kind: 'shop_product.restore', payload: { id: '42', expect: NEW_STAMP, expectState: { status: 'active', trashed: false }, fields: { status: 'draft', deletedAt: null } }, until: new Date(Date.now() + 86_400_000).toISOString() }

        await expect(applyUndo(statusUndo, SHOP_ACTOR, 'cs_1')).resolves.toMatchObject({ entities: [{ id: '42' }] })

        expect(cms().update).not.toHaveBeenCalled()
    })

    it('ignores keys that are not in the pre-image vocabulary (a payload came back from outside)', async () => {
        state.cms = fakeCms({ products: [productDoc({ updatedAt: NEW_STAMP })] })

        await applyUndo(restore({ price: 49, tenant: 9, status: 'active', aiReviewPending: true }), SHOP_ACTOR, 'cs_1')

        expect(updateData().data).toEqual({ price: 49 })
    })
})

describe('shop_product.set_status [TC-AIREL-173..176]', () => {
    it('activates a ready product, clears the AI review flag, and undo is the inverse transition [TC-AIREL-173]', async () => {
        const result = await applyChangeSet(status('draft', 'active'), SHOP_ACTOR)

        expect(updateData().data).toMatchObject({ status: 'active', aiReviewPending: false })
        expect(result.undo).toMatchObject({
            kind: 'shop_product.restore',
            payload: { id: '42', expectState: { status: 'active', trashed: false }, fields: { status: 'draft', deletedAt: null } },
        })
    })

    it('answers the publish gate\'s missing fields instead of activating [TC-AIREL-173]', async () => {
        state.cms = fakeCms({ products: [productDoc({ sku: '', weight: 0 })] })

        await expect(applyChangeSet(status('draft', 'active'), SHOP_ACTOR)).rejects.toMatchObject({
            status: 422,
            message: expect.stringMatching(/missing: sku, weight/i),
        })
        expect(cms().update).not.toHaveBeenCalled()
    })

    it('needs the typed name for archive and trash [TC-AIREL-174]', async () => {
        await expect(applyChangeSet(status('draft', 'archived'), SHOP_ACTOR)).rejects.toMatchObject({ status: 422, message: expect.stringMatching(/typed/) })
        await expect(applyChangeSet(status('draft', 'trash'), SHOP_ACTOR)).rejects.toMatchObject({ status: 422 })
        expect(cms().update).not.toHaveBeenCalled()

        await applyChangeSet(status('draft', 'archived', { confirmText: 'Batik Scarf' }), SHOP_ACTOR)
        expect(updateData().data).toMatchObject({ status: 'archived' })
    })

    it('trash is a soft delete: deletedAt is set and the status is left alone [TC-AIREL-175]', async () => {
        const result = await applyChangeSet(status('draft', 'trash', { confirmText: 'Batik Scarf' }), SHOP_ACTOR)

        const { data } = updateData()
        expect(typeof data.deletedAt).toBe('string')
        expect(data).not.toHaveProperty('status')
        expect(result.undo?.payload).toMatchObject({ expectState: { status: 'draft', trashed: true }, fields: { status: 'draft', deletedAt: null } })
    })

    it('brings a trashed product back as a draft, and only as a draft [TC-AIREL-175]', async () => {
        state.cms = fakeCms({ products: [productDoc({ status: 'active', deletedAt: '2026-10-20T10:00:00.000Z' })] })

        await expect(applyChangeSet(status('trash', 'active'), SHOP_ACTOR)).rejects.toMatchObject({ status: 422 })
        await applyChangeSet(status('trash', 'draft'), SHOP_ACTOR)

        expect(updateData().data).toMatchObject({ status: 'draft', deletedAt: null })
    })

    it('refuses when the status moved since the draft, or the version did [TC-AIREL-176]', async () => {
        state.cms = fakeCms({ products: [productDoc({ status: 'active' })] })
        await expect(applyChangeSet(status('draft', 'archived', { confirmText: 'x' }), SHOP_ACTOR)).rejects.toMatchObject({ status: 409 })

        state.cms = fakeCms({ products: [productDoc({ updatedAt: '2026-10-20T09:31:00.000Z' })] })
        await expect(applyChangeSet(status('draft', 'active'), SHOP_ACTOR)).rejects.toMatchObject({ status: 409 })
        expect(cms().update).not.toHaveBeenCalled()
    })

    it('undoes a status change by the status itself, so the SEO fill that follows an activation does not block it [TC-AIREL-176]', async () => {
        // updatedAt moved (background SEO), the status is still what the change left
        state.cms = fakeCms({ products: [productDoc({ status: 'active', updatedAt: '2026-10-21T10:05:00.000Z' })] })
        const undo = {
            kind: 'shop_product.restore',
            payload: { id: '42', expect: NEW_STAMP, expectState: { status: 'active', trashed: false }, fields: { status: 'draft', deletedAt: null } },
            until: new Date(Date.now() + 86_400_000).toISOString(),
        }

        await applyUndo(undo, SHOP_ACTOR, 'cs_1')

        expect(updateData().data).toMatchObject({ status: 'draft', deletedAt: null })

        // but not once someone changed the status again
        state.cms = fakeCms({ products: [productDoc({ status: 'archived' })] })
        await expect(applyUndo(undo, SHOP_ACTOR, 'cs_1')).rejects.toMatchObject({ status: 409 })
    })

    it('restores a trashed product\'s pre-image: status and deletedAt together', async () => {
        state.cms = fakeCms({ products: [productDoc({ deletedAt: '2026-10-21T10:00:00.000Z' })] })
        const undo = {
            kind: 'shop_product.restore',
            payload: { id: '42', expect: NEW_STAMP, expectState: { status: 'draft', trashed: true }, fields: { status: 'draft', deletedAt: null } },
            until: new Date(Date.now() + 86_400_000).toISOString(),
        }

        await applyUndo(undo, SHOP_ACTOR, 'cs_1')

        expect(updateData().data).toMatchObject({ status: 'draft', deletedAt: null })
    })
})
