import { describe, expect, it, vi } from 'vitest'
import { queueGenerationRecovery } from '@/lib/ai/generation-recovery'
import { runGenerationRecoveryJob } from '@/lib/ai/generation-recovery-worker'
import { hashGenerationSnapshot } from '@/lib/ai/generation-snapshot-hash'
import { enforceGroundedBlocks } from '@/lib/ai/grounded-blocks'

vi.mock('@/lib/ai/openai-generator', () => ({
    generateSiteWithAI: vi.fn(),
}))

import { generateSiteWithAI } from '@/lib/ai/openai-generator'

const snapshot = {
    businessInfo: { businessName: 'Demo', industry: 'tech', products: 'App', shortDescription: 'Demo app' },
    language: 'en', generationLocale: 'en',
    contentBrief: {
        referenceContent: { heroHeadline: 'The original recovery brief' }, visualStyle: {},
    },
}
const snapshotHash = hashGenerationSnapshot(snapshot)

function createPayload(overrides: Record<string, unknown> = {}) {
    const parent = { id: 41, endpoint: 'site-generator', lifecycle: 'terminal', recoveryStatus: 'eligible', inputSnapshot: snapshot, inputSchemaVersion: 'f41.v1', inputHash: snapshotHash, tenant: 9, user: 7, retryAttempt: 0 }
    return {
        findByID: vi.fn().mockResolvedValue(parent),
        find: vi.fn().mockResolvedValue({ docs: [] }),
        create: vi.fn().mockResolvedValueOnce({ id: 42 }).mockResolvedValueOnce({ id: 99 }),
        update: vi.fn().mockResolvedValue({}),
        ...overrides,
    }
}

