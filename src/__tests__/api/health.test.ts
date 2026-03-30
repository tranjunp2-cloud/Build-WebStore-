import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/health/route'
import { NextRequest } from 'next/server'

// Mock payload for deep mode
vi.mock('payload', () => ({
    getPayload: vi.fn().mockResolvedValue({
        find: vi.fn().mockResolvedValue({ docs: [{ id: 1 }] }),
    }),
}))

vi.mock('@/payload.config', () => ({ default: {} }))

function createRequest(url: string) {
    return new NextRequest(new URL(url, 'http://localhost:3000'))
}

describe('/api/health', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('GET /api/health → lightweight 200 with status ok', async () => {
        const res = await GET(createRequest('/api/health'))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.status).toBe('ok')
        expect(body.timestamp).toBeDefined()
        expect(body.db).toBeUndefined() // no DB call in lightweight
    })

    it('GET /api/health?deep=1 → full diagnostic with DB check', async () => {
        const res = await GET(createRequest('/api/health?deep=1'))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.status).toBe('ok')
        expect(body.uptime).toBeDefined()
        expect(body.node).toBeDefined()
        expect(body.memory).toBeDefined()
        expect(body.memory.rss).toBeTypeOf('number')
        expect(body.db).toBeDefined()
        expect(body.db.status).toBe('connected')
        expect(body.db.latency).toBeTypeOf('number')
        expect(body.envCheck).toBeDefined()
    })

    it('GET /api/health?deep=1 → 503 when DB fails', async () => {
        const { getPayload } = await import('payload')
        vi.mocked(getPayload).mockResolvedValueOnce({
            find: vi.fn().mockRejectedValue(new Error('Connection refused')),
        } as any)

        const res = await GET(createRequest('/api/health?deep=1'))
        const body = await res.json()

        expect(res.status).toBe(503)
        expect(body.status).toBe('degraded')
        expect(body.db.status).toBe('error')
        expect(body.db.error).toContain('Connection refused')
    })
})
