import { describe, it, expect, vi } from 'vitest'
import { POST } from '@/app/api/orders/create/route'
import { NextRequest } from 'next/server'

// Bypass withAuth HOC — inject mock user trực tiếp
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn().mockImplementation((handler: any) => {
        return async (req: any, ctx: any) => {
            const user = { id: 'user-1', email: 'admin@example.com' }
            return handler(user, req, ctx)
        }
    }),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'user-1', email: 'admin@example.com' }),
}))

// Mock Stripe checkout session creation
vi.mock('@/lib/payment/stripe', () => ({
    createStripeCheckoutSession: vi.fn().mockResolvedValue({
        sessionId: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
    }),
}))

// Mock thư viện PayloadCMS để không gọi DB thật
vi.mock('payload', () => {
    // Tạo giả lập db Payload CMS
    const mockPayload = {
        findByID: vi.fn().mockImplementation(async ({ collection, id }) => {
            if (collection === 'sites' && id === 'site-123') {
                return { id: 'site-123', tenant: 'tenant-456' }
            }
            if (collection === 'tenants' && id === 'tenant-456') {
                return {
                    id: 'tenant-456',
                    slug: 'test-store',
                    stripeAccountId: 'acct_test_merchant',
                    stripeOnboardingComplete: true,
                }
            }
            if (collection === 'products' && id === 'prod-1') {
                return { id: 'prod-1', name: 'Mock Product', price: 100, inventory: 10, currency: 'MYR' }
            }
            return null
        }),
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockImplementation(async ({ collection, data }) => {
            if (collection === 'orders') {
                return { ...data, id: 'order-999' }
            }
            return data
        })
    }
    
    return {
        getPayload: vi.fn().mockResolvedValue(mockPayload)
    }
})

describe('POST /api/orders/create', () => {
    
    it('returns 400 validation error when required fields are missing', async () => {
        // Thiếu customer email và items
        const req = new NextRequest('http://localhost:3000/api/orders/create', {
            method: 'POST',
            body: JSON.stringify({ siteId: 'site-123' })
        })

        const response = await POST(req)
        const json = await response.json()

        expect(response.status).toBe(400)
        expect(json.success).toBe(false)
        expect(json.error.code).toBe('VALIDATION_ERROR')
    })
    
    it('returns 404 if siteId does not exist in DB', async () => {
        const req = new NextRequest('http://localhost:3000/api/orders/create', {
            method: 'POST',
            body: JSON.stringify({
                siteId: 'invalid-site',
                items: [{ productId: 'prod-1', quantity: 1 }],
                customer: { name: 'John Doe', email: 'john@example.com' },
                paymentMethod: 'cod',
            })
        })

        const response = await POST(req)
        const json = await response.json()

        expect(response.status).toBe(404)
        expect(json.success).toBe(false)
        expect(json.error.message).toBe('Site not found')
    })

    it('returns 200 with orderId and total calculated correctly (Happy Path)', async () => {
        const req = new NextRequest('http://localhost:3000/api/orders/create', {
            method: 'POST',
            body: JSON.stringify({
                siteId: 'site-123',
                items: [{ productId: 'prod-1', quantity: 2 }],
                customer: { name: 'John Doe', email: 'john@example.com' },
                paymentMethod: 'cod',
            })
        })

        const response = await POST(req)
        const json = await response.json()

        // 2 items * 100 price = 200 subtotal
        // Tax 6% = 12
        // Total = 212
        
        expect(response.status).toBe(200)
        expect(json.success).toBe(true)
        expect(json.data.orderId).toBe('order-999')
        expect(json.data.total).toBe(212)
        expect(json.data.currency).toBe('MYR')
        expect(json.data.status).toBe('pending')
        expect(json.data.checkoutUrl).toBe('https://checkout.stripe.com/pay/cs_test_123')
    })
})
