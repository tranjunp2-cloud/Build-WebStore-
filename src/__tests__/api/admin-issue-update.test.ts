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
        async (request: NextRequest, context: { params?: { id?: string } }) => mocks.guard(handler, request, context),
}))

import { PATCH } from '@/app/api/admin/issues/[id]/route'

const context = { params: { id: '91' } }
const request = () => new NextRequest('https://prime.test/api/admin/issues/91', {
    method: 'PATCH',
    body: JSON.stringify({ status: 'done' }),
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

    it('marks the linked generation ready for operator verification when a ticket reaches Done', async () => {
        const response = await PATCH(request(), context)

        expect(response.status).toBe(200)
        expect(mocks.update).toHaveBeenNthCalledWith(1, expect.objectContaining({
            collection: 'template-issues', data: { status: 'done' },
        }))
        expect(mocks.update).toHaveBeenNthCalledWith(2, expect.objectContaining({
            collection: 'ai-generation-records', data: { recoveryStatus: 'ticket_verification_required' },
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
