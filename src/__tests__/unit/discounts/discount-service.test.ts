/**
 * TC-AICP-150 — the Discounts write core shared by the dashboard routes and the copilot
 * (lib/discounts/discount-service): the tenant comes from the caller, usageCount / tenant are never
 * writable, a code is unique per tenant, and the copilot's strict mode keeps a discount (and the site it
 * names) inside the drafted workspace. Real: discount-service. Faked: Payload.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))

import { getPayload } from 'payload'
import {
    createDiscountAs,
    deleteDiscountAs,
    DiscountServiceError,
    isDuplicateDiscountCode,
    setDiscountStatusAs,
    updateDiscountAs,
} from '@/lib/discounts/discount-service'

const user = { id: 3, tenants: [{ tenant: 42 }] } as never
const cms = { create: vi.fn(), update: vi.fn(), findByID: vi.fn(), delete: vi.fn() }
const body = { code: 'RAYA10', type: 'percentage' as const, value: 10 }

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getPayload).mockResolvedValue(cms as never)
})

describe('createDiscountAs [TC-AICP-150]', () => {
    it('forces the caller\'s tenant as an integer, starts usageCount at 0 and writes with overrideAccess', async () => {
        cms.create.mockResolvedValueOnce({ id: 9 })

        await createDiscountAs({ user, tenantId: '42' }, { ...body, site: '5' })

        expect(cms.create).toHaveBeenCalledWith({
            collection: 'discounts',
            data: { ...body, tenant: 42, site: 5, status: 'active', usageCount: 0 },
            overrideAccess: true,
        })
    })

    it('keeps a usage count only when an undo brings a deleted code back', async () => {
        cms.create.mockResolvedValueOnce({ id: 9 })

        await createDiscountAs({ user, tenantId: 42 }, { ...body, status: 'inactive', usageCount: 7 })

        expect(cms.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ usageCount: 7, status: 'inactive', site: null }) }))
    })

    it('says DUPLICATE_CODE for the unique index (message or Postgres 23505)', async () => {
        cms.create.mockRejectedValueOnce(new Error('Value must be unique'))
        cms.create.mockRejectedValueOnce(Object.assign(new Error('boom'), { code: '23505' }))

        await expect(createDiscountAs({ user, tenantId: '42' }, body)).rejects.toMatchObject({ code: 'DUPLICATE_CODE' })
        await expect(createDiscountAs({ user, tenantId: '42' }, body)).rejects.toBeInstanceOf(DiscountServiceError)
        expect(isDuplicateDiscountCode(new Error('connection reset'))).toBe(false)
    })

    it('with strictTenant, refuses a site that is not in the workspace', async () => {
        cms.findByID.mockResolvedValueOnce({ id: 5, tenant: { id: 77 } }).mockResolvedValueOnce({ id: 6, tenant: 42 })

        await expect(createDiscountAs({ user, tenantId: '42', strictTenant: true }, { ...body, site: 5 })).rejects.toMatchObject({ code: 'SITE_NOT_FOUND' })
        expect(cms.create).not.toHaveBeenCalled()
        cms.create.mockResolvedValueOnce({ id: 9 })
        await expect(createDiscountAs({ user, tenantId: '42', strictTenant: true }, { ...body, site: 6 })).resolves.toEqual({ id: 9 })
    })
})

describe('updateDiscountAs / setDiscountStatusAs [TC-AICP-150]', () => {
    it('strips usageCount and tenant, and writes as the user with access checks on', async () => {
        cms.findByID.mockResolvedValueOnce({ id: 1, tenant: 42 })
        cms.update.mockResolvedValueOnce({ id: 1 })

        await updateDiscountAs({ user, tenantId: '42' }, '1', { value: 20, usageCount: 0, tenant: 'other' } as never)

        expect(cms.update).toHaveBeenCalledWith({ collection: 'discounts', id: '1', data: { value: 20 }, user, overrideAccess: false })
    })

    it('says NOT_FOUND when the discount is not visible; strictTenant also when it belongs to another tenant', async () => {
        cms.findByID.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 1, tenant: { id: 77 } }).mockResolvedValueOnce({ id: 1, tenant: { id: 77 } })

        await expect(updateDiscountAs({ user, tenantId: '42' }, 1, { value: 1 })).rejects.toMatchObject({ code: 'NOT_FOUND' })
        await expect(updateDiscountAs({ user, tenantId: '42', strictTenant: true }, 1, { value: 1 })).rejects.toMatchObject({ code: 'NOT_FOUND' })
        expect(cms.update).not.toHaveBeenCalled()
        // the dashboard route keeps Payload's own access: a user who can see it may change it
        cms.update.mockResolvedValueOnce({ id: 1 })
        await expect(updateDiscountAs({ user, tenantId: '42' }, 1, { value: 1 })).resolves.toEqual({ id: 1 })
    })

    it('switches a discount on or off through the same write', async () => {
        cms.findByID.mockResolvedValueOnce({ id: 1, tenant: 42 })
        cms.update.mockResolvedValueOnce({ id: 1 })

        await setDiscountStatusAs({ user, tenantId: 42, strictTenant: true }, 1, 'inactive')

        expect(cms.update).toHaveBeenCalledWith(expect.objectContaining({ id: 1, data: { status: 'inactive' } }))
    })

    it('says DUPLICATE_CODE when a rename hits another code', async () => {
        cms.findByID.mockResolvedValueOnce({ id: 1, tenant: 42 })
        cms.update.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'))

        await expect(updateDiscountAs({ user, tenantId: '42' }, 1, { code: 'TAKEN' })).rejects.toMatchObject({ code: 'DUPLICATE_CODE' })
    })
})

describe('deleteDiscountAs [TC-AICP-150]', () => {
    it('checks the discount first, then deletes as the user with access checks on', async () => {
        cms.findByID.mockResolvedValueOnce({ id: 1, tenant: 42 })

        await deleteDiscountAs({ user, tenantId: '42', strictTenant: true }, 1)

        expect(cms.delete).toHaveBeenCalledWith({ collection: 'discounts', id: 1, user, overrideAccess: false })
    })

    it('deletes nothing it cannot see or that is another tenant\'s', async () => {
        cms.findByID.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 1, tenant: 77 })

        await expect(deleteDiscountAs({ user, tenantId: '42' }, 1)).rejects.toMatchObject({ code: 'NOT_FOUND' })
        await expect(deleteDiscountAs({ user, tenantId: '42', strictTenant: true }, 1)).rejects.toMatchObject({ code: 'NOT_FOUND' })
        expect(cms.delete).not.toHaveBeenCalled()
    })
})
