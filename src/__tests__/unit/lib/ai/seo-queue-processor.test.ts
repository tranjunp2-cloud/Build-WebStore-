/**
 * Unit Tests: seo-queue — backgroundSeoProcessor via queueSEOAutoGeneration
 * TC-IDs: TC-F08-03-01
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

const mockGenerateAutoSEOMeta = vi.fn()

vi.mock('@/lib/ai/generate-meta', () => ({
    generateAutoSEOMeta: (...args: unknown[]) => mockGenerateAutoSEOMeta(...args),
}))

import { queueSEOAutoGeneration } from '@/lib/ai/seo-queue'
import { revalidatePath } from 'next/cache'

// ─── Helper: flush microtasks/promises ───────────────────────────────────────

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 10))

// ─── TC-F08-03-01: SEO queue background processor ────────────────────────────

describe('queueSEOAutoGeneration — background processor [TC-F08-03-01]', () => {
    beforeEach(() => {
        vi.clearAllMocks()

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
        await queueSEOAutoGeneration('products', '123', 'site-1', 'Nasi Lemak')
        const elapsed = Date.now() - start

        // Assert — returns without waiting for background work
        expect(elapsed).toBeLessThan(100)
    })

    it('calls getPayload to access database [TC-F08-03-01]', async () => {
        // Arrange & Act
        await queueSEOAutoGeneration('products', '99', 'site-5', 'Product Name')
        await flushPromises()

        // Assert
        expect(mockGetPayload).toHaveBeenCalledOnce()
    })

    it('fetches site by ID to get business name [TC-F08-03-01]', async () => {
        // Arrange & Act
        await queueSEOAutoGeneration('products', '99', 'site-5', 'Teh Tarik')
        await flushPromises()

        // Assert
        expect(mockFindByID).toHaveBeenCalledWith(
            expect.objectContaining({ collection: 'sites', id: 'site-5' })
        )
    })

    it('creates a pending SEO meta job record [TC-F08-03-01]', async () => {
        // Arrange & Act
        await queueSEOAutoGeneration('products', '55', 'site-2', 'Roti Canai')
        await flushPromises()

        // Assert
        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'seo-meta-jobs',
                data: expect.objectContaining({
                    targetCollection: 'products',
                    targetId: '55',
                    status: 'pending',
                }),
            })
        )
    })

    it('calls generateAutoSEOMeta with product type, name, and site name [TC-F08-03-01]', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ businessName: 'Restoran ABC', name: 'restoran-abc' })

        // Act
        await queueSEOAutoGeneration('products', '10', 'site-3', 'Ayam Percik', 'Grilled chicken')
        await flushPromises()

        // Assert
        expect(mockGenerateAutoSEOMeta).toHaveBeenCalledWith(
            'product',
            'Ayam Percik',
            'Restoran ABC',
            'Grilled chicken',
            []
        )
    })

    it('calls generateAutoSEOMeta with page type for pages collection [TC-F08-03-01]', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ businessName: 'MyBiz', name: 'mybiz' })

        // Act
        await queueSEOAutoGeneration('pages', '20', 'site-4', 'About Us')
        await flushPromises()

        // Assert
        expect(mockGenerateAutoSEOMeta).toHaveBeenCalledWith(
            'page',
            'About Us',
            'MyBiz',
            undefined,
            []
        )
    })

    it('updates the target collection with generated SEO fields [TC-F08-03-01]', async () => {
        // Arrange & Act
        await queueSEOAutoGeneration('products', '77', 'site-6', 'Mee Goreng')
        await flushPromises()

        // Assert
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'products',
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
        await queueSEOAutoGeneration('products', '88', 'site-7', 'Laksa')
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
        await queueSEOAutoGeneration('products', '90', 'site-8', 'Char Kway Teow')
        await flushPromises()

        // Assert
        expect(revalidatePath).toHaveBeenCalledWith('/sitemap.xml')
    })

    it('falls back to site.name when businessName is absent [TC-F08-03-01]', async () => {
        // Arrange — site has name but not businessName
        mockFindByID.mockResolvedValue({ name: 'plain-site' })

        // Act
        await queueSEOAutoGeneration('products', '11', 'site-9', 'Product X')
        await flushPromises()

        // Assert — site name passed to meta generator
        expect(mockGenerateAutoSEOMeta).toHaveBeenCalledWith(
            'product',
            'Product X',
            'plain-site',
            undefined,
            []
        )
    })

    it('falls back to "Website" when site has no name at all [TC-F08-03-01]', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({})

        // Act
        await queueSEOAutoGeneration('products', '12', 'site-10', 'No-Name Product')
        await flushPromises()

        // Assert
        expect(mockGenerateAutoSEOMeta).toHaveBeenCalledWith(
            'product',
            'No-Name Product',
            'Website',
            undefined,
            []
        )
    })
})

// ─── TC-F08-03-01: SEO queue error handling ──────────────────────────────────

describe('queueSEOAutoGeneration — error handling [TC-F08-03-01]', () => {
    beforeEach(() => {
        vi.clearAllMocks()

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
        await queueSEOAutoGeneration('products', '50', 'site-x', 'Failed Product')
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
        await queueSEOAutoGeneration('products', '60', 'site-y', 'Error Product')
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
            queueSEOAutoGeneration('products', '70', 'site-z', 'Ghost Product')
        ).resolves.toBeUndefined()

        await flushPromises()
    })
})
