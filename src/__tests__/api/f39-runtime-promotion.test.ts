import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    user: {
        current: { id: 1, roles: ['super-admin'] as string[] } as {
            id: number
            roles: string[]
        } | null,
    },
    fetchProviderEvidence: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn(async () => mocks.user.current),
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        find: mocks.find,
        create: mocks.create,
    })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/admin/live-errors/fetch-provider-evidence', () => ({
    fetchProviderEvidence: mocks.fetchProviderEvidence,
}))

import { NextRequest } from 'next/server'
import type { LiveError } from '@/lib/admin/live-errors/contracts'
import { LiveErrorProviderError } from '@/lib/admin/live-errors/contracts'
import { POST } from '@/app/api/admin/issues/route'

const guidance: LiveError['guidance'] = {
    category: 'http-500-503',
    investigationArea: 'Application route, dependency, or recent deployment',
    checks: [
        'Inspect the top application frame',
        'Compare the first occurrence with the latest deployment',
    ],
    escalationCondition:
        'Escalate when the application frame is unavailable or the deployment comparison is inconclusive',
    label: 'Suggested next checks',
}

function liveError(overrides: Partial<LiveError> = {}): LiveError {
    return {
        source: 'sentry',
        providerId: '9001',
        occurredAt: '2026-07-28T08:00:00.000Z',
        severity: 'high',
        message: 'Server-authoritative failure',
        host: 'coffee.primeweb.app',
        tenantMatch: { id: '42', slug: 'coffee', name: 'Coffee' },
        route: '/api/orders',
        method: 'POST',
        statusCode: 500,
        release: 'release-1',
        deploymentId: null,
        requestId: 'req-shared',
        traceId: 'trace-shared',
        frames: [],
        providerUrl: 'https://sentry.io/organizations/example/issues/9001/',
        guidance,
        ...overrides,
    }
}

function request(body: unknown): NextRequest {
    return new NextRequest('http://localhost/api/admin/issues', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    })
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.user.current = { id: 1, roles: ['super-admin'] }
    mocks.find.mockResolvedValue({
        docs: [],
        totalDocs: 0,
        totalPages: 0,
    })
    mocks.create.mockResolvedValue({
        id: 77,
        title: 'Sentry: Server-authoritative failure',
        relatedType: 'runtime',
        relatedId: 'sentry:9001',
    })
    mocks.fetchProviderEvidence.mockResolvedValue({
        data: liveError(),
        fetchedAt: '2026-07-28T08:01:00.000Z',
    })
})

// ── TC-F39-AC12,15: Server-authoritative runtime promotion ─────────────────
describe('[TC-F39-AC12,15] POST /api/admin/issues runtime promotion', () => {
    it('refetches provider evidence and persists only the server-normalized snapshot', async () => {
        // Arrange
        const untrustedBrowserEvidence = {
            relatedType: 'runtime',
            source: 'sentry',
            providerId: '9001',
            message: 'browser-controlled secret',
            host: 'attacker.example',
        }

        // Act
        const response = await POST(request(untrustedBrowserEvidence))
        const body = await response.json()

        // Assert
        expect(response.status).toBe(201)
        expect(body.created).toBe(true)
        expect(mocks.fetchProviderEvidence).toHaveBeenCalledWith('sentry', '9001')
        expect(mocks.create).toHaveBeenCalledWith({
            collection: 'template-issues',
            data: expect.objectContaining({
                title: 'sentry: Server-authoritative failure',
                severity: 'high',
                category: 'other',
                status: 'backlog',
                relatedType: 'runtime',
                relatedId: 'sentry:9001',
                description: expect.stringContaining('Server-authoritative failure'),
            }),
        })
        const createCall = mocks.create.mock.calls[0]?.[0] as {
            data: { description: string }
        }
        expect(createCall.data.description).not.toContain('browser-controlled secret')
        expect(createCall.data.description).not.toContain('attacker.example')
    })

    it('returns a provider error without writing a partial issue', async () => {
        // Arrange
        mocks.fetchProviderEvidence.mockRejectedValue(
            new LiveErrorProviderError('sentry', 'timeout'),
        )

        // Act
        const response = await POST(request({
            relatedType: 'runtime',
            source: 'sentry',
            providerId: '9001',
        }))
        const body = await response.json()

        // Assert
        expect(response.status).toBe(504)
        expect(body).toEqual({
            error: 'Provider unavailable',
            source: 'sentry',
            code: 'timeout',
        })
        expect(mocks.find).not.toHaveBeenCalled()
        expect(mocks.create).not.toHaveBeenCalled()
    })
})

