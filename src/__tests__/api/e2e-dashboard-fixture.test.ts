import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    getCurrentUser: vi.fn(),
    tenantIdForQuery: vi.fn(),
    queueSEOAutoGeneration: vi.fn(),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('payload', async () => {
    const actual = await vi.importActual<typeof import('payload')>('payload')
    return { ...actual, getPayload: vi.fn() }
})

vi.mock('@/lib/auth', () => ({
    getCurrentUser: mocks.getCurrentUser,
    tenantIdForQuery: mocks.tenantIdForQuery,
}))

vi.mock('@/lib/ai/seo-queue', () => ({
    queueSEOAutoGeneration: mocks.queueSEOAutoGeneration,
}))

import { NextRequest } from 'next/server'
import {
    getPayload,
    type CollectionAfterChangeHook,
    type CollectionBeforeChangeHook,
} from 'payload'
import { POST } from '@/app/api/e2e/dashboard-fixture/route'
import { Products } from '@/collections/Products'

const publishGateHook = Products.hooks!.beforeChange![1] as CollectionBeforeChangeHook
const productAfterChangeHook = Products.hooks!.afterChange![0] as CollectionAfterChangeHook

function fixtureRequest() {
    return new NextRequest('http://localhost/api/e2e/dashboard-fixture', {
        method: 'POST',
        headers: {
            'x-e2e-fixture-intent': 'dashboard-fixture-v2',
        },
    })
}

describe('[TC-F03.57] POST /api/e2e/dashboard-fixture', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.APP_ENV = 'staging'
        process.env.TEST_EMAIL = 'dashboard@example.com'
        mocks.getCurrentUser.mockResolvedValue({
            id: 84,
            email: 'dashboard@example.com',
            tenants: [{ tenant: 42 }],
        })
        mocks.tenantIdForQuery.mockReturnValue(42)
    })

    it('seeds a publish-valid product and enables orders for the session tenant', async () => {
        // Arrange
        const productHookPayload = {
            findByID: vi.fn().mockResolvedValue({ seo: { autoMetaEnabled: true } }),
        }
        const payload = {
            findByID: vi.fn().mockResolvedValue({
                id: 42,
                settings: {
                    allowedWebsites: 3,
                    dashboardPreferences: ['seo'],
                },
            }),
            find: vi.fn().mockImplementation(async ({ collection }: { collection: string }) => {
                if (collection === 'orders') return { docs: [{ id: 99 }] }
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
                        : 53
                if (collection === 'products') {
                    await publishGateHook({ data, operation: 'create' } as never)
                    await productAfterChangeHook({
                        doc: { id, ...data },
                        operation: 'create',
                        req: { payload: productHookPayload },
                    } as never)
                }
                return { id, ...data }
            }),
            update: vi.fn(),
            delete: vi.fn(),
        }
        vi.mocked(getPayload).mockResolvedValue(payload as never)

        // Act
        const response = await POST(fixtureRequest())
        const body = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(payload.findByID).toHaveBeenCalledWith({
            collection: 'tenants',
            id: 42,
            depth: 0,
            overrideAccess: true,
        })
        expect(payload.update).toHaveBeenCalledWith({
            collection: 'tenants',
            id: 42,
            data: {
                settings: {
                    allowedWebsites: 3,
                    dashboardPreferences: ['seo', 'orders'],
                },
            },
            overrideAccess: true,
        })
        expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'products',
            data: expect.objectContaining({
                tenant: 42,
                site: 51,
                sku: 'E2E-DASHBOARD-PRODUCT-42',
                inventory: 10,
                weight: 0.5,
                hasVariants: false,
                status: 'active',
            }),
            overrideAccess: true,
        }))
        expect(payload.delete).toHaveBeenCalledWith({
            collection: 'orders',
            id: 99,
            overrideAccess: true,
        })
        expect(body).toEqual({
            status: 'fixture-ready',
            setupCapability: 'dashboard-fixture-v2',
            tenantId: 42,
            dashboardFixture: {
                orderId: 53,
                orderNumber: 'E2E-DASHBOARD-PENDING-42',
                orderTotal: 107.8,
            },
        })
        expect(mocks.queueSEOAutoGeneration).not.toHaveBeenCalled()
    })

    it('rejects an unauthenticated request', async () => {
        // Arrange
        mocks.getCurrentUser.mockResolvedValue(null)

        // Act
        const response = await POST(fixtureRequest())

        // Assert
        expect(response.status).toBe(401)
        expect(getPayload).not.toHaveBeenCalled()
    })

    it('rejects a session that does not belong to the configured E2E user', async () => {
        // Arrange
        mocks.getCurrentUser.mockResolvedValue({
            id: 85,
            email: 'another@example.com',
            tenants: [{ tenant: 43 }],
        })

        // Act
        const response = await POST(fixtureRequest())

        // Assert
        expect(response.status).toBe(403)
        expect(getPayload).not.toHaveBeenCalled()
    })

    it('rejects a session without a primary tenant', async () => {
        // Arrange
        mocks.tenantIdForQuery.mockReturnValue(null)

        // Act
        const response = await POST(fixtureRequest())

        // Assert
        expect(response.status).toBe(409)
        expect(getPayload).not.toHaveBeenCalled()
    })

    it('is unavailable outside staging even when the public environment is misconfigured', async () => {
        // Arrange
        process.env.APP_ENV = 'production'
        process.env.NEXT_PUBLIC_APP_ENV = 'staging'

        // Act
        const response = await POST(fixtureRequest())

        // Assert
        expect(response.status).toBe(403)
        expect(mocks.getCurrentUser).not.toHaveBeenCalled()
    })
})
