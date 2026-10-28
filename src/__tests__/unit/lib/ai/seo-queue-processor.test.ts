/**
 * Unit Tests: seo-queue — backgroundSeoProcessor via queueSEOAutoGeneration
 * TC-IDs: TC-F08-03-01, TC-AISEC-03
 * Convention: docs/TEST_CONVENTION.md
 *
 * Note: backgroundSeoProcessor is a private function called async (fire-and-forget).
 * We test it indirectly through queueSEOAutoGeneration by awaiting the promise
 * completion (mocked payload flushes synchronously in tests).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks (must be at top, before imports) ───────────────────────────────────

const mockFindByID = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockGetPayload = vi.fn()

vi.mock('payload', () => ({
    getPayload: (...args: unknown[]) => mockGetPayload(...args),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}))

// Inside a request, after() runs the task once the response is sent; the test runs it at once.
vi.mock('next/server', () => ({
    after: vi.fn((task: () => unknown) => {
        void task()
    }),
}))

const mockGenerateAutoSEOMeta = vi.fn()

vi.mock('@/lib/ai/generate-meta', () => ({
    generateAutoSEOMeta: (...args: unknown[]) => mockGenerateAutoSEOMeta(...args),
}))

// Platform gate + publisher membership, as seen by the processor (TC-AISEC-03).
const mockIsAiTasksEnabled = vi.fn(() => true)
const mockActorForUserInTenant = vi.fn()

vi.mock('@/lib/ai-platform/config', () => ({
    isAiTasksEnabled: () => mockIsAiTasksEnabled(),
}))

vi.mock('@/lib/ai-platform/context', () => ({
    AgentAccessError: class AgentAccessError extends Error {},
    actorForUserInTenant: (...args: unknown[]) => mockActorForUserInTenant(...args),
}))

import { queueSEOAutoGeneration } from '@/lib/ai/seo-queue'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'

// ─── Helper: flush microtasks/promises ───────────────────────────────────────

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 10))

const PUBLISHER = { id: 7, email: 'owner@shop.my', tenants: [{ tenant: { id: 1 }, status: 'active' }] }
const PUBLISHER_ACTOR = { user: PUBLISHER, tenantId: '1', organizationId: 'org_1', role: 'owner' }

// ─── TC-F08-03-01: SEO queue background processor ────────────────────────────

describe('queueSEOAutoGeneration — background processor [TC-F08-03-01]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockIsAiTasksEnabled.mockReturnValue(true)

        // Default: payload resolves successfully
        mockGetPayload.mockResolvedValue({
            findByID: mockFindByID,
            create: mockCreate,
            update: mockUpdate,
        })

        mockFindByID.mockResolvedValue({
            businessName: 'KL Cafe',
            name: 'kl-cafe',
        })

        mockCreate.mockResolvedValue({ id: 'job-42' })
        mockUpdate.mockResolvedValue({})
        mockGenerateAutoSEOMeta.mockResolvedValue({
            title: 'Nasi Lemak | KL Cafe | Buy Online Malaysia',
            description: 'Authentic Nasi Lemak at KL Cafe. Order online today!',
        })
    })

    it('resolves immediately without blocking caller [TC-F08-03-01]', async () => {
        // Arrange & Act — function should return quickly (fire-and-forget)
        const start = Date.now()
        await queueSEOAutoGeneration('pages', '123', 'site-1', 'Nasi Lemak')
        const elapsed = Date.now() - start

        // Assert — returns without waiting for background work
        expect(elapsed).toBeLessThan(100)
    })

    it('calls getPayload to access database [TC-F08-03-01]', async () => {
        // Arrange & Act
        await queueSEOAutoGeneration('pages', '99', 'site-5', 'Product Name')
        await flushPromises()

        // Assert
        expect(mockGetPayload).toHaveBeenCalledOnce()
    })

    it('fetches site by ID to get business name [TC-F08-03-01]', async () => {
        // Arrange & Act
        await queueSEOAutoGeneration('pages', '99', 'site-5', 'Teh Tarik')
        await flushPromises()

        // Assert
        expect(mockFindByID).toHaveBeenCalledWith(
            expect.objectContaining({ collection: 'sites', id: 'site-5' })
        )
    })

    it('creates a pending SEO meta job record [TC-F08-03-01]', async () => {
        // Arrange & Act
        await queueSEOAutoGeneration('pages', '55', 'site-2', 'Roti Canai')
        await flushPromises()

        // Assert
        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'seo-meta-jobs',
                data: expect.objectContaining({
                    targetCollection: 'pages',
                    targetId: '55',
                    status: 'pending',
                }),
            })
        )
    })

    it('calls generateAutoSEOMeta with page type, name, site name, and context [TC-F08-03-01]', async () => {
        // Arrange — the processor names the site from `site.name` (stale expectation fixed: was businessName)
        mockFindByID.mockResolvedValue({ name: 'Restoran ABC' })

        // Act
        await queueSEOAutoGeneration('pages', '10', 'site-3', 'Ayam Percik', 'Grilled chicken')
        await flushPromises()

        // Assert — no publisher, so no actor: the meta falls back to the template
        expect(mockGenerateAutoSEOMeta).toHaveBeenCalledWith(
            'page',
            'Ayam Percik',
            'Restoran ABC',
            'Grilled chicken',
            [],
            undefined,
            null,
            expect.anything()
        )
    })

    it('calls generateAutoSEOMeta with page type for pages collection [TC-F08-03-01]', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ name: 'MyBiz' })

        // Act
        await queueSEOAutoGeneration('pages', '20', 'site-4', 'About Us')
        await flushPromises()

        // Assert
        expect(mockGenerateAutoSEOMeta).toHaveBeenCalledWith(
            'page',
            'About Us',
            'MyBiz',
            undefined,
            [],
            undefined,
            null,
            expect.anything()
        )
    })

    it('updates the target collection with generated SEO fields [TC-F08-03-01]', async () => {
        // Arrange & Act
        await queueSEOAutoGeneration('pages', '77', 'site-6', 'Mee Goreng')
        await flushPromises()

        // Assert
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'pages',
                id: '77',
                data: expect.objectContaining({
                    seo: {
                        title: 'Nasi Lemak | KL Cafe | Buy Online Malaysia',
                        description: 'Authentic Nasi Lemak at KL Cafe. Order online today!',
                    },
                }),
            })
        )
    })

    it('marks job as completed after successful update [TC-F08-03-01]', async () => {
        // Arrange & Act
        await queueSEOAutoGeneration('pages', '88', 'site-7', 'Laksa')
        await flushPromises()

        // Assert — second update call marks job completed
        const updateCalls = mockUpdate.mock.calls
        const completedCall = updateCalls.find(
            (call) => call[0]?.collection === 'seo-meta-jobs' && call[0]?.data?.status === 'completed'
        )
        expect(completedCall).toBeDefined()
        expect(completedCall[0].id).toBe('job-42')
    })

    it('calls revalidatePath for sitemap after success [TC-F08-03-01]', async () => {
        // Arrange & Act
        await queueSEOAutoGeneration('pages', '90', 'site-8', 'Char Kway Teow')
        await flushPromises()

        // Assert
        expect(revalidatePath).toHaveBeenCalledWith('/sitemap.xml')
    })

    it('falls back to site.name when businessName is absent [TC-F08-03-01]', async () => {
        // Arrange — site has name but not businessName
        mockFindByID.mockResolvedValue({ name: 'plain-site' })

        // Act
        await queueSEOAutoGeneration('pages', '11', 'site-9', 'Product X')
        await flushPromises()

        // Assert — site name passed to meta generator
        expect(mockGenerateAutoSEOMeta).toHaveBeenCalledWith(
            'page',
            'Product X',
            'plain-site',
            undefined,
            [],
            undefined,
            null,
            expect.anything()
        )
    })

    it('falls back to "Website" when site has no name at all [TC-F08-03-01]', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({})

        // Act
        await queueSEOAutoGeneration('pages', '12', 'site-10', 'No-Name Product')
        await flushPromises()

        // Assert
        expect(mockGenerateAutoSEOMeta).toHaveBeenCalledWith(
            'page',
            'No-Name Product',
            'Website',
            undefined,
            [],
            undefined,
            null,
            expect.anything()
        )
    })
})

// ─── TC-AISEC-03: the publisher's identity decides whether AI runs ───────────

describe('queueSEOAutoGeneration — publisher actor [TC-AISEC-03]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockIsAiTasksEnabled.mockReturnValue(true)
        mockGetPayload.mockResolvedValue({ findByID: mockFindByID, create: mockCreate, update: mockUpdate })
        mockFindByID.mockResolvedValue({ name: 'KL Cafe', tenant: { id: 1 } })
        mockCreate.mockResolvedValue({ id: 'job-9' })
        mockUpdate.mockResolvedValue({})
        mockGenerateAutoSEOMeta.mockResolvedValue({ title: 'T', description: 'D' })
        mockActorForUserInTenant.mockReturnValue(PUBLISHER_ACTOR)
    })

    it('generates as the publisher in the site workspace when the platform is configured', async () => {
        await queueSEOAutoGeneration('products', '5', 'site-1', 'Teh Tarik', undefined, PUBLISHER)
        await flushPromises()

        expect(mockActorForUserInTenant).toHaveBeenCalledWith(PUBLISHER, '1')
        expect(mockGenerateAutoSEOMeta).toHaveBeenCalledWith('product', 'Teh Tarik', 'KL Cafe', undefined, [], undefined, PUBLISHER_ACTOR, expect.anything())
    })

    it('runs without an actor (template meta) when the platform is not configured', async () => {
        mockIsAiTasksEnabled.mockReturnValue(false)

        await queueSEOAutoGeneration('pages', '6', 'site-1', 'Contact', undefined, PUBLISHER)
        await flushPromises()

        expect(mockActorForUserInTenant).not.toHaveBeenCalled()
        expect(mockGenerateAutoSEOMeta).toHaveBeenCalledWith('page', 'Contact', 'KL Cafe', undefined, [], undefined, null, expect.anything())
    })

    it('runs without an actor when the publisher is not an active member of the site workspace', async () => {
        // actorForUserInTenant throws AgentAccessError(403) for non-members; the processor treats any refusal as "no actor".
        mockActorForUserInTenant.mockImplementation(() => {
            throw new Error('You are not an active member of this workspace.')
        })

        await queueSEOAutoGeneration('pages', '7', 'site-1', 'Contact', undefined, PUBLISHER)
        await flushPromises()

        expect(mockGenerateAutoSEOMeta).toHaveBeenCalledWith('page', 'Contact', 'KL Cafe', undefined, [], undefined, null, expect.anything())
    })

    it('runs without an actor when there is no publisher (imports, scripts)', async () => {
        await queueSEOAutoGeneration('pages', '8', 'site-1', 'Contact')
        await flushPromises()

        expect(mockActorForUserInTenant).not.toHaveBeenCalled()
        expect(mockGenerateAutoSEOMeta).toHaveBeenCalledWith('page', 'Contact', 'KL Cafe', undefined, [], undefined, null, expect.anything())
    })
})

// ─── Scheduling: after() inside a request, detached outside one ─────────────

describe('queueSEOAutoGeneration — scheduling [TC-F08-03-01]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockIsAiTasksEnabled.mockReturnValue(true)
        mockGetPayload.mockResolvedValue({ findByID: mockFindByID, create: mockCreate, update: mockUpdate })
        mockFindByID.mockResolvedValue({ name: 'KL Cafe' })
        mockCreate.mockResolvedValue({ id: 'job-3' })
        mockUpdate.mockResolvedValue({})
        mockGenerateAutoSEOMeta.mockResolvedValue({ title: 'T', description: 'D' })
    })

    it('hands the work to next/server after() so it survives the response', async () => {
        await queueSEOAutoGeneration('pages', '1', 'site-1', 'Laksa')
        await flushPromises()

        expect(after).toHaveBeenCalledWith(expect.any(Function))
        expect(mockGenerateAutoSEOMeta).toHaveBeenCalledOnce()
    })

    it('still runs the work detached when after() throws outside a request scope', async () => {
        vi.mocked(after).mockImplementationOnce(() => {
            throw new Error('`after` was called outside a request scope')
        })

        await expect(queueSEOAutoGeneration('pages', '2', 'site-1', 'Laksa')).resolves.toBeUndefined()
        await flushPromises()

        expect(mockGetPayload).toHaveBeenCalledOnce()
        expect(mockGenerateAutoSEOMeta).toHaveBeenCalledOnce()
    })
})

// ─── TC-F08-03-01: SEO queue error handling ──────────────────────────────────

describe('queueSEOAutoGeneration — error handling [TC-F08-03-01]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockIsAiTasksEnabled.mockReturnValue(true)

        mockGetPayload.mockResolvedValue({
            findByID: mockFindByID,
            create: mockCreate,
            update: mockUpdate,
        })

        mockFindByID.mockResolvedValue({ businessName: 'Test Biz' })
        mockCreate.mockResolvedValue({ id: 'job-err-1' })
        mockUpdate.mockResolvedValue({})
    })

    it('marks job as failed when generateAutoSEOMeta throws [TC-F08-03-01]', async () => {
        // Arrange
        mockGenerateAutoSEOMeta.mockRejectedValue(new Error('OpenAI timeout'))

        // Act
        await queueSEOAutoGeneration('pages', '50', 'site-x', 'Failed Product')
        await flushPromises()

        // Assert — update called to mark job failed
        const failCall = mockUpdate.mock.calls.find(
            (call) => call[0]?.collection === 'seo-meta-jobs' && call[0]?.data?.status === 'failed'
        )
        expect(failCall).toBeDefined()
        expect(failCall[0].data.errorLog).toContain('OpenAI timeout')
    })

    it('marks job as failed when target collection update throws [TC-F08-03-01]', async () => {
        // Arrange
        mockGenerateAutoSEOMeta.mockResolvedValue({ title: 'Title', description: 'Desc' })
        // First update (target collection) throws; second update (job status) must still be called
        mockUpdate
            .mockRejectedValueOnce(new Error('DB write failed'))
            .mockResolvedValueOnce({})

        // Act
        await queueSEOAutoGeneration('pages', '60', 'site-y', 'Error Product')
        await flushPromises()

        // Assert — job update called to log failure
        const failCall = mockUpdate.mock.calls.find(
            (call) => call[0]?.collection === 'seo-meta-jobs' && call[0]?.data?.status === 'failed'
        )
        expect(failCall).toBeDefined()
        expect(failCall[0].data.errorLog).toContain('DB write failed')
    })

    it('does not throw even if entire background processor crashes [TC-F08-03-01]', async () => {
        // Arrange — getPayload itself fails
        mockGetPayload.mockRejectedValue(new Error('Payload not available'))

        // Act & Assert — caller must not see this error (fire-and-forget)
        await expect(
            queueSEOAutoGeneration('pages', '70', 'site-z', 'Ghost Product')
        ).resolves.toBeUndefined()

        await flushPromises()
    })
})
