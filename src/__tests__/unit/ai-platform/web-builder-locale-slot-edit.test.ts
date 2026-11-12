/**
 * TC-AIREL-220 … 229 — a copilot text edit made while a translation is on screen changes that translation, not the
 * page's original text (live bug: Malay view, "change the headline" rewrote the English section and left the Malay copy).
 * Real: site-read.ts, site-prepare.ts, site-structure.ts (prepare + apply), site-edits.ts, site-page-locale.ts,
 * site-locale-view.ts, site-patch.ts, lib/i18n/locale-display, the block registry.
 * Faked: Payload Local API (in memory, two pages), tenant row lock (runs the callback; locale_content SQL answered per page),
 * plan gate, media cleanup.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangeSetApplyError } from '@/lib/ai-platform/appliers/errors'
import { applySitePagePatch, applySitePageRestore } from '@/lib/ai-platform/appliers/site-edits'
import { applySitePagesPatch, applySitePagesRestore } from '@/lib/ai-platform/appliers/site-structure'
import { blockHash } from '@/lib/ai-platform/site/site-blocks'
import { preparePagePatch } from '@/lib/ai-platform/site/site-prepare'
import { readSite } from '@/lib/ai-platform/site/site-read'
import { prepareSitePatch } from '@/lib/ai-platform/site/site-structure'
import { slotLocaleOf, shownLayout } from '@/lib/ai-platform/site/site-locale-view'
import { revealTargetOf } from '@/lib/editor/reveal/reveal-target'
import { localizedBlock } from '@/lib/i18n/locale-display'
import { siteLanguagesOf } from '@/lib/site-languages'
import { FAQ, HERO, LAYOUT, OWNER, PAGE_ID, PRODUCTS, SITE_ID, page, site } from './web-builder-fixtures'

const OTHER_PAGE_ID = 11
const HERO_ID = HERO.id
const FAQ_ID = FAQ.id
const PRODUCTS_ID = PRODUCTS.id

const state = vi.hoisted(() => ({
    site: null as Record<string, unknown> | null,
    pages: {} as Record<string, Record<string, unknown>>,
    /** pages.locale_content per page id, and the site's written language as the raw SQL reads them */
    content: {} as Record<string, Record<string, unknown>>,
    written: 'en',
    layoutWrites: [] as Array<{ id: string; layout: Array<Record<string, unknown>> }>,
    contentWrites: [] as Array<{ id: string; content: Record<string, unknown> }>,
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        findByID: vi.fn(async ({ collection, id }: { collection: string; id: string | number }) => (collection === 'sites' ? state.site : (state.pages[String(id)] ?? null))),
        find: vi.fn(async ({ collection }: { collection: string }) => ({ docs: collection === 'products' ? [{ id: '1' }] : [] })),
        update: vi.fn(async ({ collection, id, data }: { collection: string; id: string | number; data: Record<string, unknown> }) => {
            if (collection === 'pages') {
                state.layoutWrites.push({ id: String(id), layout: data.layout as Array<Record<string, unknown>> })
                state.pages[String(id)] = { ...state.pages[String(id)]!, layout: data.layout }
            }
            return {}
        }),
        // readLocaleContent: the raw pages.locale_content column of one page
        db: {
            drizzle: {
                execute: vi.fn(async (query: unknown) => {
                    const { PgDialect } = await import('drizzle-orm/pg-core')
                    const { params } = new PgDialect().sqlToQuery(query as Parameters<PgDialect['sqlToQuery']>[0])
                    return { rows: [{ locale_content: state.content[String(params[0])] ?? {} }] }
                }),
            },
        },
    })),
}))
vi.mock('@/lib/payload/tenant-row-lock', () => ({
    withTenantRowLock: vi.fn(async (_cms: unknown, _tenant: unknown, operation: (req: { transactionID: string }) => Promise<unknown>) => operation({ transactionID: 'tx' })),
    lockTenantSiteRows: vi.fn(async () => undefined),
    executeTenantTransaction: vi.fn(async (_cms: unknown, _req: unknown, query: unknown) => {
        const { PgDialect } = await import('drizzle-orm/pg-core')
        const { sql, params } = new PgDialect().sqlToQuery(query as Parameters<PgDialect['sqlToQuery']>[0])
        if (/editor_revision/.test(sql)) return { rows: [] }
        if (/^\s*select/i.test(sql)) return { rows: [{ locale_content: state.content[String(params[0])] ?? {}, base: state.written }] }
        const id = String(params[1])
        const content = JSON.parse(String(params[0])) as Record<string, unknown>
        state.content[id] = content
        state.contentWrites.push({ id, content })
        return { rows: [] }
    }),
}))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(async () => ({ plan: 'PROFESSIONAL' })),
    canUse: vi.fn(async () => true),
}))
vi.mock('@/lib/ai/media-injector', () => ({ stripOrphanMediaRefs: vi.fn(async () => undefined) }))

