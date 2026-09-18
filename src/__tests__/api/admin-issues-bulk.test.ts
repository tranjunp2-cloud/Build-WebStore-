import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    findByID: vi.fn(),
    update: vi.fn(),
    guard: vi.fn(),
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({ findByID: mocks.findByID, update: mocks.update })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/admin/api-utils', () => ({
    withSuperAdmin: (handler: (request: NextRequest) => Promise<Response>) =>
        async (request: NextRequest) => mocks.guard(handler, request),
}))

import { POST } from '@/app/api/admin/issues/bulk/route'

function request(body: unknown) {
    return new NextRequest('https://prime.test/api/admin/issues/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
}

describe('[TC-F41-05] POST /api/admin/issues/bulk assignment invariants', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.guard.mockImplementation((handler, req) => handler(req))
        mocks.findByID.mockResolvedValue({ id: 91, status: 'backlog', relatedType: 'manual' })
        mocks.update.mockResolvedValue({ id: 91 })
    })

    it('assigns only the DEV team target and clears a legacy personal owner', async () => {
        const response = await POST(request({ ids: [91], action: 'assign', assignmentTarget: 'dev' }))

        expect(response.status).toBe(200)
        expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'template-issues', id: 91, data: { assignmentTarget: 'dev', assignedTo: null },
        }))
    })

    it('rejects the legacy named-assignee request shape', async () => {
        const response = await POST(request({ ids: [91], action: 'assign', assignedTo: 7 }))

        expect(response.status).toBe(422)
        expect(mocks.update).not.toHaveBeenCalled()
    })
})
