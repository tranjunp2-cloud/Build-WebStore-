/**
 * TC-PERF-177 — leaving the confirm page ("Track order") drops `ct_<id>` and, only for a browser that held a
 * valid confirm cookie, sets the short-lived `ov_<id>` view cookie the tracking page accepts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockFindByID = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ findByID: mockFindByID })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { DELETE } from '@/app/api/orders/[id]/clear-confirm-token/route'
import { generateConfirmToken } from '@/lib/orders/upload-token'
import { verifyOrderViewToken } from '@/lib/orders/order-view-token'

const ORDER = { id: 78, orderNumber: 'ORD-ABC123' }

function request(cookie?: string) {
    return new NextRequest('https://shop.example.com/api/orders/78/clear-confirm-token', {
        method: 'DELETE',
        headers: cookie ? { cookie } : {},
    })
}
const ctx = { params: Promise.resolve({ id: '78' }) }

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('PAYLOAD_SECRET', 'test-payload-secret')
    mockFindByID.mockResolvedValue(ORDER)
})
afterEach(() => {
    vi.unstubAllEnvs()
})

describe('DELETE /api/orders/[id]/clear-confirm-token [TC-PERF-177]', () => {
    it('swaps a valid confirm cookie for a view cookie bound to the order', async () => {
        // Arrange
        const ct = generateConfirmToken(ORDER.id, ORDER.orderNumber)

        // Act
        const res = await DELETE(request(`ct_78=${ct}`), { params: Promise.resolve({ id: '78' }) })

        // Assert
        expect(res.cookies.get('ct_78')?.value).toBe('')
        const view = res.cookies.get('ov_78')
        expect(view?.httpOnly).toBe(true)
        expect(verifyOrderViewToken(view?.value, ORDER.id, ORDER.orderNumber)).toBe(true)
    })

    it('grants nothing without a valid confirm cookie', async () => {
        // Act
        const noCookie = await DELETE(request(), ctx)
        const forged = await DELETE(request(`ct_78=${'a'.repeat(64)}`), { params: Promise.resolve({ id: '78' }) })

        // Assert
        expect(noCookie.cookies.get('ov_78')).toBeUndefined()
        expect(forged.cookies.get('ov_78')).toBeUndefined()
        expect(forged.cookies.get('ct_78')?.value).toBe('')
    })
})
