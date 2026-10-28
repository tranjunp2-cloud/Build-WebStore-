/**
 * TC-AIWB-110 — the website's languages for the copilot (the editor's Menu → Quick language):
 * site_read view "languages" (primary, second, written-in language, untranslated sections per page),
 * the language change it stages (`site.languages_patch`: add / remove the second, make one primary —
 * exactly the menu fields Quick language writes), the apply against the menu draft (fingerprint guard,
 * rebuilt from the stored menu, never from the plan) and its undo (`site.nav_restore`).
 * Real: site-languages.ts, appliers/site-structure.ts (applySiteLanguagesPatch), site-nav currentFrame,
 * site-blocks, lib/site-languages, the site access check.
 * Faked: Payload Local API + its SQL (in memory: the site row, its pages and their translations),
 * the tenant row lock (runs the callback), the plan gate, media cleanup, publish and rate limiter.
 */

import { PgDialect } from 'drizzle-orm/pg-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applySiteLanguagesPatch, applySiteNavRestore } from '@/lib/ai-platform/appliers/site-structure'
import { blockHash } from '@/lib/ai-platform/site/site-blocks'
import { languagesHeader, prepareSiteLanguages, readSiteLanguages, translationCoverage } from '@/lib/ai-platform/site/site-languages'
import { FAQ, HERO, LAYOUT, NAV, OWNER, PAGE_ID, SITE_ID, page, site } from './web-builder-fixtures'

const state = vi.hoisted(() => ({
    site: null as Record<string, unknown> | null,
    pages: new Map<string, Record<string, unknown>>(),
    translations: {} as Record<string, unknown>,
    writes: [] as Array<{ collection: string; data: Record<string, unknown> }>,
}))

vi.mock('payload', () => {
    const cms = {
        findByID: vi.fn(async ({ collection, id }: { collection: string; id: string | number }) => (collection === 'sites' ? state.site : (state.pages.get(String(id)) ?? null))),
        find: vi.fn(async ({ collection }: { collection: string }) => ({ docs: collection === 'pages' ? [...state.pages.values()] : [], totalDocs: state.pages.size })),
        update: vi.fn(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
            state.writes.push({ collection, data })
            if (collection === 'sites') state.site = { ...state.site, ...data }
            return {}
        }),
        db: {
            drizzle: {
                execute: vi.fn(async (query: unknown) => {
                    const text = new PgDialect().sqlToQuery(query as never).sql
                    if (text.includes('deleted_at IS NOT NULL')) return { rows: [] }
                    return { rows: [...state.pages.keys()].map((id) => ({ id, locale_content: state.translations[id] ?? {} })) }
                }),
            },
        },
    }
    return { getPayload: vi.fn(async () => cms) }
})
vi.mock('@/lib/payload/tenant-row-lock', () => ({
    withTenantRowLock: vi.fn(async (_cms: unknown, _tenant: unknown, operation: (req: { transactionID: string }) => Promise<unknown>) => operation({ transactionID: 'tx' })),
    lockTenantSiteRows: vi.fn(async () => undefined),
    executeTenantTransaction: vi.fn(async () => ({ rows: [] })),
}))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({ getActivePlanSubscription: vi.fn(async () => ({ plan: 'PROFESSIONAL' })), canUse: vi.fn(async () => true) }))
vi.mock('@/lib/ai/media-injector', () => ({ stripOrphanMediaRefs: vi.fn(async () => undefined) }))
vi.mock('@/lib/ai-platform/appliers/blog-draft', () => ({ ingestBlogImage: vi.fn() }))
vi.mock('@/lib/sites/publish-site', () => ({ publishSite: vi.fn() }))
vi.mock('@/lib/rateLimit', () => ({ checkTwoTierRateLimit: vi.fn(async () => ({ allowed: true })) }))

