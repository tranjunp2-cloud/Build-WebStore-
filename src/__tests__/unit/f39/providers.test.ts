import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSentryErrors } from '@/lib/admin/live-errors/providers/sentry'
import { fetchVercelErrors } from '@/lib/admin/live-errors/providers/vercel'

function stubSentryEnv() {
    vi.stubEnv('SENTRY_READ_TOKEN', 'synthetic-sentry-token')
    vi.stubEnv('SENTRY_ORG', 'synthetic-org')
    vi.stubEnv('SENTRY_PROJECT', 'synthetic-project')
    vi.stubEnv('SENTRY_ENVIRONMENT', 'production')
}

function stubVercelEnv() {
    vi.stubEnv('VERCEL_TOKEN', 'synthetic-vercel-token')
    vi.stubEnv('VERCEL_TEAM_ID', 'team_synthetic')
    vi.stubEnv('VERCEL_PROJECT_ID', 'project_synthetic')
}

afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
})

// ── TC-F39-AC01,03–05,11: Bounded provider adapters ────────────────────────
describe('[TC-F39-AC01,03–05,11] provider adapters', () => {
    it('normalizes a bounded Sentry issue list without exposing native fields', async () => {
        // Arrange
        stubSentryEnv()
        const providerResponse = [{
            id: '9001',
            lastSeen: '2026-07-28T08:00:00.000Z',
            level: 'error',
            title: 'Synthetic Sentry failure',
            permalink: 'https://sentry.io/organizations/synthetic-org/issues/9001/',
            user: { email: 'excluded@example.test' },
            metadata: { arbitrary: 'must-not-survive' },
        }]
        const fetchMock = vi.fn(async () => new Response(JSON.stringify(providerResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }))

        // Act
        const result = await fetchSentryErrors(undefined, fetchMock)
        const serialized = JSON.stringify(result)

        // Assert
        expect(result.data).toHaveLength(1)
        expect(result.data[0]).toMatchObject({
            source: 'sentry',
            providerId: '9001',
            message: 'Synthetic Sentry failure',
            providerUrl: 'https://sentry.io/organizations/synthetic-org/issues/9001/',
        })
        expect(serialized).not.toContain('excluded@example.test')
        expect(serialized).not.toContain('must-not-survive')
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(String(fetchMock.mock.calls[0]?.[0])).toContain('is%3Aunresolved')
    })

    it('fetches only the selected Sentry latest event and caps in-app frames', async () => {
        // Arrange
        stubSentryEnv()
        const latestEvent = {
            groupID: '9001',
            dateCreated: '2026-07-28T08:00:00.000Z',
            level: 'error',
            title: 'Latest synthetic event',
            entries: [{
                type: 'exception',
                data: {
                    values: [{
                        stacktrace: {
                            frames: Array.from({ length: 7 }, (_, index) => ({
                                function: `handler${index}`,
                                module: 'app.route',
                                filename: '/app/route.ts',
                                lineNo: index + 1,
                                inApp: true,
                                vars: { secret: 'excluded' },
                            })),
                        },
                    }],
                },
            }],
        }
        const fetchMock = vi.fn(async () => new Response(JSON.stringify(latestEvent), {
            status: 200,
        }))

        // Act
        const result = await fetchSentryErrors('9001', fetchMock)

        // Assert
        expect(result.data).toHaveLength(1)
        expect(result.data[0]?.frames).toHaveLength(5)
        expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/issues/9001/events/latest/')
    })

    it('resolves current production deployment then keeps only qualifying Vercel rows', async () => {
        // Arrange
        stubVercelEnv()
        const deployments = { deployments: [{ uid: 'dpl_synthetic' }] }
        const logs = [
            {
                level: 'info',
                message: 'Healthy request',
                rowId: 'row-1',
                source: 'serverless',
                timestampInMs: 1_753_689_600_000,
                domain: 'shop.primeweb.app',
                requestMethod: 'GET',
                requestPath: '/health?secret=excluded',
                responseStatusCode: 200,
            },
            {
                level: 'error',
                message: 'authorization=synthetic-secret',
                rowId: 'row-2',
                source: 'serverless',
                timestampInMs: 1_753_689_700_000,
                domain: 'Shop.PrimeWeb.App:443',
                requestMethod: 'POST',
                requestPath: '/api/orders?token=excluded',
                responseStatusCode: 500,
            },
        ]
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify(deployments), { status: 200 }))
            .mockResolvedValueOnce(new Response(logs.map(log => JSON.stringify(log)).join('\n'), { status: 200 }))

        // Act
        const result = await fetchVercelErrors(undefined, fetchMock)
        const item = result.data[0]

        // Assert
        expect(result.data).toHaveLength(1)
        expect(item).toMatchObject({
            source: 'vercel',
            host: 'shop.primeweb.app',
            route: '/api/orders',
            method: 'POST',
            statusCode: 500,
            deploymentId: 'dpl_synthetic',
        })
        expect(item?.providerId).toMatch(/^[a-f0-9]{64}$/)
        expect(item?.message).toBe('authorization=[REDACTED]')
        expect(String(fetchMock.mock.calls[0]?.[0])).toContain('target=production')
        expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/runtime-logs')
    })

    it('distinguishes provider authorization failure from empty success', async () => {
        // Arrange
        stubSentryEnv()
        const fetchMock = vi.fn(async () => new Response('', { status: 403 }))

        // Act
        const result = fetchSentryErrors(undefined, fetchMock)

        // Assert
        await expect(result).rejects.toMatchObject({
            source: 'sentry',
            code: 'unauthorized',
            status: 502,
        })
    })
})
