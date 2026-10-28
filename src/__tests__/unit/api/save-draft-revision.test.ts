/**
 * TC-AIWB-41 — the editor save is refused when the draft changed since the editor read it
 * (another tab, an approved copilot change), instead of overwriting it.
 * TC-AIWB-112..117 — only what a save really changes counts: an unchanged theme / menu / footer / widgets
 * (sent with every save) neither needs the site revision to match nor bumps it; a retry of a committed save
 * (same saveId) is let through; the revision handed back never claims a part the save did not check.
 * Real: the save route, lib/sites/editor-revision (SQL rendered with drizzle's PgDialect).
 * Faked: Payload Local API (site / page rows in `state`), the tenant row lock (runs the callback),
 * raw SQL answered from `state.revision` / `state.lastSaveId`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PATCH } from '@/app/api/sites/[siteId]/save/route'
import { formatDraftVersion, parseDraftVersion, staleParts } from '@/lib/sites/editor-revision'

vi.mock('@payload-config', () => ({ default: {} }))

const state = vi.hoisted(() => ({
    revision: { site: 3, page: 7 },
    lastSaveId: { site: null as string | null, page: null as string | null },
    site: {} as Record<string, unknown>,
    pageUpdates: 0,
    siteUpdates: 0,
}))

vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'user-1', email: 'owner@example.com', tenants: [{ tenant: 'tenant-1' }] }),
}))

vi.mock('payload', () => ({
    getPayload: vi.fn().mockResolvedValue({
        findByID: vi.fn(async ({ collection }: { collection: string }) =>
            collection === 'sites' ? { id: 1, tenant: 'tenant-1', ...state.site } : { id: 42, site: 1, _status: 'draft', layout: [] }),
        find: vi.fn(async () => ({ docs: [] })),
        update: vi.fn(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
            if (collection === 'pages') state.pageUpdates += 1
            if (collection === 'sites') {
                state.siteUpdates += 1
                state.site = { ...state.site, ...data }
            }
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
        const { sql, params } = new PgDialect().sqlToQuery(query as Parameters<PgDialect['sqlToQuery']>[0])
        if (/SELECT editor_revision, editor_last_save_id FROM sites/.test(sql)) {
            return { rows: [{ editor_revision: state.revision.site, editor_last_save_id: state.lastSaveId.site }] }
        }
        if (/SELECT editor_revision, editor_last_save_id FROM pages/.test(sql)) {
            return { rows: [{ editor_revision: state.revision.page, editor_last_save_id: state.lastSaveId.page }] }
        }
        if (/UPDATE sites SET editor_revision = editor_revision \+ 1, editor_last_save_id = \$1/.test(sql)) {
            state.revision.site += 1
            state.lastSaveId.site = params[0] as string | null
        }
        if (/UPDATE pages SET editor_revision = editor_revision \+ 1, editor_last_save_id = \$1/.test(sql)) {
            state.revision.page += 1
            state.lastSaveId.page = params[0] as string | null
        }
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
        state.lastSaveId = { site: null, page: null }
        state.site = {}
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
        // a save that writes nothing versioned checked nothing: it echoes its base, never the newer site revision
        expect(localeSave.headers.get('x-draft-version')).toBe('3.7')
    })

    it('lets a save without a base through (older clients)', async () => {
        state.revision = { site: 9, page: 9 }

        const res = await save({ blocks, isDraft: true })

        expect(res.status).toBe(200)
        expect(state.pageUpdates).toBe(1)
    })
})

// what the editor loaded and sends back with every save (theme / menu / footer / widgets)
const stored = {
    theme: { primaryColor: '#0d9488', fontHeading: null, accentColor: '' },
    headerBlock: { blockType: 'navigation', links: [{ url: '/', label: 'Home' }] },
    pendingHeaderBlock: { blockType: 'navigation', links: [{ url: '/', label: 'Home' }, { url: '/about', label: 'About' }] },
    footerBlock: null,
    pendingFooterBlock: null,
    globalBlocks: null,
    pendingGlobalBlocks: { cartWidget: null, whatsappButton: { blockType: 'whatsapp-button', phone: '60123' }, socialWidget: null },
}
// the editor's view: pending draft else live, the theme without its empty fields, keys in another order (JSONB)
const editorFrames = {
    theme: { primaryColor: '#0d9488' },
    headerBlock: { links: [{ label: 'Home', url: '/' }, { label: 'About', url: '/about' }], blockType: 'navigation' },
    footerBlock: null,
    globalBlocks: { cartWidget: null, whatsappButton: { phone: '60123', blockType: 'whatsapp-button' }, socialWidget: null },
}

describe('editor save — only real changes count [TC-AIWB-112..117]', () => {
    beforeEach(() => {
        state.revision = { site: 3, page: 7 }
        state.lastSaveId = { site: null, page: null }
        state.site = structuredClone(stored)
        state.pageUpdates = 0
        state.siteUpdates = 0
    })

    it('TC-AIWB-112: unchanged theme / menu / footer / widgets on a site saved elsewhere since → 200, page saved, no site bump, site part stays at the base', async () => {
        // Arrange — another tab saved its own page twice: the site revision moved on
        state.revision.site = 5

        // Act
        const res = await save({ blocks, ...editorFrames, isDraft: true, base: '3.7', saveId: 'tab-b-1' })

        // Assert
        expect(res.status).toBe(200)
        expect(state.revision.site).toBe(5)
        expect(state.revision.page).toBe(8)
        expect(state.pageUpdates).toBe(1)
        // never claims the site revision 5 it did not load: a later real theme change is still checked
        expect(res.headers.get('x-draft-version')).toBe('3.8')
    })

    it('TC-AIWB-113: a theme or menu that differs from the stored one on a site changed since → 409 (still refused), nothing written', async () => {
        // Arrange — an approved copilot change (or another tab) wrote the site since this tab loaded it
        state.revision.site = 4

        // Act
        const themeChanged = await save({ blocks, ...editorFrames, theme: { primaryColor: '#ff0000' }, isDraft: true, base: '3.7' })
        const menuChanged = await save({ blocks, ...editorFrames, headerBlock: stored.headerBlock, isDraft: true, base: '3.7' })

        // Assert
        expect(themeChanged.status).toBe(409)
        expect(await themeChanged.json()).toMatchObject({ code: 'DRAFT_CHANGED', parts: ['site'], draftVersion: '4.7' })
        expect(menuChanged.status).toBe(409)
        expect(state.pageUpdates).toBe(0)
        expect(state.siteUpdates).toBe(0)
        expect(state.revision).toEqual({ site: 4, page: 7 })
    })

    it('TC-AIWB-114: a real theme / widgets change on the current site revision is a site write: bumped and handed back', async () => {
        // Act
        const res = await save({ ...editorFrames, globalBlocks: { ...editorFrames.globalBlocks, cartWidget: { blockType: 'cartWidget' } }, base: '3.7', saveId: 's-1' })

        // Assert
        expect(res.status).toBe(200)
        expect(state.revision.site).toBe(4)
        expect(state.lastSaveId.site).toBe('s-1')
        expect(res.headers.get('x-draft-version')).toBe('4.7')
    })

    it('TC-AIWB-115: a retry of a save that was committed (same saveId, old base) → 200 instead of locking the editor', async () => {
        // Arrange — the first try was committed but its response was lost (the editor still holds base 3.7)
        const first = await save({ blocks, ...editorFrames, theme: { primaryColor: '#222222' }, isDraft: true, base: '3.7', saveId: 'save-a' })
        expect(first.status).toBe(200)
        expect(state.revision).toEqual({ site: 4, page: 8 })

        // Act — the retry, with a later edit of the page
        const retry = await save({ blocks: [{ blockType: 'hero', headline: 'Typed after' }], ...editorFrames, theme: { primaryColor: '#222222' }, isDraft: true, base: '3.7', saveId: 'save-a' })

        // Assert
        expect(retry.status).toBe(200)
        expect(state.pageUpdates).toBe(2)
        expect(retry.headers.get('x-draft-version')).toBe('4.9')
    })

    it('TC-AIWB-116: the same old base with a different saveId (someone else wrote since) → 409', async () => {
        // Arrange — another tab's committed save
        await save({ blocks, ...editorFrames, isDraft: true, base: '3.7', saveId: 'tab-a' })

        // Act
        const res = await save({ blocks, ...editorFrames, isDraft: true, base: '3.7', saveId: 'tab-b' })

        // Assert
        expect(res.status).toBe(409)
        expect(await res.json()).toMatchObject({ parts: ['page'] })
    })

    it('TC-AIWB-116: an approved copilot change after the committed try (bump without a saveId) still refuses the retry', async () => {
        // Arrange — the lost-response save, then a copilot change of the same page
        await save({ blocks, ...editorFrames, isDraft: true, base: '3.7', saveId: 'save-a' })
        state.revision.page += 1
        state.lastSaveId.page = null

        // Act
        const retry = await save({ blocks, ...editorFrames, isDraft: true, base: '3.7', saveId: 'save-a' })

        // Assert
        expect(retry.status).toBe(409)
    })

    it('TC-AIWB-117: a settings save (contact info only) echoes the base parts it did not check and bumps nothing', async () => {
        // Arrange — the site and the page both moved on elsewhere
        state.revision = { site: 5, page: 9 }

        // Act
        const res = await save({ contactInfo: { phone: '+60123456789' }, base: '3.7', saveId: 'settings-1' })

        // Assert
        expect(res.status).toBe(200)
        expect(state.siteUpdates).toBe(1)
        expect(state.revision).toEqual({ site: 5, page: 9 })
        expect(res.headers.get('x-draft-version')).toBe('3.7')
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

    it('TC-AIWB-115: a part whose last bump was this same save is not stale; another save id or none is', () => {
        const base = { site: 1, page: 1 }
        const current = { site: 2, page: 2, lastSaveId: { site: 'save-a', page: null } }

        expect(staleParts(base, current, { site: true, page: true }, 'save-a')).toEqual(['page'])
        expect(staleParts(base, current, { site: true, page: false }, 'save-b')).toEqual(['site'])
        expect(staleParts(base, current, { site: true, page: false })).toEqual(['site'])
    })
})
