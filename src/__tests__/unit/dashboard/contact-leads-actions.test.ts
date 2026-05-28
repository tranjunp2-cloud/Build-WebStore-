/**
 * Customers Server Actions — TC-CUST-16 through TC-CUST-25, TC-CUST-30..31
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { getCurrentTenantId } from '@/lib/auth'
import { getPayload } from 'payload'
import {
    getCustomersAction,
    updateContactStatusAction,
    deleteCustomerAction,
    exportCustomersCsvAction,
} from '@/app/(dashboard)/contact-leads/actions'

vi.mock('@/lib/auth', () => ({ getCurrentTenantId: vi.fn() }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))

type MockPayload = { find: Mock; update: Mock; delete: Mock; findByID: Mock }

const TENANT_ID = 'tenant-123'
const SITE_ID = 10

const siteDoc = { id: SITE_ID }
const contactDoc = {
    id: 1, name: 'Alice', email: 'alice@example.com', phone: null,
    message: 'Hi', status: 'new', site: SITE_ID, createdAt: '2026-01-01T00:00:00.000Z',
}
const subscriberDoc = {
    id: 2, email: 'bob@example.com', site: SITE_ID, createdAt: '2026-01-02T00:00:00.000Z',
}

describe('[TC-CUST-16..19] getCustomersAction', () => {
    let mockPayload: MockPayload

    beforeEach(() => {
        vi.clearAllMocks()
        mockPayload = { find: vi.fn(), update: vi.fn(), delete: vi.fn(), findByID: vi.fn() }
        vi.mocked(getPayload).mockResolvedValue(mockPayload as never)
        mockPayload.find.mockResolvedValue({ docs: [] })
    })

    it('[TC-CUST-16] throws Unauthorized when no tenant', async () => {
        vi.mocked(getCurrentTenantId).mockResolvedValue(null)
        await expect(getCustomersAction()).rejects.toThrow(/Unauthorized/i)
    })

    it('[TC-CUST-17] fetches sites + both contact-submissions and subscribers by default', async () => {
        vi.mocked(getCurrentTenantId).mockResolvedValue(TENANT_ID)
        mockPayload.find
            .mockResolvedValueOnce({ docs: [siteDoc] })      // getTenantSiteIds
            .mockResolvedValueOnce({ docs: [contactDoc] })    // contact-submissions
            .mockResolvedValueOnce({ docs: [subscriberDoc] }) // subscribers
        const res = await getCustomersAction()
        expect(res.data).toHaveLength(2)
        expect(mockPayload.find).toHaveBeenCalledTimes(3)
    })

    it('[TC-CUST-18] source=newsletter skips contact-submissions', async () => {
        vi.mocked(getCurrentTenantId).mockResolvedValue(TENANT_ID)
        mockPayload.find
            .mockResolvedValueOnce({ docs: [siteDoc] })       // getTenantSiteIds
            .mockResolvedValueOnce({ docs: [subscriberDoc] }) // subscribers
        await getCustomersAction({ source: 'newsletter' })
        expect(mockPayload.find).toHaveBeenCalledTimes(2)
        expect(mockPayload.find).toHaveBeenCalledWith(
            expect.objectContaining({ collection: 'subscribers' }),
        )
    })

    it('[TC-CUST-19] status=new skips newsletter (always subscribed — mismatch)', async () => {
        vi.mocked(getCurrentTenantId).mockResolvedValue(TENANT_ID)
        mockPayload.find
            .mockResolvedValueOnce({ docs: [siteDoc] })    // getTenantSiteIds
            .mockResolvedValueOnce({ docs: [contactDoc] }) // contact-submissions
        await getCustomersAction({ status: 'new' })
        expect(mockPayload.find).toHaveBeenCalledTimes(2)
        expect(mockPayload.find).toHaveBeenCalledWith(
            expect.objectContaining({ collection: 'contact-submissions' }),
        )
    })

    it('[TC-CUST-30] status=read skips newsletter query (read is contact-only)', async () => {
        vi.mocked(getCurrentTenantId).mockResolvedValue(TENANT_ID)
        mockPayload.find
            .mockResolvedValueOnce({ docs: [siteDoc] })    // getTenantSiteIds
            .mockResolvedValueOnce({ docs: [contactDoc] }) // contact-submissions only
        await getCustomersAction({ status: 'read' })
        expect(mockPayload.find).toHaveBeenCalledTimes(2)
        const calls = vi.mocked(mockPayload.find).mock.calls.map(c => c[0] as { collection: string })
        expect(calls.some(c => c.collection === 'subscribers')).toBe(false)
    })

    it('[TC-CUST-31] status=subscribed skips contact-submissions query (subscribed is newsletter-only)', async () => {
        vi.mocked(getCurrentTenantId).mockResolvedValue(TENANT_ID)
        mockPayload.find
            .mockResolvedValueOnce({ docs: [siteDoc] })       // getTenantSiteIds
            .mockResolvedValueOnce({ docs: [subscriberDoc] }) // subscribers only
        await getCustomersAction({ status: 'subscribed' })
        expect(mockPayload.find).toHaveBeenCalledTimes(2)
        const calls = vi.mocked(mockPayload.find).mock.calls.map(c => c[0] as { collection: string })
        expect(calls.some(c => c.collection === 'contact-submissions')).toBe(false)
    })
})

describe('[TC-CUST-20..21] updateContactStatusAction', () => {
    let mockPayload: MockPayload

    beforeEach(() => {
        vi.clearAllMocks()
        mockPayload = { find: vi.fn(), update: vi.fn(), delete: vi.fn(), findByID: vi.fn() }
        vi.mocked(getPayload).mockResolvedValue(mockPayload as never)
        vi.mocked(getCurrentTenantId).mockResolvedValue(TENANT_ID)
    })

    it('[TC-CUST-20] maps display "contacted" → DB "replied" on update', async () => {
        mockPayload.findByID
            .mockResolvedValueOnce(contactDoc)                           // source record
            .mockResolvedValueOnce({ ...contactDoc, status: 'replied' }) // after update
        mockPayload.find
            .mockResolvedValueOnce({ docs: [siteDoc] })    // getTenantSiteIds
            .mockResolvedValueOnce({ docs: [contactDoc] }) // siblings
        mockPayload.update.mockResolvedValue({ ...contactDoc, status: 'replied' })

        await updateContactStatusAction(1, 'contacted')

        expect(mockPayload.update).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'contact-submissions',
                id: 1,
                data: { status: 'replied' },
            }),
        )
    })

    it('[TC-CUST-21] throws for invalid display status', async () => {
        await expect(updateContactStatusAction(1, 'subscribed')).rejects.toThrow(/Invalid status/i)
    })
})

describe('[TC-CUST-22..24] deleteCustomerAction', () => {
    let mockPayload: MockPayload

    beforeEach(() => {
        vi.clearAllMocks()
        mockPayload = { find: vi.fn(), update: vi.fn(), delete: vi.fn(), findByID: vi.fn() }
        vi.mocked(getPayload).mockResolvedValue(mockPayload as never)
        vi.mocked(getCurrentTenantId).mockResolvedValue(TENANT_ID)
        mockPayload.delete.mockResolvedValue({})
    })

    it('[TC-CUST-22] deletes from contact-submissions for source=contact-form', async () => {
        mockPayload.findByID.mockResolvedValueOnce(contactDoc)
        mockPayload.find.mockResolvedValueOnce({ docs: [siteDoc] })

        await deleteCustomerAction(1, 'contact-form')

        expect(mockPayload.delete).toHaveBeenCalledWith(
            expect.objectContaining({ collection: 'contact-submissions', id: 1 }),
        )
    })

    it('[TC-CUST-23] deletes from subscribers for source=newsletter', async () => {
        mockPayload.findByID.mockResolvedValueOnce(subscriberDoc)
        mockPayload.find.mockResolvedValueOnce({ docs: [siteDoc] })

        await deleteCustomerAction(2, 'newsletter')

        expect(mockPayload.delete).toHaveBeenCalledWith(
            expect.objectContaining({ collection: 'subscribers', id: 2 }),
        )
    })

    it('[TC-CUST-24] throws for invalid source', async () => {
        await expect(deleteCustomerAction(1, 'unknown')).rejects.toThrow(/Invalid source/i)
    })
})

describe('[TC-CUST-25] exportCustomersCsvAction', () => {
    let mockPayload: MockPayload

    beforeEach(() => {
        vi.clearAllMocks()
        mockPayload = { find: vi.fn(), update: vi.fn(), delete: vi.fn(), findByID: vi.fn() }
        vi.mocked(getPayload).mockResolvedValue(mockPayload as never)
        vi.mocked(getCurrentTenantId).mockResolvedValue(TENANT_ID)
        mockPayload.find.mockResolvedValue({ docs: [] })
    })

    it('[TC-CUST-25] returns CSV string with header line', async () => {
        mockPayload.find.mockResolvedValueOnce({ docs: [siteDoc] }) // getTenantSiteIds
        const csv = await exportCustomersCsvAction({})
        expect(typeof csv).toBe('string')
        expect(csv.split('\n')[0]).toContain('"ID"')
    })
})
