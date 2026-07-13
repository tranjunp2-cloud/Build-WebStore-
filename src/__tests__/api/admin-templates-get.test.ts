/**
 * Regression Tests — Admin Templates GET/PATCH by ID (TC-GH1535-05)
 *
 * Bug (GH #1535): GET/PATCH /api/admin/templates/[id] returned 500 on a missing id
 * (payload.findByID/update throw NotFound, withSuperAdmin has no catch). A NON-numeric
 * id additionally makes Postgres throw a cast error (22P02) that `disableErrors` does
 * NOT suppress.
 * Fix: a numeric-id guard returns 404 before touching the DB (covers non-numeric), plus
 * disableErrors (GET) / isNotFoundError catch (PATCH) map a missing numeric id → 404.
 *
 * The mock throws a realistic 22P02 for non-numeric ids and NotFound for missing numeric
 * ids — so these tests FAIL if the guard/catch is removed (they don't rely on a mock
 * that conveniently returns null).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { findByIDSpy, updateSpy } = vi.hoisted(() => ({
    findByIDSpy: vi.fn(),
    updateSpy: vi.fn(),
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({ findByID: findByIDSpy, update: updateSpy })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/admin/api-utils', () => ({
    withSuperAdmin: (handler: any) => async (req: any, ctx: any) => handler(req, ctx),
    UpdateTemplateSchema: { safeParse: (data: any) => ({ success: true, data }) },
}))

import { GET, PATCH } from '@/app/api/admin/templates/[id]/route'

const TEMPLATE = { id: 123, name: 'Test Template', category: 'business', isPremium: false }

// Realistic Payload/pg behavior: non-numeric id → 22P02 cast error (NOT suppressed by
// disableErrors); missing numeric id → NotFound (→ null when disableErrors).
function realisticFindByID({ id, disableErrors }: { id: string | number; disableErrors?: boolean }) {
    if (!/^\d+$/.test(String(id))) {
        const err: any = new Error('invalid input syntax for type integer'); err.code = '22P02'
        throw err
    }
    if (String(id) === '123') return TEMPLATE
    if (disableErrors) return null
    const err: any = new Error('Not Found'); err.name = 'NotFound'; throw err
}
function realisticUpdate({ id, data }: { id: string | number; data: any }) {
    if (!/^\d+$/.test(String(id))) {
        const err: any = new Error('invalid input syntax for type integer'); err.code = '22P02'
        throw err
    }
    if (String(id) === '123') return { id: 123, ...data }
    const err: any = new Error('Not Found'); err.name = 'NotFound'; throw err
}

const req = (method = 'GET', body?: unknown) =>
    new NextRequest(new URL('http://localhost:3000/api/admin/templates/x'), {
        method,
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

describe('GET /api/admin/templates/[id] — TC-GH1535-05', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        findByIDSpy.mockImplementation(realisticFindByID)
        updateSpy.mockImplementation(realisticUpdate)
    })

    describe('TC-GH1535-05a: missing / invalid id → 404 (never 500)', () => {
        it('missing numeric id → 404 (disableErrors → null)', async () => {
            const res = await GET(req(), ctx('999') as any)
            expect(res.status).toBe(404)
            expect((await res.json()).error).toBe('Not found')
        })

        it('non-numeric id → 404 WITHOUT hitting the DB (numeric guard)', async () => {
            const res = await GET(req(), ctx('invalid-id') as any)
            expect(res.status).toBe(404)
            // The guard must short-circuit before findByID — otherwise the 22P02 throw 500s.
            expect(findByIDSpy).not.toHaveBeenCalled()
        })

        it('empty id → 404', async () => {
            const res = await GET(req(), ctx('') as any)
            expect(res.status).toBe(404)
            expect(findByIDSpy).not.toHaveBeenCalled()
        })
    })

    describe('TC-GH1535-05b: valid id → 200', () => {
        it('existing numeric id → 200 with template data', async () => {
            const res = await GET(req(), ctx('123') as any)
            const body = await res.json()
            expect(res.status).toBe(200)
            expect(body.data.id).toBe(123)
            expect(body.data).toHaveProperty('category')
            expect(findByIDSpy).toHaveBeenCalledWith(expect.objectContaining({ disableErrors: true }))
        })
    })
})

describe('PATCH /api/admin/templates/[id] — TC-GH1535-05', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        findByIDSpy.mockImplementation(realisticFindByID)
        updateSpy.mockImplementation(realisticUpdate)
    })

    it('TC-GH1535-05d: non-numeric id → 404 WITHOUT hitting the DB', async () => {
        const res = await PATCH(req('PATCH', { name: 'x' }), ctx('abc') as any)
        expect(res.status).toBe(404)
        expect(updateSpy).not.toHaveBeenCalled()
    })

    it('TC-GH1535-05e: missing numeric id → 404 (NotFound mapped, not 500)', async () => {
        const res = await PATCH(req('PATCH', { name: 'x' }), ctx('999') as any)
        expect(res.status).toBe(404)
        expect((await res.json()).error).toBe('Not found')
    })

    it('invalid JSON body → 400', async () => {
        const res = await PATCH(req('PATCH', 'not json'), ctx('123') as any)
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('Invalid JSON body')
    })

    it('valid PATCH on existing id → 200', async () => {
        const res = await PATCH(req('PATCH', { name: 'Updated' }), ctx('123') as any)
        expect(res.status).toBe(200)
        expect((await res.json()).data).toBeDefined()
    })
})
