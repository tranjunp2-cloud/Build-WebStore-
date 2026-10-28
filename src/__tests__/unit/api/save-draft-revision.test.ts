/**
 * TC-AIWB-41 — the editor save is refused when the draft changed since the editor read it
 * (another tab, an approved copilot change), instead of overwriting it.
 * Real: the save route, lib/sites/editor-revision (SQL rendered with drizzle's PgDialect).
 * Faked: Payload Local API, the tenant row lock (runs the callback), raw SQL answered from `revision`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PATCH } from '@/app/api/sites/[siteId]/save/route'
import { formatDraftVersion, parseDraftVersion, staleParts } from '@/lib/sites/editor-revision'

vi.mock('@payload-config', () => ({ default: {} }))

const state = vi.hoisted(() => ({
    revision: { site: 3, page: 7 },
    pageUpdates: 0,
    siteUpdates: 0,
}))

vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'user-1', email: 'owner@example.com', tenants: [{ tenant: 'tenant-1' }] }),
}))

vi.mock('payload', () => ({
    getPayload: vi.fn().mockResolvedValue({
        findByID: vi.fn(async ({ collection }: { collection: string }) =>
            collection === 'sites' ? { id: 1, tenant: 'tenant-1' } : { id: 42, site: 1, _status: 'draft', layout: [] }),
        find: vi.fn(async () => ({ docs: [] })),
        update: vi.fn(async ({ collection }: { collection: string }) => {
            if (collection === 'pages') state.pageUpdates += 1
            if (collection === 'sites') state.siteUpdates += 1
            return {}
        }),
    }),
}))

vi.mock('@/lib/rateLimit', () => ({
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 59, resetAt: Date.now() + 60000 }),
}))
vi.mock('@/lib/payload-retry', () => ({
    withPayloadRetry: vi.fn().mockImplementation(async (fn: () => unknown) => fn()),
    classifyTransientError: vi.fn().mockReturnValue(null),
}))
vi.mock('@/lib/ai/media-injector', () => ({
    stripOrphanMediaRefs: vi.fn().mockImplementation(async (blocks: unknown[]) => ({ stripped: 0, checked: blocks.length })),
    cleanupNonNumericImageFields: vi.fn(),
}))
vi.mock('@/lib/block-normalization', () => ({ normalizeBlocksForPersistence: vi.fn((blocks: unknown[]) => blocks) }))
vi.mock('@/lib/payload/tenant-row-lock', () => ({
    TenantSiteLockError: class TenantSiteLockError extends Error {},
    withTenantRowLock: vi.fn(async (_p: unknown, _t: unknown, operation: (req: { transactionID: string }) => Promise<unknown>) =>
        operation({ transactionID: 'save-transaction' })),
    lockTenantSiteRows: vi.fn().mockResolvedValue(undefined),
    // revision reads / bumps answered from `state.revision`; the locale_content write is a no-op
    executeTenantTransaction: vi.fn(async (_p: unknown, _r: unknown, query: unknown) => {
        const { PgDialect } = await import('drizzle-orm/pg-core')
        const { sql } = new PgDialect().sqlToQuery(query as Parameters<PgDialect['sqlToQuery']>[0])
        if (/SELECT editor_revision FROM sites/.test(sql)) return { rows: [{ editor_revision: state.revision.site }] }
        if (/SELECT editor_revision FROM pages/.test(sql)) return { rows: [{ editor_revision: state.revision.page }] }
        if (/UPDATE sites SET editor_revision/.test(sql)) state.revision.site += 1
        if (/UPDATE pages SET editor_revision/.test(sql)) state.revision.page += 1
        return { rows: [] }
    }),
}))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({ id: 'sub-1', plan: 'PROFESSIONAL_TM_USER', status: 'active' }),
    canUse: vi.fn().mockResolvedValue(true),
}))

const save = (body: Record<string, unknown>) =>
    PATCH(
        new NextRequest('http://localhost:3000/api/sites/1/save?pageId=42', {
            method: 'PATCH',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
        }),
        { params: Promise.resolve({ siteId: '1' }) },
    )

const blocks = [{ blockType: 'hero', headline: 'Edited in this tab' }]

describe('editor save — draft revision guard [TC-AIWB-41]', () => {
    beforeEach(() => {
        state.revision = { site: 3, page: 7 }
        state.pageUpdates = 0
        state.siteUpdates = 0
    })

    it('saves from the current revision, bumps what it wrote and returns the new revision', async () => {
        const res = await save({ blocks, theme: { primaryColor: '#111111' }, isDraft: true, base: '3.7' })

        expect(res.status).toBe(200)
        expect(res.headers.get('x-draft-version')).toBe('4.8')
        expect((await res.json()).draftVersion).toBe('4.8')
        expect(state.pageUpdates).toBe(1)
    })

    it('refuses a save whose page changed since (an approved copilot edit) and writes nothing', async () => {
        state.revision.page = 8

        const res = await save({ blocks, theme: { primaryColor: '#111111' }, isDraft: true, base: '3.7' })

        expect(res.status).toBe(409)
        expect(await res.json()).toMatchObject({ code: 'DRAFT_CHANGED', parts: ['page'], draftVersion: '3.8' })
        expect(state.pageUpdates).toBe(0)
        expect(state.siteUpdates).toBe(0)
    })

    it('refuses a theme / menu save when the site part changed, but not a save that writes no site part', async () => {
        state.revision.site = 4

        const themeSave = await save({ theme: { primaryColor: '#111111' }, base: '3.7' })
        const localeSave = await save({ locale: 'ms', base: '3.7' })

        expect(themeSave.status).toBe(409)
        expect(localeSave.status).toBe(200)
        // a save that writes nothing versioned leaves the revision as it is
        expect(localeSave.headers.get('x-draft-version')).toBe('4.7')
    })

    it('lets a save without a base through (older clients)', async () => {
        state.revision = { site: 9, page: 9 }

        const res = await save({ blocks, isDraft: true })

        expect(res.status).toBe(200)
        expect(state.pageUpdates).toBe(1)
    })
})

describe('draft revision helpers [TC-AIWB-41]', () => {
    it('round-trips the version and rejects malformed bases', () => {
        expect(parseDraftVersion(formatDraftVersion({ site: 12, page: 3 }))).toEqual({ site: 12, page: 3 })
        expect(formatDraftVersion({ site: 2, page: null })).toBe('2.0')
        for (const bad of [undefined, '', '3', 'a.b', '1.2.3', 7]) expect(parseDraftVersion(bad)).toBeNull()
    })

    it('only the parts a save writes can make it stale', () => {
        const base = { site: 1, page: 1 }
        const current = { site: 2, page: 2 }

        expect(staleParts(base, current, { site: true, page: true })).toEqual(['site', 'page'])
        expect(staleParts(base, current, { site: false, page: true })).toEqual(['page'])
        expect(staleParts(base, current, { site: false, page: false })).toEqual([])
        expect(staleParts(null, current, { site: true, page: true })).toEqual([])
    })
})
