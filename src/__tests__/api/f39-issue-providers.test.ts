import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    user: { current: { id: 1, roles: ['super-admin'] as string[] } as { id: number; roles: string[] } | null },
    fetchProviderEvidence: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn(async () => mocks.user.current),
}))

vi.mock('@/lib/admin/live-errors/fetch-provider-evidence', () => ({
    fetchProviderEvidence: mocks.fetchProviderEvidence,
}))

import { NextRequest } from 'next/server'
import { LiveErrorProviderError } from '@/lib/admin/live-errors/contracts'
import { GET } from '@/app/api/admin/issues/providers/route'

beforeEach(() => {
    vi.clearAllMocks()
    mocks.user.current = { id: 1, roles: ['super-admin'] }
    mocks.fetchProviderEvidence.mockResolvedValue({
        data: [],
        fetchedAt: '2026-07-28T08:00:00.000Z',
    })
})

// ── TC-F39-API-01–05: Super-admin provider read endpoint ───────────────────
describe('[TC-F39-API-01–05] GET /api/admin/issues/providers', () => {
    it('returns 401 for an unauthenticated request', async () => {
        // Arrange
        mocks.user.current = null
        const request = new NextRequest('http://localhost/api/admin/issues/providers?source=sentry')

        // Act
        const response = await GET(request)

        // Assert
        expect(response.status).toBe(401)
        expect(mocks.fetchProviderEvidence).not.toHaveBeenCalled()
    })

    it('returns 403 for a non-super-admin request', async () => {
        // Arrange
        mocks.user.current = { id: 2, roles: ['tenant-owner'] }
        const request = new NextRequest('http://localhost/api/admin/issues/providers?source=sentry')

        // Act
        const response = await GET(request)

        // Assert
        expect(response.status).toBe(403)
        expect(mocks.fetchProviderEvidence).not.toHaveBeenCalled()
    })

    it('returns 400 for an invalid source or provider id', async () => {
        // Arrange
        const invalidSource = new NextRequest('http://localhost/api/admin/issues/providers?source=other')
        const invalidId = new NextRequest('http://localhost/api/admin/issues/providers?source=sentry&id=../../secret')

        // Act
        const sourceResponse = await GET(invalidSource)
        const idResponse = await GET(invalidId)

        // Assert
        expect(sourceResponse.status).toBe(400)
        expect(idResponse.status).toBe(400)
        expect(mocks.fetchProviderEvidence).not.toHaveBeenCalled()
    })

    it('returns list and detail using server-authoritative provider identity', async () => {
        // Arrange
        mocks.fetchProviderEvidence
            .mockResolvedValueOnce({ data: [], fetchedAt: '2026-07-28T08:00:00.000Z' })
            .mockResolvedValueOnce({
                data: { source: 'sentry', providerId: '9001' },
                fetchedAt: '2026-07-28T08:01:00.000Z',
            })
        const listRequest = new NextRequest('http://localhost/api/admin/issues/providers?source=sentry')
        const detailRequest = new NextRequest('http://localhost/api/admin/issues/providers?source=sentry&id=9001')

        // Act
        const listResponse = await GET(listRequest)
        const detailResponse = await GET(detailRequest)
        const detailBody = await detailResponse.json()

        // Assert
        expect(listResponse.status).toBe(200)
        expect(detailResponse.status).toBe(200)
        expect(detailBody.data.providerId).toBe('9001')
        expect(mocks.fetchProviderEvidence).toHaveBeenNthCalledWith(1, 'sentry', undefined)
        expect(mocks.fetchProviderEvidence).toHaveBeenNthCalledWith(2, 'sentry', '9001')
        expect(detailResponse.headers.get('Cache-Control')).toBe('no-store')
    })

    it('maps timeout and provider failures to safe non-empty error responses', async () => {
        // Arrange
        mocks.fetchProviderEvidence
            .mockRejectedValueOnce(new LiveErrorProviderError('vercel', 'timeout'))
            .mockRejectedValueOnce(new LiveErrorProviderError('sentry', 'rate-limited'))
        const vercelRequest = new NextRequest('http://localhost/api/admin/issues/providers?source=vercel')
        const sentryRequest = new NextRequest('http://localhost/api/admin/issues/providers?source=sentry')

        // Act
        const timeoutResponse = await GET(vercelRequest)
        const unavailableResponse = await GET(sentryRequest)
        const timeoutBody = await timeoutResponse.json()
        const unavailableBody = await unavailableResponse.json()

        // Assert
        expect(timeoutResponse.status).toBe(504)
        expect(timeoutBody).toEqual({
            error: 'Provider unavailable',
            source: 'vercel',
            code: 'timeout',
        })
        expect(unavailableResponse.status).toBe(502)
        expect(unavailableBody.code).toBe('rate-limited')
    })
})
