/**
 * TC-AIAUD-114..120 — applying and undoing the approved "set up N products" card (`shop_product.bulk.update`):
 * workspace scoping, the version guard checked for every product before any write, options, the publish gate,
 * a write that fails midway, and ONE undo that never overwrites a later edit.
 * Real: appliers/store-product-setup, lib/products/save-product (patch mode).
 * Faked: Payload (a small in-memory products table), the plan gate, picture ingest.
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
import { canUse } from '@/lib/subscriptions/plan-subscription'

type Doc = ReturnType<typeof productDoc>
const NEW_STAMP = '2026-10-21T10:00:00.000Z'
const ATT = async () => ({ buffer: Buffer.from('x'), mime: 'image/jpeg', name: 'a.jpg' })

/** A fake Payload whose `products` table answers by id inside the workspace (tenant 4) and keeps what is written. */
function table(docs: Doc[]) {
    const cms = fakeCms({ products: docs })
    const rows = new Map<number, Doc>(docs.map((doc) => [doc.id as number, doc]))
    cms.find.mockImplementation(async (args) => {
        if (args.collection !== 'products') return { docs: [], totalDocs: 0, hasNextPage: false, totalPages: 1 }
        const where = JSON.stringify(args.where)
        const id = Number(/"id":\{"equals":(\d+)\}/.exec(where)?.[1])
        const tenant = Number(/"tenant":\{"equals":(\d+)\}/.exec(where)?.[1])
        const found = [...rows.values()].filter((doc) => doc.id === id && doc.tenant === tenant)
        return { docs: found, totalDocs: found.length, hasNextPage: false, totalPages: 1 }
    })
    cms.findByID.mockImplementation(async ({ id }: { id: number }) => rows.get(id) ?? null)
    cms.update.mockImplementation(async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
        const next = { ...(rows.get(id) as Doc), ...data, updatedAt: NEW_STAMP } as Doc
        rows.set(id, next)
        return next
    })
    return { cms, rows }
}

const doc = (id: number, name: string, over: Record<string, unknown> = {}) =>
    productDoc({ id, name, status: 'active', price: 0, inventory: 0, sku: `SKU-${id}`, images: [{ image: 11, alt: 'Stock' }], updatedAt: `${UPDATED_AT}`, ...over })

const bulk = (items: Array<{ id: string; changes: Record<string, unknown>; base?: string; name?: string }>) =>
    ({ id: 'cs_1', action: { kind: 'shop_product.bulk.update', payload: { items: items.map((item) => ({ base: UPDATED_AT, ...item })) } } }) as never

type Written = { id: number; data: Record<string, unknown>; overrideAccess: boolean; user: unknown }
const writes = () => (state.cms as ReturnType<typeof fakeCms>).update.mock.calls.map(([args]) => args as Written)

beforeEach(() => {
    vi.mocked(canUse).mockResolvedValue(true)
    vi.mocked(ingestPicture).mockClear()
    state.cms = null
})