type Prepared = { error?: { code: string }; kind?: string; diffs?: Array<{ field: string; before: string | null; after: string }>; guardrails?: Array<{ rule: string }>; plan?: Record<string, unknown> }
const MENU = { ...NAV, links: [{ label: 'Home', url: '/' }] }
const draft = (input: Record<string, unknown>) => prepareSiteLanguages(OWNER, { siteId: String(SITE_ID), why: 'Malay buyers', ...input }) as Promise<Prepared>

beforeEach(() => {
    vi.clearAllMocks()
    state.site = site({ generationLocale: 'en', locale: 'ms', headerBlock: MENU })
    state.pages = new Map([[String(PAGE_ID), page(structuredClone(LAYOUT))]])
    state.translations = { [String(PAGE_ID)]: { [String(HERO.id)]: { ms: { headline: 'Selamat datang' } } } }
    state.writes = []
})

describe('the menu fields Quick language writes [TC-AIWB-110]', () => {
    const one = site({ generationLocale: 'en' })

    it('adds a second language with the switcher on, removes it keeping the translations, makes one primary', () => {
        expect(languagesHeader(MENU, one, { siteId: '1', why: 'x', change: 'add_second', locale: 'ms' })).toMatchObject({ multilingualEnabled: true, showLanguageSwitcher: true, secondaryLocale: 'ms' })
        const two = site({ generationLocale: 'en', headerBlock: { ...MENU, secondaryLocale: 'ms', showLanguageSwitcher: true, _localeContent: { ms: { links: [], secondaryLocale: 'ms' } } } })
        const removed = languagesHeader(two.headerBlock as never, two, { siteId: '1', why: 'x', change: 'remove_second', locale: null })
        expect(removed).toMatchObject({ showLanguageSwitcher: false, secondaryLocale: '', _localeContent: { ms: { links: [] } } })
        expect(languagesHeader(two.headerBlock as never, two, { siteId: '1', why: 'x', change: 'make_primary', locale: 'ms' })).toMatchObject({ primaryLocale: 'ms', secondaryLocale: 'en' })
    })

    it('refuses what would change nothing or names no language', () => {
        expect(languagesHeader(MENU, one, { siteId: '1', why: 'x', change: 'add_second', locale: 'en' })).toMatchObject({ error: { code: 'same_language' } })
        expect(languagesHeader(MENU, one, { siteId: '1', why: 'x', change: 'remove_second', locale: null })).toMatchObject({ error: { code: 'no_change' } })
        expect(languagesHeader(MENU, one, { siteId: '1', why: 'x', change: 'make_primary', locale: null })).toMatchObject({ error: { code: 'invalid_input' } })
    })
})

describe('site_read view "languages" [TC-AIWB-110]', () => {
    it('lists the languages from the menu draft (not the language last viewed) and the untranslated sections', async () => {
        state.site = { ...state.site!, pendingHeaderBlock: { ...MENU, secondaryLocale: 'ms', showLanguageSwitcher: true } }

        const read = await readSiteLanguages(OWNER, SITE_ID)

        expect(read).toMatchObject({ writtenIn: { locale: 'en' }, primary: { locale: 'en' }, second: { locale: 'ms', name: 'Bahasa Melayu' }, canAdd: [] })
        const sections = LAYOUT.filter((b) => b.blockType !== 'navigation' && b.blockType !== 'footer').length
        expect(read.pages).toEqual([{ pageId: String(PAGE_ID), page: 'Home', sections, missing: { ms: sections - 1 } }])
    })

    it('one language: nothing to fill, Bahasa Melayu can be added', async () => {
        const read = await readSiteLanguages(OWNER, SITE_ID)

        expect(read.second).toBeNull()
        expect(read.canAdd).toEqual([{ locale: 'ms', name: 'Bahasa Melayu' }])
        expect(read.pages[0]!.missing).toEqual({})
    })

    it('after Make Default the primary language needs the translation too', () => {
        const made = site({ generationLocale: 'en', headerBlock: { ...MENU, primaryLocale: 'ms', secondaryLocale: 'en' } })

        expect(translationCoverage(made, [page([HERO, FAQ])]).toFill).toEqual(['ms'])
    })
})

