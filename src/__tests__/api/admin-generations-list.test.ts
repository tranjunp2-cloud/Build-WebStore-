import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { findSpy, getCurrentUserSpy } = vi.hoisted(() => ({
    findSpy: vi.fn(),
    getCurrentUserSpy: vi.fn(),
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({ find: findSpy })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: getCurrentUserSpy }))

import { GET } from '@/app/api/admin/generations/route'

const fixture = (id: string, recoveryStatus: string | null, createdAt: string, extra: Record<string, unknown> = {}) => ({
    id,
    createdAt,
    lifecycle: recoveryStatus === 'stale_running' ? 'running' : 'terminal',
    outcome: recoveryStatus === 'none' ? 'succeeded' : 'failed',
    recoveryStatus,
    user: { id: 'u-1', email: 'operator@example.com' },
    site: { id: 's-1', name: 'Demo site' },
    pageSummary: { expected: 5, persisted: 4, failed: 1 },
    generationErrors: [{
        code: 'PAGE_PERSISTENCE_FAILED', phase: 'page_persist', locationType: 'page', locationKey: 'about',
        operatorMessage: 'Normalized page persistence failure token=private-operator-token',
        userSafeMessage: 'Chúng tôi chưa thể hoàn thiện một trang của website.',
    }],
    ...extra,
})

const request = (query = '') => new NextRequest(`http://localhost:3000/api/admin/generations${query}`)

