import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    find: vi.fn(),
    create: vi.fn(),
    guard: vi.fn(),
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({ find: mocks.find, create: mocks.create })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/admin/api-utils', () => ({
    withSuperAdmin: (handler: (request: NextRequest) => Promise<Response>) =>
        async (request: NextRequest) => mocks.guard(handler, request),
}))

import { POST } from '@/app/api/admin/issues/route'

function request(body: unknown) {
    return new NextRequest('https://prime.test/api/admin/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

describe('[TC-F41-05] POST /api/admin/issues ticket creation invariants', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.guard.mockImplementation((handler, req) => handler(req))
        mocks.find.mockResolvedValue({ totalDocs: 1, docs: [{ id: 41 }] })
        mocks.create.mockResolvedValue({ id: 91, relatedType: 'generation', relatedId: '41', assignmentTarget: 'dev' })
    })

    it('keeps a generation relation instead of falling through to a manual ticket', async () => {
        const response = await POST(request({
            title: 'Không thể lưu website', description: 'Bug report', relatedType: 'generation', relatedId: '41', assignmentTarget: 'dev',
        }))

        expect(response.status).toBe(201)
        expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'template-issues',
            data: expect.objectContaining({ relatedType: 'generation', relatedId: '41', assignmentTarget: 'dev' }),
        }))
    })

    it('rejects a named assignee so the API matches the DEV/unassigned board rule', async () => {
        const response = await POST(request({ title: 'Không thể lưu website', description: 'Bug report', assignedTo: 7 }))

        expect(response.status).toBe(422)
        expect(mocks.create).not.toHaveBeenCalled()
    })
})
