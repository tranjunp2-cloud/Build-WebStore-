/**
 * TC-AIWB-42 — publishing inside the caller's tenant transaction (the copilot's `site.publish`): every read and
 * write joins it, the first page that can't be published (validation or database error) stops it and rolls the
 * whole publish back (nothing goes live alone), and the cache is revalidated only after the commit. Without a transaction the
 * editor's Publish keeps its behaviour (partial failures are reported, not thrown).
 * Real: publishSite. Faked: the Payload Local API (in memory), the plan gate, the tenant SQL helper, next/cache.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { revalidateTag } from 'next/cache'
import { PublishRolledBack, publishSite } from '@/lib/sites/publish-site'
import { executeTenantTransaction } from '@/lib/payload/tenant-row-lock'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@/lib/migration/pw1-publish-grant', () => ({ hasCompletedPw1PublishGrant: vi.fn(async () => false) }))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(async () => ({ plan: 'PROFESSIONAL' })),
    canUse: vi.fn(async () => true),
}))
vi.mock('@/lib/payload/tenant-row-lock', () => ({ executeTenantTransaction: vi.fn(async () => ({ rows: [] })) }))

type Call = { op: string; collection: string; req?: unknown }
const state = { calls: [] as Call[], failPage: null as null | { id: number; error: Error } }

const validationError = () => Object.assign(new Error('The following field is invalid: layout.0.headline'), { data: { errors: [{ path: 'layout.0.headline', message: 'This field is required.' }] } })
const databaseError = () => Object.assign(new Error('insert failed'), { cause: { code: '23505', message: 'duplicate key' } })

const SITE = { id: 1, name: 'Kedai', status: 'published', tenant: 'tenant-1', pendingHeaderBlock: { blockType: 'navigation', links: [] } }
const PAGES = [
    { id: 1, title: 'Home', site: 1, layout: [{ blockType: 'hero', headline: 'Hi' }] },
    { id: 2, title: 'About', site: 1, layout: [{ blockType: 'hero', headline: 'About us' }] },
]

const cms = {
    findByID: vi.fn(async ({ collection, req, depth }: { collection: string; req?: unknown; depth?: number }) => {
        state.calls.push({ op: 'findByID', collection, req })
        return depth === 1 ? { ...SITE, tenant: { id: 'tenant-1', slug: 'kedai' } } : SITE
    }),
    find: vi.fn(async ({ collection, req }: { collection: string; req?: unknown }) => {
        state.calls.push({ op: 'find', collection, req })
        return { docs: PAGES, hasNextPage: false }
    }),
    update: vi.fn(async ({ collection, id, req }: { collection: string; id: number | string; req?: unknown }) => {
        state.calls.push({ op: 'update', collection, req })
        if (collection === 'pages' && state.failPage && Number(id) === state.failPage.id) throw state.failPage.error
        return collection === 'sites' ? { ...SITE, publishedAt: 'now' } : { id }
    }),
    db: { drizzle: { execute: vi.fn(async () => ({ rows: [] })) } },
} as unknown as Payload

const OWNER = { id: 'user-1', tenants: [{ tenant: 'tenant-1', role: 'owner', status: 'active' }] }
const req = { transactionID: 'tx-publish' }

function publishInTx() {
    const afterCommit: Array<() => void> = []
    const run = publishSite({ payload: cms, user: OWNER, siteId: '1', body: {}, pw1Grant: null, tx: { req, afterCommit: (task) => afterCommit.push(task) } })
    return { run, afterCommit }
}

beforeEach(() => {
    vi.clearAllMocks()
    state.calls = []
    state.failPage = null
    process.env.NEXT_PUBLIC_PLATFORM_DOMAIN = 'primeweb.app'
})

describe('publishSite in a tenant transaction [TC-AIWB-42]', () => {
    it('joins the transaction for every read and write, and revalidates only after the commit', async () => {
        const { run, afterCommit } = publishInTx()

        const result = await run

        expect(result.status).toBe(200)
        expect(state.calls.length).toBeGreaterThan(0)
        expect(state.calls.every((call) => call.req === req)).toBe(true)
        expect(vi.mocked(executeTenantTransaction)).toHaveBeenCalledWith(cms, req, expect.anything())
        expect(revalidateTag).not.toHaveBeenCalled()
        afterCommit.forEach((task) => task())
        expect(revalidateTag).toHaveBeenCalledWith('site-1')
    })

    it('a page that fails validation rolls the publish back at once: nothing goes live, no later page is written', async () => {
        // Payload's update kills the caller's transaction on any error: a later update would deadlock on its locks
        state.failPage = { id: 1, error: validationError() }

        const failure = await publishInTx().run.catch((e: unknown) => e)

        expect(failure).toBeInstanceOf(PublishRolledBack)
        expect((failure as PublishRolledBack).result).toMatchObject({ status: 409, body: { error: { code: 'PARTIAL_PUBLISH_FAILURE', failedPages: ['1'] } } })
        expect(state.calls.filter((c) => c.op === 'update' && c.collection === 'pages')).toHaveLength(1)
        expect(state.calls.some((c) => c.op === 'update' && c.collection === 'sites')).toBe(false)
    })

    it('a database error stops at once (the transaction is aborted) and rolls back', async () => {
        state.failPage = { id: 1, error: databaseError() }

        const failure = await publishInTx().run.catch((e: unknown) => e)

        expect(failure).toBeInstanceOf(PublishRolledBack)
        expect((failure as PublishRolledBack).result.status).toBe(500)
        expect(state.calls.filter((c) => c.op === 'update' && c.collection === 'pages')).toHaveLength(1)
    })
})

describe('publishSite without a transaction (the editor Publish) keeps its behaviour [TC-AIWB-42]', () => {
    it('reports a failed page without throwing and revalidates right away on success', async () => {
        state.failPage = { id: 2, error: validationError() }
        const failed = await publishSite({ payload: cms, user: OWNER, siteId: '1', body: {}, pw1Grant: null })
        expect(failed.status).toBe(409)

        state.failPage = null
        const ok = await publishSite({ payload: cms, user: OWNER, siteId: '1', body: {}, pw1Grant: null })
        expect(ok.status).toBe(200)
        expect(revalidateTag).toHaveBeenCalled()
        expect(state.calls.every((call) => call.req === undefined)).toBe(true)
    })
})