type Prepared = Record<string, unknown> & {
    error?: { code: string; message: string }
    diffs?: Array<{ field: string; before: string | null; after: string }>
    guardrails?: Array<{ rule: string; ok: boolean; detail: string }>
    plan?: Record<string, unknown> & { ops?: Array<Record<string, unknown>>; expect?: Record<string, string>; locale?: string; localeExpect?: Record<string, string> }
}

const MS_HERO = { headline: 'Penjagaan mudah. Kulit cantik.', subheadline: 'Dibuat dengan tangan di Kelantan' }
const setHeadline = (text: string) => [{ op: 'set_fields', blockId: HERO_ID, fields: { headline: text } }]
const prepare = (ops: unknown[], language?: string, pageId = PAGE_ID) =>
    preparePagePatch(OWNER, { siteId: String(SITE_ID), pageId: String(pageId), why: 'Change the headline', ops, ...(language ? { language } : {}) }) as Promise<Prepared>
const heroOf = (layout: Array<Record<string, unknown>>) => layout.find((b) => b.id === HERO_ID)!
const lastLayout = () => state.layoutWrites.at(-1)?.layout

beforeEach(() => {
    // English site (written in English) whose second language is Malay
    state.site = site({ generationLocale: 'en', locale: 'en', headerBlock: { blockType: 'navigation', primaryLocale: 'en', secondaryLocale: 'ms' } })
    state.pages = { [String(PAGE_ID)]: page(structuredClone(LAYOUT)), [String(OTHER_PAGE_ID)]: page(structuredClone(LAYOUT), { id: OTHER_PAGE_ID, title: 'About', slug: '/about', isHomepage: false }) }
    state.content = { [String(PAGE_ID)]: { [HERO_ID]: { ms: { ...MS_HERO } } }, [String(OTHER_PAGE_ID)]: { [HERO_ID]: { ms: { ...MS_HERO } } } }
    state.written = 'en'
    state.layoutWrites = []
    state.contentWrites = []
})

describe('prepare — the card is drawn from the language on screen [TC-AIREL-220]', () => {
    it('shows the Malay text as "before" and records the language and its version guard in the plan', async () => {
        const result = await prepare(setHeadline('Glow gently'), 'ms')

        expect(result.error).toBeUndefined()
        expect(result.diffs).toEqual([expect.objectContaining({ field: 'Headline', before: MS_HERO.headline, after: 'Glow gently' })])
        expect(result.plan?.locale).toBe('ms')
        // the guard is the block as the merchant saw it (Malay copy over the stored text)
        expect(result.plan?.localeExpect).toEqual({ [HERO_ID]: blockHash({ ...HERO, ...MS_HERO }) })
        expect(result.plan?.expect).toEqual({})
        expect(result.guardrails).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'language_copy', ok: true })]))
    })

    it('an English view (the written language), no language, or one the site does not have draws from the stored sections', async () => {
        for (const language of ['en', undefined, 'vi']) {
            const result = await prepare(setHeadline('Glow gently'), language)

            expect(result.diffs).toEqual([expect.objectContaining({ before: HERO.headline, after: 'Glow gently' })])
            expect(result.plan?.locale).toBeUndefined()
            expect(result.plan?.expect).toEqual({ [HERO_ID]: blockHash(HERO) })
        }
    })
})

describe('apply — a Malay-view text edit writes the Malay copy [TC-AIREL-221]', () => {
    it('changes locale_content[hero].ms.headline and leaves the stored English section alone', async () => {
        const prepared = await prepare(setHeadline('Glow gently'), 'ms')

        await applySitePagePatch(prepared.plan, OWNER)

        expect(state.content[String(PAGE_ID)]).toEqual({ [HERO_ID]: { ms: { headline: 'Glow gently', subheadline: MS_HERO.subheadline } } })
        // no base write at all: the sections are untouched
        expect(state.layoutWrites).toHaveLength(0)
        expect(heroOf(state.pages[String(PAGE_ID)]!.layout as Array<Record<string, unknown>>).headline).toBe(HERO.headline)
    })

    it('a base-language slot still follows when the edit is made in the written language', async () => {
        state.content[String(PAGE_ID)] = { [HERO_ID]: { en: { headline: HERO.headline }, ms: { ...MS_HERO } } }
        const prepared = await prepare(setHeadline('Glow gently'), 'en')

        await applySitePagePatch(prepared.plan, OWNER)

        expect(heroOf(lastLayout()!).headline).toBe('Glow gently')
        expect(state.content[String(PAGE_ID)]).toEqual({ [HERO_ID]: { en: { headline: 'Glow gently' }, ms: { ...MS_HERO } } })
    })
})

