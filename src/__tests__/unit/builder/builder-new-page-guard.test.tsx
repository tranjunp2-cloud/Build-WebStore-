/**
 * TC-F01.113 (GH-2153) — /builder/new sends an account that already has a website (or one being generated)
 * to the dashboard instead of the builder; a failed site and a brand-new account still get the form.
 * Real: the page + generationBlockReason. Faked: session, Payload, redirect, the client component.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { find, redirect } = vi.hoisted(() => ({
    find: vi.fn(),
    redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
}))

vi.mock('next/navigation', () => ({ redirect }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ find })) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn(async () => ({ id: 7, tenants: [{ tenant: 42 }] })),
    tenantIdForQuery: vi.fn(() => 42),
}))
vi.mock('@/app/(builder)/builder/new/AIBuilderPageClient', () => ({ default: () => null }))

import AIBuilderPage from '@/app/(builder)/builder/new/page'
import { getCurrentUser, tenantIdForQuery } from '@/lib/auth'

const sitesInDb = (...docs: Array<Record<string, unknown>>) => find.mockResolvedValue({ docs })

describe('/builder/new — existing website guard [TC-F01.113]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(tenantIdForQuery).mockReturnValue(42)
    })

    it('redirects to the dashboard when the account has a completed site', async () => {
        sitesInDb({ generationStatus: 'completed', updatedAt: new Date().toISOString() })

        await expect(AIBuilderPage()).rejects.toThrow('NEXT_REDIRECT:/dashboard')
    })

    it('redirects to the generating dashboard state while a generation is running', async () => {
        sitesInDb({ generationStatus: 'generating', updatedAt: new Date().toISOString() })

        await expect(AIBuilderPage()).rejects.toThrow('NEXT_REDIRECT:/dashboard?ai_status=generating')
    })

    it('shows the builder when the only generating site is stale (crashed run)', async () => {
        sitesInDb({ generationStatus: 'generating', updatedAt: new Date(Date.now() - 30 * 60_000).toISOString() })

        await expect(AIBuilderPage()).resolves.toBeTruthy()
        expect(redirect).not.toHaveBeenCalled()
    })

    it('shows the builder for an account without a site, and only looks at completed/generating rows', async () => {
        sitesInDb()

        await expect(AIBuilderPage()).resolves.toBeTruthy()
        expect(find).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'sites',
            where: { and: [{ tenant: { equals: 42 } }, { generationStatus: { in: ['completed', 'generating'] } }] },
        }))
    })

    it('skips the lookup when the visitor has no tenant', async () => {
        vi.mocked(getCurrentUser).mockResolvedValueOnce(null as never)
        vi.mocked(tenantIdForQuery).mockReturnValueOnce(null)

        await expect(AIBuilderPage()).resolves.toBeTruthy()
        expect(find).not.toHaveBeenCalled()
    })
})
