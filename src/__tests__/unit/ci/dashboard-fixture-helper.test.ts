import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { provisionDashboardFixture } from '../../../../e2e/helpers/dashboard-fixture'

describe('dashboard fixture provisioning helper', () => {
    const fetchMock = vi.fn<typeof fetch>()

    beforeEach(() => {
        fetchMock.mockReset()
        vi.stubGlobal('fetch', fetchMock)
        vi.stubEnv('BASE_URL', 'https://staging.example.com')
        vi.stubEnv('E2E_SETUP_SECRET', 'setup-secret')
        vi.stubEnv('TEST_EMAIL', 'dashboard@example.com')
        vi.stubEnv('TEST_PASSWORD', 'password123')
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.unstubAllEnvs()
    })

    it('requests a fresh fixture on every invocation and returns its identity', async () => {
        // Arrange
        fetchMock.mockImplementation(async () => new Response(JSON.stringify({
            setupCapability: 'dashboard-fixture-v2',
            dashboardFixture: {
                orderId: 53,
                orderNumber: 'E2E-DASHBOARD-PENDING-42',
                orderTotal: 107.8,
            },
        }), { status: 200 }))

        // Act
        const firstFixture = await provisionDashboardFixture()
        const secondFixture = await provisionDashboardFixture()

        // Assert
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(firstFixture).toEqual({
            orderId: '53',
            orderNumber: 'E2E-DASHBOARD-PENDING-42',
            orderTotal: 107.8,
        })
        expect(secondFixture).toEqual(firstFixture)

        const [requestUrl, requestInit] = fetchMock.mock.calls[0]
        expect(String(requestUrl)).toBe(
            'https://staging.example.com/api/e2e/ensure-test-user',
        )
        expect(requestInit).toEqual(expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
                Authorization: 'Bearer setup-secret',
                'Content-Type': 'application/json',
            }),
        }))
        expect(JSON.parse(String(requestInit?.body))).toEqual({
            email: 'dashboard@example.com',
            password: 'password123',
            seedDashboardFixture: true,
        })
    })

    it('rejects a stale v1 deployment even when its fixture metadata is valid', async () => {
        // Arrange
        fetchMock.mockResolvedValue(new Response(JSON.stringify({
            setupCapability: 'dashboard-fixture-v1',
            dashboardFixture: {
                orderId: 53,
                orderNumber: 'E2E-DASHBOARD-PENDING-42',
                orderTotal: 107.8,
            },
        }), { status: 200 }))

        // Act + Assert
        await expect(provisionDashboardFixture()).rejects.toThrow(
            'incompatible capability',
        )
    })

    it('fails before the request when the setup secret is unavailable', async () => {
        // Arrange
        vi.stubEnv('E2E_SETUP_SECRET', '')

        // Act + Assert
        await expect(provisionDashboardFixture()).rejects.toThrow(
            'E2E_SETUP_SECRET is required',
        )
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
