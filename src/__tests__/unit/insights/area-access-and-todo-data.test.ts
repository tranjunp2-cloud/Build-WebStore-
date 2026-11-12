/**
 * TC-AICP-195 — who sees which numbers and tasks (the sidebar's rule: full roles see everything, a custom role
 * only the permissions it holds, Contact Leads full roles only, another workspace's membership counts for nothing)
 * and the dashboard loader that applies it: the viewer's areas reach computeShopTodos, a failure is "unavailable",
 * never a thrown page.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getPayload: vi.fn(), computeShopTodos: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
vi.mock('@/lib/insights/shop-todo', () => ({ computeShopTodos: mocks.computeShopTodos }))
vi.mock('@/lib/ai-platform/work/seo-work-item', () => ({ seoWorkItem: vi.fn(async () => null) }))

import { areasOf, canAccessArea } from '@/lib/insights/area-access'
import { loadShopWork } from '@/lib/ai-platform/work/shop-work-sources'

const member = (membership: Record<string, unknown>) => ({ roles: [], tenants: [{ tenant: 4, status: 'active', ...membership }] })

describe('canAccessArea / areasOf [TC-AICP-195]', () => {
    it.each(['owner', 'admin', 'editor', 'viewer'])('lets the %s role see every area, leads included', (role) => {
        expect(areasOf(member({ role }), 4)).toEqual({ orders: true, products: true, builder: true, settings: true, leads: true })
    })

    it('limits a custom role to the permissions it holds, and never gives it Contact Leads', () => {
        const user = member({ role: 'custom', permissions: ['orders', 'builder'] })

        expect(areasOf(user, 4)).toEqual({ orders: true, products: false, builder: true, settings: false, leads: false })
        expect(canAccessArea(member({ role: 'custom', permissions: [] }), 4, 'orders')).toBe(false)
        expect(canAccessArea(member({ role: 'custom' }), 4, 'orders')).toBe(false)
    })

    it('counts only an active membership of this very workspace', () => {
        expect(canAccessArea(member({ role: 'owner', status: 'pending' }), 4, 'orders')).toBe(false)
        expect(canAccessArea(member({ role: 'owner' }), 5, 'orders')).toBe(false)
        expect(canAccessArea(member({ role: 'owner', tenant: { id: 4 } }), '4', 'orders')).toBe(true)
        expect(canAccessArea({ roles: ['super-admin'], tenants: [] }, 4, 'orders')).toBe(false)
        expect(canAccessArea(null, 4, 'orders')).toBe(false)
        expect(canAccessArea({}, 4, 'orders')).toBe(false)
    })

    it('treats a member without a role as a viewer (the legacy default)', () => {
        expect(canAccessArea({ tenants: [{ tenant: 4, status: 'active' }] }, 4, 'products')).toBe(true)
    })
})

describe('shop issues for the viewer [TC-AICP-195]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getPayload.mockResolvedValue({ marker: 'payload' })
        mocks.computeShopTodos.mockResolvedValue([])
    })

    it('computes the issues for the viewer\'s own areas, site and language', async () => {
        const user = member({ role: 'custom', permissions: ['products'] })
        mocks.computeShopTodos.mockResolvedValue([{ id: 'low_stock', kind: 'low_stock', severity: 'medium', title: '3 produk hampir habis', detail: 'Produk aktif.', count: 3, href: '/products', prompt: 'Tunjuk senarai' }])

        const work = await loadShopWork({ user, tenantId: '4' } as never, 'ms', new Date(), { siteId: '9' })

        expect(work.items).toEqual([expect.objectContaining({ key: 'shop:low_stock', group: 'week', title: '3 produk hampir habis', area: 'Produk' })])
        expect(mocks.computeShopTodos).toHaveBeenCalledWith(
            { marker: 'payload' },
            expect.objectContaining({ tenantId: '4', siteId: '9', locale: 'ms', now: expect.any(Date), areas: { orders: false, products: true, builder: false, settings: false, leads: false } }),
        )
    })
})
