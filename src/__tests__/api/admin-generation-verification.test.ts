import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ findByID: vi.fn(), find: vi.fn(), update: vi.fn(), guard: vi.fn() }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ findByID: mocks.findByID, find: mocks.find, update: mocks.update })) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/admin/api-utils', () => ({ withSuperAdmin: (handler: (request: NextRequest, context: { params?: { id?: string } }) => Promise<Response>) => async (request: NextRequest, context: { params?: { id?: string } }) => mocks.guard(handler, request, context) }))

import { PATCH } from '@/app/api/admin/generations/[id]/verification/route'

const request = (action: string) => new NextRequest('https://prime.test/api/admin/generations/41/verification', { method: 'PATCH', body: JSON.stringify({ action }), headers: { 'Content-Type': 'application/json' } })
const context = { params: { id: '41' } }

describe('[TC-F41-23] generation operator verification', () => {
    beforeEach(() => { vi.clearAllMocks(); mocks.guard.mockImplementation((handler, req, ctx) => handler(req, ctx)); mocks.update.mockResolvedValue({ id: 41 }); mocks.find.mockResolvedValue({ docs: [{ id: 9 }] }) })
    it('moves a Dev fixed handoff into QA Testing and operator verification', async () => {
        mocks.findByID.mockResolvedValue({ id: 41, recoveryStatus: 'ticket_verification_required' })
        const response = await PATCH(request('start'), context)
        expect(response.status).toBe(200)
        expect(mocks.update).toHaveBeenNthCalledWith(1, expect.objectContaining({ collection: 'template-issues', id: 9, data: { status: 'testing' } }))
        expect(mocks.update).toHaveBeenNthCalledWith(2, expect.objectContaining({ collection: 'ai-generation-records', data: { recoveryStatus: 'operator_verifying' } }))
    })
    it('reopens the ticket when operator verification fails', async () => {
        mocks.findByID.mockResolvedValue({ id: 41, recoveryStatus: 'operator_verifying' })
        const response = await PATCH(request('reopen'), context)
        expect(response.status).toBe(200)
        expect(mocks.update).toHaveBeenNthCalledWith(1, expect.objectContaining({ collection: 'template-issues', id: 9, data: { status: 'reopen' } }))
        expect(mocks.update).toHaveBeenNthCalledWith(2, expect.objectContaining({ collection: 'ai-generation-records', data: { recoveryStatus: 'ticket_created' } }))
    })
})
