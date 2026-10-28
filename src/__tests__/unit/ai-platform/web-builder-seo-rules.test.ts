/**
 * TC-AIWB-78 / 79 / 80 / 81 / 82 / 83 — page SEO rules of the web builder copilot, ported from staging's
 * generate-seo route: tracked keywords + "has content" + slug state in what the agent reads, no-content and
 * short-description notes, and the slug proposal for pages that were never published (with apply + undo).
 * Real: site-read.ts, site-seo-translate.ts (prepareSeoChange, slugFromText), appliers/site-edits.ts.
 * Faked: Payload Local API, the tenant row lock.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applySiteSeoPatch, applySiteSeoRestore } from '@/lib/ai-platform/appliers/site-edits'
import { readSite } from '@/lib/ai-platform/site/site-read'
import { prepareSeoChange, seoFingerprint, slugFromText } from '@/lib/ai-platform/site/site-seo-translate'
import { LAYOUT, NAV, OWNER, PAGE_ID, SITE_ID, page, site } from './web-builder-fixtures'

const state = vi.hoisted(() => ({
    site: null as Record<string, unknown> | null,
    /** the page as the editor shows it (latest draft) */
    page: null as Record<string, unknown> | null,
    /** the page's published row; null = never published */
    main: null as Record<string, unknown> | null,
    others: [] as unknown[],
    writes: [] as Array<Record<string, unknown>>,
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        findByID: vi.fn(async ({ collection, draft }: { collection: string; draft?: boolean }) => {
            if (collection === 'sites') return state.site
            return draft === false ? state.main : state.page
        }),
        find: vi.fn(async () => ({ docs: state.others, totalDocs: state.others.length })),
        update: vi.fn(async (arg: { data: Record<string, unknown> }) => {
            state.writes.push(arg.data)
            state.page = { ...state.page!, ...arg.data }
            return {}
        }),
    })),
}))
vi.mock('@/lib/payload/tenant-row-lock', () => ({
    withTenantRowLock: vi.fn(async (_c: unknown, _t: unknown, op: (req: { transactionID: string }) => Promise<unknown>) => op({ transactionID: 'tx' })),
    lockTenantSiteRows: vi.fn(async () => undefined),
}))

vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(async () => ({ plan: 'PROFESSIONAL' })),
    canUse: vi.fn(async () => true),
}))

type Result = Record<string, unknown> & {
    error?: { code: string; message: string }
    diffs?: Array<{ field: string; before: string | null; after: string }>
    guardrails?: Array<{ rule: string; ok: boolean }>
    plan?: Record<string, unknown>
}
const seo = (input: Record<string, unknown>) => prepareSeoChange(OWNER, { siteId: String(SITE_ID), pageId: String(PAGE_ID), why: 'Better search result', ...input }) as Promise<Result>
const ids = { siteId: String(SITE_ID), pageId: String(PAGE_ID) }

beforeEach(() => {
    state.site = site({ seo: { trackedKeywords: [{ keyword: 'batik kelantan' }, { keyword: ' ' }, { keyword: 'kain batik' }] } })
    // a draft inner page that was never published
    state.page = page(structuredClone(LAYOUT), { slug: '/about-us', isHomepage: false, seo: { title: 'Old title', description: 'Old description' } })
    state.main = state.page
    state.others = []
    state.writes = []
})

describe('site_read page view — what the agent writes SEO from [TC-AIWB-78]', () => {
    const read = async () => ((await readSite(OWNER, { view: 'page', siteId: String(SITE_ID), pageId: String(PAGE_ID) })) as { seo: Record<string, unknown> }).seo

    it('lists today\'s SEO, the tracked keywords (blanks dropped), content and an editable slug for a draft page', async () => {
        expect(await read()).toEqual({ title: 'Old title', description: 'Old description', keywords: ['batik kelantan', 'kain batik'], hasContent: true, slugEditable: true })
    })

    it('says the slug is not editable once the page was published, and for the home page', async () => {
        state.main = { ...state.page!, _status: 'published' }
        expect((await read()).slugEditable).toBe(false)
        state.main = state.page
        state.page = { ...state.page!, isHomepage: true }
        expect((await read()).slugEditable).toBe(false)
    })

    it('says hasContent false for a page with only the menu and footer', async () => {
        state.page = { ...state.page!, layout: [NAV] }
        expect((await read()).hasContent).toBe(false)
    })
})