describe('apply — an English-view edit writes the sections [TC-AIREL-222]', () => {
    it('writes the base headline and no translation', async () => {
        const prepared = await prepare(setHeadline('Glow gently'), 'en')

        await applySitePagePatch(prepared.plan, OWNER)

        expect(heroOf(lastLayout()!).headline).toBe('Glow gently')
        expect(state.contentWrites).toHaveLength(0)
        expect(state.content[String(PAGE_ID)]![HERO_ID]).toEqual({ ms: { ...MS_HERO } })
    })

    it('a plan that names no language writes the sections too (older cards keep working)', async () => {
        const plan = { siteId: String(SITE_ID), pageId: String(PAGE_ID), ops: setHeadline('Glow gently'), expect: { [HERO_ID]: blockHash(HERO) } }

        await applySitePagePatch(plan, OWNER)

        expect(heroOf(lastLayout()!).headline).toBe('Glow gently')
    })
})

describe('undo puts the Malay copy back where it was [TC-AIREL-223]', () => {
    it('restores the previous Malay text, and nothing in the sections', async () => {
        const prepared = await prepare(setHeadline('Glow gently'), 'ms')
        const applied = await applySitePagePatch(prepared.plan, OWNER)
        const payload = applied.undo!.payload as { restore: unknown[]; slots?: { locale: string; entries: Record<string, unknown> } }
        expect(payload.restore).toEqual([])
        expect(payload.slots).toMatchObject({ locale: 'ms', entries: { [HERO_ID]: MS_HERO } })

        await applySitePageRestore(applied.undo!.payload, OWNER)

        expect(state.content[String(PAGE_ID)]).toEqual({ [HERO_ID]: { ms: MS_HERO } })
        expect(state.layoutWrites).toHaveLength(0)
    })

    it('removes a copy the edit created, and refuses (409) once the Malay text was edited since', async () => {
        const applied = await applySitePagePatch((await prepare(setHeadline('Glow gently'), 'ms')).plan, OWNER)
        state.content[String(PAGE_ID)] = { [HERO_ID]: { ms: { headline: 'Edited by hand' } } }

        await expect(applySitePageRestore(applied.undo!.payload, OWNER)).rejects.toMatchObject({ status: 409 })
        expect(state.content[String(PAGE_ID)]).toEqual({ [HERO_ID]: { ms: { headline: 'Edited by hand' } } })
    })
})

describe('read — the copilot reads the text on screen [TC-AIREL-224]', () => {
    it('page and block views show the Malay copy with a language note; the version is the shown block\'s', async () => {
        const pageView = (await readSite(OWNER, { view: 'page', siteId: String(SITE_ID), pageId: String(PAGE_ID), language: 'ms' })) as { language: { shown: string; writtenIn: string }; blocks: Array<{ id: string; fields: string[] }> }
        const blockView = (await readSite(OWNER, { view: 'block', siteId: String(SITE_ID), pageId: String(PAGE_ID), blockId: HERO_ID, language: 'ms' })) as { data: Record<string, unknown>; version: string; language: unknown }

        expect(pageView.language).toMatchObject({ shown: 'ms', writtenIn: 'en' })
        expect(JSON.stringify(pageView.blocks.find((b) => b.id === HERO_ID)!.fields)).toContain(MS_HERO.headline)
        expect(blockView.data.headline).toBe(MS_HERO.headline)
        expect(blockView.version).toBe(blockHash({ ...HERO, ...MS_HERO }))
    })

    it('the written language, or no language, reads the stored sections with no language note', async () => {
        for (const language of ['en', undefined]) {
            const view = (await readSite(OWNER, { view: 'block', siteId: String(SITE_ID), pageId: String(PAGE_ID), blockId: HERO_ID, ...(language ? { language } : {}) })) as { data: Record<string, unknown>; version: string; language?: unknown }

            expect(view.data.headline).toBe(HERO.headline)
            expect(view.version).toBe(blockHash(HERO))
            expect(view.language).toBeUndefined()
        }
    })
})

