/**
 * TC-AICP-277 — the shop's issues (the dock's work queue, was the dashboard To do card) remember a workspace's list: the second render inside the
 * TTL does not recompute, another workspace / language / viewer-areas / site gets its own list, a failed load is
 * not remembered, concurrent renders share one load, the copilot's applied changes drop the workspace's lists.
 * TC-AISEC-028..030 — the memory outlives the dock's 60 s poll (3 min), holds 5 000 lists with least-recently-read
 * eviction, and a list moved by a hit is still dropped by the copilot's writes.
 * Real: todo-cache.ts, shop-work-sources.ts, invalidate-after-write.ts. Faked: Payload, computeShopTodos (counted).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getPayload: vi.fn(), computeShopTodos: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
vi.mock('@/lib/insights/shop-todo', () => ({ computeShopTodos: mocks.computeShopTodos }))
// the SEO issue reads its own evaluation (not this cache)
vi.mock('@/lib/ai-platform/work/seo-work-item', () => ({ seoWorkItem: vi.fn(async () => null) }))

import { loadShopWork } from '@/lib/ai-platform/work/shop-work-sources'
import { invalidateAfterAgentWrite } from '@/lib/ai-platform/invalidate-after-write'
import { cachedTodos, clearTodoCache, invalidateTodoCache, TODO_CACHE_MAX_ENTRIES, TODO_CACHE_TTL_MS, todoCacheKey } from '@/lib/dashboard/todo-cache'

const owner = (tenant: number) => ({ roles: [], tenants: [{ tenant, role: 'owner', status: 'active' }] })
const custom = (tenant: number, permissions: string[]) => ({ roles: [], tenants: [{ tenant, role: 'custom', permissions, status: 'active' }] })
const args = (over: Record<string, unknown> = {}) => ({ user: owner(4), tenantId: 4, siteId: '9', locale: 'en' as const, ...over })
/** the shop issues of the dock for these args, as the old card states (ready / unavailable) */
const getTodoCardData = (a: ReturnType<typeof args>) =>
    loadShopWork({ user: a.user, tenantId: String(a.tenantId) } as never, a.locale as 'en', new Date(), { siteId: a.siteId as string | null }).then(
        (work) => ({ state: 'ready', items: work.items }),
        () => ({ state: 'unavailable' }),
    )
const item = (id: string) => ({ id, kind: id, severity: 'high', title: id, detail: '', count: 1, href: '/', prompt: 'Help' })
/** the card gets the To do rows as work items (one per kind) */
const ready = (...kinds: string[]) => ({ state: 'ready', items: kinds.map((kind) => expect.objectContaining({ key: `shop:${kind}`, title: kind })) })

beforeEach(() => {
    vi.clearAllMocks()
    clearTodoCache()
    mocks.getPayload.mockResolvedValue({ marker: 'payload' })
    mocks.computeShopTodos.mockResolvedValue([item('low_stock')])
})
afterEach(() => vi.useRealTimers())

describe('shop issues memory [TC-AICP-277]', () => {
    it('computes once for repeated renders of the same workspace, viewer, language and site', async () => {
        const first = await getTodoCardData(args())
        const second = await getTodoCardData(args())

        expect(second).toEqual(first)
        expect(mocks.computeShopTodos).toHaveBeenCalledTimes(1)
    })

    it('computes again once the TTL is over', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-22T04:00:00Z'))
        await getTodoCardData(args())

        vi.setSystemTime(new Date('2026-10-22T04:00:00Z').getTime() + TODO_CACHE_TTL_MS + 1)
        await getTodoCardData(args())

        expect(mocks.computeShopTodos).toHaveBeenCalledTimes(2)
    })

    it.each([
        ['another workspace', { user: owner(5), tenantId: 5 }],
        ['another language', { locale: 'ms' }],
        ['another site', { siteId: '10' }],
        ['a viewer with fewer areas', { user: custom(4, ['products']) }],
    ])('keeps a separate list for %s', async (_label, over) => {
        await getTodoCardData(args())
        await getTodoCardData(args(over))

        expect(mocks.computeShopTodos).toHaveBeenCalledTimes(2)
    })

    it('does not remember a failure: the next render tries again', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        mocks.computeShopTodos.mockRejectedValueOnce(new Error('db down'))

        expect(await getTodoCardData(args())).toEqual({ state: 'unavailable' })
        expect(await getTodoCardData(args())).toEqual(ready('low_stock'))
        expect(mocks.computeShopTodos).toHaveBeenCalledTimes(2)
        log.mockRestore()
    })

    it('shares one load between renders that overlap', async () => {
        let release: (items: unknown[]) => void = () => undefined
        mocks.computeShopTodos.mockReturnValueOnce(new Promise((resolve) => (release = resolve)))

        const both = Promise.all([getTodoCardData(args()), getTodoCardData(args())])
        await new Promise((resolve) => setTimeout(resolve, 0))
        release([item('out_of_stock')])

        expect(await both).toEqual([ready('out_of_stock'), ready('out_of_stock')])
        expect(mocks.computeShopTodos).toHaveBeenCalledTimes(1)
    })

    it('drops a workspace\'s lists when the copilot applied a change, and only that workspace\'s', async () => {
        await getTodoCardData(args())
        await getTodoCardData(args({ user: owner(5), tenantId: 5 }))

        invalidateTodoCache(4)
        await getTodoCardData(args())
        await getTodoCardData(args({ user: owner(5), tenantId: 5 }))

        expect(mocks.computeShopTodos).toHaveBeenCalledTimes(3)
    })

    it('does not mix up workspace 4 with workspace 41 when forgetting', async () => {
        await getTodoCardData(args({ user: owner(41), tenantId: 41 }))

        invalidateTodoCache(4)
        await getTodoCardData(args({ user: owner(41), tenantId: 41 }))

        expect(mocks.computeShopTodos).toHaveBeenCalledTimes(1)
    })
})

