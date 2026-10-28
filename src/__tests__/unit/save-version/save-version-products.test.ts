// @vitest-environment node
/**
 * TC-AICP-325 — saveProduct (the manual save) with `expectedUpdatedAt`: the same version saves and returns the doc with
 * its new updatedAt; a stale version is refused (typed conflict carrying the stored version) before anything is written
 * (no photo, no update); no version = today's behaviour (copilot / imports); saveProductAction returns the conflict as a result.
 * TC-AICP-326 — updateProductField (list status / trash) with the row's version: same behaviours; the action returns the conflict.
 * TC-AICP-338 — getProductAction hands the form the version AFTER it cleared the AI-review flag (that clear is a write).
 * Real: save-product, products/actions, save-version. Faked: Payload (a stored product with a clock), session, plan gate.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ stored: { id: 42, name: 'Scarf', status: 'draft', price: 10, sku: 'S', inventory: 1, weight: 0.2, updatedAt: '2026-10-22T01:00:00.000Z', aiReviewPending: false } as Record<string, unknown>, clock: 0 }))
const cms = vi.hoisted(() => ({
    find: vi.fn(),
    create: vi.fn(),
    findByID: vi.fn(),
    update: vi.fn(),
    db: { drizzle: { execute: vi.fn(async () => ({ rows: [] })) } },
}))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => cms) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn(async () => ({ id: 'u1' })),
    tenantIdForQuery: vi.fn(() => 68),
}))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(async () => ({ id: 's1', plan: 'PRO' })),
    canUse: vi.fn(async () => true),
}))
vi.mock('@/lib/media/carton-placeholder', () => ({ findOrCreateCartonMedia: vi.fn(async () => ({ id: 5 })) }))
vi.mock('@/lib/ai/seo-actor', () => ({ withAiActorFor: vi.fn(async (_u: unknown, _t: unknown, run: () => Promise<unknown>) => run()) }))
vi.mock('@/app/(dashboard)/actions/media', () => ({ getOrCreateCrateCartonIdAction: vi.fn(async () => 5) }))

import { getProductAction, saveProductAction, updateProductFieldAction } from '@/app/(dashboard)/products/actions'
import { saveProduct, updateProductField } from '@/lib/products/save-product'
import { VersionConflictError } from '@/lib/save-version/save-version'

const ACTOR = { user: { id: 'u1' } as never, tenantId: 68 }
const LOADED = '2026-10-22T01:00:00.000Z'
const NEWER = '2026-10-22T02:30:00.000Z'

beforeEach(() => {
    vi.clearAllMocks()
    h.stored = { id: 42, name: 'Scarf', status: 'draft', price: 10, sku: 'S', inventory: 1, weight: 0.2, updatedAt: LOADED, aiReviewPending: false }
    h.clock = 0
    cms.findByID.mockImplementation(async () => ({ ...h.stored }))
    cms.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        h.stored = { ...h.stored, ...data, updatedAt: new Date(Date.parse(NEWER) + ++h.clock * 1000).toISOString() }
        return { ...h.stored }
    })
})

const hold = (updatedAt: string) => { h.stored = { ...h.stored, updatedAt } }

describe('saveProduct with expectedUpdatedAt [TC-AICP-325]', () => {
    it('TC-AICP-325: the version the form loaded saves, and the doc comes back with the new updatedAt', async () => {
        const saved = await saveProduct({ name: 'Scarf 2', price: 12 }, 42, { ...ACTOR, expectedUpdatedAt: LOADED })

        expect(cms.update).toHaveBeenCalledTimes(1)
        expect(saved.updatedAt).not.toBe(LOADED)
        expect(saved).toMatchObject({ id: 42, name: 'Scarf 2' })
    })

    it('TC-AICP-325: the same moment spelled with an offset is still fresh', async () => {
        await saveProduct({ name: 'Scarf 2' }, 42, { ...ACTOR, expectedUpdatedAt: '2026-10-22T09:00:00.000+08:00' })
        expect(cms.update).toHaveBeenCalledTimes(1)
    })

    it('TC-AICP-325: a stale version is refused with the stored version, and nothing is written', async () => {
        hold(NEWER)

        const err = await saveProduct({ name: 'My name' }, 42, { ...ACTOR, expectedUpdatedAt: LOADED }).catch((e) => e)

        expect(err).toBeInstanceOf(VersionConflictError)
        expect(err.current).toBe(NEWER)
        expect(cms.update).not.toHaveBeenCalled()
        expect(cms.create).not.toHaveBeenCalled()
        expect(h.stored.name).toBe('Scarf')
    })

    it('TC-AICP-325: no version = no check (copilot patch, imports): a changed product is saved as before', async () => {
        hold(NEWER)

        await saveProduct({ name: 'Scarf 3' }, 42, ACTOR)
        await saveProduct({ name: 'Scarf 4' }, 42, { ...ACTOR, mode: 'patch', source: 'ai' })

        expect(cms.update).toHaveBeenCalledTimes(2)
    })

    it('TC-AICP-325: a new product has nothing to check', async () => {
        cms.create.mockResolvedValueOnce({ id: 43, name: 'New' })
        await saveProduct({ name: 'New product' }, undefined, { ...ACTOR, expectedUpdatedAt: LOADED })
        expect(cms.create).toHaveBeenCalledTimes(1)
    })

    it('TC-AICP-325: two saves from one form: the second sends the version the first returned', async () => {
        const first = await saveProduct({ name: 'One' }, 42, { ...ACTOR, expectedUpdatedAt: LOADED })
        const second = await saveProduct({ name: 'Two' }, 42, { ...ACTOR, expectedUpdatedAt: first.updatedAt })
        expect(second.name).toBe('Two')
        // the first version is stale now
        await expect(saveProduct({ name: 'Three' }, 42, { ...ACTOR, expectedUpdatedAt: first.updatedAt })).rejects.toBeInstanceOf(VersionConflictError)
    })

    it('TC-AICP-325: saveProductAction answers the conflict as a typed result; a fresh save answers the doc', async () => {
        hold(NEWER)
        expect(await saveProductAction({ name: 'My name' }, 42, LOADED)).toEqual({ ok: false, code: 'VERSION_CONFLICT', current: NEWER })
        expect(cms.update).not.toHaveBeenCalled()

        const saved = await saveProductAction({ name: 'My name' }, 42, NEWER)
        expect(saved).toMatchObject({ id: 42, name: 'My name' })
        expect(saved.updatedAt).toBeTruthy()
        // without a version: as before
        hold('2026-10-22T05:00:00.000Z')
        expect(await saveProductAction({ name: 'Again' }, 42)).toMatchObject({ name: 'Again' })
    })
})

describe('updateProductField with the row version [TC-AICP-326]', () => {
    it('TC-AICP-326: the row version writes the status; a stale one is refused and nothing is written', async () => {
        await updateProductField(42, { status: 'archived' }, ACTOR, LOADED)
        expect(cms.update).toHaveBeenCalledTimes(1)

        cms.update.mockClear()
        const err = await updateProductField(42, { status: 'active' }, ACTOR, LOADED).catch((e) => e)
        expect(err).toBeInstanceOf(VersionConflictError)
        expect(err.current).toBe(h.stored.updatedAt)
        expect(cms.update).not.toHaveBeenCalled()
    })

    it('TC-AICP-326: no version = old behaviour (the copilot applier); trash is guarded the same way', async () => {
        hold(NEWER)
        await updateProductField(42, { status: 'archived' }, ACTOR)
        expect(cms.update).toHaveBeenCalledTimes(1)

        cms.update.mockClear()
        await expect(updateProductField(42, { deletedAt: '2026-10-22T03:00:00.000Z' }, ACTOR, LOADED)).rejects.toBeInstanceOf(VersionConflictError)
        expect(cms.update).not.toHaveBeenCalled()
    })

    it('TC-AICP-326: updateProductFieldAction answers the typed conflict, or the doc with its new updatedAt', async () => {
        hold(NEWER)
        expect(await updateProductFieldAction(42, { status: 'archived' }, LOADED)).toEqual({ ok: false, code: 'VERSION_CONFLICT', current: NEWER })
        const saved = await updateProductFieldAction(42, { status: 'archived' }, NEWER)
        expect(saved).toMatchObject({ id: 42, status: 'archived' })
        expect(saved.updatedAt).not.toBe(NEWER)
    })
})

describe('getProductAction version [TC-AICP-338]', () => {
    it('TC-AICP-338: after clearing aiReviewPending the returned updatedAt is the cleared write\'s, so the first save is not refused', async () => {
        h.stored.aiReviewPending = true

        const product = await getProductAction(42)

        expect(cms.update).toHaveBeenCalledTimes(1)
        expect(product.aiReviewPending).toBe(false)
        expect(product.updatedAt).toBe(h.stored.updatedAt)
        expect(product.updatedAt).not.toBe(LOADED)
        // saving with exactly what the form got goes through
        await expect(saveProduct({ name: 'Scarf 5' }, 42, { ...ACTOR, expectedUpdatedAt: product.updatedAt })).resolves.toBeTruthy()
    })
})
