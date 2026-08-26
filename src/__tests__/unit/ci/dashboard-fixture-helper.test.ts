import type { APIRequestContext, APIResponse } from '@playwright/test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { provisionDashboardFixture } from '../../../../e2e/helpers/dashboard-fixture'
import { prepareDashboardEasyParcelOnlyFixture } from '../../../../e2e/helpers/dashboard-shipping-fixture'

function mockResponse(status: number, body: unknown): APIResponse {
    return {
        ok: () => status >= 200 && status < 300,
        status: () => status,
        text: async () => typeof body === 'string' ? body : JSON.stringify(body),
    } as APIResponse
}

const readyFixture = {
    setupCapability: 'dashboard-fixture-v2',
    dashboardFixture: {
        orderId: 53,
        orderNumber: 'E2E-DASHBOARD-PENDING-42',
        orderTotal: 107.8,
    },
}

describe('[TC-F03.57] dashboard fixture provisioning helper', () => {
    const postMock = vi.fn()
    const request = { post: postMock } as unknown as APIRequestContext

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('uses the authenticated request context and returns a fresh fixture', async () => {
        // Arrange
        postMock.mockResolvedValue(mockResponse(200, readyFixture))

        // Act
        const firstFixture = await provisionDashboardFixture(request)
        const secondFixture = await provisionDashboardFixture(request)

        // Assert
        expect(postMock).toHaveBeenCalledTimes(2)
        expect(postMock).toHaveBeenCalledWith('/api/e2e/dashboard-fixture', {
            headers: {
                'x-e2e-fixture-intent': 'dashboard-fixture-v2',
            },
            timeout: 15_000,
        })
        expect(firstFixture).toEqual({
            orderId: '53',
            orderNumber: 'E2E-DASHBOARD-PENDING-42',
            orderTotal: 107.8,
        })
        expect(secondFixture).toEqual(firstFixture)
    })

    it('retries a stale v1 deployment until capability v2 is live', async () => {
        // Arrange
        postMock
            .mockResolvedValueOnce(mockResponse(200, {
                ...readyFixture,
                setupCapability: 'dashboard-fixture-v1',
            }))
            .mockResolvedValueOnce(mockResponse(200, readyFixture))

        // Act
        const fixture = await provisionDashboardFixture(request, {
            maxAttempts: 2,
            retryDelayMs: 0,
        })

        // Assert
        expect(postMock).toHaveBeenCalledTimes(2)
        expect(fixture.orderId).toBe('53')
    })

    it('retries a transient missing route while the Vercel alias is stale', async () => {
        // Arrange
        postMock
            .mockResolvedValueOnce(mockResponse(404, 'Not Found'))
            .mockResolvedValueOnce(mockResponse(200, readyFixture))

        // Act
        const fixture = await provisionDashboardFixture(request, {
            maxAttempts: 2,
            retryDelayMs: 0,
        })

        // Assert
        expect(postMock).toHaveBeenCalledTimes(2)
        expect(fixture.orderNumber).toBe('E2E-DASHBOARD-PENDING-42')
    })

    it('fails when capability v2 never becomes ready', async () => {
        // Arrange
        postMock.mockResolvedValue(mockResponse(200, {
            ...readyFixture,
            setupCapability: 'dashboard-fixture-v1',
        }))

        // Act + Assert
        await expect(provisionDashboardFixture(request, {
            maxAttempts: 1,
            retryDelayMs: 0,
        })).rejects.toThrow('incompatible capability')
        expect(postMock).toHaveBeenCalledTimes(1)
    })

    it('fails immediately when the authenticated session is rejected', async () => {
        // Arrange
        postMock.mockResolvedValue(mockResponse(401, { error: 'Unauthorized' }))

        // Act + Assert
        await expect(provisionDashboardFixture(request, {
            maxAttempts: 3,
            retryDelayMs: 0,
        })).rejects.toThrow('rejected (401)')
        expect(postMock).toHaveBeenCalledTimes(1)
    })
})

