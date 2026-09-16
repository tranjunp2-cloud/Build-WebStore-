import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    findByID: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    guard: vi.fn(),
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        findByID: mocks.findByID,
        find: mocks.find,
        create: mocks.create,
        update: mocks.update,
    })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/admin/api-utils', () => ({
    withSuperAdmin: (handler: (request: NextRequest) => Promise<Response>) =>
        async (request: NextRequest) => mocks.guard(handler, request),
}))

import { POST } from '@/app/api/admin/generations/[id]/issue/route'

const request = new NextRequest('https://prime.test/api/admin/generations/41/issue', { method: 'POST' })
const context = { params: Promise.resolve({ id: '41' }) }

function ticketEligibleGeneration(overrides: Record<string, unknown> = {}) {
    return {
        id: 41,
        createdAt: '2026-09-16T00:00:00.000Z',
        lifecycle: 'terminal',
        outcome: 'failed',
        recoveryStatus: 'ticket_required',
        traceId: 'tr_generation_issue_41',
        inputSnapshot: { businessInfo: { businessName: 'Private florist name', shortDescription: 'private@example.test' } },
        promptText: 'prompt must never reach an issue',
        generationErrors: [{
            phase: 'persist_page', locationType: 'page', locationKey: 'contact', locationLabel: 'Contact page from raw payload',
            code: 'PAGE_GENERATION_FAILED', category: 'system', userSafeMessage: 'Không thể lưu trang', sanitizedTechnicalMessage: 'Database write timed out',
        }],
        pageSummary: { expected: 5, persisted: 4, failed: 1 },
        ...overrides,
    }
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.findByID.mockResolvedValue(ticketEligibleGeneration())
    mocks.find.mockResolvedValue({ docs: [] })
    mocks.create.mockResolvedValue({ id: 91 })
    mocks.update.mockResolvedValue({ id: 41 })
    mocks.guard.mockImplementation((handler: (request: NextRequest) => Promise<Response>, guardedRequest: NextRequest) => handler(guardedRequest))
})

describe('[TC-F41-21/22/29] POST /api/admin/generations/:id/issue', () => {
    it('TC-F41-21: creates a server-derived ticket with only sanitized incident context', async () => {
        // Arrange

        // Act
        const response = await POST(request, context)
        const body = await response.json() as { data: { id: string; created: boolean; href: string } }

        // Assert
        expect(response.status).toBe(201)
        expect(body.data).toEqual({ id: '91', created: true, href: '/studio/issues?relatedType=generation&relatedId=41' })
        expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'template-issues', overrideAccess: true,
            data: expect.objectContaining({
                category: 'ai-quality', status: 'open', relatedType: 'generation', relatedId: '41',
                dedupeKey: expect.stringMatching(/^f41i_[a-f0-9]{64}$/),
            }),
        }))
        const created = mocks.create.mock.calls[0]?.[0] as { data: { description: string } }
        expect(created.data.description).toContain('Trace ID: tr_generation_issue_41')
        expect(created.data.description).not.toContain('private@example.test')
        expect(created.data.description).not.toContain('Private florist name')
        expect(created.data.description).not.toContain('prompt must never reach an issue')
        expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'ai-generation-records',
            where: expect.objectContaining({
                and: expect.arrayContaining([
                    { or: [{ id: { equals: '41' } }, { retryRootGeneration: { equals: '41' } }] },
                ]),
            }),
            data: { recoveryStatus: 'ticket_created' },
        }))
    })

    it('TC-F41-22: returns the existing ticket without inserting a duplicate', async () => {
        // Arrange
        mocks.find.mockImplementation(async ({ collection }: { collection: string }) => (
            collection === 'template-issues' ? { docs: [{ id: 92, relatedId: '7' }] } : { docs: [] }
        ))

        // Act
        const response = await POST(request, context)
        const body = await response.json() as { data: { id: string; created: boolean } }

        // Assert
        expect(response.status).toBe(200)
        expect(body.data).toMatchObject({ id: '92', created: false, href: '/studio/issues?relatedType=generation&relatedId=7' })
        expect(mocks.create).not.toHaveBeenCalled()
    })

    it('TC-F41-22: recovers a unique-index race by returning the concurrent winner', async () => {
        // Arrange
        let issueFinds = 0
        mocks.find.mockImplementation(async ({ collection }: { collection: string }) => {
            if (collection !== 'template-issues') return { docs: [] }
            issueFinds += 1
            return issueFinds === 1 ? { docs: [] } : { docs: [{ id: 93 }] }
        })
        mocks.create.mockRejectedValue(Object.assign(new Error('duplicate key'), { cause: { code: '23505' } }))

        // Act
        const response = await POST(request, context)
        const body = await response.json() as { data: { id: string; created: boolean } }

        // Assert
        expect(response.status).toBe(200)
        expect(body.data).toMatchObject({ id: '93', created: false })
        expect(mocks.create).toHaveBeenCalledTimes(1)
    })

    it('TC-F41-22: marks the retry root and all ticket-eligible siblings as escalated', async () => {
        // Arrange
        mocks.findByID.mockResolvedValue(ticketEligibleGeneration({
            id: 43,
            retryRootGeneration: { id: 41 },
            recoveryStatus: 'exhausted',
        }))

        // Act
        const response = await POST(request, context)
        const body = await response.json() as { data: { href: string } }

        // Assert
        expect(response.status).toBe(201)
        expect(body.data.href).toBe('/studio/issues?relatedType=generation&relatedId=41')
        expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ relatedId: '41' }),
        }))
        expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                and: [
                    { or: [{ id: { equals: '41' } }, { retryRootGeneration: { equals: '41' } }] },
                    { or: [{ recoveryStatus: { equals: 'ticket_required' } }, { recoveryStatus: { equals: 'exhausted' } }] },
                ],
            },
            data: { recoveryStatus: 'ticket_created' },
        }))
    })

    it('TC-F41-29: rejects a non-ticket-eligible generation without creating an issue', async () => {
        // Arrange
        mocks.findByID.mockResolvedValue(ticketEligibleGeneration({ recoveryStatus: 'eligible' }))

        // Act
        const response = await POST(request, context)
        const body = await response.json() as { error: { code: string } }

        // Assert
        expect(response.status).toBe(409)
        expect(body.error.code).toBe('NOT_TICKET_ELIGIBLE')
        expect(mocks.create).not.toHaveBeenCalled()
        expect(mocks.update).not.toHaveBeenCalled()
    })

    it('TC-F41-01: denies a non-Super-Admin before loading generation existence', async () => {
        // Arrange
        mocks.guard.mockResolvedValue(new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }))

        // Act
        const response = await POST(request, context)

        // Assert
        expect(response.status).toBe(403)
        expect(mocks.findByID).not.toHaveBeenCalled()
    })
})
