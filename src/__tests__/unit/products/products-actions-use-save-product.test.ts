// @vitest-environment node
/**
 * TC-AIREL-186 — the dashboard's product server actions are thin: they read the session and call
 * lib/products/save-product with { user, tenantId } (the save logic itself is covered by save-product-action.test.ts
 * and save-product-lib.test.ts).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    saveProduct: vi.fn(async () => ({ id: 1 })),
    saveAiProduct: vi.fn(async () => ({ ok: true })),
    updateProductField: vi.fn(async () => ({ id: 1 })),
    deleteProduct: vi.fn(async () => ({ id: 1 })),
    getCurrentUser: vi.fn(),
}))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser, tenantIdForQuery: vi.fn(() => 68) }))
vi.mock('@/lib/products/save-product', () => ({ saveProduct: mocks.saveProduct, updateProductField: mocks.updateProductField, deleteProduct: mocks.deleteProduct }))
vi.mock('@/lib/products/save-ai-product', () => ({ saveAiProduct: mocks.saveAiProduct }))

import { deleteProductAction, saveAiProductAction, saveProductAction, updateProductFieldAction } from '@/app/(dashboard)/products/actions'

const USER = { id: 'u1' }

beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue(USER)
})

describe('products server actions delegate to save-product [TC-AIREL-186]', () => {
    it('saveProductAction passes the session user, tenant and the dashboard placeholder resolver', async () => {
        await saveProductAction({ name: 'Scarf' }, 5)

        expect(mocks.saveProduct).toHaveBeenCalledWith({ name: 'Scarf' }, 5, expect.objectContaining({ user: USER, tenantId: 68, placeholderImageId: expect.any(Function) }))
    })

    it('saveAiProductAction hands over a lazy actor so an invalid request never needs the session', async () => {
        await saveAiProductAction({ name: 'x' }, { a: 1 })

        expect(mocks.saveAiProduct).toHaveBeenCalledWith({ name: 'x' }, { a: 1 }, expect.any(Function), { placeholderImageId: expect.any(Function) })
        expect(mocks.getCurrentUser).not.toHaveBeenCalled()
        const resolve = mocks.saveAiProduct.mock.calls[0]?.[2] as unknown as () => Promise<unknown>
        expect(await resolve()).toEqual({ user: USER, tenantId: 68 })
    })

    it('updateProductFieldAction and deleteProductAction pass the same actor', async () => {
        await updateProductFieldAction(7, { status: 'active' })
        await deleteProductAction(7)

        expect(mocks.updateProductField).toHaveBeenCalledWith(7, { status: 'active' }, { user: USER, tenantId: 68 }, undefined)
        expect(mocks.deleteProduct).toHaveBeenCalledWith(7, { user: USER, tenantId: 68 })
    })

    it('throws Unauthorized without a session, before any write', async () => {
        mocks.getCurrentUser.mockResolvedValue(null)

        await expect(saveProductAction({ name: 'Scarf' })).rejects.toThrow('Unauthorized')
        await expect(updateProductFieldAction(7, { status: 'active' })).rejects.toThrow('Unauthorized')
        await expect(deleteProductAction(7)).rejects.toThrow('Unauthorized')
        expect(mocks.saveProduct).not.toHaveBeenCalled()
        expect(mocks.updateProductField).not.toHaveBeenCalled()
        expect(mocks.deleteProduct).not.toHaveBeenCalled()
    })
})
