import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// ── Mocks at top (Rule: vi.mock() top-level, never inside describe/it) ──
vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('payload', () => ({
    getPayload: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn(),
    tenantIdForQuery: vi.fn(),
}))

import { getCategoriesAction } from '@/app/(dashboard)/products/categories/actions'
import { getPayload } from 'payload'
import { getCurrentUser } from '@/lib/auth'

const mockCurrentUser = { id: 'user-123', tenants: [{ tenant: 'tenant-456' }] }

type MockPayload = { find: Mock; db: { drizzle: { execute: Mock } } }

describe('getCategoriesAction — tenant-scoped access (TC-F08-05-13)', () => {
    let mockPayload: MockPayload
    let mockFind: Mock
    let mockExecute: Mock

    beforeEach(() => {
        vi.clearAllMocks()
        mockFind = vi.fn().mockResolvedValue({ docs: [] })
        mockExecute = vi.fn().mockResolvedValue({ rows: [] })

        mockPayload = {
            find: mockFind,
            db: { drizzle: { execute: mockExecute } },
        }

        vi.mocked(getPayload).mockResolvedValue(mockPayload as any)
        vi.mocked(getCurrentUser).mockResolvedValue(mockCurrentUser as any)
    })

    it('TC-F08-05-13: passes overrideAccess:false so the tenant-scoped read access-control actually applies', async () => {
        // Regression guard: Payload's Local API defaults `overrideAccess` to `true` when omitted,
        // which silently bypasses Categories.ts's tenant-scoped `read` access control (`{tenant:
        // {in:tenantIds}}`). Without this flag, every logged-in user sees every tenant's categories
        // and aggregated cross-tenant product counts — confirmed via a real Payload Local API call
        // against local Postgres with a real multi-tenant seed (25 categories / 312 products
        // leaked across tenants for a user whose own tenant had only 4 categories / 6 products).
        await getCategoriesAction()

        expect(mockFind).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'categories',
                overrideAccess: false,
            })
        )
    })

    it('TC-F08-05-13: throws Unauthorized when no user, never calls payload.find', async () => {
        vi.mocked(getCurrentUser).mockResolvedValueOnce(null)

        await expect(getCategoriesAction()).rejects.toThrow('Unauthorized')
        expect(mockFind).not.toHaveBeenCalled()
    })
})
