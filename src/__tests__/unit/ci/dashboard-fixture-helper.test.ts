import type { APIRequestContext, APIResponse } from '@playwright/test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { provisionDashboardFixture } from '../../../../e2e/helpers/dashboard-fixture'

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
