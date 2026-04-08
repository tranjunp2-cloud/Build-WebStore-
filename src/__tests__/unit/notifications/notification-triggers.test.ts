import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── TC-F16.14: Notification triggers for Orders, Products, Blogs ───────
// Tests verify hook logic by importing collection configs and calling hooks directly.

// Mock the notify-tenant-owners module
const mockNotifyTenantOwners = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/notifications/notify-tenant-owners', () => ({
    notifyTenantOwners: (...args: any[]) => mockNotifyTenantOwners(...args),
}))

// Must import AFTER vi.mock
import { Orders } from '@/collections/Orders'
import { Products, lowStockHook } from '@/collections/Products'
import { Blogs } from '@/collections/Blogs'

const mockPayload = { find: vi.fn(), create: vi.fn() } as any

function makeReq(overrides = {}) {
    return { payload: mockPayload, user: { id: 1 }, ...overrides } as any
}

describe('[TC-F16.14] ORDER_NEW trigger — Orders.afterChange', () => {
    const hook = Orders.hooks!.afterChange![0]

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('fires notification on order create (COD/QR Banking)', async () => {
        const doc = {
            id: 1, tenant: 5, orderNumber: 'ORD-001',
            currency: 'MYR', total: 150, customerName: 'Alice',
        }

        const result = await hook({ doc, operation: 'create', req: makeReq(), previousDoc: undefined } as any)

        expect(result).toBe(doc)
        // fire-and-forget — need to flush promises
        await vi.waitFor(() => expect(mockNotifyTenantOwners).toHaveBeenCalled())
        expect(mockNotifyTenantOwners).toHaveBeenCalledWith(mockPayload, 5, {
            type: 'ORDER_NEW',
            title: 'New Order #ORD-001 - MYR 150.00',
            message: 'Order placed by Alice',
            actionUrl: '/orders',
        })
    })

    it('skips notification on order update', async () => {
        const doc = { id: 1, tenant: 5, orderNumber: 'ORD-001' }

        await hook({ doc, operation: 'update', req: makeReq(), previousDoc: doc } as any)
        await new Promise(r => setTimeout(r, 50))

        expect(mockNotifyTenantOwners).not.toHaveBeenCalled()
    })

    it('skips notification for Stripe orders (stripeSessionId present)', async () => {
        const doc = {
            id: 1, tenant: 5, orderNumber: 'ORD-002',
            stripeSessionId: 'cs_test_abc', currency: 'MYR', total: 200,
            customerName: 'Bob',
        }

        await hook({ doc, operation: 'create', req: makeReq(), previousDoc: undefined } as any)
        await new Promise(r => setTimeout(r, 50))

        expect(mockNotifyTenantOwners).not.toHaveBeenCalled()
    })

    it('resolves tenant from object reference', async () => {
        const doc = {
            id: 1, tenant: { id: 7 }, orderNumber: 'ORD-003',
            currency: 'USD', total: 50, customerName: 'Carol',
        }

        await hook({ doc, operation: 'create', req: makeReq(), previousDoc: undefined } as any)
        await vi.waitFor(() => expect(mockNotifyTenantOwners).toHaveBeenCalled())

        expect(mockNotifyTenantOwners).toHaveBeenCalledWith(
            mockPayload, 7, expect.objectContaining({ type: 'ORDER_NEW' }),
        )
    })

    it('handles null total gracefully', async () => {
        const doc = {
            id: 1, tenant: 5, orderNumber: 'ORD-004',
            currency: 'MYR', total: undefined, customerName: 'Dave',
        }

        await hook({ doc, operation: 'create', req: makeReq(), previousDoc: undefined } as any)
        await vi.waitFor(() => expect(mockNotifyTenantOwners).toHaveBeenCalled())

        expect(mockNotifyTenantOwners).toHaveBeenCalledWith(
            mockPayload, 5, expect.objectContaining({
                title: 'New Order #ORD-004 - MYR 0.00',
            }),
        )
    })
})

