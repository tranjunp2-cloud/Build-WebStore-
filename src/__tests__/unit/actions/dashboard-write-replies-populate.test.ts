/**
 * TC-PERF-130 / TC-PERF-131 — dashboard server actions that write (blog categories, blog status, product delete)
 * answer like the reads: relations populated with display fields only. The writes ran at the default depth 2 with
 * field read access off, so the reply sent the browser the whole tenant row (Xendit / EasyParcel / ECH secrets)
 * and, on a status flip, the author's user row (otpHash, keyString) — the author may be another member.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const member = { id: 'user-1', email: 'staff@shop.my', firstName: 'Aina', lastName: 'B', sessions: [{ id: 's' }],
    tenants: [{ tenant: { id: 'tenant-1', metaData: { phone: '+60123' } }, role: 'editor', status: 'active' }] }

vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn(async () => member), tenantIdForQuery: vi.fn(() => 'tenant-1') }))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(async () => ({ plan: 'PROFESSIONAL_TM_USER' })),
    canUse: vi.fn(async () => true),
    canUseWithinLimit: vi.fn(async () => true),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

const mockFind = vi.fn()
const mockFindByID = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({ find: mockFind, findByID: mockFindByID, create: mockCreate, update: mockUpdate })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { SAFE_RELATION_POPULATE } from '@/lib/payload/safe-populate'
import {
    createBlogCategoryAction, updateBlogCategoryAction, updateBlogStatusAction, getCurrentUserAction,
} from '@/app/(dashboard)/blog/actions'
import { deleteProductAction } from '@/app/(dashboard)/products/actions'

const safe = expect.objectContaining({ depth: 1, populate: SAFE_RELATION_POPULATE })

describe('dashboard write actions reply with display fields only [TC-PERF-130]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFind.mockResolvedValue({ docs: [] })
        mockFindByID.mockResolvedValue({ id: 5, tenant: 'tenant-1' })
        mockCreate.mockResolvedValue({ id: 5 })
        mockUpdate.mockResolvedValue({ id: 5 })
    })

    it('blog category create and rename populate with the safe fields', async () => {
        // Act
        await createBlogCategoryAction({ name: 'Tips' })
        await updateBlogCategoryAction('5', { name: 'Tips 2' })

        // Assert
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ collection: 'blog_categories', depth: 1, populate: SAFE_RELATION_POPULATE }))
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ collection: 'blog_categories', depth: 1, populate: SAFE_RELATION_POPULATE }))
    })

    it('blog status flip populates with the safe fields (the author may be another member)', async () => {
        // Act
        await updateBlogStatusAction('5', 'published')

        // Assert
        expect(mockUpdate).toHaveBeenCalledWith(safe)
    })

    it('getCurrentUserAction gives the editor the author name only: no sessions, no tenant metaData', async () => {
        // Act
        const shown = await getCurrentUserAction()

        // Assert
        expect(shown).toEqual({ id: 'user-1', email: 'staff@shop.my', firstName: 'Aina', lastName: 'B' })
    })
})

describe('product writes reply with tenant / site names only [TC-PERF-131]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('deleteProductAction populates tenant { name, slug } and site { name, domain }', async () => {
        // Arrange
        mockUpdate.mockResolvedValue({ id: 9 })

        // Act
        await deleteProductAction(9)

        // Assert
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'products', depth: 1,
            populate: { tenants: { name: true, slug: true }, sites: { name: true, domain: true } },
        }))
    })
})
