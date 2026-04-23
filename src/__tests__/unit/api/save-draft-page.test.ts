/**
 * Unit Tests: PATCH /api/sites/[siteId]/save — draft page resolution (BUG-724)
 * TC-ID: TC-F05-01-11, TC-F05-01-12
 * Convention: docs/TEST_CONVENTION.md
 *
 * Root cause: findByID without draft:true only returns published pages. A 404
 * page that was never published (_status:'draft') was not found, silently falling
 * back to the homepage — saving edits to the wrong page.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH } from '@/app/api/sites/[siteId]/save/route'
import { NextRequest } from 'next/server'

vi.mock('@payload-config', () => ({ default: {} }))

const { mockFindByID, mockFind, mockUpdate } = vi.hoisted(() => ({
    mockFindByID: vi.fn(),
    mockFind: vi.fn(),
    mockUpdate: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'owner@example.com',
        tenants: [{ tenant: 'tenant-1' }],
    }),
}))

vi.mock('payload', () => ({
    getPayload: vi.fn().mockResolvedValue({
        findByID: mockFindByID,
        find: mockFind,
        update: mockUpdate,
    }),
}))

vi.mock('@/lib/rateLimit', () => ({
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 59, resetAt: Date.now() + 60000 }),
}))

vi.mock('@/lib/payload-retry', () => ({
    withPayloadRetry: vi.fn().mockImplementation(async (fn: () => unknown) => fn()),
    classifyTransientError: vi.fn().mockReturnValue(false),
}))

vi.mock('@/lib/ai/media-injector', () => ({
    stripOrphanMediaRefs: vi.fn().mockImplementation(async (blocks: unknown[]) => ({ stripped: 0, checked: blocks.length })),
    cleanupNonNumericImageFields: vi.fn(),
}))

vi.mock('@/lib/block-normalization', () => ({
    normalizeBlocksForPersistence: vi.fn((blocks: unknown[]) => blocks),
}))

const makeReq = (siteId: string, pageId: string | null, body: Record<string, unknown>) => {
    const url = pageId
        ? `http://localhost:3000/api/sites/${siteId}/save?pageId=${pageId}`
        : `http://localhost:3000/api/sites/${siteId}/save`
    return new NextRequest(url, {
        method: 'PATCH',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    })
}

const makeParams = (siteId: string) => ({ params: Promise.resolve({ siteId }) })

describe('PATCH /api/sites/[siteId]/save — draft page resolution (BUG-724)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUpdate.mockResolvedValue({})
        mockFind.mockResolvedValue({ docs: [] })
    })

    it('TC-F05-01-11 — saves to draft-only page (never published) via draft:true lookup', async () => {
        // Arrange — site owned by tenant-1, page is draft-only (_status:'draft')
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })  // site lookup
            .mockResolvedValueOnce({ id: '42', site: 1, _status: 'draft', layout: [] })  // page lookup with draft:true

        const blocks = [{ blockType: 'hero', headline: 'New text' }]
        const res = await PATCH(makeReq('1', '42', { blocks, isDraft: true }), makeParams('1'))

        expect(res.status).toBe(200)

        // Verify findByID was called with draft:true for the page lookup
        expect(mockFindByID).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'pages',
            id: '42',
            draft: true,
        }))

        // Verify update targets the correct page (42), not the homepage
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'pages',
            id: '42',
            data: expect.objectContaining({ layout: blocks }),
            draft: true,
        }))

        // Homepage fallback must NOT be called
        expect(mockFind).not.toHaveBeenCalled()
    })

    it('TC-F05-01-12 — returns 404 when pageId given but page not found (no homepage fallback)', async () => {
        // Arrange — site found, but page lookup returns null (page does not exist)
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })  // site lookup
            .mockResolvedValueOnce(null)  // page not found

        const blocks = [{ blockType: 'hero', headline: 'Lost edit' }]
        const res = await PATCH(makeReq('1', '999', { blocks, isDraft: true }), makeParams('1'))

        expect(res.status).toBe(404)
        const body = await res.json()
        expect(body.error).toMatch(/page not found/i)
        expect(body.pageId).toBe('999')

        // Ensure we did NOT fall back to saving on the homepage
        expect(mockUpdate).not.toHaveBeenCalled()
        expect(mockFind).not.toHaveBeenCalled()
    })

    it('TC-F05-01-12b — returns 404 when page belongs to different site (tenant isolation)', async () => {
        // Arrange — page exists but belongs to siteId=2, not siteId=1
        mockFindByID
            .mockResolvedValueOnce({ id: 'site-1', tenant: 'tenant-1' })  // site lookup
            .mockResolvedValueOnce({ id: '42', site: 2, _status: 'draft', layout: [] })  // page for different site

        const blocks = [{ blockType: 'hero', headline: 'Attacker edit' }]
        const res = await PATCH(makeReq('1', '42', { blocks, isDraft: true }), makeParams('1'))

        expect(res.status).toBe(404)
        const body = await res.json()
        expect(body.error).toMatch(/page not found/i)

        expect(mockUpdate).not.toHaveBeenCalled()
    })
})
