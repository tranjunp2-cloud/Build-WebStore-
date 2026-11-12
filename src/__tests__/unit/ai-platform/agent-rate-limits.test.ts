// @vitest-environment node
/**
 * TC-AISEC-054 — "Generate" a picture through the BFF (`POST /api/agent/media/generate`): 10 per user per hour; the
 * 11th answers 429 with `Retry-After` and a plain message and never reaches ai-platform; another user is not affected.
 * TC-AISEC-055 — attachments (`POST /api/agent/attachments` upload and `attachments/pick`, one count): 30 per user per
 * 10 minutes, 429 with `Retry-After` before the file is read; the QC load-test bypass of the shared limiter still
 * lets everything through.
 * Real: agent-proxy routing, agent-rate-limits.ts, rateLimit.ts (in-memory, no Upstash), generated-images.ts,
 * attachments.ts, upstream.ts. Faked: the agent flag, the merchant (context), ai-platform (fetch).
 */
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/ai-platform/config', () => ({ isAiAgentEnabled: vi.fn(() => true), getAiPlatformUrl: vi.fn(() => 'http://ai-platform.test') }))
vi.mock('@/lib/ai-platform/context', () => ({
    AgentAccessError: class AgentAccessError extends Error {
        constructor(message: string, readonly status: number) { super(message) }
    },
    resolveAgentActor: vi.fn(async (req: Request) => ({ user: { id: Number(req.headers.get('x-test-user') ?? 3), email: 'owner@shop.my' }, tenantId: '4', organizationId: 'org_4', role: 'owner' })),
    signAgentContextToken: vi.fn(async () => 'ctx-token'),
}))

import { handleAgentProxy } from '@/lib/ai-platform/agent-proxy'
import { AGENT_RATE_LIMITS } from '@/lib/ai-platform/agent-rate-limits'
import { clearRateLimitMap } from '@/lib/rateLimit'

const fetchMock = vi.fn()
const call = (path: string, init: { body?: BodyInit; user?: number; json?: boolean } = {}) =>
    handleAgentProxy(
        new NextRequest(`http://localhost:3000/api/agent/${path}`, {
            method: 'POST',
            headers: { host: 'localhost:3000', 'x-test-user': String(init.user ?? 3), ...(init.json ? { 'content-type': 'application/json' } : {}) },
            body: init.body,
        }),
        path.split('/'),
    )
const generate = (user?: number) => call('media/generate', { body: JSON.stringify({ prompt: 'Indigo batik scarf on linen' }), user, json: true })
const upload = (user?: number) => call('attachments', { body: new FormData(), user })
const pick = (user?: number) => call('attachments/pick', { body: '{}', user, json: true })
const imageCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/v1/images')).length

beforeEach(() => {
    clearRateLimitMap()
    delete process.env.UPSTASH_REDIS_REST_URL
    // ai-platform is down: each picture call fails (502) after it was counted
    fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ title: 'down', status: 500 }), { status: 500, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.APP_ENV
    delete process.env.QC_RATELIMIT_BYPASS_ENABLED
})

describe('picture generation limit [TC-AISEC-054]', () => {
    it('lets 10 pictures an hour through, then answers 429 with Retry-After without calling ai-platform', async () => {
        // Arrange
        for (let i = 0; i < AGENT_RATE_LIMITS.picture.limit; i += 1) expect((await generate()).status).toBe(502)
        expect(imageCalls()).toBe(10)

        // Act
        const res = await generate()

        // Assert
        expect(res.status).toBe(429)
        const retryAfter = Number(res.headers.get('retry-after'))
        expect(retryAfter).toBeGreaterThan(3500)
        expect(retryAfter).toBeLessThanOrEqual(3600)
        expect((await res.json()).detail).toBe('You generated 10 pictures in the last hour. Try again in 60 minutes.')
        expect(imageCalls()).toBe(10)
    })

    it('counts per user: another merchant still generates', async () => {
        // Arrange
        for (let i = 0; i < 10; i += 1) await generate(3)

        // Act
        const other = await generate(8)

        // Assert
        expect(other.status).toBe(502)
        expect(imageCalls()).toBe(11)
    })

    it('does not count a request refused for its input (nothing to draw)', async () => {
        // Arrange
        for (let i = 0; i < 12; i += 1) await call('media/generate', { body: JSON.stringify({ prompt: '' }), json: true })

        // Act
        const res = await generate()

        // Assert
        expect(res.status).toBe(502)
    })
})

describe('attachment upload and pick limit [TC-AISEC-055]', () => {
    it('allows 30 uploads and picks together per 10 minutes, then 429 before the file is read', async () => {
        // Arrange — empty upload / pick bodies: refused (400) after they were counted
        for (let i = 0; i < 15; i += 1) {
            expect((await upload()).status).toBe(400)
            expect((await pick()).status).toBe(400)
        }

        // Act
        const res = await upload()
        const picked = await pick()

        // Assert
        expect(res.status).toBe(429)
        expect(picked.status).toBe(429)
        expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(500)
        expect((await res.json()).detail).toBe('You attached 30 files in the last 10 minutes. Try again in 10 minutes.')
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('counts per user', async () => {
        // Arrange
        for (let i = 0; i < 30; i += 1) await upload(3)

        // Act + Assert
        expect((await upload(3)).status).toBe(429)
        expect((await upload(8)).status).toBe(400)
    })

    it('keeps the QC load-test bypass of the shared limiter', async () => {
        // Arrange
        process.env.APP_ENV = 'qc-test'
        process.env.QC_RATELIMIT_BYPASS_ENABLED = 'true'

        // Act
        const statuses = new Set<number>()
        for (let i = 0; i < 35; i += 1) statuses.add((await upload()).status)
        for (let i = 0; i < 12; i += 1) statuses.add((await generate()).status)

        // Assert
        expect([...statuses]).toEqual([400, 502])
    })
})
