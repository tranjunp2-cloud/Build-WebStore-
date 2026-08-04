import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import { getCurrentUser } from '@/lib/auth'
import { PATCH } from '@/app/api/e2e/site-status/route'

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('payload', () => ({
    getPayload: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn(),
}))

describe('PATCH /api/e2e/site-status', () => {
    const createRequest = (body: unknown) =>
        new NextRequest('http://localhost/api/e2e/site-status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })

    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('TEST_EMAIL', 'e2e-owner@example.com')
        vi.stubEnv('APP_ENV', 'staging')
        vi.mocked(getCurrentUser).mockResolvedValue({
            id: 7,
            email: 'e2e-owner@example.com',
            tenants: [{ tenant: 42, status: 'active' }],
        } as never)
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('is disabled when the server test identity is not configured', async () => {
        vi.stubEnv('TEST_EMAIL', '')

        const response = await PATCH(createRequest({ siteId: 10, status: 'published' }))

        expect(response.status).toBe(503)
        expect(getPayload).not.toHaveBeenCalled()
    })

    it('rejects an authenticated user other than TEST_EMAIL', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue({
            id: 8,
            email: 'other@example.com',
            tenants: [{ tenant: 42, status: 'active' }],
        } as never)

        const response = await PATCH(createRequest({ siteId: 10, status: 'published' }))

        expect(response.status).toBe(403)
        expect(getPayload).not.toHaveBeenCalled()
    })

    it('rejects a site outside the authenticated active tenant', async () => {
        const payload = {
            findByID: vi.fn().mockResolvedValue({ id: 10, tenant: 99, status: 'draft' }),
            update: vi.fn(),
        }
        vi.mocked(getPayload).mockResolvedValue(payload as never)

        const response = await PATCH(createRequest({ siteId: 10, status: 'published' }))

        expect(response.status).toBe(403)
        expect(payload.update).not.toHaveBeenCalled()
    })

    it('updates only status for the authenticated account-owned site', async () => {
        const payload = {
            findByID: vi.fn().mockResolvedValue({ id: 10, tenant: 42, status: 'draft' }),
            update: vi.fn().mockResolvedValue({ id: 10, status: 'published' }),
        }
        vi.mocked(getPayload).mockResolvedValue(payload as never)

        const response = await PATCH(createRequest({ siteId: '10', status: 'published' }))

        expect(response.status).toBe(200)
        expect(payload.update).toHaveBeenCalledWith({
            collection: 'sites',
            id: 10,
            data: { status: 'published' },
            depth: 0,
            overrideAccess: true,
        })
        expect(await response.json()).toEqual({
            success: true,
            data: { id: 10, status: 'published' },
        })
    })
})