describe('[TC-F16.14] PRODUCT_LOW_STOCK trigger — Products.afterChange', () => {
    const hook = lowStockHook

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('fires notification when inventory crosses threshold downward (15 → 5)', async () => {
        const doc = { id: 1, tenant: 3, name: 'Widget', inventory: 5 }
        const previousDoc = { id: 1, tenant: 3, name: 'Widget', inventory: 15 }

        await hook({ doc, previousDoc, operation: 'update', req: makeReq() } as any)
        await vi.waitFor(() => expect(mockNotifyTenantOwners).toHaveBeenCalled())

        expect(mockNotifyTenantOwners).toHaveBeenCalledWith(mockPayload, 3, {
            type: 'PRODUCT_LOW_STOCK',
            title: 'Low Stock Alert',
            message: 'Widget is running low (5 units left)',
            actionUrl: '/products',
        })
    })

    it('does NOT fire when already below threshold (9 → 8) — anti-spam', async () => {
        const doc = { id: 1, tenant: 3, name: 'Widget', inventory: 8 }
        const previousDoc = { id: 1, tenant: 3, name: 'Widget', inventory: 9 }

        await hook({ doc, previousDoc, operation: 'update', req: makeReq() } as any)
        await new Promise(r => setTimeout(r, 50))

        expect(mockNotifyTenantOwners).not.toHaveBeenCalled()
    })

    it('does NOT fire when inventory goes UP across threshold (5 → 15)', async () => {
        const doc = { id: 1, tenant: 3, name: 'Widget', inventory: 15 }
        const previousDoc = { id: 1, tenant: 3, name: 'Widget', inventory: 5 }

        await hook({ doc, previousDoc, operation: 'update', req: makeReq() } as any)
        await new Promise(r => setTimeout(r, 50))

        expect(mockNotifyTenantOwners).not.toHaveBeenCalled()
    })

    it('fires again after restock then drop (5 → 20 → 8)', async () => {
        const doc = { id: 1, tenant: 3, name: 'Widget', inventory: 8 }
        const previousDoc = { id: 1, tenant: 3, name: 'Widget', inventory: 20 }

        await hook({ doc, previousDoc, operation: 'update', req: makeReq() } as any)
        await vi.waitFor(() => expect(mockNotifyTenantOwners).toHaveBeenCalled())
    })

    it('does NOT fire on create operation', async () => {
        const doc = { id: 1, tenant: 3, name: 'Widget', inventory: 5 }

        const result = await hook({ doc, previousDoc: undefined, operation: 'create', req: makeReq() } as any)
        await new Promise(r => setTimeout(r, 50))

        expect(result).toBe(doc)
        expect(mockNotifyTenantOwners).not.toHaveBeenCalled()
    })

    it('fires when inventory drops exactly to 9 (boundary)', async () => {
        const doc = { id: 1, tenant: 3, name: 'Widget', inventory: 9 }
        const previousDoc = { id: 1, tenant: 3, name: 'Widget', inventory: 10 }

        await hook({ doc, previousDoc, operation: 'update', req: makeReq() } as any)
        await vi.waitFor(() => expect(mockNotifyTenantOwners).toHaveBeenCalled())
    })

    it('does NOT fire when staying at exactly 10', async () => {
        const doc = { id: 1, tenant: 3, name: 'Widget', inventory: 10 }
        const previousDoc = { id: 1, tenant: 3, name: 'Widget', inventory: 10 }

        await hook({ doc, previousDoc, operation: 'update', req: makeReq() } as any)
        await new Promise(r => setTimeout(r, 50))

        expect(mockNotifyTenantOwners).not.toHaveBeenCalled()
    })
})

describe('[TC-F16.14] BLOG_PUBLISHED trigger — Blogs.afterChange', () => {
    const hook = Blogs.hooks!.afterChange![0]

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('fires notification when blog transitions draft → published', async () => {
        const doc = { id: 1, tenant: 4, title: 'My Blog Post', status: 'published' }
        const previousDoc = { id: 1, tenant: 4, title: 'My Blog Post', status: 'draft' }

        await hook({ doc, previousDoc, operation: 'update', req: makeReq() } as any)
        await vi.waitFor(() => expect(mockNotifyTenantOwners).toHaveBeenCalled())

        expect(mockNotifyTenantOwners).toHaveBeenCalledWith(mockPayload, 4, {
            type: 'BLOG_PUBLISHED',
            title: 'Blog Published',
            message: 'My Blog Post has been published',
            actionUrl: '/blogs',
        })
    })

    it('does NOT fire when blog is updated while already published', async () => {
        const doc = { id: 1, tenant: 4, title: 'Updated Title', status: 'published' }
        const previousDoc = { id: 1, tenant: 4, title: 'My Blog Post', status: 'published' }

        await hook({ doc, previousDoc, operation: 'update', req: makeReq() } as any)
        await new Promise(r => setTimeout(r, 50))

        expect(mockNotifyTenantOwners).not.toHaveBeenCalled()
    })

    it('fires when blog is created directly as published', async () => {
        const doc = { id: 1, tenant: 4, title: 'New Blog', status: 'published' }

        await hook({ doc, previousDoc: undefined, operation: 'create', req: makeReq() } as any)
        await vi.waitFor(() => expect(mockNotifyTenantOwners).toHaveBeenCalled())
    })

    it('does NOT fire when blog is created as draft', async () => {
        const doc = { id: 1, tenant: 4, title: 'Draft Blog', status: 'draft' }

        await hook({ doc, previousDoc: undefined, operation: 'create', req: makeReq() } as any)
        await new Promise(r => setTimeout(r, 50))

        expect(mockNotifyTenantOwners).not.toHaveBeenCalled()
    })

    it('fires when blog is unpublished then re-published', async () => {
        const doc = { id: 1, tenant: 4, title: 'Re-Published', status: 'published' }
        const previousDoc = { id: 1, tenant: 4, title: 'Re-Published', status: 'draft' }

        await hook({ doc, previousDoc, operation: 'update', req: makeReq() } as any)
        await vi.waitFor(() => expect(mockNotifyTenantOwners).toHaveBeenCalled())
    })
})
