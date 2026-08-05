import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    queueSEOAutoGeneration: vi.fn(),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('payload', async () => {
    const actual = await vi.importActual<typeof import('payload')>('payload')
    return { ...actual, getPayload: vi.fn() }
})

vi.mock('@/lib/ai/seo-queue', () => ({
    queueSEOAutoGeneration: mocks.queueSEOAutoGeneration,
}))

import { NextRequest } from 'next/server'
import {
    getPayload,
    type CollectionAfterChangeHook,
    type CollectionBeforeChangeHook,
} from 'payload'
import { POST } from '@/app/api/e2e/ensure-test-user/route'
import { Products } from '@/collections/Products'
import { DEFAULT_DASHBOARD_BLOCKS } from '@/lib/dashboard-utils'

const publishGateHook = Products.hooks!.beforeChange![1] as CollectionBeforeChangeHook
const productAfterChangeHook = Products.hooks!.afterChange![0] as CollectionAfterChangeHook

describe('[TC-F08-04-110] POST /api/e2e/ensure-test-user', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.E2E_SETUP_SECRET = 'setup-secret'
        process.env.APP_ENV = 'staging'
    })

    it('[TC-F08-04-126] rejects setup when the server secret is missing before Payload access', async () => {
        // Arrange
        delete process.env.E2E_SETUP_SECRET

        // Act
        const response = await POST(new NextRequest('http://localhost/api/e2e/ensure-test-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'benchmark@example.com', password: 'password123' }),
        }))

        // Assert
        expect(response.status).toBe(503)
        expect(getPayload).not.toHaveBeenCalled()
    })

    it('[TC-F08-04-126] rejects a wrong setup secret before any tenant mutation', async () => {
        // Arrange — the Payload mock must never be resolved for an unauthorized request.

        // Act
        const response = await POST(new NextRequest('http://localhost/api/e2e/ensure-test-user', {
            method: 'POST',
            headers: { Authorization: 'Bearer wrong-secret', 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'benchmark@example.com', password: 'password123' }),
        }))

        // Assert
        expect(response.status).toBe(401)
        expect(getPayload).not.toHaveBeenCalled()
    })

    it('[TC-F08-04-126] rejects arbitrary tenant or category identifiers', async () => {
        // Arrange — callers may not redirect the fixed category fixture to another tenant.

        // Act
        const response = await POST(new NextRequest('http://localhost/api/e2e/ensure-test-user', {
            method: 'POST',
            headers: { Authorization: 'Bearer setup-secret', 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'benchmark@example.com',
                password: 'password123',
                tenantId: 'victim-tenant',
                categoryId: 'victim-category',
            }),
        }))

        // Assert
        expect(response.status).toBe(400)
        expect(getPayload).not.toHaveBeenCalled()
    })

    it('[TC-F08-04-126] provisions active subscription, Site, and tenant-owned Product category', async () => {
        // Arrange
        const payload = {
            find: vi.fn().mockImplementation(async ({ collection }: { collection: string }) => {
                if (collection === 'tenants') return { docs: [{ id: 42 }] }
                if (collection === 'plan-subscriptions') return { docs: [] }
                if (collection === 'sites') return { docs: [] }
                if (collection === 'users') return { docs: [] }
                return { docs: [] }
            }),
            create: vi.fn().mockImplementation(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => ({
                id: collection === 'users' ? 84 : collection === 'categories' ? 88 : 21,
                ...data,
            })),
            update: vi.fn(),
        }
        vi.mocked(getPayload).mockResolvedValue(payload as never)

        // Act
        const response = await POST(new NextRequest('http://localhost/api/e2e/ensure-test-user', {
            method: 'POST',
            headers: { Authorization: 'Bearer setup-secret', 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'benchmark@example.com',
                password: 'password123',
                tenantSlug: 'e2e-generation-run',
            }),
        }))
        const body = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'plan-subscriptions',
            overrideAccess: true,
            data: expect.objectContaining({
                tenant: 42,
                name: 'main',
                plan: 'FREEMIUM',
                status: 'active',
                packCode: 'FREEMIUM',
            }),
        }))
        expect(payload.create).toHaveBeenCalledWith({
            collection: 'sites',
            overrideAccess: true,
            data: {
                tenant: 42,
                name: 'E2E Test Workspace Site',
                status: 'draft',
                siteType: 'ecommerce',
            },
        })
        expect(payload.create).toHaveBeenCalledWith({
            collection: 'categories',
            overrideAccess: true,
            data: {
                tenant: 42,
                site: 21,
                name: 'E2E AI Products',
                slug: 'e2e-ai-products',
            },
        })
        expect(body).toEqual(expect.objectContaining({
            tenantId: 42,
            siteId: 21,
            categoryId: 88,
            categoryName: 'E2E AI Products',
        }))
    })

    it('[TC-F08-04-126] reuses the Site and active category while excluding soft-deleted history', async () => {
        // Arrange
        const existingUser = {
            id: 84,
            roles: ['tenant-owner'],
            tenants: [
                { id: 'membership-7', tenant: { id: 7 }, role: 'owner', status: 'active', permissions: [] },
                { tenant: { id: 42 }, role: 'owner', status: 'active', permissions: ['products'] },
            ],
        }
        const payload = {
            find: vi.fn().mockImplementation(async ({ collection }: { collection: string }) => {
                if (collection === 'tenants') return { docs: [{ id: 42 }] }
                if (collection === 'plan-subscriptions') return { docs: [{ id: 63 }] }
                if (collection === 'sites') return { docs: [{ id: 77 }] }
                if (collection === 'categories') return { docs: [{ id: 88, deletedAt: null }] }
                if (collection === 'users') return { docs: [existingUser] }
                return { docs: [] }
            }),
            create: vi.fn(),
            update: vi.fn().mockImplementation(async ({ id, data }: { id: string | number; data: Record<string, unknown> }) => ({ id, ...data })),
        }
        vi.mocked(getPayload).mockResolvedValue(payload as never)

        // Act
        const response = await POST(new NextRequest('http://localhost/api/e2e/ensure-test-user', {
            method: 'POST',
            headers: { Authorization: 'Bearer setup-secret', 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'benchmark@example.com', password: 'password123' }),
        }))
        const body = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(payload.find).toHaveBeenCalledWith({
            collection: 'sites',
            where: { tenant: { equals: 42 } },
            limit: 1,
            overrideAccess: true,
        })
        expect(payload.find).toHaveBeenCalledWith({
            collection: 'categories',
            where: {
                and: [
                    { tenant: { equals: 42 } },
                    { slug: { equals: 'e2e-ai-products' } },
                    { deletedAt: { exists: false } },
                ],
            },
            limit: 1,
            sort: '-createdAt',
            overrideAccess: true,
        })
        expect(payload.update).toHaveBeenCalledWith({
            collection: 'categories',
            id: 88,
            overrideAccess: true,
            data: {
                tenant: 42,
                site: 77,
                name: 'E2E AI Products',
                slug: 'e2e-ai-products',
            },
        })
        const userUpdate = payload.update.mock.calls.find(([args]) => args.collection === 'users')?.[0]
        expect(userUpdate).toEqual(expect.objectContaining({
            collection: 'users',
            id: 84,
            data: expect.objectContaining({
                tenants: [
                    expect.objectContaining({
                        tenant: 42,
                        role: 'owner',
                        status: 'active',
                        permissions: ['products'],
                    }),
                    expect.objectContaining({ id: 'membership-7', tenant: 7 }),
                ],
            }),
        }))
        expect(body).toEqual(expect.objectContaining({ siteId: 77, categoryId: 88 }))
        expect(payload.create).not.toHaveBeenCalledWith(expect.objectContaining({ collection: 'sites' }))
        expect(payload.create).not.toHaveBeenCalledWith(expect.objectContaining({ collection: 'categories' }))
    })

    it('[TC-F08-04-126] recovers the active category created by a concurrent setup request', async () => {
        // Arrange
        let categoryReadCount = 0
        const existingUser = {
            id: 84,
            roles: ['tenant-owner'],
            tenants: [{ tenant: 42, role: 'owner', status: 'active', permissions: [] }],
        }
        const payload = {
            find: vi.fn().mockImplementation(async ({ collection }: { collection: string }) => {
                if (collection === 'tenants') return { docs: [{ id: 42 }] }
                if (collection === 'plan-subscriptions') return { docs: [{ id: 63 }] }
                if (collection === 'sites') return { docs: [{ id: 77 }] }
                if (collection === 'categories') {
                    categoryReadCount++
                    return categoryReadCount === 1 ? { docs: [] } : { docs: [{ id: 88 }] }
                }
                if (collection === 'users') return { docs: [existingUser] }
                return { docs: [] }
            }),
            create: vi.fn().mockImplementation(async ({ collection }: { collection: string }) => {
                if (collection === 'categories') {
                    throw new Error('duplicate key value violates categories_tenant_slug_uniq')
                }
                return { id: 84 }
            }),
            update: vi.fn().mockImplementation(async ({ id, data }: { id: string | number; data: Record<string, unknown> }) => ({ id, ...data })),
        }
        vi.mocked(getPayload).mockResolvedValue(payload as never)

        // Act
        const response = await POST(new NextRequest('http://localhost/api/e2e/ensure-test-user', {
            method: 'POST',
            headers: { Authorization: 'Bearer setup-secret', 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'benchmark@example.com', password: 'password123' }),
        }))
        const body = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(categoryReadCount).toBe(2)
        expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({ collection: 'categories' }))
        expect(body).toEqual(expect.objectContaining({ categoryId: 88 }))
    })

    it('TC-F03.57: recreates a current-period pending dashboard fixture when requested', async () => {
        // Arrange
        const productHookPayload = {
            findByID: vi.fn().mockResolvedValue({ seo: { autoMetaEnabled: true } }),
        }
        const payload = {
            find: vi.fn().mockImplementation(async ({ collection }: { collection: string }) => {
                if (collection === 'tenants') return { docs: [{ id: 42 }] }
                if (collection === 'plan-subscriptions') return { docs: [{ id: 7 }] }
                if (collection === 'sites') return { docs: [] }
                if (collection === 'products') return { docs: [] }
                if (collection === 'orders') return { docs: [{ id: 99 }] }
                if (collection === 'users') return { docs: [{ id: 84, tenants: [{ tenant: 42 }], roles: ['tenant-owner'] }] }
                return { docs: [] }
            }),
            create: vi.fn().mockImplementation(async ({
                collection,
                data,
            }: {
                collection: string
                data: Record<string, unknown>
            }) => {
                const id = collection === 'sites'
                    ? 51
                    : collection === 'products'
                        ? 52
                        : collection === 'orders'
                            ? 53
                            : 84
                if (collection === 'products') {
                    await publishGateHook({ data, operation: 'create' } as never)
                    await productAfterChangeHook({
                        doc: { id, ...data },
                        operation: 'create',
                        req: { payload: productHookPayload },
                    } as never)
                }
                return {
                    id,
                    ...data,
                }
            }),
            delete: vi.fn(),
            update: vi.fn(),
        }
        vi.mocked(getPayload).mockResolvedValue(payload as never)

        // Act
        const response = await POST(new NextRequest('http://localhost/api/e2e/ensure-test-user', {
            method: 'POST',
            headers: { Authorization: 'Bearer setup-secret', 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'dashboard@example.com',
                password: 'password123',
                seedDashboardFixture: true,
            }),
        }))
        const body = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(payload.delete).toHaveBeenCalledWith({
            collection: 'orders',
            id: 99,
            overrideAccess: true,
        })
        expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'sites',
            overrideAccess: true,
            data: expect.objectContaining({
                tenant: 42,
                generationStatus: 'completed',
            }),
        }))
        expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'products',
            overrideAccess: true,
            data: expect.objectContaining({
                tenant: 42,
                site: 51,
                sku: 'E2E-DASHBOARD-PRODUCT-42',
                inventory: 10,
                weight: 0.5,
                hasVariants: false,
                status: 'active',
            }),
        }))
        expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'tenants',
            id: 42,
            overrideAccess: true,
            data: {
                settings: {
                    dashboardPreferences: [...DEFAULT_DASHBOARD_BLOCKS, 'orders'],
                },
            },
        }))
        expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'orders',
            overrideAccess: true,
            data: expect.objectContaining({
                tenant: 42,
                site: 51,
                orderNumber: 'E2E-DASHBOARD-PENDING-42',
                status: 'pending',
                total: 107.8,
                currency: 'MYR',
            }),
        }))
        expect(body.setupCapability).toBe('dashboard-fixture-v2')
        expect(body.dashboardFixture).toEqual({
            orderId: 53,
            orderNumber: 'E2E-DASHBOARD-PENDING-42',
            orderTotal: 107.8,
        })
        expect(mocks.queueSEOAutoGeneration).not.toHaveBeenCalled()
    })

    it('TC-F03.57: keeps tenant-isolated fixtures unique and preserves dashboard preferences', async () => {
        // Arrange
        const tenants = new Map<string, {
            id: number
            settings: {
                allowedWebsites: number
                dashboardPreferences: string[]
            }
        }>([
            ['e2e-alpha', {
                id: 42,
                settings: {
                    allowedWebsites: 3,
                    dashboardPreferences: ['seo', 'orders'],
                },
            }],
            ['e2e-beta', {
                id: 43,
                settings: {
                    allowedWebsites: 2,
                    dashboardPreferences: ['glance'],
                },
            }],
        ])
        const orders: Array<{
            id: number
            tenant: number
            orderNumber: string
        }> = []
        let nextOrderId = 100
        const productHookPayload = {
            findByID: vi.fn().mockResolvedValue({ seo: { autoMetaEnabled: true } }),
        }
        const payload = {
            find: vi.fn().mockImplementation(async ({
                collection,
                where,
            }: {
                collection: string
                where?: {
                    slug?: { equals?: string }
                    and?: Array<Record<string, { equals?: string | number }>>
                }
            }) => {
                if (collection === 'tenants') {
                    const tenant = tenants.get(where?.slug?.equals || '')
                    return { docs: tenant ? [tenant] : [] }
                }
                if (collection === 'plan-subscriptions') return { docs: [{ id: 7 }] }
                if (collection === 'sites') {
                    const tenantId = where?.and?.[0]?.tenant?.equals as number
                    return { docs: [{ id: tenantId * 10 + 1 }] }
                }
                if (collection === 'products') {
                    const tenantId = where?.and?.[0]?.tenant?.equals as number
                    return {
                        docs: [{
                            id: tenantId * 10 + 2,
                            status: 'draft',
                            price: null,
                            sku: '',
                            inventory: null,
                            weight: 0,
                            hasVariants: false,
                        }],
                    }
                }
                if (collection === 'orders') {
                    const tenantId = where?.and?.[0]?.tenant?.equals
                    const orderNumber = where?.and?.[1]?.orderNumber?.equals
                    return {
                        docs: orders.filter(order => (
                            order.tenant === tenantId
                            && order.orderNumber === orderNumber
                        )),
                    }
                }
                if (collection === 'users') return { docs: [] }
                return { docs: [] }
            }),
            create: vi.fn().mockImplementation(async ({
                collection,
                data,
            }: {
                collection: string
                data: Record<string, unknown>
            }) => {
                if (collection === 'orders') {
                    const orderNumber = String(data.orderNumber)
                    if (orders.some(order => order.orderNumber === orderNumber)) {
                        throw new Error('duplicate key value violates unique constraint')
                    }
                    const order = {
                        id: nextOrderId++,
                        tenant: Number(data.tenant),
                        orderNumber,
                    }
                    orders.push(order)
                    return { ...data, ...order }
                }
                return { id: 84, ...data }
            }),
            delete: vi.fn(),
            update: vi.fn().mockImplementation(async ({
                collection,
                data,
                id,
            }: {
                collection: string
                data: Record<string, unknown>
                id: number
            }) => {
                if (collection === 'products') {
                    const originalDoc = {
                        id,
                        status: 'draft',
                        price: null,
                        sku: '',
                        inventory: null,
                        weight: 0,
                        hasVariants: false,
                    }
                    await publishGateHook({
                        data,
                        operation: 'update',
                        originalDoc,
                    } as never)
                    await productAfterChangeHook({
                        doc: { id, ...data },
                        previousDoc: originalDoc,
                        operation: 'update',
                        req: { payload: productHookPayload },
                    } as never)
                }
                return { id, ...data }
            }),
        }
        vi.mocked(getPayload).mockResolvedValue(payload as never)

        const provision = async (tenantSlug: string, email: string) => {
            const response = await POST(new NextRequest('http://localhost/api/e2e/ensure-test-user', {
                method: 'POST',
                headers: { Authorization: 'Bearer setup-secret', 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password: 'password123',
                    tenantSlug,
                    seedDashboardFixture: true,
                }),
            }))
            return {
                response,
                body: await response.json() as {
                    dashboardFixture?: { orderNumber: string }
                },
            }
        }

        // Act
        const alpha = await provision('e2e-alpha', 'alpha@example.com')
        const beta = await provision('e2e-beta', 'beta@example.com')

        // Assert
        expect(alpha.response.status).toBe(200)
        expect(beta.response.status).toBe(200)
        expect(alpha.body.dashboardFixture?.orderNumber).toBe('E2E-DASHBOARD-PENDING-42')
        expect(beta.body.dashboardFixture?.orderNumber).toBe('E2E-DASHBOARD-PENDING-43')
        expect(orders.map(order => order.orderNumber)).toEqual([
            'E2E-DASHBOARD-PENDING-42',
            'E2E-DASHBOARD-PENDING-43',
        ])
        const tenantUpdates = payload.update.mock.calls
            .map(([call]) => call)
            .filter(call => call.collection === 'tenants')
        expect(tenantUpdates).toEqual([
            expect.objectContaining({
                id: 42,
                data: {
                    settings: {
                        allowedWebsites: 3,
                        dashboardPreferences: ['seo', 'orders'],
                    },
                },
            }),
            expect.objectContaining({
                id: 43,
                data: {
                    settings: {
                        allowedWebsites: 2,
                        dashboardPreferences: ['glance', 'orders'],
                    },
                },
            }),
        ])
        expect(payload.delete).not.toHaveBeenCalled()
        expect(mocks.queueSEOAutoGeneration).not.toHaveBeenCalled()
    })
})