describe('queueGenerationRecovery', () => {
    it('TC-F41-09: accepts an unchanged JSONB snapshot even when its object keys are reordered', async () => {
        // Arrange — PostgreSQL JSONB can return the same object in a different
        // key order from the HTTP request that originally created the capture.
        const reloadedSnapshot = {
            language: 'en',
            businessInfo: { products: 'App', industry: 'tech', shortDescription: 'Demo app', businessName: 'Demo' },
            contentBrief: { visualStyle: {}, referenceContent: { heroHeadline: 'The original recovery brief' } },
            generationLocale: 'en',
        }
        const payload = createPayload({ findByID: vi.fn().mockResolvedValue({ id: 41, endpoint: 'site-generator', lifecycle: 'terminal', recoveryStatus: 'eligible', inputSnapshot: reloadedSnapshot, inputSchemaVersion: 'f41.v1', inputHash: snapshotHash, tenant: 9, user: 7, retryAttempt: 0 }) })

        // Act
        const result = await queueGenerationRecovery(payload, { parentGenerationId: 41, requestedBy: 2, idempotencyKey: '5b98894f-3f93-4147-85c5-30a7bbca0b12' })

        // Assert
        expect(result).toMatchObject({ kind: 'accepted' })
    })

    it('TC-F41-09: creates an isolated child and durable job from a frozen structured snapshot', async () => {
        // Arrange
        const payload = createPayload()

        // Act
        const result = await queueGenerationRecovery(payload, { parentGenerationId: 41, requestedBy: 2, idempotencyKey: '6ca7f9b7-c398-4c26-9925-1e9c6cd7d572' })

        // Assert
        expect(result).toMatchObject({ kind: 'accepted', childGenerationId: '42', jobId: '99', idempotent: false })
        expect(payload.create.mock.calls[0]?.[0]).toMatchObject({ collection: 'ai-generation-records', data: { source: 'ops_retry', parentGeneration: 41, retryRootGeneration: 41, retryAttempt: 1, tenant: 9, inputSnapshot: snapshot } })
        expect(payload.create.mock.calls[0]?.[0].data).not.toHaveProperty('promptText')
        expect(payload.create.mock.calls[1]?.[0]).toMatchObject({ collection: 'generation_recovery_jobs', data: { sourceGeneration: 41, childGeneration: 42, tenant: 9, status: 'queued' } })
        expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({ id: 41, data: { recoveryStatus: 'retrying' } }))
    })

    it('TC-F41-09: returns the canonical child for the same idempotency key without writing again', async () => {
        // Arrange
        const payload = createPayload({ find: vi.fn().mockResolvedValueOnce({ docs: [{ id: 99, childGeneration: 42, status: 'queued', idempotencyKey: 'same' }] }) })

        // Act
        const result = await queueGenerationRecovery(payload, { parentGenerationId: 41, requestedBy: 2, idempotencyKey: 'same' })

        // Assert
        expect(result).toEqual({ kind: 'accepted', jobId: '99', parentGenerationId: '41', childGenerationId: '42', idempotent: true })
        expect(payload.create).not.toHaveBeenCalled()
    })

    it('TC-F41-09: never reverts a completed retry parent to retrying on an old idempotency replay', async () => {
        // Arrange — a delayed HTTP replay may find the durable, terminal job.
        const payload = createPayload({
            find: vi.fn().mockResolvedValueOnce({ docs: [{ id: 99, childGeneration: 42, status: 'succeeded', idempotencyKey: 'same' }] }),
        })

        // Act
        const result = await queueGenerationRecovery(payload, { parentGenerationId: 41, requestedBy: 2, idempotencyKey: 'same' })

        // Assert
        expect(result).toMatchObject({ kind: 'error', code: 'NOT_RETRYABLE' })
        expect(payload.update).not.toHaveBeenCalled()
    })

    it('TC-F41-10: rejects a parent that is not retry-eligible without creating child, site, or job', async () => {
        // Arrange
        const payload = createPayload({ findByID: vi.fn().mockResolvedValue({ id: 41, lifecycle: 'terminal', recoveryStatus: 'ticket_required', inputSnapshot: snapshot, inputSchemaVersion: 'f41.v1', inputHash: snapshotHash, tenant: 9 }) })

        // Act
        const result = await queueGenerationRecovery(payload, { parentGenerationId: 41, requestedBy: 2, idempotencyKey: '73d1c03e-bd31-44de-a9b7-afd12b17df9d' })

        // Assert
        expect(result).toMatchObject({ kind: 'error', code: 'NOT_RETRYABLE' })
        expect(payload.create).not.toHaveBeenCalled()
    })

    it('TC-F41-11: returns the active canonical child rather than creating a second retry', async () => {
        // Arrange
        const payload = createPayload({
            find: vi.fn()
                .mockResolvedValueOnce({ docs: [] })
                .mockResolvedValueOnce({ docs: [{ id: 99, childGeneration: 42, status: 'running' }] }),
        })

        // Act
        const result = await queueGenerationRecovery(payload, { parentGenerationId: 41, requestedBy: 2, idempotencyKey: '73d1c03e-bd31-44de-a9b7-afd12b17df9d' })

        // Assert
        expect(result).toEqual({ kind: 'conflict', childGenerationId: '42' })
        expect(payload.create).not.toHaveBeenCalled()
        expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'ai-generation-records',
            id: 41,
            data: { recoveryStatus: 'retrying' },
        }))
    })
})

