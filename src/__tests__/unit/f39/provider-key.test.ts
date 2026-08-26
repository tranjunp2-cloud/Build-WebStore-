import { describe, expect, it } from 'vitest'
import type { LiveError } from '@/lib/admin/live-errors/contracts'
import {
    createVercelProviderKey,
    getExactCorrelationId,
    getRuntimeRelatedId,
} from '@/lib/admin/live-errors/provider-key'

function error(overrides: Partial<LiveError> = {}): LiveError {
    return {
        source: 'vercel',
        providerId: 'provider-id',
        occurredAt: '2026-07-28T08:00:00.000Z',
        severity: 'high',
        message: 'Synthetic failure',
        host: 'shop.primeweb.app',
        tenantMatch: null,
        route: '/api/orders',
        method: 'POST',
        statusCode: 500,
        release: null,
        deploymentId: 'dpl_test',
        requestId: null,
        traceId: null,
        frames: [],
        providerUrl: 'https://vercel.com/dashboard',
        guidance: {
            category: 'http-500-503',
            investigationArea: 'Application route, dependency, or recent deployment',
            checks: ['Inspect the top application frame', 'Compare deployments'],
            escalationCondition: 'Escalate when evidence is inconclusive',
            label: 'Suggested next checks',
        },
        ...overrides,
    }
}

// ── TC-F39-AC02,13–14: Exact identity and correlation ──────────────────────
describe('[TC-F39-AC02,13–14] provider identity', () => {
    it('creates a deterministic Vercel SHA-256 key from exact normalized fields', () => {
        // Arrange
        const item = error()

        // Act
        const first = createVercelProviderKey(item)
        const second = createVercelProviderKey({ ...item })
        const changed = createVercelProviderKey({ ...item, message: 'Different failure' })

        // Assert
        expect(first).toMatch(/^[a-f0-9]{64}$/)
        expect(second).toBe(first)
        expect(changed).not.toBe(first)
        expect(getRuntimeRelatedId(item)).toBe(`vercel:${first}`)
    })

    it('correlates only exact non-empty request or trace identifiers', () => {
        // Arrange
        const left = error({ requestId: 'req-exact', traceId: 'trace-left' })
        const requestMatch = error({ requestId: 'req-exact', traceId: 'trace-right' })
        const traceMatch = error({ requestId: 'different', traceId: 'trace-left' })
        const noMatch = error({ requestId: 'similar-req', traceId: 'trace-other' })

        // Act / Assert
        expect(getExactCorrelationId(left, requestMatch)).toBe('req-exact')
        expect(getExactCorrelationId(left, traceMatch)).toBe('trace-left')
        expect(getExactCorrelationId(left, noMatch)).toBeNull()
        expect(getExactCorrelationId(error(), error())).toBeNull()
    })
})
