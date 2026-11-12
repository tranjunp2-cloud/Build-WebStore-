// @vitest-environment node
/**
 * TC-AIREL-184/185 — lib/products/save-product: the validated create / update / status / trash logic takes an
 * explicit { user, tenantId } (no cookies), so the dashboard actions and the AI copilot's approval step share it.
 * Real: save-product, product-sku-conflicts, publish-guard. Faked: Payload, the plan gate, the placeholder photo.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFind, mockCreate, mockUpdate, mockFindByID, mockExecute, mockCarton } = vi.hoisted(() => ({
    mockFind: vi.fn(),
    mockCreate: vi.fn(),
    mockUpdate: vi.fn(),
    mockFindByID: vi.fn(),
    mockExecute: vi.fn(),
    mockCarton: vi.fn(),
}))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ find: mockFind, create: mockCreate, update: mockUpdate, findByID: mockFindByID, db: { drizzle: { execute: mockExecute } } })) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(async () => ({ id: 's1', plan: 'PRO', status: 'active' })),
    canUse: vi.fn(async () => true),
}))
vi.mock('@/lib/media/carton-placeholder', () => ({ findOrCreateCartonMedia: mockCarton }))

import { deleteProduct, saveProduct, updateProductField } from '@/lib/products/save-product'

const USER = { id: 'u1', email: 'owner@shop.my' } as never
const ACTOR = { user: USER, tenantId: 68 }

beforeEach(() => {
    vi.clearAllMocks()
    mockExecute.mockResolvedValue({ rows: [] })
    mockCreate.mockResolvedValue({ id: 42, name: 'Scarf' })
    mockUpdate.mockResolvedValue({ id: 42, name: 'Scarf' })
    mockFindByID.mockResolvedValue({ id: 42, name: 'Scarf', status: 'draft', price: 10, sku: 'S', inventory: 1, weight: 0.2 })
    mockCarton.mockResolvedValue({ id: 5 })
})

describe('saveProduct with an explicit actor [TC-AIREL-184]', () => {
    it('creates in the given tenant with the given user, and attaches the tenant\'s placeholder photo when it has none', async () => {
        await saveProduct({ name: 'Scarf', price: 10 }, undefined, ACTOR)

        expect(mockCarton).toHaveBeenCalledWith(expect.anything(), 68, USER)
        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'products',
                user: USER,
                overrideAccess: false,
                disableTransaction: true,
                data: expect.objectContaining({ name: 'Scarf', tenant: 68, images: [{ image: 5, alt: 'Scarf' }] }),
            }),
        )
    })

    it('uses the caller\'s own placeholder resolver when given one (the dashboard action)', async () => {
        const resolver = vi.fn(async () => 99)

        await saveProduct({ name: 'Scarf' }, undefined, { ...ACTOR, placeholderImageId: resolver })

        expect(resolver).toHaveBeenCalledTimes(1)
        expect(mockCarton).not.toHaveBeenCalled()
        expect(mockCreate.mock.calls[0]?.[0].data.images).toEqual([{ image: 99, alt: 'Scarf' }])
    })

    it('a hand edit clears aiReviewPending; a copilot patch does not and attaches no photo', async () => {
        await saveProduct({ name: 'Scarf', price: 12 }, 42, ACTOR)
        await saveProduct({ name: 'Scarf', price: 12 }, 42, { ...ACTOR, mode: 'patch', source: 'ai' })

        const [hand, patch] = mockUpdate.mock.calls.map(([args]) => args.data as Record<string, unknown>)
        expect(hand).toMatchObject({ aiReviewPending: false, images: [{ image: 5, alt: 'Scarf' }] })
        expect(patch).toEqual({ name: 'Scarf', price: 12 })
    })

    it('keeps the publish gate on the merged product and the SKU conflict check', async () => {
        mockFindByID.mockResolvedValueOnce({ id: 42, name: 'Scarf', price: 10, sku: '', inventory: 1, weight: 0.2 })
        await expect(saveProduct({ name: 'Scarf', status: 'active' }, 42, ACTOR)).rejects.toThrow(/PUBLISH_BLOCKED/)
        expect(mockUpdate).not.toHaveBeenCalled()

        mockExecute.mockResolvedValueOnce({ rows: [{ sku: 'bat-1' }] })
        await expect(saveProduct({ name: 'Scarf', sku: 'BAT-1' }, undefined, ACTOR)).rejects.toThrow(/SKU_ALREADY_IN_USE/)
        expect(mockCreate).not.toHaveBeenCalled()
    })

    it('rejects a product with no user, and validates the name', async () => {
        await expect(saveProduct({ name: 'Scarf' }, undefined, { user: null as never, tenantId: 68 })).rejects.toThrow('Unauthorized')
        await expect(saveProduct({ name: 'ab' }, undefined, ACTOR)).rejects.toThrow()
    })
})

describe('saveProduct SKU length limits [TC-F08-04-128, TC-F08-04-129]', () => {
    it('TC-F08-04-128: rejects a base SKU over 50 characters with a clear message and writes nothing; accepts exactly 50', async () => {
        await expect(saveProduct({ name: 'Scarf', sku: 'A'.repeat(51) }, undefined, ACTOR))
            .rejects.toThrow(/Base SKU must be 50 characters or fewer/)
        expect(mockCreate).not.toHaveBeenCalled()
        expect(mockUpdate).not.toHaveBeenCalled()

        await saveProduct({ name: 'Scarf', sku: 'A'.repeat(50) }, undefined, ACTOR)
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sku: 'A'.repeat(50) }) }))
    })

    it('TC-F08-04-129: variant SKU keeps the 100-character limit (100 ok, 101 rejected)', async () => {
        await saveProduct({ name: 'Scarf', variants: [{ name: 'Red', sku: 'V'.repeat(100) }] }, undefined, ACTOR)
        expect(mockCreate).toHaveBeenCalledTimes(1)

        await expect(saveProduct({ name: 'Scarf', variants: [{ name: 'Red', sku: 'V'.repeat(101) }] }, undefined, ACTOR))
            .rejects.toThrow(/Variant SKU must be 100 characters or fewer/)
        expect(mockCreate).toHaveBeenCalledTimes(1)
    })
})

describe('updateProductField and deleteProduct with an explicit actor [TC-AIREL-185]', () => {
    it('sets a status, or deletedAt, or both at once (the undo of a status change)', async () => {
        await updateProductField(42, { status: 'archived' }, ACTOR)
        await updateProductField(42, { deletedAt: '2026-10-21T10:00:00.000Z' }, ACTOR)
        await updateProductField(42, { status: 'draft', deletedAt: null }, ACTOR)

        const sent = mockUpdate.mock.calls.map(([args]) => args.data as Record<string, unknown>)
        expect(sent[0]).toMatchObject({ status: 'archived' })
        expect(sent[1]).toMatchObject({ deletedAt: '2026-10-21T10:00:00.000Z' })
        expect(sent[1]).not.toHaveProperty('status')
        expect(sent[2]).toMatchObject({ status: 'draft', deletedAt: null })
    })

    it('checks the product is the actor\'s (access-checked read) and the plan before writing', async () => {
        mockFindByID.mockResolvedValueOnce(null)

        await expect(updateProductField(42, { status: 'draft' }, ACTOR)).rejects.toThrow('Product not found or access denied')
        expect(mockFindByID).toHaveBeenCalledWith(expect.objectContaining({ id: 42, user: USER, overrideAccess: false }))
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('moves a product to the trash with the caller\'s own access', async () => {
        await deleteProduct(42, { user: USER })

        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 42, user: USER, overrideAccess: false, data: { deletedAt: expect.any(String) } }))
    })
})
