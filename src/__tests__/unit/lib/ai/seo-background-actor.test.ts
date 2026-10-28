// @vitest-environment node
/**
 * TC-AIREL-230..239 — background AI work (product / page SEO queued by a collection hook) runs as the
 * merchant in the site's workspace instead of falling back on template text.
 * Real: seo-queue, seo-actor, actor-scope, generation-actor. Faked: Payload, next/server `after`, the platform
 * config/context (membership), the meta generator (records which actor it saw), the capture log.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentActor } from '@/lib/ai-platform/context'

const { mockGetAiTaskClient, mockFind, mockFindByID, mockCreate, mockUpdate, mockGenerate, mockEnabled, mockActorFor, mockStart, mockFinish, queued } = vi.hoisted(() => ({
    mockGetAiTaskClient: vi.fn(),
    mockFind: vi.fn(),
    mockFindByID: vi.fn(),
    mockCreate: vi.fn(),
    mockUpdate: vi.fn(),
    mockGenerate: vi.fn(),
    mockEnabled: vi.fn(() => true),
    mockActorFor: vi.fn(),
    mockStart: vi.fn(),
    mockFinish: vi.fn(),
    queued: [] as Array<() => unknown>,
}))

vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ find: mockFind, findByID: mockFindByID, create: mockCreate, update: mockUpdate })) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
// after(): the work is held until the request is over, as on the platform
vi.mock('next/server', () => ({ after: (task: () => unknown) => { queued.push(task) } }))
vi.mock('@/lib/ai-platform/config', () => ({ isAiTasksEnabled: () => mockEnabled() }))
vi.mock('@/lib/ai-platform/context', () => {
    class AgentAccessError extends Error { constructor(message: string, readonly status: 401 | 403) { super(message) } }
    return { AgentAccessError, actorForUserInTenant: (...args: unknown[]) => mockActorFor(...args) }
})
vi.mock('@/lib/ai-platform/task-client', () => ({ getAiTaskClient: (...args: unknown[]) => mockGetAiTaskClient(...args) }))
vi.mock('@/lib/ai/generate-meta', () => ({ generateAutoSEOMeta: (...args: unknown[]) => mockGenerate(...args) }))
vi.mock('@/lib/ai/capture-generation', () => ({
    startCapture: (...args: unknown[]) => mockStart(...args),
    finishCapture: (...args: unknown[]) => mockFinish(...args),
}))

import { queueSEOAutoGeneration } from '@/lib/ai/seo-queue'
import { currentAiActor, runWithAiActor } from '@/lib/ai-platform/actor-scope'
import { withAiActorFor } from '@/lib/ai/seo-actor'
import { AgentAccessError } from '@/lib/ai-platform/context'

const actorOf = (tenantId: string, userId = 3): AgentActor =>
    ({ user: { id: userId, email: `u${userId}@shop.my` }, tenantId, organizationId: `org_${tenantId}`, role: 'owner' }) as unknown as AgentActor

const MERCHANT = actorOf('1')
const SITE = { id: 5, businessName: 'Kopi Kampung', tenant: 1, seo: {} }

/** Runs what the platform would run once the response is sent. */
const afterResponse = async () => {
    const tasks = queued.splice(0)
    for (const task of tasks) await task()
}

let seen: { actor: AgentActor | null; scoped: AgentActor | null; skipReason?: string; siteId?: unknown }
beforeEach(() => {
    vi.clearAllMocks()
    queued.length = 0
    mockEnabled.mockReturnValue(true)
    mockFindByID.mockResolvedValue(SITE)
    mockCreate.mockResolvedValue({ id: 'job-1' })
    mockUpdate.mockResolvedValue({})
    mockFind.mockResolvedValue({ docs: [] })
    mockActorFor.mockImplementation((user: { id: number }, tenantId: string) => actorOf(String(tenantId), user.id))
    mockGenerate.mockImplementation(async (...args: unknown[]) => {
        const options = (args[7] ?? {}) as { skipReason?: string; siteId?: unknown }
        seen = { actor: (args[6] as AgentActor | null) ?? null, scoped: currentAiActor(), skipReason: options.skipReason, siteId: options.siteId }
        return { title: 'AI title', description: 'AI description' }
    })
})

describe('queueSEOAutoGeneration captures the actor in scope [TC-AIREL-230, TC-AIREL-231]', () => {
    it('TC-AIREL-230: enqueued inside a merchant scope (site generation), it runs as that merchant after the scope is gone', async () => {
        await runWithAiActor(MERCHANT, () => queueSEOAutoGeneration('products', 9, 5, 'Signature Latte', 'desc'))
        expect(currentAiActor()).toBeNull() // the request scope is over; only the captured actor can carry it

        await afterResponse()

        expect(seen.actor).toBe(MERCHANT)
        expect(mockFind).not.toHaveBeenCalled() // nothing to look up: the scope already named the merchant
    })

    it('TC-AIREL-231: the generator and every model call under it see the merchant through currentAiActor()', async () => {
        await runWithAiActor(MERCHANT, () => queueSEOAutoGeneration('products', 9, 5, 'Signature Latte'))

        await afterResponse()

        expect(seen.scoped).toBe(MERCHANT)
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ collection: 'products', id: 9, data: { seo: { title: 'AI title', description: 'AI description' } } }))
    })
})

