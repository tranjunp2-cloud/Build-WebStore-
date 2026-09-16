import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getPayload } = vi.hoisted(() => ({ getPayload: vi.fn() }))

vi.mock('payload', () => ({ getPayload }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/admin/api-utils', () => ({
    withSuperAdmin: (handler: (request: NextRequest, context: { user: { id: number } }) => Promise<Response>) =>
        async (request: NextRequest) => handler(request, { user: { id: 1 } }),
}))

import { GET } from '@/app/api/admin/generations/[id]/route'

const context = { params: Promise.resolve({ id: '41' }) }
const request = new NextRequest('https://prime.test/api/admin/generations/41')

describe('[TC-F41-01/14] GET /api/admin/generations/:id', () => {
    it('TC-F41-14: exposes only safe, bounded debug evidence to a Super Admin', async () => {
        // Arrange
        const payload = { findByID: vi.fn().mockResolvedValue({
            id: 41, createdAt: '2026-09-15T08:00:00.000Z', endpoint: 'site-generator', lifecycle: 'terminal', outcome: 'partial_failed', recoveryStatus: 'eligible',
            user: { id: 2, firstName: 'Mai', lastName: 'Lan', email: 'mai@example.test' }, site: { id: 3, name: 'Lan Store', domain: 'https://lan.example.test', status: 'draft' },
            inputSnapshot: { businessInfo: { businessName: 'Lan Store', industry: 'Retail', shortDescription: 'Hoa', products: 'Hoa tươi' }, language: 'vi' },
            pageSummary: { expected: 2, persisted: 1, failed: 1 }, pageOutcomes: [{ pageKey: 'contact', title: 'Liên hệ', status: 'failed', errorCode: 'PAGE_FAILED' }],
            generationErrors: [{ code: 'PAGE_FAILED', locationType: 'page', userSafeMessage: 'Không thể lưu trang', sanitizedTechnicalMessage: 'safe evidence' }],
            promptText: 'do not leak', outputSnapshot: { raw: 'do not leak' }, errorLog: 'do not leak',
        }), find: vi.fn().mockResolvedValue({ docs: [] }) }
        getPayload.mockResolvedValue(payload)

        // Act
        const response = await GET(request, context)

        // Assert
        expect(response.status).toBe(200)
        const body = await response.json() as { data: Record<string, unknown> }
        expect(body.data).toMatchObject({ website: { name: 'Lan Store' }, user: { email: 'mai@example.test' }, pages: [{ title: 'Liên hệ', status: 'failed' }] })
        expect(JSON.stringify(body)).not.toContain('do not leak')
        expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'ai-generation-records', limit: 10, overrideAccess: true }))
        expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'generation_recovery_jobs', limit: 10, overrideAccess: true }))
    })

    it('TC-F41-01: rejects malformed identifiers before querying Payload', async () => {
        // Arrange
        getPayload.mockClear()

        // Act
        const response = await GET(request, { params: Promise.resolve({ id: '4.1' }) })

        // Assert
        expect(response.status).toBe(400)
        expect(getPayload).not.toHaveBeenCalled()
    })

    it('TC-F41-01: rejects non-canonical numeric identifiers before querying Payload', async () => {
        // Arrange
        getPayload.mockClear()

        // Act
        const response = await GET(request, { params: Promise.resolve({ id: '1e2' }) })

        // Assert
        expect(response.status).toBe(400)
        expect(getPayload).not.toHaveBeenCalled()
    })

    it('TC-F41-01: returns a safe 404 when the requested record does not exist', async () => {
        // Arrange
        getPayload.mockResolvedValue({ findByID: vi.fn().mockRejectedValue(Object.assign(new Error('missing'), { status: 404 })), find: vi.fn() })

        // Act
        const response = await GET(request, context)

        // Assert
        expect(response.status).toBe(404)
        expect(await response.json()).toEqual({ error: 'Not found' })
    })

    it('TC-F41-14: reports a record-read outage as 500 rather than a false 404', async () => {
        // Arrange
        getPayload.mockResolvedValue({ findByID: vi.fn().mockRejectedValue(new Error('database unavailable')), find: vi.fn() })

        // Act
        const response = await GET(request, context)

        // Assert
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({ error: 'Unable to load generation detail' })
    })

    it('TC-F41-14: reports a Payload initialization outage as a safe 500 response', async () => {
        // Arrange
        getPayload.mockRejectedValue(new Error('database initialization unavailable'))

        // Act
        const response = await GET(request, context)

        // Assert
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({ error: 'Unable to load generation detail' })
    })

    it('TC-F41-14: does not misreport a retry-history persistence failure as a missing generation', async () => {
        // Arrange
        getPayload.mockResolvedValue({ findByID: vi.fn().mockResolvedValue({ id: 41, createdAt: '2026-09-15T08:00:00.000Z' }), find: vi.fn().mockRejectedValue(new Error('database unavailable')) })

        // Act
        const response = await GET(request, context)

        // Assert
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({ error: 'Unable to load generation detail' })
    })
})