describe('the Malay text changed between the card and the approval [TC-AIREL-225]', () => {
    it('refuses with a closed 409 and writes nothing', async () => {
        const prepared = await prepare(setHeadline('Glow gently'), 'ms')
        state.content[String(PAGE_ID)] = { [HERO_ID]: { ms: { ...MS_HERO, headline: 'Someone else wrote this' } } }

        const failure = await applySitePagePatch(prepared.plan, OWNER).catch((e: unknown) => e)

        expect(failure).toBeInstanceOf(ChangeSetApplyError)
        expect(failure).toMatchObject({ status: 409, final: true })
        expect(state.contentWrites).toHaveLength(0)
        expect(state.layoutWrites).toHaveLength(0)
    })

    it('refuses a plan for a language the website no longer has', async () => {
        const prepared = await prepare(setHeadline('Glow gently'), 'ms')
        state.site = site({ generationLocale: 'en', locale: 'en', headerBlock: { blockType: 'navigation', primaryLocale: 'en', secondaryLocale: '' } })

        await expect(applySitePagePatch(prepared.plan, OWNER)).rejects.toMatchObject({ status: 409, final: true })
        expect(state.contentWrites).toHaveLength(0)
    })
})

describe('style, pictures and site-wide fields stay in the sections [TC-AIREL-226]', () => {
    it('a style change and a text change in one request: the style goes to the sections, the text to the Malay copy', async () => {
        const prepared = await prepare([{ op: 'set_variant', blockId: HERO_ID, variant: 'split-right' }, ...setHeadline('Glow gently')], 'ms')
        expect(prepared.error).toBeUndefined()
        expect(prepared.plan?.expect).toEqual({ [HERO_ID]: blockHash(HERO) })

        const applied = await applySitePagePatch(prepared.plan, OWNER)

        expect(heroOf(lastLayout()!)).toMatchObject({ variant: 'split-right', headline: HERO.headline })
        expect(state.content[String(PAGE_ID)]![HERO_ID]).toEqual({ ms: { ...MS_HERO, headline: 'Glow gently' } })
        // undo covers both halves
        await applySitePageRestore(applied.undo!.payload, OWNER)
        expect(heroOf(lastLayout()!)).toMatchObject({ variant: HERO.variant, headline: HERO.headline })
        expect(state.content[String(PAGE_ID)]![HERO_ID]).toEqual({ ms: MS_HERO })
    })

    it('a site-wide field set together with text is split like the editor does (never stored in the language copy)', async () => {
        state.content[String(PAGE_ID)] = { [PRODUCTS_ID]: { ms: { headline: 'Kedai' } } }
        const prepared = await prepare([{ op: 'set_fields', blockId: PRODUCTS_ID, fields: { headline: 'Beli batik', limit: 4 } }], 'ms')
        expect(prepared.error).toBeUndefined()

        await applySitePagePatch(prepared.plan, OWNER)

        expect(state.content[String(PAGE_ID)]![PRODUCTS_ID]).toEqual({ ms: { headline: 'Beli batik' } })
        const grid = lastLayout()!.find((b) => b.id === PRODUCTS_ID)!
        expect(grid).toMatchObject({ limit: 4, headline: PRODUCTS.headline })
    })
})

describe('what a language copy cannot take [TC-AIREL-227]', () => {
    it('a section with no Malay text yet says to translate it first', async () => {
        const result = await prepare([{ op: 'set_fields', blockId: FAQ_ID, fields: { headline: 'Soalan' } }], 'ms')

        expect(result.error).toMatchObject({ code: 'not_translated' })
        expect(result.error?.message).toMatch(/propose_page_translation/)
    })

    it('adding or reordering list items is the same in every language, changing their text is not', async () => {
        const ctaList = (rows: unknown[]) => [{ op: 'edit_list', blockId: HERO_ID, path: 'ctaButtons', rows }]
        state.content[String(PAGE_ID)] = { [HERO_ID]: { ms: { ...MS_HERO, ctaButtons: [{ label: 'Beli', url: '/shop', style: 'primary' }] } } }

        const added = await prepare(ctaList([{ keep: 0 }, { fields: { label: 'Lagi', url: '/lagi', style: 'secondary' } }]), 'ms')
        const renamed = await prepare(ctaList([{ keep: 0, fields: { label: 'Beli sekarang' } }]), 'ms')

        expect(added.error).toMatchObject({ code: 'list_shape_shared' })
        expect(renamed.error).toBeUndefined()
        expect(renamed.diffs).toEqual([expect.objectContaining({ before: 'Beli', after: 'Beli sekarang' })])
        await applySitePagePatch(renamed.plan, OWNER)
        expect((state.content[String(PAGE_ID)]![HERO_ID] as { ms: { ctaButtons: Array<{ label: string }> } }).ms.ctaButtons[0]!.label).toBe('Beli sekarang')
    })
})