describe('shop_product.bulk.update [TC-AIAUD-114]', () => {
    it('writes each product through save-product with the approver\'s access, in the workspace, and returns ONE undo for all', async () => {
        const { cms } = table([doc(11, 'Rose serum'), doc(12, 'Night cream', { price: 35, inventory: 3 })])
        state.cms = cms

        const result = await applyChangeSet(bulk([{ id: '11', changes: { price: 59, inventory: 12 } }, { id: '12', changes: { inventory: 8, status: 'draft' } }]), SHOP_ACTOR)

        expect(writes().map((w) => [w.id, w.overrideAccess, w.user === SHOP_ACTOR.user])).toEqual([[11, false, true], [12, false, true]])
        expect(writes()[0]?.data).toMatchObject({ name: 'Rose serum', price: 59, inventory: 12 })
        expect(writes()[0]?.data).not.toHaveProperty('status')
        expect(writes()[1]?.data).toMatchObject({ inventory: 8, status: 'draft' })
        // a copilot edit attaches no placeholder photo and leaves photos alone
        expect(writes()[0]?.data).not.toHaveProperty('images')
        expect(result.entities).toEqual([{ kind: 'product', id: '11', label: 'Rose serum' }, { kind: 'product', id: '12', label: 'Night cream' }])
        expect(result.links).toEqual([{ label: 'Open products', href: '/products' }])
        expect(result.undo).toMatchObject({
            kind: 'shop_product.restore_many',
            payload: {
                items: [
                    { id: '11', name: 'Rose serum', before: { price: 0, inventory: 0 }, after: { price: 59, inventory: 12 } },
                    { id: '12', name: 'Night cream', before: { inventory: 3, status: 'active' }, after: { inventory: 8, status: 'draft' } },
                ],
            },
        })
        expect((Date.parse(result.undo?.until ?? '') - Date.now()) / 86_400_000).toBeGreaterThan(6.9)
    })

    it('ingests a new photo into the shop\'s media and keeps the one the product has [TC-AIAUD-114]', async () => {
        const { cms } = table([doc(11, 'Rose serum')])
        state.cms = cms

        const result = await applyChangeSet(
            bulk([{ id: '11', changes: { images: [{ ref: 'attachment:att_9', url: '/api/agent/attachments/att_9', alt: 'Bottle', existing: false }, { ref: 'media:11', alt: null, existing: true }] } }]),
            SHOP_ACTOR,
            ATT,
        )

        expect(vi.mocked(ingestPicture).mock.calls[0]?.[4]).toBe('4')
        expect(writes()[0]?.data.images).toEqual([{ image: 77, alt: 'Bottle' }, { image: 11, alt: 'Stock' }])
        expect(result.undo?.payload).toMatchObject({ items: [{ before: { images: [{ mediaId: '11', alt: 'Stock' }] }, after: { images: ['77', '11'] } }] })
    })

    it('clears the AI-review flag when a draft goes on sale, and refuses it without the publish gate fields', async () => {
        const { cms } = table([doc(11, 'Rose serum', { status: 'draft', aiReviewPending: true, price: 10, inventory: 1 }), doc(12, 'Night cream', { status: 'draft', sku: null })])
        state.cms = cms

        await applyChangeSet(bulk([{ id: '11', changes: { status: 'active' } }]), SHOP_ACTOR)
        expect(writes()[0]?.data).toMatchObject({ status: 'active', aiReviewPending: false })

        await expect(applyChangeSet(bulk([{ id: '12', changes: { inventory: 5, status: 'active' } }]), SHOP_ACTOR)).rejects.toMatchObject({ status: 422, message: expect.stringMatching(/Night cream.*can't be on sale yet.*SKU/) })
    })
})

describe('new photos come in before any product is written [TC-AIAUD-154]', () => {
    const photo = (n: number) => ({ ref: `attachment:att_${n}`, url: `/api/agent/attachments/att_${n}`, alt: `Photo ${n}`, existing: false })

    it('TC-AIAUD-154: every download finishes before the first product write (a slow picture cannot cut the writes short)', async () => {
        const { cms } = table([doc(11, 'Rose serum'), doc(12, 'Night cream'), doc(13, 'Day cream')])
        state.cms = cms
        const order: string[] = []
        vi.mocked(ingestPicture).mockImplementation(async (_cms, image) => {
            order.push(`ingest ${(image as { ref: string }).ref}`)
            return { id: 77, url: '/x.jpg' } as never
        })
        const update = cms.update.getMockImplementation() as (args: never) => Promise<unknown>
        cms.update.mockImplementation(async (args: { id: number }) => {
            order.push(`write ${args.id}`)
            return update(args as never)
        })

        await applyChangeSet(bulk([{ id: '11', changes: { price: 5, images: [photo(1)] } }, { id: '12', changes: { inventory: 2 } }, { id: '13', changes: { images: [photo(2)] } }]), SHOP_ACTOR, ATT)

        expect(order).toEqual(['ingest attachment:att_1', 'ingest attachment:att_2', 'write 11', 'write 12', 'write 13'])
    })

    it('TC-AIAUD-154: a picture that cannot be fetched stops the card before any product is written, naming the product', async () => {
        const { cms } = table([doc(11, 'Rose serum'), doc(12, 'Night cream')])
        state.cms = cms
        vi.mocked(ingestPicture).mockReset()
        vi.mocked(ingestPicture).mockResolvedValueOnce({ id: 77, url: '/x.jpg' } as never).mockRejectedValueOnce(new Error('download timed out'))

        await expect(
            applyChangeSet(bulk([{ id: '11', changes: { price: 5, images: [photo(1)] } }, { id: '12', changes: { images: [photo(2)] } }]), SHOP_ACTOR, ATT),
        ).rejects.toMatchObject({ message: expect.stringContaining('Night cream') })

        expect(writes()).toHaveLength(0)
        vi.mocked(ingestPicture).mockReset()
        vi.mocked(ingestPicture).mockResolvedValue({ id: 77, url: '/x.jpg' } as never)
    })
})

describe('checked together before anything is written [TC-AIAUD-115]', () => {
    it('refuses the whole card, naming the product, when one was edited since the draft', async () => {
        const { cms } = table([doc(11, 'Rose serum'), doc(12, 'Night cream', { updatedAt: '2026-10-20T09:31:00.000Z' })])
        state.cms = cms

        const out = applyChangeSet(bulk([{ id: '11', changes: { inventory: 4 } }, { id: '12', changes: { inventory: 6 } }]), SHOP_ACTOR)

        await expect(out).rejects.toMatchObject({ status: 409, final: true, stale: true, message: expect.stringMatching(/"Night cream": This product changed after the assistant drafted/) })
        expect(cms.update).not.toHaveBeenCalled()
    })

    it('never reaches a product of another workspace, a trashed one, or one that is gone', async () => {
        const { cms } = table([doc(11, 'Rose serum'), doc(13, 'Foreign', { tenant: 9 }), doc(14, 'Binned', { deletedAt: '2026-10-20T10:00:00.000Z' })])
        state.cms = cms

        await expect(applyChangeSet(bulk([{ id: '11', changes: { inventory: 4 } }, { id: '13', changes: { inventory: 6 } }]), SHOP_ACTOR)).rejects.toMatchObject({ status: 409 })
        await expect(applyChangeSet(bulk([{ id: '14', changes: { inventory: 6 } }]), SHOP_ACTOR)).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/Binned.*trash/) })
        await expect(applyChangeSet(bulk([{ id: '99', changes: { inventory: 6 } }]), SHOP_ACTOR)).rejects.toMatchObject({ status: 409 })
        expect(cms.update).not.toHaveBeenCalled()
        const lookups = cms.find.mock.calls.map(([args]) => JSON.stringify(args.where)).filter((where) => where.includes('"id"'))
        expect(lookups.length).toBeGreaterThan(0)
        expect(lookups.every((where) => where.includes('"tenant":{"equals":4}'))).toBe(true)
    })

    it('refuses a plan without product management, a repeated id and a malformed payload', async () => {
        const { cms } = table([doc(11, 'Rose serum')])
        state.cms = cms
        vi.mocked(canUse).mockResolvedValue(false)
        await expect(applyChangeSet(bulk([{ id: '11', changes: { inventory: 4 } }]), SHOP_ACTOR)).rejects.toMatchObject({ status: 403 })
        vi.mocked(canUse).mockResolvedValue(true)
        await expect(applyChangeSet(bulk([{ id: '11', changes: { inventory: 4 } }, { id: '11', changes: { inventory: 5 } }]), SHOP_ACTOR)).rejects.toMatchObject({ status: 422 })
        await expect(applyChangeSet(bulk([{ id: 'x', changes: { inventory: 4 } }]), SHOP_ACTOR)).rejects.toMatchObject({ status: 422 })
        await expect(applyChangeSet(bulk([{ id: '11', changes: { inventory: -1 } }]), SHOP_ACTOR)).rejects.toMatchObject({ status: 422 })
        await expect(applyChangeSet(bulk([{ id: '11', changes: { sku: 'NEW' } }]), SHOP_ACTOR)).rejects.toMatchObject({ status: 422 })
        await expect(applyChangeSet({ id: 'cs_1', action: { kind: 'shop_product.bulk.update', payload: { items: [] } } } as never, SHOP_ACTOR)).rejects.toMatchObject({ status: 422 })
        expect(cms.update).not.toHaveBeenCalled()
    })
})