const keyOf = (tenantId: number) => todoCacheKey({ tenantId, siteId: null, locale: 'en', areas: {} })

describe('the memory outlives the dock poll [TC-AISEC-028]', () => {
    it('keeps the list across two 60 s polls and recomputes after 3 minutes', async () => {
        vi.useFakeTimers()
        const start = new Date('2026-10-22T04:00:00Z').getTime()
        vi.setSystemTime(start)
        await getTodoCardData(args())

        vi.setSystemTime(start + 61_000)
        await getTodoCardData(args())
        vi.setSystemTime(start + 122_000)
        await getTodoCardData(args())
        expect(mocks.computeShopTodos).toHaveBeenCalledTimes(1)

        vi.setSystemTime(start + 180_001)
        await getTodoCardData(args())
        expect(TODO_CACHE_TTL_MS).toBe(180_000)
        expect(mocks.computeShopTodos).toHaveBeenCalledTimes(2)
    })
})

describe('bounded, least recently read dropped first [TC-AISEC-029]', () => {
    it('holds 5 000 workspaces; past that the one read longest ago goes, not the one just read', async () => {
        for (let tenant = 1; tenant <= TODO_CACHE_MAX_ENTRIES; tenant += 1) await cachedTodos(keyOf(tenant), async () => [])
        await cachedTodos(keyOf(1), async () => []) // a hit: workspace 1 is now the most recent
        await cachedTodos(keyOf(TODO_CACHE_MAX_ENTRIES + 1), async () => []) // one over the cap
        const first = vi.fn(async () => [])
        const second = vi.fn(async () => [])

        await cachedTodos(keyOf(1), first)
        await cachedTodos(keyOf(2), second)

        expect(TODO_CACHE_MAX_ENTRIES).toBe(5_000)
        expect(first).not.toHaveBeenCalled()
        expect(second).toHaveBeenCalledTimes(1)
    })
})

describe('writes still drop a list that was just read [TC-AISEC-030]', () => {
    it('the copilot\'s apply / undo forgets the workspace\'s list even after hits moved it', async () => {
        await getTodoCardData(args())
        await getTodoCardData(args())

        invalidateAfterAgentWrite('4')
        await getTodoCardData(args())

        expect(mocks.computeShopTodos).toHaveBeenCalledTimes(2)
    })

    it('a failed load after a hit-moved list expired is still not remembered', async () => {
        vi.useFakeTimers()
        const start = new Date('2026-10-22T04:00:00Z').getTime()
        vi.setSystemTime(start)
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        await getTodoCardData(args())
        await getTodoCardData(args())
        vi.setSystemTime(start + TODO_CACHE_TTL_MS + 1)
        mocks.computeShopTodos.mockRejectedValueOnce(new Error('db down'))

        expect(await getTodoCardData(args())).toEqual({ state: 'unavailable' })
        expect(await getTodoCardData(args())).toEqual(ready('low_stock'))
        expect(mocks.computeShopTodos).toHaveBeenCalledTimes(3)
        log.mockRestore()
    })
})