describe('prepareSeoChange — content and length notes [TC-AIWB-79]', () => {
    it('adds a page_empty note (not a refusal) when the page has no content', async () => {
        state.page = { ...state.page!, layout: [] }
        const result = await seo({ title: 'About us | Kedai Batik' })
        expect(result.error).toBeUndefined()
        expect(result.guardrails).toContainEqual(expect.objectContaining({ rule: 'page_empty', ok: false }))
    })

    it('adds a description_short note under 150 characters and none at 150–160', async () => {
        expect((await seo({ description: 'd'.repeat(149) })).guardrails).toContainEqual(expect.objectContaining({ rule: 'description_short', ok: false }))
        expect((await seo({ description: 'd'.repeat(150) })).guardrails?.some((g) => g.rule === 'description_short')).toBe(false)
    })
})

describe('slugFromText [TC-AIWB-80]', () => {
    it('lowercases, drops punctuation and joins words with one dash (staging rule)', () => {
        expect(slugFromText('  About Us — Kedai Batik! ')).toBe('about-us-kedai-batik')
        expect(slugFromText('a__b - c')).toBe('a-b-c')
        expect(slugFromText('!!!')).toBe('')
    })

    it('caps the address at 80 characters without a trailing dash', () => {
        const slug = slugFromText(`${'word '.repeat(30)}`)
        expect(slug.length).toBeLessThanOrEqual(80)
        expect(slug.endsWith('-')).toBe(false)
    })
})

describe('prepareSeoChange — slug proposal for draft pages only [TC-AIWB-81]', () => {
    it('drafts the new address as a diff and carries from → to in the plan', async () => {
        const result = await seo({ slug: 'Our Story' })
        expect(result.error).toBeUndefined()
        expect(result.diffs).toEqual([expect.objectContaining({ field: 'Page address', before: '/about-us', after: '/our-story' })])
    })

    it('refuses with seo_slug_locked once the page was published', async () => {
        state.main = { ...state.page!, _status: 'published' }
        expect((await seo({ slug: 'new-address' })).error).toMatchObject({ code: 'seo_slug_locked' })
    })

    it('refuses with seo_slug_locked for the home page', async () => {
        state.page = { ...state.page!, isHomepage: true }
        expect((await seo({ slug: 'new-address' })).error).toMatchObject({ code: 'seo_slug_locked' })
    })

    it('refuses an address another page of the site already uses (seo_slug_taken) and one with no letters (seo_slug_invalid)', async () => {
        state.others = [{ id: 99, slug: '/new-address' }]
        expect((await seo({ slug: 'New Address' })).error).toMatchObject({ code: 'seo_slug_taken' })
        expect((await seo({ slug: '???' })).error).toMatchObject({ code: 'seo_slug_invalid' })
    })

    it('warns that links to the old address need updating', async () => {
        expect((await seo({ slug: 'our-story' })).guardrails).toContainEqual(expect.objectContaining({ rule: 'slug_links', ok: false }))
    })

    it('a slug alone is a change; the same slug again is no_change', async () => {
        const moved = await seo({ slug: 'our-story' })
        expect(moved.plan).toMatchObject({ slug: { from: '/about-us', to: '/our-story' }, changes: {} })
        expect((await seo({ slug: '/about-us' })).error).toMatchObject({ code: 'no_change' })
    })
})

describe('applySiteSeoPatch / restore with a slug [TC-AIWB-82]', () => {
    const base = () => seoFingerprint({ title: 'Old title', description: 'Old description' })

    it('writes the new address with the SEO and returns an undo that moves it back', async () => {
        const result = await applySiteSeoPatch({ ...ids, base: base(), changes: { title: 'New title' }, slug: { from: '/about-us', to: '/our-story' } }, OWNER)
        expect(state.writes[0]).toMatchObject({ slug: '/our-story', seo: { title: 'New title' } })
        expect(result.undo?.payload).toMatchObject({ slug: { from: '/our-story', to: '/about-us' } })

        const undo = result.undo!.payload as { base: string; changes: Record<string, unknown>; slug: unknown }
        await applySiteSeoRestore({ ...ids, ...undo }, OWNER)
        expect(state.page).toMatchObject({ slug: '/about-us', seo: { title: 'Old title' } })
    })

    it('refuses with 409 and writes nothing when the address changed or the page went live meanwhile', async () => {
        const plan = { ...ids, base: base(), changes: {}, slug: { from: '/something-else', to: '/our-story' } }
        expect(await applySiteSeoPatch(plan, OWNER).catch((e: unknown) => e)).toMatchObject({ status: 409 })

        state.main = { ...state.page!, _status: 'published' }
        const live = { ...plan, slug: { from: '/about-us', to: '/our-story' } }
        expect(await applySiteSeoPatch(live, OWNER).catch((e: unknown) => e)).toMatchObject({ status: 409, message: 'This page is published, so its address stays.' })
        expect(state.writes).toHaveLength(0)
    })
})
