/**
 * TC-F09.285 — SSO renew reopens an expired store at once (#2179 item 6).
 * Renew writes the latest `main` subscription (the row the storefront gate reads) and busts its cache after the write.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFind = vi.fn()
const mockUpdate = vi.fn()
const mockRevalidateTag = vi.hoisted(() => vi.fn())

vi.mock('payload', () => ({ getPayload: vi.fn(() => Promise.resolve({ find: mockFind, update: mockUpdate })) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/cache', () => ({ revalidateTag: mockRevalidateTag }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }))

import { PUT as renewHandler } from '@/app/api/v1/sso/renew/route'
import { getCurrentUser } from '@/lib/auth'

const superAdmin = { id: 1, roles: ['super-admin'] }
const owner = { id: 2, tenants: [{ tenant: { id: 10 }, role: 'owner' }] }
const request = (body: object) => ({
    headers: { get: (h: string) => (h === 'authorization' ? 'Bearer valid-token' : null) },
    json: () => Promise.resolve(body),
}) as any

describe('PUT /api/v1/sso/renew [TC-F09.285]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentUser).mockResolvedValue(superAdmin as any)
    })

    it('renews the latest main subscription, then busts its storefront cache', async () => {
        // Arrange
        mockFind
            .mockResolvedValueOnce({ docs: [owner] })
            .mockResolvedValueOnce({ docs: [{ id: 55 }] })
        mockUpdate.mockResolvedValue({})

        // Act
        const res = await renewHandler(request({ email: 'owner@example.com', expired_at: '2027-06-01 00:00:00' }))

        // Assert
        expect(res.status).toBe(200)
        expect(mockFind).toHaveBeenLastCalledWith(expect.objectContaining({ collection: 'plan-subscriptions', sort: '-createdAt' }))
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'plan-subscriptions',
            id: 55,
            data: { endsAt: '2027-06-01T23:59:59.000Z', canceledAt: null, status: 'active' },
        }))
        expect(mockRevalidateTag).toHaveBeenCalledWith('plan-subscription:10', { expire: 0 })
        expect(mockUpdate.mock.invocationCallOrder[0]).toBeLessThan(mockRevalidateTag.mock.invocationCallOrder[0])
    })

    it('busts nothing when the tenant has no main subscription (404)', async () => {
        mockFind.mockResolvedValueOnce({ docs: [owner] }).mockResolvedValueOnce({ docs: [] })

        const res = await renewHandler(request({ email: 'owner@example.com', expired_at: '2027-06-01' }))

        expect(res.status).toBe(404)
        expect(mockRevalidateTag).not.toHaveBeenCalled()
    })
})