describe('runGenerationRecoveryJob', () => {
    it('TC-F41-12: creates a separate draft website and leaves the parent evidence immutable on success', async () => {
        // Arrange
        vi.mocked(generateSiteWithAI).mockResolvedValue({
            result: {
                siteName: 'Recovery site', siteType: 'business', theme: 'modern',
                seo: { title: 'Recovery', description: 'Recovery draft' },
                pages: [{ title: 'Home', slug: '/', blocks: [], seo: { title: 'Home', description: 'Home page' } }],
            },
        } as never)
        const updates: Array<Record<string, unknown>> = []
        const job = { id: 99, status: 'running', leaseToken: 'lease-1', childGeneration: 42, sourceGeneration: 41, tenant: 9 }
        const payload = {
            findByID: vi.fn(async ({ id }) => id === 99 ? job : { id: 42, inputSnapshot: snapshot }),
            create: vi.fn()
                .mockResolvedValueOnce({ id: 501 })
                .mockResolvedValueOnce({ id: 601 }),
            update: vi.fn(async (args) => { updates.push(args); return {} }),
        }

        // Act
        const result = await runGenerationRecoveryJob(payload, { jobId: 99, leaseToken: 'lease-1' })

        // Assert
        expect(result).toEqual({ status: 'succeeded', siteId: '501' })
        expect(payload.create.mock.calls[0]?.[0]).toMatchObject({ collection: 'sites', data: { tenant: 9, status: 'draft' } })
        expect(payload.create.mock.calls[1]?.[0]).toMatchObject({ collection: 'pages', data: { site: 501, _status: 'draft' } })
        expect(generateSiteWithAI).toHaveBeenCalledWith(
            snapshot.businessInfo,
            undefined,
            'en',
            expect.stringContaining('The original recovery brief'),
            undefined,
            undefined,
            { facts: expect.objectContaining({ brand: 'Demo' }) },
        )
        expect(updates.filter((call) => call.collection === 'ai-generation-records' && call.id === 41))
            .toEqual([expect.objectContaining({ data: { recoveryStatus: 'none' } })])
        expect(updates.some((call) => call.collection === 'ai-generation-records' && call.id === 41 && Object.keys(call.data as object).some((key) => key !== 'recoveryStatus'))).toBe(false)
    })

    it('TC-AIAUD-200: recovery rebuilds FACTS from the frozen snapshot, scrubs invented blocks and saves no empty required list', async () => {
        // Arrange — the model invents testimonials/stats/features; the merchant gave no real ones.
        const invented = [
            { blockType: 'hero', headline: 'Demo' },
            { blockType: 'testimonials', testimonials: [{ quote: 'Best app ever', name: 'Jane', role: 'CEO' }] },
            { blockType: 'stats', stats: [{ value: '10,000+', label: 'Happy customers' }, { value: '99%', label: 'Satisfaction' }] },
            { blockType: 'features', features: [] },
        ]
        vi.mocked(generateSiteWithAI).mockImplementation((async (...args: unknown[]) => {
            const options = (args[6] ?? {}) as { facts?: Parameters<typeof enforceGroundedBlocks>[1] }
            return {
                result: {
                    siteName: 'Recovery site', siteType: 'business', theme: 'modern',
                    seo: { title: 'Recovery', description: 'Recovery draft' },
                    pages: [{ title: 'Home', slug: '/', blocks: enforceGroundedBlocks(invented, options.facts, 'en'), seo: { title: 'Home', description: 'Home page' } }],
                },
            }
        }) as never)
        const job = { id: 99, status: 'running', leaseToken: 'lease-1', childGeneration: 42, sourceGeneration: 41, tenant: 9 }
        const payload = {
            findByID: vi.fn(async ({ collection, id }) => collection === 'tenants' ? { id, payments: { payment_cod: true } } : id === 99 ? job : { id: 42, inputSnapshot: snapshot }),
            create: vi.fn().mockResolvedValueOnce({ id: 501 }).mockResolvedValueOnce({ id: 601 }),
            update: vi.fn(async () => ({})),
        }

        // Act
        const result = await runGenerationRecoveryJob(payload, { jobId: 99, leaseToken: 'lease-1' })

        // Assert
        expect(result).toEqual({ status: 'succeeded', siteId: '501' })
        const options = vi.mocked(generateSiteWithAI).mock.calls.at(-1)?.[6] as { facts?: { brand: string; paymentMethods: string[] } }
        expect(options.facts).toMatchObject({ brand: 'Demo', paymentMethods: ['Cash on delivery'] })
        const layout = (payload.create.mock.calls[1]?.[0].data as { layout: Array<Record<string, unknown>> }).layout
        expect(layout.map((b) => b.blockType)).toEqual(['hero', 'testimonials'])
        const testimonials = (layout[1]!.testimonials as Array<{ quote: string }>)
        expect(JSON.stringify(testimonials)).not.toContain('Best app ever')
    })

    it('TC-AIAUD-201: recovery drops an empty required stats / features list even when the generator returns one', async () => {
        // Arrange
        vi.mocked(generateSiteWithAI).mockResolvedValue({
            result: {
                siteName: 'Recovery site', siteType: 'business', theme: 'modern',
                seo: { title: 'Recovery', description: 'Recovery draft' },
                pages: [{ title: 'Home', slug: '/', blocks: [{ blockType: 'hero', headline: 'Demo' }, { blockType: 'stats', stats: [] }, { blockType: 'features' }], seo: { title: 'Home', description: 'Home page' } }],
            },
        } as never)
        const job = { id: 99, status: 'running', leaseToken: 'lease-1', childGeneration: 42, sourceGeneration: 41, tenant: 9 }
        const payload = {
            findByID: vi.fn(async ({ id }) => id === 99 ? job : { id: 42, inputSnapshot: snapshot }),
            create: vi.fn().mockResolvedValueOnce({ id: 501 }).mockResolvedValueOnce({ id: 601 }),
            update: vi.fn(async () => ({})),
        }

        // Act
        await runGenerationRecoveryJob(payload, { jobId: 99, leaseToken: 'lease-1' })

        // Assert
        const layout = (payload.create.mock.calls[1]?.[0].data as { layout: Array<Record<string, unknown>> }).layout
        expect(layout.map((b) => b.blockType)).toEqual(['hero'])
    })

    it('TC-F41-12: terminalizes a failed child and makes only the parent ticket-eligible', async () => {
        // Arrange
        vi.mocked(generateSiteWithAI).mockRejectedValue(new Error('provider timed out'))
        const updates: Array<Record<string, unknown>> = []
        const job = { id: 99, status: 'running', leaseToken: 'lease-1', childGeneration: 42, sourceGeneration: 41, tenant: 9 }
        const payload = {
            findByID: vi.fn(async ({ id }) => id === 99 ? job : { id: 42, inputSnapshot: snapshot }),
            create: vi.fn(),
            update: vi.fn(async (args) => { updates.push(args); return {} }),
        }

        // Act
        const result = await runGenerationRecoveryJob(payload, { jobId: 99, leaseToken: 'lease-1' })

        // Assert
        expect(result).toEqual({ status: 'failed', code: 'RECOVERY_TIMEOUT' })
        expect(updates.findLast((call) => call.collection === 'ai-generation-records' && call.id === 42))
            .toEqual(expect.objectContaining({ data: expect.objectContaining({ lifecycle: 'terminal', outcome: 'failed', recoveryStatus: 'ticket_required' }) }))
        expect(updates.filter((call) => call.collection === 'ai-generation-records' && call.id === 41))
            .toEqual([expect.objectContaining({ data: { recoveryStatus: 'ticket_required' } })])
    })

    it('TC-F41-12: never terminalizes a provider failure after its lease was reclaimed', async () => {
        // Arrange — the provider can fail after the lease expired. The old
        // worker must not replace the newer worker's running/terminal state.
        vi.mocked(generateSiteWithAI).mockRejectedValue(new Error('provider timed out'))
        const ownedJob = { id: 99, status: 'running', leaseToken: 'lease-1', childGeneration: 42, sourceGeneration: 41, tenant: 9 }
        const reclaimedJob = { ...ownedJob, leaseToken: 'lease-2' }
        const updates: Array<Record<string, unknown>> = []
        const payload = {
            findByID: vi.fn()
                .mockResolvedValueOnce(ownedJob)
                .mockResolvedValueOnce({ id: 42, inputSnapshot: snapshot })
                .mockResolvedValueOnce(ownedJob)
                .mockResolvedValueOnce(ownedJob)
                .mockResolvedValueOnce({ id: 9 }) // tenant FACTS read
                .mockResolvedValueOnce(reclaimedJob),
            create: vi.fn(), update: vi.fn(async (args) => { updates.push(args); return {} }),
        }

        // Act
        const result = await runGenerationRecoveryJob(payload, { jobId: 99, leaseToken: 'lease-1' })

        // Assert
        expect(result).toEqual({ status: 'skipped' })
        expect(updates.some((call) => (call.data as Record<string, unknown>).lifecycle === 'terminal')).toBe(false)
        expect(updates.some((call) => call.collection === 'generation_recovery_jobs' && (call.data as Record<string, unknown>).status === 'failed')).toBe(false)
    })

    it('TC-F41-12: stops without creating a draft or terminalizing records after its lease is reclaimed', async () => {
        // Arrange: the first job read is owned, but the pre-generation ownership
        // recheck sees the token replaced by a later cron invocation.
        const staleJob = { id: 99, status: 'running', leaseToken: 'lease-2', childGeneration: 42, sourceGeneration: 41, tenant: 9 }
        const payload = {
            findByID: vi.fn()
                .mockResolvedValueOnce({ id: 99, status: 'running', leaseToken: 'lease-1', childGeneration: 42, sourceGeneration: 41, tenant: 9 })
                .mockResolvedValueOnce({ id: 42, inputSnapshot: snapshot })
                .mockResolvedValue(staleJob),
            create: vi.fn(), update: vi.fn(),
        }

        // Act
        const result = await runGenerationRecoveryJob(payload, { jobId: 99, leaseToken: 'lease-1' })

        // Assert
        expect(result).toEqual({ status: 'skipped' })
        expect(payload.create).not.toHaveBeenCalled()
        expect(payload.update).not.toHaveBeenCalled()
    })

    it('TC-F41-12: uses an atomic database lease CAS before any irreversible recovery write', async () => {
        // Arrange: CAS miss simulates another cron invocation reclaiming an
        // expired lease exactly as this worker starts.
        const execute = vi.fn().mockResolvedValue({ rows: [] })
        const payload = {
            findByID: vi.fn()
                .mockResolvedValueOnce({ id: 99, status: 'running', leaseToken: 'lease-1', childGeneration: 42, sourceGeneration: 41, tenant: 9 })
                .mockResolvedValueOnce({ id: 42, inputSnapshot: snapshot }),
            create: vi.fn(), update: vi.fn(), db: { drizzle: { execute } },
        }

        // Act
        const result = await runGenerationRecoveryJob(payload, { jobId: 99, leaseToken: 'lease-1' })

        // Assert
        expect(result).toEqual({ status: 'skipped' })
        expect(execute).toHaveBeenCalledTimes(1)
        expect(payload.create).not.toHaveBeenCalled()
        expect(payload.update).not.toHaveBeenCalled()
    })

    it('TC-F41-12: checkpoints the draft and each persisted page for reclaim-safe resume', async () => {
        // Arrange
        vi.mocked(generateSiteWithAI).mockResolvedValue({
            result: {
                siteName: 'Recovery site', siteType: 'business', theme: 'modern', seo: { title: 'Recovery', description: 'Recovery draft' },
                pages: [
                    { title: 'Home', slug: '/', blocks: [], seo: { title: 'Home', description: 'Home' } },
                    { title: 'About', slug: '/about', blocks: [], seo: { title: 'About', description: 'About' } },
                ],
            },
        } as never)
        const job = { id: 99, status: 'running', leaseToken: 'lease-1', childGeneration: 42, sourceGeneration: 41, tenant: 9 }
        const payload = {
            findByID: vi.fn(async ({ id }) => id === 99 ? job : { id: 42, inputSnapshot: snapshot }),
            create: vi.fn().mockResolvedValueOnce({ id: 501 }).mockResolvedValueOnce({ id: 601 }).mockResolvedValueOnce({ id: 602 }),
            update: vi.fn().mockResolvedValue({}),
        }

        // Act
        await runGenerationRecoveryJob(payload, { jobId: 99, leaseToken: 'lease-1' })

        // Assert
        const childUpdates = payload.update.mock.calls
            .map(([call]) => call)
            .filter((call) => call.collection === 'ai-generation-records' && call.id === 42)
        expect(childUpdates).toContainEqual(expect.objectContaining({ data: { site: 501, recoveredSite: 501 } }))
        expect(childUpdates).toContainEqual(expect.objectContaining({ data: expect.objectContaining({ pageSummary: { expected: 2, persisted: 1, failed: 0 } }) }))
        expect(childUpdates).toContainEqual(expect.objectContaining({ data: expect.objectContaining({ pageSummary: { expected: 2, persisted: 2, failed: 0 } }) }))
    })

    it('TC-F41-12: resumes an existing isolated draft and does not recreate its persisted page', async () => {
        // Arrange
        vi.mocked(generateSiteWithAI).mockResolvedValue({
            result: {
                siteName: 'Recovery site', siteType: 'business', theme: 'modern', seo: { title: 'Recovery', description: 'Recovery draft' },
                pages: [
                    { title: 'Home', slug: '/', blocks: [], seo: { title: 'Home', description: 'Home' } },
                    { title: 'About', slug: '/about', blocks: [], seo: { title: 'About', description: 'About' } },
                ],
            },
        } as never)
        const job = { id: 99, status: 'running', leaseToken: 'lease-1', childGeneration: 42, sourceGeneration: 41, tenant: 9 }
        const payload = {
            findByID: vi.fn(async ({ id }) => id === 99 ? job : {
                id: 42, inputSnapshot: snapshot, recoveredSite: 501,
                pageOutcomes: [{ pageKey: '/', title: 'Home', slug: '/', pageId: '601', status: 'persisted', blockCount: 0 }],
            }),
            create: vi.fn().mockResolvedValue({ id: 602 }), update: vi.fn().mockResolvedValue({}),
        }

        // Act
        const result = await runGenerationRecoveryJob(payload, { jobId: 99, leaseToken: 'lease-1' })

        // Assert
        expect(result).toEqual({ status: 'succeeded', siteId: '501' })
        expect(payload.create).toHaveBeenCalledTimes(1)
        expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({ collection: 'pages', data: expect.objectContaining({ site: 501, slug: '/about' }) }))
    })

    it('TC-F41-12: reconciles a page committed before its progress checkpoint instead of creating it twice', async () => {
        // Arrange
        vi.mocked(generateSiteWithAI).mockResolvedValue({ result: {
            siteName: 'Recovery site', siteType: 'business', theme: 'modern', seo: { title: 'Recovery', description: 'Recovery draft' },
            pages: [{ title: 'Home', slug: '/', blocks: [], seo: { title: 'Home', description: 'Home' } }],
        } } as never)
        const job = { id: 99, status: 'running', leaseToken: 'lease-1', childGeneration: 42, sourceGeneration: 41, tenant: 9 }
        const payload = {
            findByID: vi.fn(async ({ id }) => id === 99 ? job : { id: 42, inputSnapshot: snapshot, recoveredSite: 501 }),
            find: vi.fn().mockResolvedValue({ docs: [{ id: 601 }] }),
            create: vi.fn(), update: vi.fn().mockResolvedValue({}),
        }

        // Act
        const result = await runGenerationRecoveryJob(payload, { jobId: 99, leaseToken: 'lease-1' })

        // Assert
        expect(result).toEqual({ status: 'succeeded', siteId: '501' })
        expect(payload.create).not.toHaveBeenCalled()
        expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'pages', where: expect.objectContaining({ and: expect.any(Array) }) }))
    })

    it('TC-F41-12: reconciles a marked draft after create-before-checkpoint crash', async () => {
        // Arrange
        vi.mocked(generateSiteWithAI).mockResolvedValue({ result: {
            siteName: 'Recovery site', siteType: 'business', theme: 'modern', seo: { title: 'Recovery', description: 'Recovery draft' },
            pages: [{ title: 'Home', slug: '/', blocks: [], seo: { title: 'Home', description: 'Home' } }],
        } } as never)
        const job = { id: 99, status: 'running', leaseToken: 'lease-1', childGeneration: 42, sourceGeneration: 41, tenant: 9 }
        const payload = {
            findByID: vi.fn(async ({ id }) => id === 99 ? job : { id: 42, inputSnapshot: snapshot }),
            // First reconcile is the marked site; the second is its existing page.
            find: vi.fn().mockResolvedValue({ docs: [{ id: 501 }] }),
            create: vi.fn(), update: vi.fn().mockResolvedValue({}),
        }

        // Act
        const result = await runGenerationRecoveryJob(payload, { jobId: 99, leaseToken: 'lease-1' })

        // Assert
        expect(result).toEqual({ status: 'succeeded', siteId: '501' })
        expect(payload.create).not.toHaveBeenCalled()
        expect(payload.find.mock.calls[0]?.[0]).toMatchObject({
            collection: 'sites', where: { and: expect.arrayContaining([{ 'aiGenerationMetadata.originalPrompt': { equals: 'recovery-generation:42' } }]) },
        })
    })

    it('TC-F41-12: reconciles a terminal child without invoking AI again', async () => {
        // Arrange
        vi.mocked(generateSiteWithAI).mockClear()
        const job = { id: 99, status: 'running', leaseToken: 'lease-1', childGeneration: 42, sourceGeneration: 41, tenant: 9 }
        const payload = {
            findByID: vi.fn(async ({ id }) => id === 99 ? job : { id: 42, lifecycle: 'terminal', outcome: 'succeeded', recoveredSite: 501 }),
            create: vi.fn(), update: vi.fn().mockResolvedValue({}),
        }

        // Act
        const result = await runGenerationRecoveryJob(payload, { jobId: 99, leaseToken: 'lease-1' })

        // Assert
        expect(result).toEqual({ status: 'succeeded', siteId: '501' })
        expect(generateSiteWithAI).not.toHaveBeenCalled()
        expect(payload.create).not.toHaveBeenCalled()
        expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({ collection: 'generation_recovery_jobs', id: 99, data: expect.objectContaining({ status: 'succeeded' }) }))
    })
})
