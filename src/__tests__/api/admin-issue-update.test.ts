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
    withSuperAdmin: (handler: (request: NextRequest, context: { params?: { id?: string } }) => Promise<Response>) =>
        async (request: NextRequest, context: { params?: { id?: string } }) => mocks.guard(handler, request, context), withStudioPermission: (_permission: string, handler: never) => ((handler: (request: NextRequest, context: { params?: { id?: string } }) => Promise<Response>) =>
        async (request: NextRequest, context: { params?: { id?: string } }) => mocks.guard(handler, request, context))(handler), withStudioSeat: (handler: (request: NextRequest, context: { params?: { id?: string } }) => Promise<Response>) =>
        async (request: NextRequest, context: { params?: { id?: string } }) => mocks.guard(handler, request, context), studioForbidden: () => new Response(null, { status: 403 }),
}))

import { PATCH } from '@/app/api/admin/issues/[id]/route'

const context = { params: { id: '91' }, user: { roles: ['super-admin'] } }
const request = (status = 'done') => new NextRequest('https://prime.test/api/admin/issues/91', {
    method: 'PATCH',
    body: JSON.stringify({ status }),
    headers: { 'Content-Type': 'application/json' },
})

const namedAssigneeRequest = () => new NextRequest('https://prime.test/api/admin/issues/91', {
    method: 'PATCH',
    body: JSON.stringify({ assignedTo: 7 }),
    headers: { 'Content-Type': 'application/json' },
})

describe('[TC-F41-05] PATCH /api/admin/issues/:id completion handoff', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.guard.mockImplementation((handler, req, ctx) => handler(req, ctx))
        mocks.findByID.mockResolvedValue({ id: 91, status: 'in_progress', relatedType: 'generation', relatedId: '41' })
        mocks.update.mockImplementation(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => (
            collection === 'template-issues' ? { id: 91, status: data.status ?? 'in_progress' } : { id: 41 }
        ))
    })

    it('marks the linked generation ready for operator verification when Dev marks it fixed', async () => {
        const response = await PATCH(request('dev_fixed'), context)

        expect(response.status).toBe(200)
        expect(mocks.update).toHaveBeenNthCalledWith(1, expect.objectContaining({
            collection: 'template-issues', data: { status: 'dev_fixed' },
        }))
        expect(mocks.update).toHaveBeenNthCalledWith(2, expect.objectContaining({
            collection: 'ai-generation-records', data: { recoveryStatus: 'ticket_verification_required' },
        }))
    })

    it('marks the linked generation as being checked when QA Testing starts', async () => {
        const response = await PATCH(request('testing'), context)
        expect(response.status).toBe(200)
        expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({
            collection: 'ai-generation-records', data: { recoveryStatus: 'operator_verifying' },
        }))
    })

    it('rolls the ticket back when the generation handoff cannot be persisted', async () => {
        mocks.update
            .mockResolvedValueOnce({ id: 91, status: 'done' })
            .mockRejectedValueOnce(new Error('database unavailable'))
            .mockResolvedValueOnce({ id: 91, status: 'in_progress' })

        const response = await PATCH(request(), context)

        expect(response.status).toBe(503)
        expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({
            collection: 'template-issues', data: { status: 'in_progress' },
        }))
    })

    it('rejects legacy named-owner input instead of silently accepting an unsupported assignment', async () => {
        const response = await PATCH(namedAssigneeRequest(), context)

        expect(response.status).toBe(422)
        expect(mocks.update).not.toHaveBeenCalled()
    })
})