describe('one edit across several pages follows the language too [TC-AIREL-229]', () => {
    const pages = [
        { pageId: String(PAGE_ID), ops: setHeadline('Glow gently') },
        { pageId: String(OTHER_PAGE_ID), ops: setHeadline('Glow gently') },
    ]

    it('writes each page\'s Malay copy, undoes both, and the card line reveals in Malay', async () => {
        const prepared = (await prepareSitePatch(OWNER, { siteId: String(SITE_ID), why: 'Same headline', pages, language: 'ms' })) as Prepared
        expect(prepared.error).toBeUndefined()
        expect(prepared.diffs).toEqual([expect.objectContaining({ before: MS_HERO.headline }), expect.objectContaining({ before: MS_HERO.headline })])

        const applied = await applySitePagesPatch(prepared.plan, OWNER)

        expect(state.layoutWrites).toHaveLength(0)
        for (const id of [PAGE_ID, OTHER_PAGE_ID]) expect(state.content[String(id)]![HERO_ID]).toEqual({ ms: { ...MS_HERO, headline: 'Glow gently' } })
        const target = revealTargetOf({ id: 'cs_1', status: 'pending', action: { kind: 'site.pages_patch', payload: prepared.plan } } as never, { entity: { kind: 'site_block', id: HERO_ID }, field: 'Headline', path: 'headline', before: null, after: 'x' } as never)
        expect(target).toMatchObject({ locale: 'ms' })

        await applySitePagesRestore(applied.undo!.payload, OWNER)
        for (const id of [PAGE_ID, OTHER_PAGE_ID]) expect(state.content[String(id)]![HERO_ID]).toEqual({ ms: MS_HERO })
    })
})

describe('the languages and the canvas rule the copilot shares with the editor [TC-AIREL-228]', () => {
    it('a Malay-written site: English is a language only once it is added; the menu draft wins over the live menu', () => {
        const written = { generationLocale: 'ms', locale: 'ms' }

        expect(siteLanguagesOf(written)).toEqual(['ms'])
        expect(slotLocaleOf(written, 'en')).toBeNull()
        expect(slotLocaleOf({ ...written, headerBlock: { primaryLocale: 'ms', secondaryLocale: 'en' } }, 'en')).toBe('en')
        // the draft removed the second language the live menu still has
        expect(slotLocaleOf({ ...written, headerBlock: { secondaryLocale: 'en' }, pendingHeaderBlock: { secondaryLocale: '' } }, 'en')).toBeNull()
        // the written language is never a copy; a language the site lacks or a blank value is ignored
        expect(slotLocaleOf({ ...written, headerBlock: { secondaryLocale: 'en' } }, 'ms')).toBeNull()
        expect(slotLocaleOf({ ...written, headerBlock: { secondaryLocale: 'en' } }, ' ')).toBeNull()
        expect(slotLocaleOf({ ...written, headerBlock: { secondaryLocale: 'en' } }, undefined)).toBeNull()
    })

    it('Make Default: the primary language may differ from the written one and is then a copy too', () => {
        const site = { generationLocale: 'en', locale: 'en', headerBlock: { primaryLocale: 'ms', secondaryLocale: 'en' } }

        expect(siteLanguagesOf(site)).toEqual(['ms', 'en'])
        expect(slotLocaleOf(site, 'ms')).toBe('ms')
        expect(slotLocaleOf(site, 'en')).toBeNull()
    })

    it('a language copy lies over the section, structural fields stay the section\'s, and a section with no copy shows as stored', () => {
        const content = { [HERO_ID]: { ms: { ...MS_HERO, variant: 'split-left' } }, [FAQ_ID]: { ms: {} } }

        expect(localizedBlock(HERO, 'ms', content)).toEqual({ ...HERO, ...MS_HERO })
        expect(localizedBlock(FAQ, 'ms', content)).toBe(FAQ)
        expect(localizedBlock({ ...HERO, _localeContent: { ms: { headline: 'In the block' } } }, 'ms', {})).toMatchObject({ headline: 'In the block' })
        expect(shownLayout(LAYOUT, null, content)).toBe(LAYOUT)
        expect(shownLayout(LAYOUT, 'ms', content).map((b) => b.id)).toEqual(LAYOUT.map((b) => b.id))
    })
})