describe('[TC-F03.78] dashboard shipping fixture helper', () => {
    const postMock = vi.fn()
    const request = { post: postMock } as unknown as APIRequestContext

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('prepares the canonical fixture and validates the capability contract', async () => {
        // Arrange
        postMock.mockResolvedValue(mockResponse(200, {
            status: 'shipping-state-ready',
            shippingSetupCapability: 'dashboard-shipping-fixture-v2',
            siteIds: ['51', '52'],
        }))

        // Act
        const result = await prepareDashboardEasyParcelOnlyFixture(request)

        // Assert
        expect(result).toEqual({ siteIds: ['51', '52'] })
        expect(postMock).toHaveBeenCalledWith('/api/e2e/dashboard-fixture', {
            headers: { 'x-e2e-fixture-intent': 'dashboard-fixture-v2' },
            data: { action: 'prepare-gh1700-easyparcel-only' },
            timeout: 15_000,
        })
    })

    it('fails immediately when the dedicated fixture is unavailable', async () => {
        // Arrange
        postMock.mockResolvedValue(mockResponse(409, {
            error: 'Dashboard shipping fixture prerequisites not met',
            code: 'EASYPARCEL_NOT_READY',
        }))

        // Act + Assert
        await expect(prepareDashboardEasyParcelOnlyFixture(request))
            .rejects.toThrow('staging prerequisite rejected (409): EASYPARCEL_NOT_READY')
        expect(postMock).toHaveBeenCalledTimes(1)
    })

    it('does not echo unexpected response bodies into the Playwright error', async () => {
        // Arrange
        postMock.mockResolvedValue(mockResponse(500, 'internal-token-value'))

        // Act + Assert
        await expect(prepareDashboardEasyParcelOnlyFixture(request, { maxAttempts: 1 }))
            .rejects.toThrow(/^GH-1700 staging prerequisite rejected \(500\)$/)
    })

    it('does not retry a commit-ambiguous timeout or socket failure', async () => {
        // Arrange
        postMock.mockRejectedValue(new Error('Request timed out after 15000ms'))

        // Act + Assert
        await expect(prepareDashboardEasyParcelOnlyFixture(request, {
            maxAttempts: 3,
            retryDelayMs: 0,
        })).rejects.toThrow('staging prerequisite rejected: network error')
        expect(postMock).toHaveBeenCalledTimes(1)
    })

    it('does not retry a commit-ambiguous 5xx response', async () => {
        // Arrange
        postMock.mockResolvedValue(mockResponse(503, { error: 'temporary' }))

        // Act + Assert
        await expect(prepareDashboardEasyParcelOnlyFixture(request, {
            maxAttempts: 3,
            retryDelayMs: 0,
        })).rejects.toThrow('rejected (503)')
        expect(postMock).toHaveBeenCalledTimes(1)
    })

    it('retries a safe rate-limit response', async () => {
        // Arrange
        postMock
            .mockResolvedValueOnce(mockResponse(429, { error: 'rate limited' }))
            .mockResolvedValueOnce(mockResponse(200, {
                status: 'shipping-state-ready',
                shippingSetupCapability: 'dashboard-shipping-fixture-v2',
                siteIds: ['51'],
            }))

        // Act
        const result = await prepareDashboardEasyParcelOnlyFixture(request, {
            maxAttempts: 2,
            retryDelayMs: 0,
        })

        // Assert
        expect(result).toEqual({ siteIds: ['51'] })
        expect(postMock).toHaveBeenCalledTimes(2)
    })

    it('rejects the stale read-only capability contract', async () => {
        // Arrange
        postMock.mockResolvedValue(mockResponse(200, {
            status: 'shipping-state-ready',
            shippingSetupCapability: 'dashboard-shipping-fixture-v1',
            siteIds: ['51'],
        }))

        // Act + Assert
        await expect(prepareDashboardEasyParcelOnlyFixture(request))
            .rejects.toThrow('invalid response contract')
    })

    it('rejects duplicate site identities in a nominal success response', async () => {
        // Arrange
        postMock.mockResolvedValue(mockResponse(200, {
            status: 'shipping-state-ready',
            shippingSetupCapability: 'dashboard-shipping-fixture-v2',
            siteIds: ['51', '51'],
        }))

        // Act + Assert
        await expect(prepareDashboardEasyParcelOnlyFixture(request))
            .rejects.toThrow('invalid response contract')
    })
})