describe('options and compare-at price [TC-AIAUD-116]', () => {
    it('refuses price and stock of a product with options, but keeps its options when only photos change', async () => {
        const options = { hasVariants: true, variants: [{ id: 'r1', name: 'Red', sku: 'R', price: 49, stock: 3 }], variantConfigs: [{ id: 'c1', name: 'Colour', options: [{ id: 'o1', value: 'Red' }] }] }
        const { cms } = table([doc(11, 'Linen shirt', options)])
        state.cms = cms

        await expect(applyChangeSet(bulk([{ id: '11', changes: { inventory: 5 } }]), SHOP_ACTOR)).rejects.toMatchObject({ status: 422, message: expect.stringMatching(/Linen shirt.*options/) })
        expect(cms.update).not.toHaveBeenCalled()

        await applyChangeSet(bulk([{ id: '11', changes: { images: [{ ref: 'media:11', alt: 'New alt', existing: true }] } }]), SHOP_ACTOR)
        expect(writes()[0]?.data.variants).toEqual([{ name: 'Red', sku: 'R', price: 49, stock: 3 }])
        expect(writes()[0]?.data.variantConfigs).toEqual([{ name: 'Colour', options: [{ value: 'Red' }] }])
    })

    it('refuses a price at or over the compare-at price', async () => {
        state.cms = table([doc(11, 'Rose serum', { compareAtPrice: 40 })]).cms

        await expect(applyChangeSet(bulk([{ id: '11', changes: { price: 40 } }]), SHOP_ACTOR)).rejects.toMatchObject({ status: 422, message: expect.stringMatching(/compare-at/) })
    })
})