describe('resolving the actor when none was captured [TC-AIREL-232..234]', () => {
    it('TC-AIREL-232: an actor from another workspace is never used; the publisher of the right one is', async () => {
        const publisher = { id: 11, email: 'owner@shop.my' }
        await runWithAiActor(actorOf('99'), () => queueSEOAutoGeneration('products', 9, 5, 'Latte', undefined, publisher))

        await afterResponse()

        expect(mockActorFor).toHaveBeenCalledWith(publisher, '1')
        expect(seen.actor).toMatchObject({ tenantId: '1', user: { id: 11 } })
    })

    it('TC-AIREL-233: req.user alone (no scope) runs as that user in the site workspace', async () => {
        await queueSEOAutoGeneration('pages', 9, 5, 'About', undefined, { id: 12 })

        await afterResponse()

        expect(seen.actor).toMatchObject({ tenantId: '1', user: { id: 12 } })
        expect(seen.skipReason).toBeUndefined()
    })

    it('TC-AIREL-234: no scope and no publisher (server write): runs as the user who generated the site, in the site\'s workspace', async () => {
        mockFind.mockResolvedValue({ docs: [{ id: 5, user: 3 }] })
        mockFindByID.mockImplementation(async ({ collection }: { collection: string }) => (collection === 'users' ? { id: 3, email: 'u3@shop.my' } : SITE))

        await queueSEOAutoGeneration('products', 9, 5, 'Latte')
        await afterResponse()

        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'ai-generation-records',
            sort: '-createdAt',
            where: { and: [{ site: { equals: '5' } }, { endpoint: { equals: 'site-generator' } }, { user: { exists: true } }] },
        }))
        expect(mockActorFor).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }), '1')
        expect(seen.actor).toMatchObject({ tenantId: '1', user: { id: 3 } })
        expect(seen.scoped).toBe(seen.actor)
    })
})

describe('no actor can be resolved: template meta with the reason [TC-AIREL-235..237]', () => {
    it('TC-AIREL-235: nobody to run as → no actor and a reason', async () => {
        await queueSEOAutoGeneration('products', 9, 5, 'Latte')
        await afterResponse()

        expect(seen.actor).toBeNull()
        expect(seen.scoped).toBeNull()
        expect(seen.skipReason).toBe('record_missing_user')
        expect(seen.siteId).toBe(5)
    })

    it('TC-AIREL-236: the generating user left the workspace → not_workspace_member, billed to nobody', async () => {
        mockFind.mockResolvedValue({ docs: [{ id: 5, user: 3 }] })
        mockFindByID.mockImplementation(async ({ collection }: { collection: string }) => (collection === 'users' ? { id: 3 } : SITE))
        mockActorFor.mockImplementation(() => { throw new AgentAccessError('not a member', 403) })

        await queueSEOAutoGeneration('products', 9, 5, 'Latte')
        await afterResponse()

        expect(seen.actor).toBeNull()
        expect(seen.skipReason).toBe('not_workspace_member')
    })

    it('TC-AIREL-237: AI platform not configured → ai_unconfigured, no lookups', async () => {
        mockEnabled.mockReturnValue(false)

        await runWithAiActor(MERCHANT, () => queueSEOAutoGeneration('products', 9, 5, 'Latte', undefined, { id: 12 }))
        await afterResponse()

        expect(seen.actor).toBeNull()
        expect(seen.skipReason).toBe('ai_unconfigured')
        expect(mockFind).not.toHaveBeenCalled()
    })
})

describe('the template fallback says why; the activation write runs as the merchant [TC-AIREL-238, TC-AIREL-239]', () => {
    it('TC-AIREL-238: generateAutoSEOMeta records aiSkipReason on the fallback and the actor on an AI run', async () => {
        const real = await vi.importActual<typeof import('@/lib/ai/generate-meta')>('@/lib/ai/generate-meta')
        mockStart.mockResolvedValue({ recordId: 1, startTime: 0 })

        await real.generateAutoSEOMeta('product', 'Latte', 'Kopi', undefined, [], undefined, null, { skipReason: 'record_missing_user', siteId: 5 })

        expect(mockStart).toHaveBeenLastCalledWith(expect.objectContaining({ endpoint: 'generate-meta', siteId: 5 }))
        expect(mockStart.mock.calls.at(-1)?.[0]).not.toHaveProperty('userId')
        expect(mockFinish).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({
            outputSnapshot: expect.objectContaining({ path: 'no-actor-fallback', aiSkipReason: 'record_missing_user', title: 'Latte | Kopi | Buy Online Malaysia' }),
        }))

        mockGetAiTaskClient.mockReturnValue({ runTask: vi.fn(async () => ({ output: { metaTitle: 'T', metaDescription: 'D' } })) })
        await real.generateAutoSEOMeta('product', 'Latte', 'Kopi', undefined, [], undefined, actorOf('1'))
        // integer relation columns: tenant 1, not "1" (a text id made the capture row fail validation)
        expect(mockStart).toHaveBeenLastCalledWith(expect.objectContaining({ userId: 3, tenantId: 1 }))
    })

    it('TC-AIREL-239: withAiActorFor runs the write as the merchant (hook sees the scope); a non-member writes plainly; a write failure is not retried', async () => {
        const inHook = vi.fn(async () => currentAiActor())

        const asMerchant = await withAiActorFor({ id: 3 }, 1, inHook)
        expect(asMerchant).toMatchObject({ tenantId: '1', user: { id: 3 } })

        mockActorFor.mockImplementationOnce(() => { throw new AgentAccessError('no', 403) })
        expect(await withAiActorFor({ id: 4 }, 1, inHook)).toBeNull()

        mockEnabled.mockReturnValue(false)
        expect(await withAiActorFor({ id: 3 }, 1, inHook)).toBeNull()
        expect(await withAiActorFor(null, 1, inHook)).toBeNull()

        mockEnabled.mockReturnValue(true)
        const failing = vi.fn(async () => { throw new Error('write failed') })
        await expect(withAiActorFor({ id: 3 }, 1, failing)).rejects.toThrow('write failed')
        expect(failing).toHaveBeenCalledTimes(1)
    })
})
