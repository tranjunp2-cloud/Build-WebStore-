import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { queueGenerationRecovery, getPayload } = vi.hoisted(() => ({
    queueGenerationRecovery: vi.fn(),
    getPayload: vi.fn(),
}))

vi.mock('payload', () => ({ getPayload }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/ai/generation-recovery', () => ({ queueGenerationRecovery }))
vi.mock('@/lib/admin/api-utils', () => ({
    withSuperAdmin: (handler: (request: Request, context: { user: { id: number } }) => Promise<Response>) =>
        async (request: Request) => handler(request, { user: { id: 2 } }), withStudioPermission: (_permission: string, handler: never) => ((handler: (request: Request, context: { user: { id: number } }) => Promise<Response>) =>
        async (request: Request) => handler(request, { user: { id: 2 } }))(handler), withStudioSeat: (handler: (request: Request, context: { user: { id: number } }) => Promise<Response>) =>
        async (request: Request) => handler(request, { user: { id: 2 } }), studioForbidden: () => new Response(null, { status: 403 }),
}))

import { POST } from '@/app/api/admin/generations/[id]/retry/route'

const idempotencyKey = '6ca7f9b7-c398-4c26-9925-1e9c6cd7d572'
const context = { params: Promise.resolve({ id: '41' }) }

function request(headers: Record<string, string> = {}, body: unknown = { reason: 'ops_manual_retry' }) {
    return new NextRequest('https://prime.test/api/admin/generations/41/retry', {
        method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
    })
}

describe('[TC-F41-09–10] POST /api/admin/generations/:id/retry', () => {
    it('TC-F41-09: returns the canonical queued child with 202', async () => {
        // Arrange
        getPayload.mockResolvedValue({})
        queueGenerationRecovery.mockResolvedValue({ kind: 'accepted', jobId: '99', parentGenerationId: '41', childGenerationId: '42', idempotent: false })

        // Act
        const response = await POST(request({ 'idempotency-key': idempotencyKey }), context)

        // Assert
        expect(response.status).toBe(202)
        expect(await response.json()).toMatchObject({ jobId: '99', parentGenerationId: '41', childGenerationId: '42', recoveryStatus: 'retrying' })
        expect(queueGenerationRecovery).toHaveBeenCalledWith({}, { parentGenerationId: 41, requestedBy: 2, idempotencyKey })
    })

    it('TC-F41-10: rejects malformed retry input before it can enqueue a job', async () => {
        // Arrange
        getPayload.mockClear()
        queueGenerationRecovery.mockClear()

        // Act
        const response = await POST(request({}, { reason: 'unsupported' }), context)

        // Assert
        expect(response.status).toBe(400)
        expect(queueGenerationRecovery).not.toHaveBeenCalled()
        expect(getPayload).not.toHaveBeenCalled()
    })
})
