import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    fetchSentryErrors: vi.fn(),
    fetchVercelErrors: vi.fn(),
    resolveTenant: vi.fn(),
}))

vi.mock('@/lib/admin/live-errors/providers/sentry', () => ({
    fetchSentryErrors: mocks.fetchSentryErrors,
}))

vi.mock('@/lib/admin/live-errors/providers/vercel', () => ({
    fetchVercelErrors: mocks.fetchVercelErrors,
}))

vi.mock('@/lib/admin/live-errors/resolve-tenant', () => ({
    resolveTenant: mocks.resolveTenant,
}))

import type { LiveError } from '@/lib/admin/live-errors/contracts'
import { fetchProviderEvidence } from '@/lib/admin/live-errors/fetch-provider-evidence'

const guidance: LiveError['guidance'] = {
    category: 'unmatched',
    investigationArea: 'Provider evidence requires manual investigation',
    checks: ['Open the provider event', 'Inspect route, timestamp, and adjacent logs'],
    escalationCondition:
        'Escalate when the provider event lacks the route, status, or application frame needed to classify it',
    label: 'Suggested next checks',
}

function error(providerId: string, host: string | null): LiveError {
    return {
        source: 'sentry',
        providerId,
        occurredAt: '2026-07-28T08:00:00.000Z',
        severity: 'high',
        message: `Failure ${providerId}`,
        host,
        tenantMatch: null,
        route: null,
        method: null,
        statusCode: null,
        release: null,
        deploymentId: null,
        requestId: null,
        traceId: null,
        frames: [],
        providerUrl: null,
        guidance,
    }
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveTenant.mockResolvedValue({
        id: '42',
        slug: 'coffee',
        name: 'Coffee',
    })
})

afterEach(() => {
    vi.useRealTimers()
})

// ── TC-F39-AC01,06–08: Provider selection and honest tenant enrichment ─────
describe('[TC-F39-AC01,06–08] fetchProviderEvidence', () => {
    it('enriches list rows and resolves the same hostname only once per request', async () => {
        // Arrange
        mocks.fetchSentryErrors.mockResolvedValue({
            data: [
                error('9001', 'coffee.primeweb.app'),
                error('9002', 'coffee.primeweb.app'),
                error('9003', null),
            ],
            fetchedAt: '2026-07-28T08:01:00.000Z',
        })

        // Act
        const result = await fetchProviderEvidence('sentry')

        // Assert
        expect(mocks.fetchSentryErrors).toHaveBeenCalledWith(undefined)
        expect(mocks.fetchVercelErrors).not.toHaveBeenCalled()
        expect(mocks.resolveTenant).toHaveBeenCalledTimes(1)
        expect(result.data).toEqual([
            expect.objectContaining({
                providerId: '9001',
                tenantMatch: { id: '42', slug: 'coffee', name: 'Coffee' },
            }),
            expect.objectContaining({
                providerId: '9002',
                tenantMatch: { id: '42', slug: 'coffee', name: 'Coffee' },
            }),
            expect.objectContaining({
                providerId: '9003',
                tenantMatch: null,
            }),
        ])
    })

    it('returns one detail object and isolates tenant lookup failure as Unknown', async () => {
        // Arrange
        mocks.resolveTenant.mockRejectedValue(new Error('tenant cache unavailable'))
        mocks.fetchSentryErrors.mockResolvedValue({
            data: [error('9001', 'unknown.example')],
            fetchedAt: '2026-07-28T08:01:00.000Z',
        })

        // Act
        const result = await fetchProviderEvidence('sentry', '9001')

        // Assert
        expect(mocks.fetchSentryErrors).toHaveBeenCalledWith('9001')
        expect(result.data).toMatchObject({
            source: 'sentry',
            providerId: '9001',
            tenantMatch: null,
        })
    })

    it('fails closed before reopening a Vercel stream for item refetch', async () => {
        // Arrange — a Vercel content hash cannot yet identify the same streamed row.

        // Act
        const result = fetchProviderEvidence('vercel', 'a'.repeat(64))

        // Assert
        await expect(result).rejects.toMatchObject({
            source: 'vercel',
            code: 'unavailable',
            status: 502,
        })
        expect(mocks.fetchVercelErrors).not.toHaveBeenCalled()
        expect(mocks.resolveTenant).not.toHaveBeenCalled()
    })

    it('fails closed when a requested provider detail is absent', async () => {
        // Arrange
        mocks.fetchSentryErrors.mockResolvedValue({
            data: [],
            fetchedAt: '2026-07-28T08:01:00.000Z',
        })

        // Act
        const result = fetchProviderEvidence('sentry', 'missing')

        // Assert
        await expect(result).rejects.toMatchObject({
            source: 'sentry',
            code: 'not-found',
            status: 502,
        })
    })

    it('bounds tenant enrichment to four concurrent lookups and a one-second budget', async () => {
        // Arrange
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-07-28T08:00:00.000Z'))
        const errors = Array.from({ length: 10 }, (_, index) =>
            error(String(9_100 + index), `tenant-${index}.primeweb.app`),
        )
        mocks.fetchSentryErrors.mockResolvedValue({
            data: errors,
            fetchedAt: '2026-07-28T08:00:00.000Z',
        })
        mocks.resolveTenant.mockImplementation(
            () => new Promise(() => undefined),
        )

        // Act
        const resultPromise = fetchProviderEvidence('sentry')
        await vi.advanceTimersByTimeAsync(1_000)
        const result = await resultPromise

        // Assert
        expect(mocks.resolveTenant).toHaveBeenCalledTimes(4)
        expect(result.data).toEqual(
            errors.map(item => expect.objectContaining({
                providerId: item.providerId,
                tenantMatch: null,
            })),
        )
    })
})