describe('a write that fails midway [TC-AIAUD-117]', () => {
    it('closes the card as applied with the products already done (their undo kept) and names the one that failed', async () => {
        const { cms } = table([doc(11, 'Rose serum'), doc(12, 'Night cream')])
        state.cms = cms
        const update = cms.update.getMockImplementation() as (args: never) => Promise<unknown>
        cms.update.mockImplementationOnce(update).mockRejectedValueOnce(Object.assign(new Error('boom'), { name: 'ValidationError', data: { errors: [{ path: 'price', message: 'is invalid' }] } }))

        const failed = applyChangeSet(bulk([{ id: '11', changes: { inventory: 4 } }, { id: '12', changes: { price: 9 } }]), SHOP_ACTOR)

        await expect(failed).rejects.toMatchObject({
            final: true,
            status: 422,
            message: expect.stringMatching(/"Night cream": .*price: is invalid.*Done before it: "Rose serum"/),
            partial: { entities: [{ kind: 'product', id: '11', label: 'Rose serum' }], undo: { kind: 'shop_product.restore_many', payload: { items: [{ id: '11' }] } } },
        })
    })
})

describe('undo of a batch [TC-AIAUD-118..120]', () => {
    const undoRecord = (items: unknown[]) => ({ kind: 'shop_product.restore_many', payload: { items }, until: new Date(Date.now() + 86_400_000).toISOString() })
    const items = [
        { id: '11', name: 'Rose serum', before: { price: 0, inventory: 0 }, after: { price: 59, inventory: 12 } },
        { id: '12', name: 'Night cream', before: { inventory: 3, status: 'active' }, after: { inventory: 8, status: 'draft' } },
    ]

    it('puts every product back in one go [TC-AIAUD-118]', async () => {
        const { cms } = table([doc(11, 'Rose serum', { price: 59, inventory: 12 }), doc(12, 'Night cream', { inventory: 8, status: 'draft' })])
        state.cms = cms

        const result = await applyUndo(undoRecord(items), SHOP_ACTOR, 'cs_1')

        expect(writes().map((w) => [w.id, w.data, w.overrideAccess])).toEqual([
            [11, { price: 0, inventory: 0 }, false],
            [12, { inventory: 3, status: 'active' }, false],
        ])
        expect(result.entities?.map((e) => e.id)).toEqual(['11', '12'])
    })

    it('restores nothing, and names the product, when one was edited in a field the change touched [TC-AIAUD-119]', async () => {
        const { cms } = table([doc(11, 'Rose serum', { price: 59, inventory: 12 }), doc(12, 'Night cream', { inventory: 7, status: 'draft' })])
        state.cms = cms

        await expect(applyUndo(undoRecord(items), SHOP_ACTOR, 'cs_1')).rejects.toMatchObject({
            status: 409,
            message: expect.stringMatching(/"Night cream" was edited after the change/),
        })
        expect(cms.update).not.toHaveBeenCalled()
    })

    it('skips a product that is already back, and refuses after the undo window, a trashed product and a malformed record [TC-AIAUD-120]', async () => {
        const { cms } = table([doc(11, 'Rose serum', { price: 0, inventory: 0 }), doc(12, 'Night cream', { inventory: 8, status: 'draft' })])
        state.cms = cms

        await applyUndo(undoRecord(items), SHOP_ACTOR, 'cs_1')
        expect(writes().map((w) => w.id)).toEqual([12])

        await expect(applyUndo({ ...undoRecord(items), until: new Date(Date.now() - 1000).toISOString() }, SHOP_ACTOR, 'cs_1')).rejects.toMatchObject({ status: 409 })
        await expect(applyUndo(undoRecord([{ id: 'x', name: 'n', before: {}, after: {} }]), SHOP_ACTOR, 'cs_1')).rejects.toMatchObject({ status: 422 })
        state.cms = table([doc(11, 'Rose serum', { price: 59, inventory: 12, deletedAt: '2026-10-20T10:00:00.000Z' })]).cms
        await expect(applyUndo(undoRecord([items[0]]), SHOP_ACTOR, 'cs_1')).rejects.toMatchObject({ status: 409 })
    })
})
