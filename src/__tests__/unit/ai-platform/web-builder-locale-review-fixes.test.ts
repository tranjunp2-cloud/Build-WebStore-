/**
 * TC-AIREL-257 … 262 — review fixes for the localized site (review-main-worktree-261022):
 *   257  coverage / "check" / languages count a template-text copy as missing (H1)
 *   258  a copilot text edit in a language whose copy is only template text says to translate first (H1)
 *   259  edits of links, contact details and options in a translation view write the sections (H2, split)
 *   260  ...and the language copy that holds the same field follows; undo puts both back (H2, apply)
 *   261  the copilot reads the written language as the canvas shows it (M5)
 * Real: site-read.ts, site-prepare.ts, site-edits.ts, site-page-locale.ts, site-locale-view.ts, site-languages.ts,
 * site-translate-source.ts, template-content.ts, lib/i18n/locale-display, site-patch.ts, the block registry.
 * Faked: Payload Local API (in memory), tenant row lock (runs the callback; locale_content SQL answered per page),
 * plan gate, media cleanup.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applySitePagePatch, applySitePageRestore } from '@/lib/ai-platform/appliers/site-edits'
import { preparePagePatch } from '@/lib/ai-platform/site/site-prepare'
import { readSite } from '@/lib/ai-platform/site/site-read'
import { translationCoverage } from '@/lib/ai-platform/site/site-languages'
import { brandOf, localeTextProblem, mirrorNeutralChanges, shownLayout, splitLocaleOps } from '@/lib/ai-platform/site/site-locale-view'
import type { PagePatchOp } from '@/lib/ai-platform/site/site-patch'
import { resolveBlockContent } from '@/lib/ai/add-section-content'
import { FAQ, HERO, LAYOUT, OWNER, PAGE_ID, SITE_ID, page, site } from './web-builder-fixtures'

const OTHER_PAGE_ID = 11
const HERO_ID = HERO.id
const FAQ_ID = FAQ.id

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
        find: vi.fn(async ({ collection }: { collection: string }) => ({ docs: collection === 'products' ? [{ id: '1' }] : collection === 'pages' ? [state.pages[String(PAGE_ID)]] : [], totalDocs: 1 })),
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
    plan?: Record<string, unknown> & { ops?: Array<Record<string, unknown>>; expect?: Record<string, string>; locale?: string; localeExpect?: Record<string, string> }
}

const BRAND = 'Kedai Batik'
const MS_HERO = { headline: 'Batik setiap hari', subheadline: 'Dibuat dengan tangan di Kelantan', ctaButtons: [{ label: 'Beli', url: '/shop', style: 'primary' }] }
// the editor's add-section text of the hero in Malay, brand filled in: filler, not a translation
const MS_TEMPLATE_HERO = resolveBlockContent('hero', 'ms', BRAND).content
const prepare = (ops: unknown[], language?: string) =>
    preparePagePatch(OWNER, { siteId: String(SITE_ID), pageId: String(PAGE_ID), why: 'Fix the link', ops, ...(language ? { language } : {}) }) as Promise<Prepared>
const heroOf = (layout: Array<Record<string, unknown>>) => layout.find((b) => b.id === HERO_ID)!
const lastLayout = () => state.layoutWrites.at(-1)?.layout
const msHeroCopy = () => (state.content[String(PAGE_ID)]![HERO_ID] as { ms: Record<string, unknown> }).ms

beforeEach(() => {
    state.site = site({ generationLocale: 'en', locale: 'en', headerBlock: { blockType: 'navigation', primaryLocale: 'en', secondaryLocale: 'ms' } })
    state.pages = { [String(PAGE_ID)]: page(structuredClone(LAYOUT)), [String(OTHER_PAGE_ID)]: page(structuredClone(LAYOUT), { id: OTHER_PAGE_ID, title: 'About', slug: '/about', isHomepage: false }) }
    state.content = { [String(PAGE_ID)]: { [HERO_ID]: { ms: structuredClone(MS_HERO) } }, [String(OTHER_PAGE_ID)]: {} }
    state.written = 'en'
    state.layoutWrites = []
    state.contentWrites = []
})

describe('a template-text copy is a missing translation, not a translation [TC-AIREL-257]', () => {
    const sections = LAYOUT.filter((b) => b.blockType !== 'navigation' && b.blockType !== 'footer')
    const coverage = (content: Record<string, unknown>) =>
        translationCoverage(state.site as never, [{ id: PAGE_ID, title: 'Home', layout: LAYOUT, localeContent: content as never }])

    it('counts the template filler of the language as missing, a real translation and the written text apart', () => {
        const real = coverage({ [HERO_ID]: { ms: MS_HERO } }).pages[0]!.missing
        const filler = coverage({ [HERO_ID]: { ms: MS_TEMPLATE_HERO } }).pages[0]!.missing
        const repeated = coverage({ [HERO_ID]: { ms: { headline: HERO.headline, subheadline: HERO.subheadline } } }).pages[0]!.missing

        expect(real).toEqual({ ms: sections.length - 1 })
        expect(filler).toEqual({ ms: sections.length })
        // a copy that only repeats the written text was never translated
        expect(repeated).toEqual({ ms: sections.length })
    })

    it('the copy of a section whose text was reworded by hand but is mostly filler is still missing; one real field is not', () => {
        const reworded = { ...MS_TEMPLATE_HERO, headline: 'Satu tajuk baharu' }
        const handWritten = { headline: 'Satu tajuk baharu' }

        expect(coverage({ [HERO_ID]: { ms: reworded } }).pages[0]!.missing).toEqual({ ms: sections.length })
        expect(coverage({ [HERO_ID]: { ms: handWritten } }).pages[0]!.missing).toEqual({ ms: sections.length - 1 })
    })

    it('site_read "languages" says the same through the real read', async () => {
        state.content[String(PAGE_ID)] = { [HERO_ID]: { ms: MS_TEMPLATE_HERO } }
        const { readSiteLanguages } = await import('@/lib/ai-platform/site/site-languages')

        const read = await readSiteLanguages(OWNER, SITE_ID)

        expect(read.pages[0]!.missing).toEqual({ ms: sections.length })
    })
})

describe('a text edit needs a real copy of the language [TC-AIREL-258]', () => {
    it('refuses (not_translated) when the Malay copy is only the template text, and takes a real copy', async () => {
        state.content[String(PAGE_ID)] = { [HERO_ID]: { ms: MS_TEMPLATE_HERO } }
        const refused = await prepare([{ op: 'set_fields', blockId: HERO_ID, fields: { headline: 'Tajuk baharu' } }], 'ms')
        expect(refused.error).toMatchObject({ code: 'not_translated' })

        state.content[String(PAGE_ID)] = { [HERO_ID]: { ms: MS_HERO } }
        const taken = await prepare([{ op: 'set_fields', blockId: HERO_ID, fields: { headline: 'Tajuk baharu' } }], 'ms')
        expect(taken.error).toBeUndefined()
    })

    it('localeTextProblem and shownLayout use the same rule: filler shows the stored text, a real copy lies over it', () => {
        const filler = { [HERO_ID]: { ms: MS_TEMPLATE_HERO } }
        const real = { [HERO_ID]: { ms: MS_HERO } }
        const shown = (content: Record<string, unknown>) => shownLayout(LAYOUT as never, 'ms', content as never, BRAND).find((b) => b.id === HERO_ID)!
        const op = { op: 'set_fields', blockId: HERO_ID, fields: { headline: 'x' } } as PagePatchOp

        expect(shown(filler).headline).toBe(HERO.headline)
        expect(shown(real).headline).toBe(MS_HERO.headline)
        expect(localeTextProblem(op, LAYOUT as never, filler as never, 'ms', 'Bahasa Melayu', BRAND)).toMatchObject({ code: 'not_translated' })
        expect(localeTextProblem(op, LAYOUT as never, real as never, 'ms', 'Bahasa Melayu', BRAND)).toBeNull()
        expect(brandOf({ name: BRAND })).toBe(BRAND)
        expect(brandOf({})).toBe('Your Brand')
    })
})

describe('links, contact details and options belong to the sections in every language [TC-AIREL-259]', () => {
    const split = (ops: PagePatchOp[]) => splitLocaleOps(ops, LAYOUT as never)

    it('set_fields: url / phone / email / address / logoText / href go to the sections, text to the copy', () => {
        const op = { op: 'set_fields', blockId: HERO_ID, fields: { headline: 'Hi', phone: '012-3456789', email: 'a@b.my', address: 'KL', logoText: 'KB', ctaUrl: '/shop', limit: 4 } } as PagePatchOp

        const { text, base } = split([op])

        expect(text).toEqual([{ ...op, fields: { headline: 'Hi' } }])
        expect(base).toEqual([{ ...op, fields: { phone: '012-3456789', email: 'a@b.my', address: 'KL', logoText: 'KB', ctaUrl: '/shop', limit: 4 } }])
    })

    it('set_value: a link inside a list item or a contact field goes to the sections, a heading to the copy', () => {
        const value = (path: string): PagePatchOp => ({ op: 'set_value', blockId: HERO_ID, path, value: 'x' })

        expect(split([value('ctaButtons.0.url')])).toEqual({ text: [], base: [value('ctaButtons.0.url')] })
        expect(split([value('socials.0.href')]).base).toHaveLength(1)
        expect(split([value('ctaButtons.0.style')]).base).toHaveLength(1)
        expect(split([value('ctaButtons.0.label')])).toEqual({ text: [value('ctaButtons.0.label')], base: [] })
        expect(split([value('headline')]).text).toHaveLength(1)
    })

    it('edit_list in place: the label goes to the copy and the link to the sections; any other shape stays whole (and is refused there)', () => {
        const rows = [{ keep: 0, fields: { label: 'Beli sekarang', url: '/kedai' } }]
        const op = { op: 'edit_list', blockId: HERO_ID, path: 'ctaButtons', rows } as PagePatchOp

        expect(split([op])).toEqual({
            text: [{ ...op, rows: [{ keep: 0, fields: { label: 'Beli sekarang' } }] }],
            base: [{ ...op, rows: [{ keep: 0, fields: { url: '/kedai' } }] }],
        })
        const onlyLink = { ...op, rows: [{ keep: 0, fields: { url: '/kedai' } }] } as PagePatchOp
        expect(split([onlyLink])).toEqual({ text: [], base: [onlyLink] })
        // a new item: the list's shape changes, so the whole op stays a text op and the language copy refuses it
        const added = { ...op, rows: [{ keep: 0 }, { fields: { label: 'Lagi', url: '/lagi' } }] } as PagePatchOp
        expect(split([added])).toEqual({ text: [added], base: [] })
        // the list is counted in the shown language: fewer rows than the item count is not "in place"
        expect(splitLocaleOps([op], [])).toEqual({ text: [op], base: [] })
    })

    it('a Malay-view link edit with a fresh section (no Malay copy) writes the sections and asks for no translation', async () => {
        state.content[String(PAGE_ID)] = {}

        const prepared = await prepare([{ op: 'set_value', blockId: HERO_ID, path: 'ctaButtons.0.url', value: '/kedai' }], 'ms')

        expect(prepared.error).toBeUndefined()
        expect(prepared.plan?.expect).toEqual({ [HERO_ID]: expect.any(String) })
        // no text op: the card does not claim to change the Malay text
        expect(prepared.plan?.localeExpect).toEqual({})
        await applySitePagePatch(prepared.plan, OWNER)
        expect((heroOf(lastLayout()!).ctaButtons as Array<{ url: string }>)[0]!.url).toBe('/kedai')
        expect(state.contentWrites).toHaveLength(0)
    })
})

describe('the language copy that holds the field follows [TC-AIREL-260]', () => {
    it('a link edited in the Malay view: the English sections and the Malay copy both have the new link; undo puts both back', async () => {
        const prepared = await prepare([{ op: 'set_value', blockId: HERO_ID, path: 'ctaButtons.0.url', value: '/kedai' }], 'ms')
        expect(prepared.error).toBeUndefined()

        const applied = await applySitePagePatch(prepared.plan, OWNER)

        expect((heroOf(lastLayout()!).ctaButtons as Array<{ url: string }>)[0]!.url).toBe('/kedai')
        expect((msHeroCopy().ctaButtons as Array<{ url: string; label: string }>)[0]).toMatchObject({ url: '/kedai', label: 'Beli' })
        // the translated text is untouched
        expect(msHeroCopy().headline).toBe(MS_HERO.headline)

        await applySitePageRestore(applied.undo!.payload, OWNER)

        expect((heroOf(lastLayout()!).ctaButtons as Array<{ url: string }>)[0]!.url).toBe('/shop')
        expect(msHeroCopy()).toEqual(MS_HERO)
    })

    it('label and link in one list edit: the label stays in the Malay copy only, the link lands in both', async () => {
        const prepared = await prepare([{ op: 'edit_list', blockId: HERO_ID, path: 'ctaButtons', rows: [{ keep: 0, fields: { label: 'Beli sekarang', url: '/kedai' } }] }], 'ms')
        expect(prepared.error).toBeUndefined()

        await applySitePagePatch(prepared.plan, OWNER)

        const stored = heroOf(lastLayout()!).ctaButtons as Array<{ url: string; label: string }>
        expect(stored[0]).toMatchObject({ url: '/kedai', label: 'Shop' })
        expect((msHeroCopy().ctaButtons as Array<{ url: string; label: string }>)[0]).toMatchObject({ url: '/kedai', label: 'Beli sekarang' })
    })

    it('a top-level contact field: written to the sections, and to the copy only where the copy holds it', async () => {
        const contact = { blockType: 'contact', id: '00000000-0000-4000-8000-0000000000f1', variant: 'form', headline: 'Contact us', phone: '011-111', email: 'a@b.my', formFields: [] }
        state.pages[String(PAGE_ID)] = page([...LAYOUT.slice(0, 2), contact, ...LAYOUT.slice(2)] as never)
        state.content[String(PAGE_ID)] = { [contact.id]: { ms: { headline: 'Hubungi kedai kami', phone: '011-111' } } }

        const prepared = await prepare([{ op: 'set_fields', blockId: contact.id, fields: { phone: '012-3456789', email: 'hello@kedai.my', headline: 'Hubungi kami hari ini' } }], 'ms')
        expect(prepared.error).toBeUndefined()
        await applySitePagePatch(prepared.plan, OWNER)

        expect(lastLayout()!.find((b) => b.id === contact.id)).toMatchObject({ phone: '012-3456789', email: 'hello@kedai.my', headline: 'Contact us' })
        const copy = (state.content[String(PAGE_ID)]![contact.id] as { ms: Record<string, unknown> }).ms
        // the phone the copy held follows; the email it never held is not added; the headline is the Malay text
        expect(copy).toEqual({ headline: 'Hubungi kami hari ini', phone: '012-3456789' })
    })

    it('mirrorNeutralChanges never gives a copy a field it did not have, and ignores filler copies and structure', () => {
        const before = [{ ...HERO }] as never[]
        const after = [{ ...HERO, variant: 'split-right', phone: '012', ctaButtons: [{ label: 'Shop', url: '/kedai', style: 'primary' }] }] as never[]
        const shown = [{ ...HERO, ...MS_HERO }] as never[]
        const copy = (content: Record<string, unknown>) => mirrorNeutralChanges(shown, before, after, content as never, 'ms', BRAND)

        const real = copy({ [HERO_ID]: { ms: MS_HERO } })
        expect([...real.touched]).toEqual([HERO_ID])
        expect(real.next[0]).toMatchObject({ ctaButtons: [{ label: 'Beli', url: '/kedai' }], variant: HERO.variant })
        expect(real.next[0]).not.toHaveProperty('phone')
        expect(copy({ [HERO_ID]: { ms: MS_TEMPLATE_HERO } }).touched.size).toBe(0)
        expect(copy({}).touched.size).toBe(0)
    })
})

describe('the copilot reads the written language as the canvas shows it [TC-AIREL-261]', () => {
    it('a copy the editor kept of the written text lies over the stored section on read, as on the canvas', async () => {
        // a legacy page: the stored section holds another language's text, the English copy is the true written text
        state.pages[String(PAGE_ID)] = page([LAYOUT[0], { ...HERO, headline: 'Batik setiap hari (stored)' }, ...LAYOUT.slice(2)] as never)
        state.content[String(PAGE_ID)] = { [HERO_ID]: { en: { headline: HERO.headline }, ms: MS_HERO } }

        const view = (await readSite(OWNER, { view: 'block', siteId: String(SITE_ID), pageId: String(PAGE_ID), blockId: HERO_ID, language: 'en' })) as { data: Record<string, unknown> }
        const noLanguage = (await readSite(OWNER, { view: 'block', siteId: String(SITE_ID), pageId: String(PAGE_ID), blockId: HERO_ID })) as { data: Record<string, unknown> }

        expect(view.data.headline).toBe(HERO.headline)
        expect(noLanguage.data.headline).toBe(HERO.headline)
    })

    it('a written-language copy that is only template text is ignored (the stored section is shown)', () => {
        const shown = shownLayout(LAYOUT as never, null, { [HERO_ID]: { en: resolveBlockContent('hero', 'en', BRAND).content } } as never, BRAND, 'en')

        expect(shown.find((b) => b.id === HERO_ID)!.headline).toBe(HERO.headline)
    })

    it('FAQ without any copy reads as stored', () => {
        expect(shownLayout(LAYOUT as never, null, {} as never, BRAND, 'en').find((b) => b.id === FAQ.id)).toBe(FAQ)
    })
})