describe('the language change card and its apply [TC-AIWB-110]', () => {
    it('drafts adding Malay: before → after, what comes next, and a plan without the menu itself', async () => {
        const prepared = await draft({ change: 'add_second', locale: 'ms' })

        expect(prepared.kind).toBe('site.languages_patch')
        expect(prepared.diffs).toEqual([expect.objectContaining({ field: 'second language', before: 'None', after: 'Bahasa Melayu' })])
        expect(prepared.guardrails?.map((g) => g.rule)).toContain('translate_next')
        expect(prepared.plan).toEqual({ siteId: String(SITE_ID), change: 'add_second', locale: 'ms', base: blockHash(MENU as never) })
    })

    it('refuses a site without a menu', async () => {
        state.site = site({ generationLocale: 'en' })

        expect((await draft({ change: 'add_second', locale: 'ms' })).error).toMatchObject({ code: 'no_menu' })
    })

    it('writes the menu draft rebuilt from the stored one, with an undo that puts the previous draft back', async () => {
        const plan = (await draft({ change: 'add_second', locale: 'ms' })).plan!

        const result = await applySiteLanguagesPatch(plan, OWNER)

        expect(state.writes).toEqual([{ collection: 'sites', data: { pendingHeaderBlock: expect.objectContaining({ secondaryLocale: 'ms', showLanguageSwitcher: true, links: MENU.links }) } }])
        expect(result.undo).toMatchObject({ kind: 'site.nav_restore', payload: { siteId: String(SITE_ID), header: { previous: null }, footer: null } })
    })

    it('refuses when the menu changed after the draft', async () => {
        const plan = (await draft({ change: 'add_second', locale: 'ms' })).plan!
        state.site = { ...state.site!, pendingHeaderBlock: { ...MENU, links: [] } }

        await expect(applySiteLanguagesPatch(plan, OWNER)).rejects.toMatchObject({ status: 409 })
        expect(state.writes).toEqual([])
    })
})

describe('Make primary moves the language the editor shows, as the editor\'s Make Default does [TC-AIREL-262]', () => {
    const second = { ...MENU, multilingualEnabled: true, showLanguageSwitcher: true, secondaryLocale: 'ms' }

    it('writes Sites.locale with the new primary together with the menu draft, and undo puts both back', async () => {
        state.site = site({ generationLocale: 'en', locale: 'en', headerBlock: second })
        const plan = (await draft({ change: 'make_primary', locale: 'ms' })).plan!

        const result = await applySiteLanguagesPatch(plan, OWNER)

        expect(state.writes).toEqual([{ collection: 'sites', data: { pendingHeaderBlock: expect.objectContaining({ primaryLocale: 'ms', secondaryLocale: 'en' }), locale: 'ms' } }])
        expect(result.undo?.payload).toMatchObject({ locale: { previous: 'en', after: 'ms' } })

        await applySiteNavRestore(result.undo!.payload, OWNER)

        expect(state.site!.locale).toBe('en')
        expect(state.writes.at(-1)).toEqual({ collection: 'sites', data: { pendingHeaderBlock: null, locale: 'en' } })
    })

    it('adding or removing the second language does not touch Sites.locale; undo leaves a locale the editor moved since', async () => {
        state.site = site({ generationLocale: 'en', locale: 'en', headerBlock: MENU })
        await applySiteLanguagesPatch((await draft({ change: 'add_second', locale: 'ms' })).plan!, OWNER)
        expect(state.writes[0]!.data).not.toHaveProperty('locale')

        state.writes = []
        state.site = site({ generationLocale: 'en', locale: 'en', headerBlock: second })
        const made = await applySiteLanguagesPatch((await draft({ change: 'make_primary', locale: 'ms' })).plan!, OWNER)
        // the merchant switched the editor to English meanwhile
        state.site = { ...state.site!, locale: 'en' }
        state.writes = []

        await applySiteNavRestore(made.undo!.payload, OWNER)

        expect(state.writes[0]!.data).not.toHaveProperty('locale')
    })
})