// ── TC-F39-AC13: Exact duplicate and concurrent-promotion safety ───────────
describe('[TC-F39-AC13] runtime promotion idempotency', () => {
    it('returns the exact existing runtime issue before create', async () => {
        // Arrange
        const existing = {
            id: 81,
            relatedType: 'runtime',
            relatedId: 'sentry:9001',
        }
        mocks.find.mockResolvedValue({
            docs: [existing],
            totalDocs: 1,
            totalPages: 1,
        })

        // Act
        const response = await POST(request({
            relatedType: 'runtime',
            source: 'sentry',
            providerId: '9001',
        }))
        const body = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(body).toEqual({ data: existing, created: false })
        expect(mocks.create).not.toHaveBeenCalled()
    })

    it('recovers a concurrent unique-index race by returning the winning issue', async () => {
        // Arrange
        const winner = {
            id: 82,
            relatedType: 'runtime',
            relatedId: 'sentry:9001',
        }
        mocks.find
            .mockResolvedValueOnce({ docs: [], totalDocs: 0, totalPages: 0 })
            .mockResolvedValueOnce({ docs: [winner], totalDocs: 1, totalPages: 1 })
        const uniqueError = Object.assign(new Error('duplicate key'), {
            cause: { code: '23505' },
        })
        mocks.create.mockRejectedValue(uniqueError)

        // Act
        const response = await POST(request({
            relatedType: 'runtime',
            source: 'sentry',
            providerId: '9001',
        }))
        const body = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(body).toEqual({ data: winner, created: false })
        expect(mocks.find).toHaveBeenCalledTimes(2)
        expect(mocks.create).toHaveBeenCalledTimes(1)
    })
})

// ── TC-F39-GATE-01: Promotion remains Sentry-only until stable refetch ──────
describe('[TC-F39-GATE-01] runtime promotion delivery gate', () => {
    it('rejects Vercel promotion before any provider read or database write', async () => {
        // Arrange
        const unrefetchableVercelIdentity = {
            relatedType: 'runtime',
            source: 'vercel',
            providerId: 'a'.repeat(64),
        }

        // Act
        const response = await POST(request(unrefetchableVercelIdentity))

        // Assert
        expect(response.status).toBe(422)
        expect(mocks.fetchProviderEvidence).not.toHaveBeenCalled()
        expect(mocks.find).not.toHaveBeenCalled()
        expect(mocks.create).not.toHaveBeenCalled()
    })

    it('does not persist submitted cross-provider evidence on Sentry promotion', async () => {
        // Arrange
        const submittedRelated = {
            relatedType: 'runtime',
            source: 'sentry',
            providerId: '9001',
            related: {
                source: 'vercel',
                providerId: 'b'.repeat(64),
            },
        }

        // Act
        const response = await POST(request(submittedRelated))

        // Assert
        expect(response.status).toBe(201)
        expect(mocks.fetchProviderEvidence).toHaveBeenCalledTimes(1)
        expect(mocks.fetchProviderEvidence).toHaveBeenCalledWith('sentry', '9001')
        const createCall = mocks.create.mock.calls[0]?.[0] as {
            data: { description: string }
        }
        expect(createCall.data.description).not.toContain('Related vercel evidence')
    })
})
