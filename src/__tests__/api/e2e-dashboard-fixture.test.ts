import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    getCurrentUser: vi.fn(),
    tenantIdForQuery: vi.fn(),
    queueSEOAutoGeneration: vi.fn(),
    withTenantRowLock: vi.fn(),
    lockTenantSiteRows: vi.fn(),
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

vi.mock('@/lib/payload/tenant-row-lock', () => ({
    withTenantRowLock: mocks.withTenantRowLock,
    lockTenantSiteRows: mocks.lockTenantSiteRows,
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

function fixtureRequest(body?: unknown) {
    return new NextRequest('http://localhost/api/e2e/dashboard-fixture', {
        method: 'POST',
        headers: {
            'x-e2e-fixture-intent': 'dashboard-fixture-v2',
            ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
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
        mocks.withTenantRowLock.mockImplementation(async (
            _payload: unknown,
            _tenantId: unknown,
            operation: (req: { transactionID: string }) => Promise<unknown>,
        ) => (
            operation({ transactionID: 'test-transaction' })
        ))
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

describe('[TC-F03.78] POST /api/e2e/dashboard-fixture shipping state', () => {
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
        mocks.withTenantRowLock.mockImplementation(async (
            _payload: unknown,
            _tenantId: unknown,
            operation: (req: { transactionID: string }) => Promise<unknown>,
        ) => operation({ transactionID: 'test-transaction' }))
    })

    it('canonically prepares polluted E2E state and preserves sibling fields', async () => {
        // Arrange
        const payload = {
            findByID: vi.fn().mockResolvedValue({
                id: 42,
                slug: 'e2e-test',
                settings: { dashboardPreferences: ['seo'], allowedWebsites: 3 },
                easyParcelIntegration: {
                    enabled: true,
                    accessToken: 'hidden-access',
                    refreshToken: 'hidden-refresh',
                    testedAt: '2026-08-12T00:00:00.000Z',
                    warehouse: {
                        name: 'Legacy HQ',
                        phone: '+60123456789',
                        address1: '1 Test Road',
                        city: 'Kuala Lumpur',
                        state: 'Kuala Lumpur',
                        postcode: '50000',
                    },
                },
            }),
            find: vi.fn().mockResolvedValue({
                docs: [
                    {
                        id: 51,
                        themeCustomized: true,
                        shippingConfig: {
                            enabled: true,
                            westRate: 500,
                            shippingSetupConfirmed: true,
                        },
                    },
                    { id: 52, themeCustomized: false },
                ],
            }),
            update: vi.fn().mockResolvedValue({}),
        }
        vi.mocked(getPayload).mockResolvedValue(payload as never)

        // Act
        const response = await POST(fixtureRequest({
            action: 'prepare-gh1700-easyparcel-only',
        }))
        const body = await response.json()

        // Assert
        const req = { transactionID: 'test-transaction' }
        expect(response.status).toBe(200)
        expect(mocks.withTenantRowLock).toHaveBeenCalledWith(payload, 42, expect.any(Function))
        expect(mocks.lockTenantSiteRows).toHaveBeenCalledWith(payload, 42, [51, 52], req)
        expect(payload.findByID).toHaveBeenCalledWith({
            collection: 'tenants',
            id: 42,
            depth: 0,
            overrideAccess: true,
            showHiddenFields: true,
            req,
        })
        expect(payload.find).toHaveBeenCalledWith({
            collection: 'sites',
            where: {
                and: [
                    { tenant: { equals: 42 } },
                    {
                        or: [
                            { generationStatus: { equals: 'completed' } },
                            { generationStatus: { equals: 'none' } },
                            { generationStatus: { equals: null } },
                            { generationStatus: { exists: false } },
                        ],
                    },
                ],
            },
            limit: 21,
            depth: 0,
            overrideAccess: true,
            req,
        })
        expect(payload.find).toHaveBeenCalledTimes(2)
        expect(payload.update).toHaveBeenNthCalledWith(1, {
            collection: 'tenants',
            id: 42,
            data: {
                settings: {
                    dashboardPreferences: ['seo', 'onboarding'],
                    allowedWebsites: 3,
                },
            },
            overrideAccess: true,
            req,
        })
        expect(payload.update).toHaveBeenNthCalledWith(2, {
            collection: 'sites',
            id: 51,
            data: {
                themeCustomized: false,
                shippingConfig: { shippingSetupConfirmed: false },
            },
            overrideAccess: true,
            req,
        })
        expect(payload.update).toHaveBeenCalledTimes(2)
        expect(body).toEqual({
            status: 'shipping-state-ready',
            shippingSetupCapability: 'dashboard-shipping-fixture-v2',
            siteIds: ['51', '52'],
        })
        expect(JSON.stringify(body)).not.toContain('hidden-access')
        expect(JSON.stringify(body)).not.toContain('hidden-refresh')
    })

    it('is idempotent when the dedicated tenant is already canonical', async () => {
        // Arrange
        const payload = {
            findByID: vi.fn().mockResolvedValue({
                id: 42,
                slug: 'e2e-test',
                settings: { dashboardPreferences: ['onboarding', 'seo'] },
                easyParcelIntegration: {
                    enabled: true,
                    accessToken: 'hidden-access',
                    refreshToken: 'hidden-refresh',
                    testedAt: '2026-08-12T00:00:00.000Z',
                    warehouses: [{
                        label: 'HQ',
                        phone: '+60123456789',
                        address1: '1 Test Road',
                        city: 'Kuala Lumpur',
                        state: 'Kuala Lumpur',
                        postcode: '50000',
                        isDefault: true,
                    }],
                },
            }),
            find: vi.fn().mockResolvedValue({
                docs: [{
                    id: 51,
                    themeCustomized: false,
                    shippingConfig: { shippingSetupConfirmed: false },
                }],
            }),
            update: vi.fn(),
        }
        vi.mocked(getPayload).mockResolvedValue(payload as never)

        // Act
        const response = await POST(fixtureRequest({
            action: 'prepare-gh1700-easyparcel-only',
        }))

        // Assert
        expect(response.status).toBe(200)
        expect(payload.update).not.toHaveBeenCalled()
    })

    it('sanitizes malformed Dashboard preferences instead of returning 500', async () => {
        // Arrange
        const payload = {
            findByID: vi.fn().mockResolvedValue({
                id: 42,
                slug: 'e2e-test',
                settings: { dashboardPreferences: { invalid: true }, allowedWebsites: 3 },
                easyParcelIntegration: {
                    enabled: true,
                    accessToken: 'hidden-access',
                    refreshToken: 'hidden-refresh',
                    testedAt: '2026-08-12T00:00:00.000Z',
                    warehouse: {
                        name: 'Legacy HQ',
                        phone: '+60123456789',
                        address1: '1 Test Road',
                        city: 'Kuala Lumpur',
                        state: 'Kuala Lumpur',
                        postcode: '50000',
                    },
                },
            }),
            find: vi.fn().mockResolvedValue({ docs: [{ id: 51, themeCustomized: false }] }),
            update: vi.fn().mockResolvedValue({}),
        }
        vi.mocked(getPayload).mockResolvedValue(payload as never)

        // Act
        const response = await POST(fixtureRequest({
            action: 'prepare-gh1700-easyparcel-only',
        }))

        // Assert
        expect(response.status).toBe(200)
        expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'tenants',
            data: {
                settings: {
                    dashboardPreferences: ['onboarding', 'glance', 'traffic', 'seo'],
                    allowedWebsites: 3,
                },
            },
        }))
    })

    it('fails closed before mutation when the primary tenant is not dedicated', async () => {
        // Arrange
        const payload = {
            findByID: vi.fn().mockResolvedValue({
                id: 42,
                slug: 'e2e-targeted-smoke',
                easyParcelIntegration: { enabled: true },
            }),
            find: vi.fn().mockResolvedValue({ docs: [{ id: 51 }] }),
            update: vi.fn(),
        }
        vi.mocked(getPayload).mockResolvedValue(payload as never)

        // Act
        const response = await POST(fixtureRequest({
            action: 'prepare-gh1700-easyparcel-only',
        }))
        const body = await response.json()

        // Assert
        expect(response.status).toBe(409)
        expect(payload.update).not.toHaveBeenCalled()
        expect(body).toEqual({
            error: 'Dashboard shipping fixture prerequisites not met',
            code: 'TENANT_MISMATCH',
        })
    })

    it('rejects manufactured EasyParcel state before mutation', async () => {
        // Arrange
        const payload = {
            findByID: vi.fn().mockResolvedValue({
                id: 42,
                slug: 'e2e-test',
                easyParcelIntegration: { enabled: true },
            }),
            find: vi.fn().mockResolvedValue({ docs: [{ id: 51 }] }),
            update: vi.fn(),
        }
        vi.mocked(getPayload).mockResolvedValue(payload as never)

        // Act
        const response = await POST(fixtureRequest({
            action: 'prepare-gh1700-easyparcel-only',
        }))
        const body = await response.json()

        // Assert
        expect(response.status).toBe(409)
        expect(payload.update).not.toHaveBeenCalled()
        expect(body.code).toBe('EASYPARCEL_NOT_READY')
    })

    it('rejects malformed legacy warehouse JSON before mutation', async () => {
        // Arrange
        const payload = {
            findByID: vi.fn().mockResolvedValue({
                id: 42,
                slug: 'e2e-test',
                easyParcelIntegration: {
                    enabled: true,
                    accessToken: 'hidden-access',
                    refreshToken: 'hidden-refresh',
                    testedAt: '2026-08-12T00:00:00.000Z',
                    warehouse: {
                        name: 123,
                        phone: '+60123456789',
                        address1: '1 Test Road',
                        city: 'Kuala Lumpur',
                        state: 'Kuala Lumpur',
                        postcode: '50000',
                    },
                },
            }),
            find: vi.fn().mockResolvedValue({ docs: [{ id: 51 }] }),
            update: vi.fn(),
        }
        vi.mocked(getPayload).mockResolvedValue(payload as never)

        // Act
        const response = await POST(fixtureRequest({
            action: 'prepare-gh1700-easyparcel-only',
        }))
        const body = await response.json()

        // Assert
        expect(response.status).toBe(409)
        expect(body).toEqual({
            error: 'Dashboard shipping fixture prerequisites not met',
            code: 'EASYPARCEL_NOT_READY',
        })
        expect(payload.update).not.toHaveBeenCalled()
    })

    it('rejects an empty usable-site set before mutation', async () => {
        // Arrange
        const payload = {
            findByID: vi.fn().mockResolvedValue({
                id: 42,
                slug: 'e2e-test',
                easyParcelIntegration: {
                    enabled: true,
                    accessToken: 'hidden-access',
                    refreshToken: 'hidden-refresh',
                    testedAt: '2026-08-12T00:00:00.000Z',
                    warehouse: {
                        name: 'Legacy HQ',
                        phone: '+60123456789',
                        address1: '1 Test Road',
                        city: 'Kuala Lumpur',
                        state: 'Kuala Lumpur',
                        postcode: '50000',
                    },
                },
            }),
            find: vi.fn().mockResolvedValue({ docs: [] }),
            update: vi.fn(),
        }
        vi.mocked(getPayload).mockResolvedValue(payload as never)

        // Act
        const response = await POST(fixtureRequest({
            action: 'prepare-gh1700-easyparcel-only',
        }))
        const body = await response.json()

        // Assert
        expect(response.status).toBe(409)
        expect(payload.update).not.toHaveBeenCalled()
        expect(body.code).toBe('DASHBOARD_NOT_READY')
    })

    it('fails closed before mutation when the usable-site set changes during locking', async () => {
        // Arrange
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        const tenant = {
            id: 42,
            slug: 'e2e-test',
            settings: { dashboardPreferences: ['onboarding'] },
            easyParcelIntegration: {
                enabled: true,
                accessToken: 'hidden-access',
                refreshToken: 'hidden-refresh',
                testedAt: '2026-08-12T00:00:00.000Z',
                warehouse: {
                    name: 'Legacy HQ',
                    phone: '+60123456789',
                    address1: '1 Test Road',
                    city: 'Kuala Lumpur',
                    state: 'Kuala Lumpur',
                    postcode: '50000',
                },
            },
        }
        const payload = {
            findByID: vi.fn().mockResolvedValue(tenant),
            find: vi.fn()
                .mockResolvedValueOnce({ docs: [{ id: 51, themeCustomized: true }] })
                .mockResolvedValueOnce({
                    docs: [
                        { id: 51, themeCustomized: true },
                        { id: 52, themeCustomized: false },
                    ],
                }),
            update: vi.fn(),
        }
        vi.mocked(getPayload).mockResolvedValue(payload as never)

        // Act
        const response = await POST(fixtureRequest({
            action: 'prepare-gh1700-easyparcel-only',
        }))
        const body = await response.json()

        // Assert
        const req = { transactionID: 'test-transaction' }
        expect(response.status).toBe(500)
        expect(body).toEqual({ error: 'Dashboard fixture provisioning failed' })
        expect(mocks.lockTenantSiteRows).toHaveBeenCalledWith(payload, 42, [51], req)
        expect(payload.find).toHaveBeenCalledTimes(2)
        expect(payload.update).not.toHaveBeenCalled()
        expect(errorSpy).toHaveBeenCalledWith(
            '[E2E Dashboard Fixture] Error:',
            expect.objectContaining({
                message: 'Dashboard shipping fixture site set changed during preparation',
            }),
        )
    })

    it('keeps unexpected preparation failures behind the generic 500 contract', async () => {
        // Arrange
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        const payload = {
            findByID: vi.fn().mockRejectedValue(new Error('database unavailable')),
            find: vi.fn().mockResolvedValue({ docs: [] }),
        }
        vi.mocked(getPayload).mockResolvedValue(payload as never)

        // Act
        const response = await POST(fixtureRequest({
            action: 'prepare-gh1700-easyparcel-only',
        }))
        const body = await response.json()

        // Assert
        expect(response.status).toBe(500)
        expect(body).toEqual({ error: 'Dashboard fixture provisioning failed' })
        expect(errorSpy).toHaveBeenCalledWith(
            '[E2E Dashboard Fixture] Error:',
            expect.objectContaining({ message: 'database unavailable' }),
        )
    })

    it('rejects extra fields before mutation', async () => {
        // Arrange
        const payload = { update: vi.fn() }
        vi.mocked(getPayload).mockResolvedValue(payload as never)

        // Act
        const response = await POST(fixtureRequest({
            action: 'prepare-gh1700-easyparcel-only',
            tenantId: 999,
        }))

        // Assert
        expect(response.status).toBe(400)
        expect(payload.update).not.toHaveBeenCalled()
        expect(mocks.withTenantRowLock).not.toHaveBeenCalled()
    })
})