describe('GET /api/admin/generations', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        findSpy.mockResolvedValue({ docs: [] })
        getCurrentUserSpy.mockResolvedValue({ id: 'admin-1', roles: ['super-admin'] })
    })

    it('TC-F41-01: denies unauthenticated and non-Super-Admin callers without querying records', async () => {
        // Arrange
        getCurrentUserSpy.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'user-1', roles: ['user'] })

        // Act
        const anonymous = await GET(request())
        const regularUser = await GET(request())

        // Assert
        expect(anonymous.status).toBe(401)
        expect(regularUser.status).toBe(403)
        expect(findSpy).not.toHaveBeenCalled()
    })

    it('TC-F41-06: defaults to Needs Attention and returns deterministic recovery priority order', async () => {
        // Arrange
        findSpy.mockResolvedValue({ docs: [
            fixture('history', 'none', '2026-09-15T13:00:00.000Z'),
            fixture('retrying', 'retrying', '2026-09-15T11:00:00.000Z'),
            fixture('eligible', 'eligible', '2026-09-15T10:00:00.000Z'),
            fixture('stale', 'stale_running', '2026-09-15T09:00:00.000Z'),
            fixture('ticket', 'ticket_required', '2026-09-15T08:00:00.000Z'),
        ] })

        // Act
        const response = await GET(request())
        const body = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(body.items.map((item: { id: string }) => item.id)).toEqual(['ticket', 'eligible', 'retrying', 'stale'])
        expect(findSpy).toHaveBeenCalledTimes(5)
        for (const call of findSpy.mock.calls) {
            expect(call[0]).toMatchObject({
                collection: 'ai-generation-records', sort: '-createdAt,-id', page: 1, depth: 1,
            })
            expect(call[0]).not.toHaveProperty('pagination')
            expect(call[0].limit).toBeLessThanOrEqual(51)
        }
    })

    it('TC-F41-07: returns only safe list fields, including for a document with raw legacy fields', async () => {
        // Arrange
        findSpy.mockResolvedValue({ docs: [fixture('safe', 'eligible', '2026-09-15T10:00:00.000Z', {
            promptText: 'customer confidential prompt',
            inputSnapshot: { secret: 'private input' },
            outputSnapshot: { provider: 'private output' },
            errorLog: 'raw stack trace',
        })] })

        // Act
        const response = await GET(request())
        const body = await response.json()
        const serialized = body.items[0] as Record<string, unknown>

        // Assert
        expect(response.status).toBe(200)
        expect(serialized).toMatchObject({ id: 'safe', recoveryStatus: 'eligible', pageSummary: { expected: 5, persisted: 4, failed: 1 } })
        expect(serialized).not.toHaveProperty('promptText')
        expect(serialized).not.toHaveProperty('inputSnapshot')
        expect(serialized).not.toHaveProperty('outputSnapshot')
        expect(serialized).not.toHaveProperty('errorLog')
        // The list deliberately uses a generic, product-owned copy instead of
        // persisted error text, which may be historical or contain request data.
        expect((serialized.affectedError as { summary: string }).summary).toBe('Đã ghi nhận lỗi. Xem chi tiết để xử lý.')
        expect(JSON.stringify(serialized)).not.toContain('private-operator-token')
    })

    it('TC-F41-07: rejects malformed cursor and returns a stable next cursor for valid pages', async () => {
        // Arrange
        findSpy.mockResolvedValue({ docs: [
            fixture(100, 'ticket_required', '2026-09-15T12:00:00.000Z'),
            fixture(99, 'eligible', '2026-09-15T11:00:00.000Z'),
        ] })

        // Act
        const firstResponse = await GET(request('?limit=1'))
        const firstBody = await firstResponse.json()
        const nextResponse = await GET(request(`?limit=1&cursor=${encodeURIComponent(firstBody.nextCursor)}`))
        const nextBody = await nextResponse.json()
        const invalidResponse = await GET(request('?cursor=not-a-cursor'))

        // Assert
        expect(firstResponse.status).toBe(200)
        expect(firstBody.items.map((item: { id: string }) => item.id)).toEqual(['100'])
        expect(firstBody.nextCursor).toEqual(expect.any(String))
        expect(nextResponse.status).toBe(200)
        expect(nextBody.items.map((item: { id: string }) => item.id)).toEqual(['99'])
        expect(nextBody.nextCursor).toBeNull()
        expect(invalidResponse.status).toBe(400)
    })

    it('TC-F41-07: advances through equal timestamps by numeric generation ID', async () => {
        // Arrange — 9 is after 10 in descending numeric order. A string
        // comparator incorrectly evaluates "9" < "10" as false and drops it.
        const createdAt = '2026-09-15T12:00:00.000Z'
        findSpy.mockResolvedValue({ docs: [
            fixture(10, 'ticket_required', createdAt),
            fixture(9, 'ticket_required', createdAt),
        ] })

        // Act
        const firstResponse = await GET(request('?limit=1'))
        const firstBody = await firstResponse.json()
        const nextResponse = await GET(request(`?limit=1&cursor=${encodeURIComponent(firstBody.nextCursor)}`))
        const nextBody = await nextResponse.json()

        // Assert
        expect(firstBody.items.map((item: { id: string }) => item.id)).toEqual(['10'])
        expect(nextResponse.status).toBe(200)
        expect(nextBody.items.map((item: { id: string }) => item.id)).toEqual(['9'])
        expect(nextBody.nextCursor).toBeNull()
        expect(findSpy.mock.calls[1]?.[0].where).toMatchObject({
            and: expect.arrayContaining([{ or: expect.arrayContaining([
                { and: [{ createdAt: { equals: createdAt } }, { id: { less_than: 10 } }] },
            ]) }]),
        })
    })

    it('TC-F41-07: rejects a cursor when its normalized filters do not match', async () => {
        // Arrange
        findSpy.mockResolvedValue({ docs: [
            fixture(100, 'ticket_required', '2026-09-15T12:00:00.000Z'),
            fixture(99, 'eligible', '2026-09-15T11:00:00.000Z'),
        ] })
        const firstResponse = await GET(request('?limit=1'))
        const firstBody = await firstResponse.json()

        // Act
        const response = await GET(request(`?limit=1&status=failed&cursor=${encodeURIComponent(firstBody.nextCursor)}`))

        // Assert
        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toMatchObject({ error: { code: 'VALIDATION_ERROR' } })
    })

    it('TC-F41-08: accepts non-numeric text search without adding an integer ID predicate', async () => {
        // Arrange — PostgreSQL integer IDs reject arbitrary text comparisons.
        findSpy.mockResolvedValue({ docs: [fixture('safe', 'eligible', '2026-09-15T10:00:00.000Z')] })

        // Act
        const response = await GET(request('?search=site-generator'))

        // Assert
        expect(response.status).toBe(200)
        const serializedWhere = JSON.stringify(findSpy.mock.calls.map(([args]) => args.where))
        expect(serializedWhere).toContain('site-generator')
        expect(serializedWhere).not.toContain('"id":{"equals":"site-generator"}')
        expect(serializedWhere).not.toContain('"id":{"equals":null}')
    })

    it('TC-F41-09: applies combined operational filters before querying every attention bucket', async () => {
        // Arrange
        findSpy.mockResolvedValue({ docs: [fixture('filtered', 'eligible', '2026-09-15T10:00:00.000Z')] })
        const query = '?status=failed&recoveryStatus=eligible&userId=u-77&siteId=s-88&dateFrom=2026-09-01T00%3A00%3A00.000Z&dateTo=2026-09-16T00%3A00%3A00.000Z&search=trace-41'

        // Act
        const response = await GET(request(query))

        // Assert
        expect(response.status).toBe(200)
        // Search now resolves user/site display names in two bounded relation
        // queries before it queries the five recovery-priority buckets.
        expect(findSpy).toHaveBeenCalledTimes(7)
        expect(findSpy.mock.calls[0]?.[0]).toMatchObject({ collection: 'users', limit: 51, pagination: false, depth: 0 })
        expect(findSpy.mock.calls[1]?.[0]).toMatchObject({ collection: 'sites', limit: 51, pagination: false, depth: 0 })
        for (const [args] of findSpy.mock.calls.slice(2)) {
            // `combineWhere` nests its clauses, so assert the full set is
            // present without coupling this contract test to that shape.
            const where = JSON.stringify(args.where)
            expect(where).toContain('"status":{"equals":"failed"}')
            expect(where).toContain('"recoveryStatus":{"equals":"eligible"}')
            expect(where).toContain('"user":{"equals":"u-77"}')
            expect(where).toContain('"site":{"equals":"s-88"}')
            expect(where).toContain('"greater_than_equal":"2026-09-01T00:00:00.000Z"')
            expect(where).toContain('"less_than_equal":"2026-09-16T00:00:00.000Z"')
            expect(where).toContain('"traceId":{"like":"trace-41"}')
        }
    })

    it('TC-F41-09: searches user and website labels through bounded relation IDs', async () => {
        // Arrange — relationship fields are ID-backed; label matching must be
        // resolved first instead of relying on adapter-specific dot paths.
        findSpy
            .mockResolvedValueOnce({ docs: [{ id: 'user-linh' }] })
            .mockResolvedValueOnce({ docs: [{ id: 'site-linh' }] })
            .mockResolvedValue({ docs: [fixture('matched', 'eligible', '2026-09-15T10:00:00.000Z')] })

        // Act
        const response = await GET(request('?search=Linh'))

        // Assert
        expect(response.status).toBe(200)
        expect(findSpy.mock.calls[0]?.[0]).toMatchObject({
            collection: 'users', where: { or: expect.arrayContaining([{ firstName: { like: 'Linh' } }]) },
        })
        expect(findSpy.mock.calls[1]?.[0]).toMatchObject({ collection: 'sites', where: { name: { like: 'Linh' } } })
        for (const [args] of findSpy.mock.calls.slice(2)) {
            const where = JSON.stringify(args.where)
            expect(where).toContain('"user":{"in":["user-linh"]}')
            expect(where).toContain('"site":{"in":["site-linh"]}')
        }
    })

    it('TC-F41-09: rejects a broad relation-label search instead of silently truncating matching generations', async () => {
        // Arrange — the 51st relation match proves the 50-ID bounded query is
        // incomplete. The API must require a narrower term before it queries
        // generation records.
        const tooManyUsers = Array.from({ length: 51 }, (_, index) => ({ id: `user-${index}` }))
        findSpy.mockImplementation(({ collection }: { collection: string }) => {
            if (collection === 'users') return Promise.resolve({ docs: tooManyUsers })
            if (collection === 'sites') return Promise.resolve({ docs: [] })
            return Promise.reject(new Error('generation query must not run for broad relation search'))
        })

        // Act
        const response = await GET(request('?search=an'))

        // Assert
        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toMatchObject({ error: { code: 'SEARCH_TOO_BROAD' } })
        expect(findSpy.mock.calls.every(([args]) => args.collection !== 'ai-generation-records')).toBe(true)
    })

    it('TC-F41-10: serializes absent user and site relations as Unknown without throwing', async () => {
        // Arrange — deleted relations are valid historic generation records.
        findSpy.mockResolvedValue({ docs: [fixture('orphaned', 'ticket_required', '2026-09-15T10:00:00.000Z', {
            user: null,
            site: null,
        })] })

        // Act
        const response = await GET(request())
        const body = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(body.items[0]).toMatchObject({
            user: { id: null, label: 'Unknown', missing: true },
            site: { id: null, label: 'Unknown', missing: true },
        })
    })
})
