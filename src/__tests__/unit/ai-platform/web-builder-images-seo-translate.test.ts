/**
 * TC-AIWB-22 / 23 / 24 — section pictures, page SEO and page translation of the web builder copilot.
 * Real: site-prepare.ts (checkPagePatchOps set_image, preparePagePatch), site-patch.ts (runPagePatch, setAtPath),
 * site-seo-translate.ts (prepareSeoChange, prepareTranslatePage, translatableStrings, translatedSlot, fingerprints),
 * appliers/site-edits.ts (picture ingest, SEO and translation writes, undo), site-blocks.ts, @ech/ai-contracts
 * (string flattening), the block registry, the site access check.
 * Faked: Payload Local API (in memory), tenant row lock (runs the callback), the locale_content SQL (real
 * drizzle SQL text, run against the in-memory row), plan gate, media cleanup, picture ingest (picture-ingest),
 * the AI task client (the translator).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ingestPicture } from '@/lib/ai-platform/appliers/picture-ingest'
import { ChangeSetApplyError } from '@/lib/ai-platform/appliers/errors'
import { undoVerdict } from '@/lib/ai-platform/appliers/site-undo-verdict'
import { applySiteLocaleRestore, applySitePagePatch, applySiteSeoPatch, applySiteSeoRestore, applySiteTranslatePage } from '@/lib/ai-platform/appliers/site-edits'
import { getAiTaskClient } from '@/lib/ai-platform/task-client'
import { blockHash } from '@/lib/ai-platform/site/site-blocks'
import { PagePatchError, runPagePatch, setAtPath } from '@/lib/ai-platform/site/site-patch'
import { preparePagePatch } from '@/lib/ai-platform/site/site-prepare'
import { localeFingerprint, prepareSeoChange, prepareTranslatePage, seoFingerprint, translatableStrings, translatedSlot } from '@/lib/ai-platform/site/site-seo-translate'
import { FAQ, FOOTER, HERO, LAYOUT, NAV, OWNER, PAGE_ID, PRODUCTS, SITE_ID, page, site } from './web-builder-fixtures'

const state = vi.hoisted(() => ({
    site: null as Record<string, unknown> | null,
    page: null as Record<string, unknown> | null,
    localeContent: {} as Record<string, unknown>,
    writes: [] as Array<{ collection: string; arg: Record<string, unknown> }>,
    events: [] as string[],
    subscription: { plan: 'PROFESSIONAL' } as null | { plan: string },
    // media rows the library rule can see (media-access.ts reads them with Payload `find`)
    mediaRows: [] as Array<Record<string, unknown>>,
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        findByID: vi.fn(async ({ collection }: { collection: string }) => (collection === 'sites' ? state.site : state.page)),
        find: vi.fn(async ({ collection, where }: { collection: string; where?: { id?: { in?: Array<number | string> } } }) =>
            collection === 'media' ? { docs: state.mediaRows.filter((row) => where?.id?.in?.some((id) => String(id) === String(row.id))) } : { docs: [] },
        ),
        update: vi.fn(async (arg: { collection: string; data: Record<string, unknown> }) => {
            state.writes.push({ collection: arg.collection, arg: arg as unknown as Record<string, unknown> })
            state.events.push(`write:${arg.collection}`)
            if (arg.collection === 'pages') state.page = { ...state.page!, ...arg.data }
            return {}
        }),
        // readLocaleContent: the raw pages.locale_content column
        db: { drizzle: { execute: vi.fn(async () => ({ rows: [{ locale_content: state.localeContent }] })) } },
    })),
}))
vi.mock('@/lib/payload/tenant-row-lock', () => ({
    withTenantRowLock: vi.fn(async (_cms: unknown, _tenant: unknown, operation: (req: { transactionID: string }) => Promise<unknown>) => operation({ transactionID: 'tx' })),
    lockTenantSiteRows: vi.fn(async () => undefined),
    // the locale_content statements: the SELECT reads the in-memory row, the UPDATE stores its JSON parameter
    executeTenantTransaction: vi.fn(async (_cms: unknown, _req: unknown, query: unknown) => {
        const { PgDialect } = await import('drizzle-orm/pg-core')
        const { sql, params } = new PgDialect().sqlToQuery(query as Parameters<PgDialect['sqlToQuery']>[0])
        // the editor draft revision (read / bumped by every write) is not what these tests look at
        if (/editor_revision/.test(sql)) return { rows: [] }
        if (/^\s*select/i.test(sql)) return { rows: [{ locale_content: state.localeContent, site_id: state.page?.site }] }
        state.localeContent = JSON.parse(String(params[0]))
        state.events.push('write:locale_content')
        return { rows: [] }
    }),
}))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(async () => state.subscription),
    canUse: vi.fn(async () => true),
}))
vi.mock('@/lib/ai/media-injector', () => ({ stripOrphanMediaRefs: vi.fn(async () => undefined) }))
vi.mock('@/lib/ai-platform/appliers/picture-ingest', () => ({ ingestPicture: vi.fn() }))
vi.mock('@/lib/ai-platform/task-client', () => ({ getAiTaskClient: vi.fn() }))

type Result = Record<string, unknown> & {
    error?: { code: string; message: string }
    diffs?: Array<{ entity: { kind: string; id: string }; field: string; before: string | null; after: string }>
    plan?: Record<string, unknown> & { ops?: Array<Record<string, unknown>>; changes?: Record<string, unknown>; base?: string; entries?: Record<string, Record<string, unknown>>; blocks?: Record<string, string>; expect?: Record<string, string> }
    guardrails?: Array<{ rule: string; ok: boolean; detail: string }>
}

const PICTURE = { ref: 'pixabay:1234', url: 'https://cdn.pixabay.com/photo/1234.jpg', name: 'Batik fabric' }
const CONTACT_ID = '00000000-0000-4000-8000-0000000000f1'
const TESTIMONIALS_ID = uuid(50)
const SINGLE_PICTURE_KEYS = ['image', 'backgroundImage', 'avatar', 'logo', 'photo', 'thumbnail', 'poster', 'beforeImage', 'afterImage']

function uuid(n: number) {
    return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

/** A testimonials section whose list items carry a picture, a link and their own id (what a merchant's list looks like). */
const TESTIMONIALS = {
    blockType: 'testimonials',
    id: TESTIMONIALS_ID,
    variant: 'grid',
    headline: 'Kata pelanggan',
    testimonials: [{ id: 'row-1', quote: 'Cantik sekali', name: 'Aminah', avatar: { url: '/a.jpg' }, link: '/review/1', image: 5 }],
}

const planFor = (ops: unknown[], expect: Record<string, string>) => ({ siteId: String(SITE_ID), pageId: String(PAGE_ID), ops, expect })
const patch = (ops: unknown[]) => preparePagePatch(OWNER, { siteId: String(SITE_ID), pageId: String(PAGE_ID), why: 'Add a picture', ops }) as Promise<Result>
const seoInput = (input: Record<string, unknown>) => prepareSeoChange(OWNER, { siteId: String(SITE_ID), pageId: String(PAGE_ID), why: 'Better search title', ...input }) as Promise<Result>
const translateInput = (input: Record<string, unknown> = {}) => prepareTranslatePage(OWNER, { siteId: String(SITE_ID), pageId: String(PAGE_ID), why: 'Malay version', locale: 'ms', ...input }) as Promise<Result>

/** The stored hash of a section on the page as it is now (what a plan drafted from this page carries). */
const hashOf = (id: string) => {
    const block = (state.page!.layout as Array<Record<string, unknown>>).find((b) => b.id === id)
    return block ? blockHash(block) : 'gone'
}

/** A translation plan for `entries`, guarded by the page as it is now and the slots as they are now. */
function translationPlan(entries: Record<string, Record<string, string>>, locale: 'en' | 'ms' = 'ms') {
    const ids = Object.keys(entries)
    return {
        siteId: String(SITE_ID),
        pageId: String(PAGE_ID),
        locale,
        entries,
        blocks: Object.fromEntries(ids.map((id) => [id, hashOf(id)])),
        expect: Object.fromEntries(ids.map((id) => [id, localeFingerprint(state.localeContent as never, id, locale)])),
    }
}

const runTask = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    // Malay added as the second language (Menu → Quick language)
    state.site = site({ generationLocale: 'en', headerBlock: { secondaryLocale: 'ms' } })
    state.page = page(structuredClone(LAYOUT), { seo: { title: 'Old title', description: 'Old description' } })
    state.localeContent = {}
    state.mediaRows = []
    state.writes = []
    state.events = []
    state.subscription = { plan: 'PROFESSIONAL' }
    vi.mocked(ingestPicture).mockImplementation(async () => {
        state.events.push('ingest')
        return { id: 77, url: '/media/77.jpg' } as never
    })
    // the translator echoes every string with an "MS " prefix, so the stored text is visibly the model's
    runTask.mockReset().mockImplementation(async (_task: string, input: { fields: Record<string, string> }) => ({
        output: { fields: Object.fromEntries(Object.entries(input.fields).map(([key, value]) => [key, `MS ${value}`])) },
    }))
    vi.mocked(getAiTaskClient).mockReturnValue({ runTask } as never)
})

// ─── TC-AIWB-22 ────────────────────────────────────────────────────────────

describe('set_image — a picture from the chat into a section picture field [TC-AIWB-22]', () => {
    it.each([
        ['attachment:55', 'attachment:55'],
        ['pixabay:1234', 'pixabay:1234'],
    ])('accepts the %s source and drafts it on the hero picture', async (ref) => {
        const result = await patch([{ op: 'set_image', blockId: HERO.id, path: 'image', image: { ref, name: 'Batik' } }])

        expect(result.error).toBeUndefined()
        expect(result.plan?.ops).toEqual([{ op: 'set_image', blockId: HERO.id, path: 'image', image: { ref, name: 'Batik' } }])
    })

    it('refuses an asset: ref with unknown_image: there is no DAM on this release [TC-AIREL-72]', async () => {
        const result = await patch([{ op: 'set_image', blockId: HERO.id, path: 'image', image: { ref: 'asset:dam-9', name: 'Batik' } }])

        expect(result.error).toMatchObject({ code: 'unknown_image' })
    })

    it('refuses a media: ref the workspace may not use (another shop\'s row, or an unknown id) with unknown_image [TC-AIREL-137]', async () => {
        state.mediaRows = [{ id: 55, tenant: 999, mimeType: 'image/jpeg' }]
        const foreign = await patch([{ op: 'set_image', blockId: HERO.id, path: 'image', image: { ref: 'media:55', name: 'Other shop' } }])
        const unknown = await patch([{ op: 'set_image', blockId: HERO.id, path: 'image', image: { ref: 'media:56' } }])

        expect(foreign.error).toMatchObject({ code: 'unknown_image' })
        expect(foreign.plan).toBeUndefined()
        expect(unknown.error).toMatchObject({ code: 'unknown_image' })
    })

    it('accepts a media: ref from the workspace\'s own library, and the apply step reuses that row [TC-AIREL-137]', async () => {
        state.mediaRows = [{ id: 55, tenant: 1, mimeType: 'image/jpeg' }]

        const result = await patch([{ op: 'set_image', blockId: HERO.id, path: 'image', image: { ref: 'media:55', name: 'Shop photo' } }])

        expect(result.error).toBeUndefined()
        expect(result.plan?.ops?.[0]).toMatchObject({ op: 'set_image', image: { ref: 'media:55' } })
    })

    it.each(SINGLE_PICTURE_KEYS)('accepts the single-picture key %s', async (key) => {
        const result = await patch([{ op: 'set_image', blockId: HERO.id, path: key, image: PICTURE }])

        expect(result.error).toBeUndefined()
    })

    it.each(['images', 'video', 'media'])('refuses the key %s, which is not a single picture field (bad_picture_field)', async (key) => {
        const result = await patch([{ op: 'set_image', blockId: HERO.id, path: key, image: PICTURE }])

        expect(result.error).toMatchObject({ code: 'bad_picture_field' })
    })

    it.each([
        ['headline', 'a text field'],
        ['items.0', 'a list item, not a picture key'],
        ['items.5.image', 'an index past the end of the list'],
        ['items.0.question.image', 'a picture under a text value'],
        ['missing.image', 'a key the section does not have'],
    ])('refuses the path %s (%s) with bad_picture_field', async (path) => {
        const result = await patch([{ op: 'set_image', blockId: FAQ.id, path, image: PICTURE }])

        expect(result.error).toMatchObject({ code: 'bad_picture_field' })
    })

    it('refuses a picture field whose current value is a list (bad_picture_field)', async () => {
        state.page = page(LAYOUT.map((b) => (b.id === HERO.id ? { ...b, image: [{ url: '/old.jpg' }] } : b)))

        const result = await patch([{ op: 'set_image', blockId: HERO.id, path: 'image', image: PICTURE }])

        expect(result.error).toMatchObject({ code: 'bad_picture_field' })
    })

    it.each([
        ['constructor.image'],
        ['__proto__.image'],
        ['prototype.image'],
        ['items.0.__proto__.image'],
        ['toString.image'],
    ])('refuses the path %s: only own properties are walked (bad_picture_field)', async (path) => {
        const blockId = path.startsWith('items') ? FAQ.id : HERO.id

        const result = await patch([{ op: 'set_image', blockId, path, image: PICTURE }])

        expect(result.error).toMatchObject({ code: 'bad_picture_field' })
        expect(({} as Record<string, unknown>).image).toBeUndefined()
    })

    it('refuses a text and a picture of the same top-level field in one change, set_fields first (bad_patch)', async () => {
        state.page = page([NAV, TESTIMONIALS, FOOTER])

        const result = await patch([
            { op: 'set_fields', blockId: TESTIMONIALS_ID, fields: { testimonials: [{ quote: 'Sedap', name: 'Aminah' }] } },
            { op: 'set_image', blockId: TESTIMONIALS_ID, path: 'testimonials.0.avatar', image: PICTURE },
        ])

        expect(result.error).toMatchObject({ code: 'bad_patch' })
        expect(result.error?.message).toContain('testimonials')
    })

    it('refuses the same clash with the picture first and the text second (bad_patch)', async () => {
        state.page = page([NAV, TESTIMONIALS, FOOTER])

        const result = await patch([
            { op: 'set_image', blockId: TESTIMONIALS_ID, path: 'testimonials.0.avatar', image: PICTURE },
            { op: 'set_fields', blockId: TESTIMONIALS_ID, fields: { testimonials: [{ quote: 'Sedap', name: 'Aminah' }] } },
        ])

        expect(result.error).toMatchObject({ code: 'bad_patch' })
    })

    it('allows a text change and a picture of different top-level fields in one change', async () => {
        state.page = page([NAV, TESTIMONIALS, FOOTER])

        const result = await patch([
            { op: 'set_fields', blockId: TESTIMONIALS_ID, fields: { headline: 'Ulasan terkini' } },
            { op: 'set_image', blockId: TESTIMONIALS_ID, path: 'testimonials.0.avatar', image: PICTURE },
        ])

        expect(result.error).toBeUndefined()
        expect(result.plan?.ops).toHaveLength(2)
    })

    it('refuses a picture on the navigation (structural, the frame is not the copilot\'s)', async () => {
        const result = await patch([{ op: 'set_image', blockId: NAV.id, path: 'image', image: PICTURE }])

        expect(result.error).toMatchObject({ code: 'structural' })
    })

    it('refuses a section id that is not on the page (unknown_section)', async () => {
        const result = await patch([{ op: 'set_image', blockId: 'ghost', path: 'image', image: PICTURE }])

        expect(result.error).toMatchObject({ code: 'unknown_section' })
    })

    it('shows the picture change in the review by its plain name with the picture name; the line keeps the path for "Show" [TC-AIWB-62]', async () => {
        const result = await patch([{ op: 'set_image', blockId: HERO.id, path: 'image', image: PICTURE }])

        expect(result.diffs).toEqual([
            expect.objectContaining({ entity: { kind: 'site_block', id: HERO.id, label: expect.any(String) }, field: 'Picture', path: 'image', before: null, after: 'New picture: Batik fabric' }),
        ])
    })

    it('runPagePatch writes the media id at the path and marks the section touched', () => {
        const { next, touched } = runPagePatch(structuredClone(LAYOUT) as never, [{ op: 'set_image', blockId: HERO.id, path: 'image', image: PICTURE, mediaId: 77 }])

        expect(next.find((b) => b.id === HERO.id)).toMatchObject({ image: 77, headline: HERO.headline })
        expect(touched).toEqual(new Set([HERO.id]))
        // the input layout is not mutated
        expect(LAYOUT.find((b) => b.id === HERO.id)).not.toHaveProperty('image')
    })

    it('runPagePatch writes a picture inside a list item by index', () => {
        const { next } = runPagePatch(structuredClone(LAYOUT) as never, [{ op: 'set_image', blockId: FAQ.id, path: 'items.0.image', image: PICTURE, mediaId: 78 }])

        expect(next.find((b) => b.id === FAQ.id)).toMatchObject({ items: [{ question: 'Ship to Sabah?', answer: 'Yes', image: 78 }] })
    })

    it('setAtPath refuses a prototype segment with PagePatchError and pollutes nothing', () => {
        expect(() => setAtPath({}, ['__proto__', 'polluted'], true)).toThrow(PagePatchError)
        expect(() => setAtPath({ a: 1 }, ['constructor'], 1)).toThrow(PagePatchError)
        expect(() => setAtPath({}, ['prototype', 'image'], 1)).toThrow(PagePatchError)
        expect(({} as Record<string, unknown>).polluted).toBeUndefined()
        expect(setAtPath({ a: { b: 1 } }, ['a', 'b'], 2)).toEqual({ a: { b: 2 } })
    })

    it('runPagePatch throws PagePatchError on an unsafe picture path', () => {
        expect(() => runPagePatch(structuredClone(LAYOUT) as never, [{ op: 'set_image', blockId: HERO.id, path: 'constructor.image', image: PICTURE, mediaId: 77 }])).toThrow(PagePatchError)
    })

    it('apply ingests the picture into the workspace first, then writes its media id into the page draft', async () => {
        const drafted = { [HERO.id]: blockHash(HERO) }

        await applySitePagePatch(planFor([{ op: 'set_image', blockId: HERO.id, path: 'image', image: PICTURE }], drafted), OWNER)

        expect(vi.mocked(ingestPicture).mock.calls[0]![1]).toEqual(PICTURE)
        expect(vi.mocked(ingestPicture).mock.calls[0]![2]).toBe('Batik fabric')
        expect(state.events).toEqual(['ingest', 'write:pages'])
        const layout = state.writes.find((w) => w.collection === 'pages')!.arg.data.layout as Array<Record<string, unknown>>
        expect(layout.find((b) => b.id === HERO.id)).toMatchObject({ image: 77 })
    })

    it('a failed ingest stops the change with 422: nothing is written to the page', async () => {
        vi.mocked(ingestPicture).mockRejectedValueOnce(new Error('upstream 500'))

        const failure = await applySitePagePatch(planFor([{ op: 'set_image', blockId: HERO.id, path: 'image', image: PICTURE }], { [HERO.id]: blockHash(HERO) }), OWNER).catch((e: unknown) => e)

        expect(failure).toBeInstanceOf(ChangeSetApplyError)
        expect(failure).toMatchObject({ status: 422, message: 'A picture for this change could not be added. Nothing was changed.' })
        expect(state.writes).toHaveLength(0)
        expect(state.events).not.toContain('write:pages')
    })

    // the version is checked before anything is uploaded: a refused (409) change leaves no unreferenced media behind
    it('a stale change uploads nothing: 409 final before the picture is ingested', async () => {
        state.page = page(LAYOUT.map((b) => (b.id === HERO.id ? { ...b, headline: 'Merchant just edited' } : b)))

        const failure = await applySitePagePatch(planFor([{ op: 'set_image', blockId: HERO.id, path: 'image', image: PICTURE }], { [HERO.id]: blockHash(HERO) }), OWNER).catch((e: unknown) => e)

        expect(failure).toMatchObject({ status: 409, final: true })
        expect(vi.mocked(ingestPicture)).not.toHaveBeenCalled()
        expect(state.writes).toHaveLength(0)
    })
})

// ─── TC-AIWB-23 ────────────────────────────────────────────────────────────

describe('prepareSeoChange — limits, sanitising and the draft [TC-AIWB-23]', () => {
    it('accepts a 60-character SEO title and refuses 61 (seo_title_length, the editor warning)', async () => {
        expect((await seoInput({ title: 'a'.repeat(60) })).error).toBeUndefined()

        const result = await seoInput({ title: 'a'.repeat(61) })

        expect(result.error).toMatchObject({ code: 'seo_title_length', message: 'The SEO title must be 1–60 characters (it is 61).' })
    })

    it('refuses an empty SEO title once sanitised (seo_title_length)', async () => {
        expect((await seoInput({ title: '   ' })).error).toMatchObject({ code: 'seo_title_length' })
    })

    it('accepts a 160-character SEO description and refuses 161 (seo_description_length)', async () => {
        expect((await seoInput({ description: 'd'.repeat(160) })).error).toBeUndefined()

        const result = await seoInput({ description: 'd'.repeat(161) })

        expect(result.error).toMatchObject({ code: 'seo_description_length', message: 'The SEO description must be 1–160 characters (it is 161).' })
    })

    it('strips HTML from the SEO text before the review and the limit check', async () => {
        const result = await seoInput({ title: '<b>Batik</b> <img src=x onerror=alert(1)>Kedai' })

        expect(result.error).toBeUndefined()
        expect(result.diffs?.[0]).toMatchObject({ field: 'SEO title', path: 'seoTitle', after: 'Batik Kedai' })
        expect(JSON.stringify(result.plan)).not.toContain('<')
    })

    it('refuses a change that says what the SEO already says (no_change)', async () => {
        const result = await seoInput({ title: 'Old title' })

        expect(result.error).toMatchObject({ code: 'no_change', message: "The page's SEO already says that." })
    })

    it('drafts only the changed keys, low risk, and carries the SEO fingerprint of what it was drafted from', async () => {
        const result = await seoInput({ title: 'New title', description: 'Old description' })

        expect(result).toMatchObject({ kind: 'site.seo_patch', risk: 'low' })
        expect(result.plan).toEqual({
            siteId: String(SITE_ID),
            pageId: String(PAGE_ID),
            base: seoFingerprint({ title: 'Old title', description: 'Old description' }),
            changes: { title: 'New title' },
        })
        expect(result.diffs).toHaveLength(1)
    })

    it('does not touch the stored page while drafting', async () => {
        const before = JSON.stringify(state.page)

        await seoInput({ title: 'New title' })

        expect(JSON.stringify(state.page)).toBe(before)
        expect(state.writes).toHaveLength(0)
    })
})

describe('applySiteSeoPatch / applySiteSeoRestore — the page draft SEO and its undo [TC-AIWB-23]', () => {
    const base = () => seoFingerprint({ title: 'Old title', description: 'Old description' })

    it('writes the SEO into the page draft and returns an undo record', async () => {
        const result = await applySiteSeoPatch({ siteId: String(SITE_ID), pageId: String(PAGE_ID), base: base(), changes: { title: 'New title' } }, OWNER)

        const write = state.writes.find((w) => w.collection === 'pages')!
        expect(write.arg).toMatchObject({ draft: true, data: { seo: { title: 'New title', description: 'Old description' } } })
        expect(result.undo).toMatchObject({ kind: 'site.seo_restore', payload: { siteId: String(SITE_ID), pageId: String(PAGE_ID), changes: { title: 'Old title' } } })
    })

    it('refuses with 409 and writes nothing when the SEO changed since it was drafted', async () => {
        state.page = page(structuredClone(LAYOUT), { seo: { title: 'Merchant title', description: 'Old description' } })

        const failure = await applySiteSeoPatch({ siteId: String(SITE_ID), pageId: String(PAGE_ID), base: base(), changes: { title: 'New title' } }, OWNER).catch((e: unknown) => e)

        expect(failure).toMatchObject({ status: 409, final: true, message: "The page's SEO changed after the assistant drafted this. Ask again." })
        expect(state.writes).toHaveLength(0)
    })

    it('undo puts the previous SEO back while it is still as the change left it', async () => {
        const applied = await applySiteSeoPatch({ siteId: String(SITE_ID), pageId: String(PAGE_ID), base: base(), changes: { title: 'New title' } }, OWNER)
        const undo = applied.undo!.payload as { base: string; changes: Record<string, unknown> }

        await applySiteSeoRestore({ siteId: String(SITE_ID), pageId: String(PAGE_ID), base: undo.base, changes: undo.changes }, OWNER)

        expect(state.page!.seo).toEqual({ title: 'Old title', description: 'Old description' })
    })

    it('undoVerdict follows the SEO: applied, reverted once put back, diverged once edited again [TC-AIREL-312]', async () => {
        const applied = await applySiteSeoPatch({ siteId: String(SITE_ID), pageId: String(PAGE_ID), base: base(), changes: { title: 'New title' } }, OWNER)

        await expect(undoVerdict(applied.undo!, OWNER)).resolves.toBe('applied')
        state.page = { ...state.page!, seo: { title: 'Old title', description: 'Old description' } }
        await expect(undoVerdict(applied.undo!, OWNER)).resolves.toBe('reverted')
        state.page = { ...state.page!, seo: { title: 'Edited again', description: 'Old description' } }
        await expect(undoVerdict(applied.undo!, OWNER)).resolves.toBe('diverged')
    })

    it('undo twice (or after the SEO was put back by hand) is a success that writes nothing [TC-AIREL-304]', async () => {
        const applied = await applySiteSeoPatch({ siteId: String(SITE_ID), pageId: String(PAGE_ID), base: base(), changes: { title: 'New title' } }, OWNER)
        const undo = applied.undo!.payload as { base: string; changes: Record<string, unknown> }
        await applySiteSeoRestore({ siteId: String(SITE_ID), pageId: String(PAGE_ID), base: undo.base, changes: undo.changes }, OWNER)
        const writes = state.writes.length

        await expect(applySiteSeoRestore({ siteId: String(SITE_ID), pageId: String(PAGE_ID), base: undo.base, changes: undo.changes }, OWNER)).resolves.toBeDefined()

        expect(state.writes).toHaveLength(writes)
        expect(state.page!.seo).toEqual({ title: 'Old title', description: 'Old description' })
    })

    it('undo refuses with 409 once the SEO was edited again', async () => {
        const applied = await applySiteSeoPatch({ siteId: String(SITE_ID), pageId: String(PAGE_ID), base: base(), changes: { title: 'New title' } }, OWNER)
        const undo = applied.undo!.payload as { base: string; changes: Record<string, unknown> }
        state.page = { ...state.page!, seo: { title: 'Edited again', description: 'Old description' } }

        const failure = await applySiteSeoRestore({ siteId: String(SITE_ID), pageId: String(PAGE_ID), base: undo.base, changes: undo.changes }, OWNER).catch((e: unknown) => e)

        expect(failure).toMatchObject({ status: 409, message: "The page's title or description was changed after the assistant's change, so this can't be undone from here. Change them back in the page's SEO settings." })
        expect(state.page!.seo).toEqual({ title: 'Edited again', description: 'Old description' })
    })
})

// ─── TC-AIWB-24 ────────────────────────────────────────────────────────────

describe('translatableStrings and translatedSlot — what the translator sees and what a slot holds [TC-AIWB-24]', () => {
    it('lists only the text paths of a section: no structure, pictures, links or ids', () => {
        const { fields, source } = translatableStrings(HERO as never)

        expect(fields).toMatchObject({ headline: 'Batik for every day', subheadline: 'Hand-made in Kelantan', 'ctaButtons.0.label': 'Shop' })
        expect(Object.keys(fields)).not.toContain('ctaButtons.0.url')
        expect(source).not.toHaveProperty('blockType')
        expect(source).not.toHaveProperty('variant')
        expect(source).not.toHaveProperty('id')
        expect(source).not.toHaveProperty('image')
    })

    // option values (a button's style, a link's target) are not text: never sent, never written
    it('does not send enum-valued keys such as a button style to the translator', () => {
        const { fields } = translatableStrings(HERO as never)

        expect(Object.keys(fields)).not.toContain('ctaButtons.0.style')
    })

    it('drops the id, link and picture paths inside list items', () => {
        const { fields } = translatableStrings(TESTIMONIALS as never)

        expect(fields).toEqual({ headline: 'Kata pelanggan', 'testimonials.0.quote': 'Cantik sekali', 'testimonials.0.name': 'Aminah' })
    })

    it('a slot with no translated text is the section content itself, without its identity fields', () => {
        const slot = translatedSlot(TESTIMONIALS as never, {})

        expect(slot).toEqual({ headline: 'Kata pelanggan', testimonials: TESTIMONIALS.testimonials })
    })

    it('a slot takes the translated texts in place and keeps the list pictures, links and ids', () => {
        const slot = translatedSlot(TESTIMONIALS as never, { headline: 'Ulasan pelanggan', 'testimonials.0.quote': 'Sangat cantik' })

        expect(slot).toEqual({
            headline: 'Ulasan pelanggan',
            testimonials: [{ id: 'row-1', quote: 'Sangat cantik', name: 'Aminah', avatar: { url: '/a.jpg' }, link: '/review/1', image: 5 }],
        })
    })
})

describe('prepareTranslatePage — which sections are translated [TC-AIWB-24]', () => {
    it('translates the sections only: the navigation and footer are skipped', async () => {
        const result = await translateInput()

        expect(result.error).toBeUndefined()
        expect(Object.keys(result.plan!.entries!).sort()).toEqual([FAQ.id, HERO.id, PRODUCTS.id].sort())
        expect(runTask).toHaveBeenCalledTimes(3)
        expect(runTask).toHaveBeenCalledWith('i18n.translate-blocks', expect.objectContaining({ targetLocale: 'ms' }))
    })

    it('skips sections without a saved id (the editor could not find them again on undo)', async () => {
        state.page = page([NAV, { ...HERO, id: 'block-1' }, FAQ, FOOTER])

        const result = await translateInput()

        expect(Object.keys(result.plan!.entries!)).toEqual([FAQ.id])
    })

    it('with onlyMissing (the default) skips sections that already have that translation', async () => {
        state.localeContent = { [HERO.id]: { en: {}, ms: { headline: 'Sudah diterjemah' } } }

        const result = await translateInput()

        expect(Object.keys(result.plan!.entries!).sort()).toEqual([FAQ.id, PRODUCTS.id].sort())
    })

    it('with onlyMissing false it also redoes the sections already translated', async () => {
        state.localeContent = { [HERO.id]: { en: {}, ms: { headline: 'Sudah diterjemah' } } }

        const result = await translateInput({ onlyMissing: false })

        expect(Object.keys(result.plan!.entries!).sort()).toEqual([FAQ.id, HERO.id, PRODUCTS.id].sort())
    })

    it('refuses with no_change when every section already has the translation', async () => {
        state.localeContent = {
            [HERO.id]: { en: {}, ms: { headline: 'a' } },
            [FAQ.id]: { en: {}, ms: { headline: 'b' } },
            [PRODUCTS.id]: { en: {}, ms: { headline: 'c' } },
        }

        const result = await translateInput()

        expect(result.error).toMatchObject({ code: 'no_change', message: 'Every section already has a Bahasa Melayu translation. Ask again with onlyMissing false to redo them.' })
        expect(runTask).not.toHaveBeenCalled()
    })

    it('refuses more than 12 sections with too_large before the translator is called', async () => {
        state.page = page([NAV, ...Array.from({ length: 13 }, (_, i) => ({ ...FAQ, id: uuid(i + 1) })), FOOTER])

        const result = await translateInput()

        expect(result.error).toMatchObject({ code: 'too_large', message: 'This page has 13 sections to translate; at most 12 per change.' })
        expect(runTask).not.toHaveBeenCalled()
    })

    it('accepts exactly 12 sections', async () => {
        state.page = page([NAV, ...Array.from({ length: 12 }, (_, i) => ({ ...FAQ, id: uuid(i + 1) })), FOOTER])

        const result = await translateInput()

        expect(result.error).toBeUndefined()
        expect(runTask).toHaveBeenCalledTimes(12)
    })

    it('a section with no text at all is not sent, and a page with only such sections is no_change', async () => {
        state.page = page([NAV, { blockType: 'divider', id: uuid(90), variant: 'solid' }, FOOTER])

        const result = await translateInput()

        expect(result.error).toMatchObject({ code: 'no_change', message: 'This page has no text to translate.' })
        expect(runTask).not.toHaveBeenCalled()
    })

    it('refuses the site\'s own language with same_language, and the translator is not called', async () => {
        const result = await translateInput({ locale: 'en' })

        expect(result.error).toMatchObject({ code: 'same_language', message: 'This website is written in English already. Translate into the other language.' })
        expect(runTask).not.toHaveBeenCalled()
    })

    it('the site\'s language falls back to its locale field, then to English', async () => {
        state.site = site({ generationLocale: undefined, locale: 'ms', headerBlock: { secondaryLocale: 'en' } })
        expect((await translateInput({ locale: 'ms' })).error).toMatchObject({ code: 'same_language' })

        state.site = site({ generationLocale: undefined, locale: undefined, headerBlock: { secondaryLocale: 'ms' } })
        expect((await translateInput({ locale: 'en' })).error).toMatchObject({ code: 'same_language' })
        expect((await translateInput({ locale: 'ms' })).error).toBeUndefined()
    })

    // TC-AIWB-107 — only into a language the site has (Quick language): Malay viewed once in the
    // editor (Sites.locale) but never added is refused before the translator runs; the header
    // being edited counts before the live one
    it('refuses a language the site has not added, with where to add it [TC-AIWB-107]', async () => {
        state.site = site({ generationLocale: 'en', locale: 'ms', headerBlock: { primaryLocale: 'en' } })

        const result = await translateInput({ locale: 'ms' })

        expect(result.error).toMatchObject({ code: 'language_not_added', message: expect.stringContaining('Menu → Quick language') })
        expect(runTask).not.toHaveBeenCalled()
        state.site = site({ generationLocale: 'en', headerBlock: {}, pendingHeaderBlock: { secondaryLocale: 'ms' } })
        expect((await translateInput({ locale: 'ms' })).error).toBeUndefined()
    })

    it('a Malay site translates into English', async () => {
        state.site = site({ generationLocale: 'ms', headerBlock: { secondaryLocale: 'en' } })

        const result = await translateInput({ locale: 'en' })

        expect(result.error).toBeUndefined()
    })

    it('the card lists every translated text as original → translation, one row per text', async () => {
        const result = await translateInput()

        // one row per translated text: the card has as many rows as the plan has texts
        const texts = Object.values(result.plan!.entries!).reduce((sum, strings) => sum + Object.keys(strings as object).length, 0)
        expect(result.diffs).toHaveLength(texts)
        expect(result.diffs).toEqual(expect.arrayContaining([
            expect.objectContaining({ field: 'Bahasa Melayu · headline', before: 'Batik for every day', after: 'MS Batik for every day' }),
            expect.objectContaining({ field: 'Bahasa Melayu · ctaButtons.0.label', before: 'Shop', after: 'MS Shop' }),
        ]))
    })

    it('the plan carries only the translated texts, the section hashes and the slot fingerprints', async () => {
        const result = await translateInput()

        expect(result.plan!.entries![HERO.id]).toMatchObject({ headline: 'MS Batik for every day', subheadline: 'MS Hand-made in Kelantan', 'ctaButtons.0.label': 'MS Shop' })
        expect(Object.keys(result.plan!.entries![HERO.id]!).some((key) => /url|href|link|src|image/i.test(key))).toBe(false)
        expect(result.plan!.blocks![HERO.id]).toBe(blockHash(HERO))
        expect(result.plan!.expect![HERO.id]).toBe(localeFingerprint({}, HERO.id, 'ms'))
        expect(JSON.stringify(result.plan)).not.toContain('/shop')
    })

    it('more than 190 translated texts: the card lists 190 and says how many are not shown (long_translation)', async () => {
        // 12 sections × (headline + 20 items × question/answer) = 492 texts
        state.page = page([NAV, ...Array.from({ length: 12 }, (_, i) => ({ ...FAQ, id: uuid(i + 1), items: Array.from({ length: 20 }, (__, k) => ({ question: `Q${k}`, answer: `A${k}` })) })), FOOTER])

        const result = await translateInput()

        expect(result.diffs).toHaveLength(190)
        expect(result.guardrails).toContainEqual(expect.objectContaining({ rule: 'long_translation', ok: false, detail: expect.stringContaining('302 more') }))
        expect(Object.values(result.plan!.entries!).reduce((sum, strings) => sum + Object.keys(strings as object).length, 0)).toBe(492)
    })

    it('the translator never sees pictures, links or business data, at any depth', async () => {
        const richHero = { ...HERO, image: 12, backgroundImage: { url: 'https://cdn.example/bg.jpg' }, ctaButtons: [{ label: 'Shop', url: 'https://shop.example/buy', style: 'primary' }], gallery: [{ image: 'attachment-9', caption: 'Kain' }] }
        const contact = { blockType: 'contact', id: CONTACT_ID, variant: 'default', headline: 'Hubungi kami', email: 'hello@kedai.example', phone: '+60 12-345 6789', address: 'No 1, Jalan Kebun', socials: [{ platform: 'instagram', url: 'https://instagram.com/kedai' }] }
        state.page = page([NAV, richHero, contact, FOOTER])

        await translateInput()

        const sent = runTask.mock.calls.map(([, input]) => (input as { fields: Record<string, string> }).fields)
        const keys = sent.flatMap((fields) => Object.keys(fields))
        const values = sent.flatMap((fields) => Object.values(fields))
        expect(values).toEqual(expect.arrayContaining(['Batik for every day', 'Kain', 'Shop', 'Hubungi kami']))
        expect(keys.filter((key) => /image|url|href|link|src|email|phone|address|social|logo/i.test(key))).toEqual([])
        for (const secret of ['cdn.example', 'shop.example', 'attachment-9', 'hello@kedai.example', '+60 12-345 6789', 'Jalan Kebun', 'instagram.com', '/buy']) {
            expect(JSON.stringify(sent)).not.toContain(secret)
        }
    })

    it('a platform 429 is reported as ai_quota', async () => {
        runTask.mockRejectedValueOnce(Object.assign(new Error('quota'), { status: 429 }))

        const result = await translateInput()

        expect(result.error).toMatchObject({ code: 'ai_quota', message: "The workspace reached today's AI limit, so the page could not be translated. Try again tomorrow." })
    })

    it('any other failure is reported as ai_unavailable', async () => {
        runTask.mockRejectedValueOnce(new Error('gateway timeout'))

        const result = await translateInput()

        expect(result.error).toMatchObject({ code: 'ai_unavailable', message: 'The translation could not be made right now. Try again in a moment.' })
    })

    it('no AI platform configured is reported as ai_unavailable, not thrown', async () => {
        vi.mocked(getAiTaskClient).mockImplementation(() => {
            throw new Error('AI_PLATFORM_URL is not configured.')
        })

        const result = await translateInput()

        expect(result.error).toMatchObject({ code: 'ai_unavailable' })
    })

    it('after the first failure no further sections are sent', async () => {
        state.page = page([NAV, ...Array.from({ length: 12 }, (_, i) => ({ ...FAQ, id: uuid(i + 1) })), FOOTER])
        runTask.mockRejectedValue(Object.assign(new Error('quota'), { status: 429 }))

        const result = await translateInput()

        expect(result.error).toMatchObject({ code: 'ai_quota' })
        // six sections are in flight at once; the rest are never sent
        expect(runTask.mock.calls.length).toBeGreaterThan(0)
        expect(runTask.mock.calls.length).toBeLessThanOrEqual(6)
    })
})

describe('applySiteTranslatePage / applySiteLocaleRestore — per-locale writes and undo [TC-AIWB-24]', () => {
    const FAQ_EN = { headline: 'Questions' }

    it('merges the translation into its locale only: the slot is the whole section, other locale and sections untouched', async () => {
        state.localeContent = { [FAQ.id]: { en: FAQ_EN, ms: { headline: 'Soalan' } } }

        await applySiteTranslatePage(translationPlan({ [HERO.id]: { headline: 'Batik untuk setiap hari' } }), OWNER)

        const stored = state.localeContent as Record<string, Record<string, Record<string, unknown>>>
        expect(stored[HERO.id]).toEqual({
            en: {},
            ms: { headline: 'Batik untuk setiap hari', subheadline: 'Hand-made in Kelantan', ctaButtons: HERO.ctaButtons },
        })
        expect(stored[FAQ.id]).toEqual({ en: FAQ_EN, ms: { headline: 'Soalan' } })
    })

    it('a list item keeps its picture, link and id after translation', async () => {
        state.page = page([NAV, TESTIMONIALS, FOOTER])

        await applySiteTranslatePage(translationPlan({ [TESTIMONIALS_ID]: { headline: 'Ulasan pelanggan', 'testimonials.0.quote': 'Sangat cantik' } }), OWNER)

        const stored = state.localeContent as Record<string, Record<string, Record<string, unknown>>>
        expect(stored[TESTIMONIALS_ID]!.ms).toEqual({
            headline: 'Ulasan pelanggan',
            testimonials: [{ id: 'row-1', quote: 'Sangat cantik', name: 'Aminah', avatar: { url: '/a.jpg' }, link: '/review/1', image: 5 }],
        })
    })

    it('returns an undo that removes a translation which had none before', async () => {
        const result = await applySiteTranslatePage(translationPlan({ [HERO.id]: { headline: 'Batik untuk setiap hari' } }), OWNER)

        expect(result.undo).toMatchObject({ kind: 'site.locale_restore', payload: { locale: 'ms', entries: { [HERO.id]: null } } })
        await applySiteLocaleRestore(result.undo!.payload, OWNER)
        expect((state.localeContent as Record<string, Record<string, unknown>>)[HERO.id]!.ms).toBeUndefined()
    })

    it('undo restores the translation the section had before the apply', async () => {
        state.localeContent = { [FAQ.id]: { en: FAQ_EN, ms: { headline: 'Soalan lama' } } }

        const result = await applySiteTranslatePage(translationPlan({ [FAQ.id]: { headline: 'Soalan baru' } }), OWNER)
        expect((state.localeContent as Record<string, Record<string, Record<string, unknown>>>)[FAQ.id]!.ms).toMatchObject({ headline: 'Soalan baru' })

        await applySiteLocaleRestore(result.undo!.payload, OWNER)
        expect(state.localeContent).toEqual({ [FAQ.id]: { en: FAQ_EN, ms: { headline: 'Soalan lama' } } })
    })

    it('refuses with 409 and writes nothing when a section translation changed since it was drafted', async () => {
        state.localeContent = { [FAQ.id]: { en: FAQ_EN, ms: { headline: 'Soalan' } } }
        const expected = localeFingerprint(state.localeContent as never, FAQ.id, 'ms')
        state.localeContent = { [FAQ.id]: { en: FAQ_EN, ms: { headline: 'Editor sudah ubah' } } }
        const plan = { ...translationPlan({ [FAQ.id]: { headline: 'Soalan baru' } }), expect: { [FAQ.id]: expected } }

        const failure = await applySiteTranslatePage(plan, OWNER).catch((e: unknown) => e)

        expect(failure).toMatchObject({ status: 409, final: true, message: 'These translations changed after the assistant drafted them. Ask again.' })
        expect(state.localeContent).toEqual({ [FAQ.id]: { en: FAQ_EN, ms: { headline: 'Editor sudah ubah' } } })
    })

    it('undoVerdict follows the copies: applied, reverted once taken back, diverged once edited [TC-AIREL-312]', async () => {
        const result = await applySiteTranslatePage(translationPlan({ [HERO.id]: { headline: 'Batik untuk setiap hari' } }), OWNER)
        const written = structuredClone(state.localeContent)

        await expect(undoVerdict(result.undo!, OWNER)).resolves.toBe('applied')
        await applySiteLocaleRestore(result.undo!.payload, OWNER)
        await expect(undoVerdict(result.undo!, OWNER)).resolves.toBe('reverted')
        state.localeContent = { [HERO.id]: { en: {}, ms: { headline: 'Diedit semula' } } }
        await expect(undoVerdict(result.undo!, OWNER)).resolves.toBe('diverged')
        expect(written).toBeDefined()
    })

    it('undo twice is a success that writes nothing [TC-AIREL-304]', async () => {
        const result = await applySiteTranslatePage(translationPlan({ [HERO.id]: { headline: 'Batik untuk setiap hari' } }), OWNER)
        await applySiteLocaleRestore(result.undo!.payload, OWNER)
        const stored = structuredClone(state.localeContent)
        const events = state.events.length

        await expect(applySiteLocaleRestore(result.undo!.payload, OWNER)).resolves.toBeDefined()

        expect(state.localeContent).toEqual(stored)
        expect(state.events).toHaveLength(events)
    })

    it('undo refuses with 409 once a translation was edited since the apply', async () => {
        const result = await applySiteTranslatePage(translationPlan({ [HERO.id]: { headline: 'Batik untuk setiap hari' } }), OWNER)
        state.localeContent = { [HERO.id]: { en: {}, ms: { headline: 'Diedit semula' } } }

        const failure = await applySiteLocaleRestore(result.undo!.payload, OWNER).catch((e: unknown) => e)

        expect(failure).toMatchObject({ status: 409, message: "These translations were edited after the assistant wrote them, so this can't be undone from here. Change them back in the editor." })
        expect((state.localeContent as Record<string, Record<string, unknown>>)[HERO.id]!.ms).toEqual({ headline: 'Diedit semula' })
    })

    it('undo refuses with 422 when its entries and fingerprints name different sections', async () => {
        const failure = await applySiteLocaleRestore({ siteId: String(SITE_ID), pageId: String(PAGE_ID), locale: 'ms', entries: { [HERO.id]: null }, expect: { [FAQ.id]: 'x' } }, OWNER).catch((e: unknown) => e)

        expect(failure).toMatchObject({ status: 422, message: 'This undo is not complete.' })
        expect(state.localeContent).toEqual({})
    })

    it('a malformed translation (a null entry) is refused by the plan schema and writes nothing', async () => {
        const plan = { ...translationPlan({ [HERO.id]: { headline: 'x' } }), entries: { [HERO.id]: null } }

        await expect(applySiteTranslatePage(plan as never, OWNER)).rejects.toThrow()
        expect(state.localeContent).toEqual({})
    })

    it('a page id that is not digits is refused by the schema', async () => {
        await expect(applySiteTranslatePage({ ...translationPlan({ [HERO.id]: { headline: 'x' } }), pageId: 'abc' }, OWNER)).rejects.toThrow()
        await expect(applySiteLocaleRestore({ siteId: String(SITE_ID), pageId: '../10', locale: 'ms', entries: { [HERO.id]: null }, expect: { [HERO.id]: 'x' } }, OWNER)).rejects.toThrow()
        expect(state.localeContent).toEqual({})
    })

    it('entries, blocks and expect must name the same sections (422)', async () => {
        const base = translationPlan({ [HERO.id]: { headline: 'x' } })

        const extraExpect = await applySiteTranslatePage({ ...base, expect: { ...base.expect, [FAQ.id]: 'x' } }, OWNER).catch((e: unknown) => e)
        expect(extraExpect).toMatchObject({ status: 422, message: 'This translation is not complete. Ask again.' })

        const extraBlock = await applySiteTranslatePage({ ...base, blocks: { ...base.blocks, [FAQ.id]: 'x' } }, OWNER).catch((e: unknown) => e)
        expect(extraBlock).toMatchObject({ status: 422 })
        expect(state.localeContent).toEqual({})
    })

    it('zero sections is refused with 422', async () => {
        const failure = await applySiteTranslatePage({ siteId: String(SITE_ID), pageId: String(PAGE_ID), locale: 'ms', entries: {}, blocks: {}, expect: {} }, OWNER).catch((e: unknown) => e)

        expect(failure).toMatchObject({ status: 422 })
    })

    it('more than 20 sections is refused with 422 before anything is read', async () => {
        const ids = Array.from({ length: 21 }, (_, i) => uuid(i + 1))
        const plan = {
            siteId: String(SITE_ID),
            pageId: String(PAGE_ID),
            locale: 'ms' as const,
            entries: Object.fromEntries(ids.map((id) => [id, { headline: 'x' }])),
            blocks: Object.fromEntries(ids.map((id) => [id, 'x'])),
            expect: Object.fromEntries(ids.map((id) => [id, 'x'])),
        }

        await expect(applySiteTranslatePage(plan, OWNER)).rejects.toMatchObject({ status: 422 })
        expect(state.localeContent).toEqual({})
    })

    it('a navigation or footer section is refused with 422', async () => {
        const failure = await applySiteTranslatePage(translationPlan({ [NAV.id]: { logoText: 'Kedai' } }), OWNER).catch((e: unknown) => e)

        expect(failure).toMatchObject({ status: 422, message: "This section can't be translated here." })
        expect(state.localeContent).toEqual({})
    })

    it('a section without a saved id is refused with 422', async () => {
        state.page = page([NAV, { ...HERO, id: 'block-1' }, FOOTER])

        const failure = await applySiteTranslatePage(translationPlan({ 'block-1': { headline: 'x' } }), OWNER).catch((e: unknown) => e)

        expect(failure).toMatchObject({ status: 422, message: "This section can't be translated here." })
    })

    it('a section changed since it was drafted is refused with 409 and nothing is written', async () => {
        const plan = translationPlan({ [HERO.id]: { headline: 'Batik untuk setiap hari' } })
        state.page = page(LAYOUT.map((b) => (b.id === HERO.id ? { ...b, headline: 'Merchant edited' } : b)))

        const failure = await applySiteTranslatePage(plan, OWNER).catch((e: unknown) => e)

        expect(failure).toMatchObject({ status: 409, final: true, message: 'Some of these sections changed after the assistant translated them. Ask again.' })
        expect(state.localeContent).toEqual({})
    })

    it('a section that is gone is refused with 409', async () => {
        const failure = await applySiteTranslatePage({ ...translationPlan({ [HERO.id]: { headline: 'x' } }), blocks: { ghost: 'x' }, entries: { ghost: { headline: 'x' } }, expect: { ghost: 'x' } }, OWNER).catch((e: unknown) => e)

        expect(failure).toMatchObject({ status: 409 })
        expect(state.localeContent).toEqual({})
    })

    it('a page of another site is refused with 409', async () => {
        state.page = page(LAYOUT, { site: 99 })

        const failure = await applySiteTranslatePage(translationPlan({ [HERO.id]: { headline: 'x' } }), OWNER).catch((e: unknown) => e)

        expect(failure).toMatchObject({ status: 409, message: 'This page no longer exists.' })
    })

    it('a text key that is not one of the section\'s text paths is refused with 422', async () => {
        const pictureKey = await applySiteTranslatePage(translationPlan({ [HERO.id]: { image: 'x' } }), OWNER).catch((e: unknown) => e)
        const linkPath = await applySiteTranslatePage(translationPlan({ [HERO.id]: { 'ctaButtons.0.url': 'https://evil.example' } }), OWNER).catch((e: unknown) => e)

        expect(pictureKey).toMatchObject({ status: 422, message: 'This translation no longer fits the section. Ask again.' })
        expect(linkPath).toMatchObject({ status: 422 })
        expect(state.localeContent).toEqual({})
    })
})

// ─── TC-AIWB-46 ────────────────────────────────────────────────────────────

describe('set_pictures — a gallery gets a new list of pictures from the chat [TC-AIWB-46]', () => {
    const GALLERY_ID = uuid(60)
    const GALLERY = {
        blockType: 'gallery',
        id: GALLERY_ID,
        variant: 'grid',
        headline: 'Our shop',
        images: [
            { id: 'g1', image: 11, caption: 'Old one' },
            { id: 'g2', image: 12, caption: 'Old two' },
        ],
    }
    const SECOND = { ref: 'pixabay:7', url: 'https://cdn.pixabay.com/photo/7.jpg', name: 'Coffee beans' }
    const items = [{ image: PICTURE, caption: 'Our batik' }, { image: SECOND }, { image: { ref: 'attachment:att_1', name: 'shop.jpg' }, caption: 'The shop' }]

    beforeEach(() => {
        state.page = page([NAV, HERO, GALLERY, FOOTER])
    })

    it('drafts the whole list in order and shows it on the card', async () => {
        const result = await patch([{ op: 'set_pictures', blockId: GALLERY_ID, path: 'images', items }])

        expect(result.error).toBeUndefined()
        expect(result.plan?.ops).toEqual([{ op: 'set_pictures', blockId: GALLERY_ID, path: 'images', items }])
        expect(result.diffs).toEqual([
            expect.objectContaining({ field: 'Images', before: '2 pictures', after: expect.stringContaining('3 pictures: 1. Batik fabric — “Our batik”; 2. Coffee beans; 3. shop.jpg') }),
        ])
    })

    it.each([
        [HERO.id, 'image', 'a single picture field'],
        [GALLERY_ID, 'headline', 'a text field'],
        [GALLERY_ID, 'video', 'a key the gallery does not have'],
    ])('refuses %s → %s (%s) with bad_picture_field', async (blockId, path) => {
        const result = await patch([{ op: 'set_pictures', blockId, path, items }])

        expect(result.error).toMatchObject({ code: 'bad_picture_field' })
    })

    it('refuses a media: ref outside the library (unknown_image) and a text edit of the same list in one change (bad_patch)', async () => {
        const media = await patch([{ op: 'set_pictures', blockId: GALLERY_ID, path: 'images', items: [{ image: { ref: 'media:5' } }] }])
        expect(media.error).toMatchObject({ code: 'unknown_image' }) // not in this workspace's library

        const clash = await patch([
            { op: 'set_fields', blockId: GALLERY_ID, fields: { headline: 'New' } },
            { op: 'set_pictures', blockId: GALLERY_ID, path: 'images', items },
            { op: 'set_pictures', blockId: GALLERY_ID, path: 'images', items },
        ])
        expect(clash.error).toMatchObject({ code: 'bad_patch' })
    })

    it('a text edit of the pictures is skipped with a note that says how pictures change', async () => {
        const result = await patch([{ op: 'set_fields', blockId: GALLERY_ID, fields: { headline: 'Gallery', images: [{ image: { url: 'https://x/y.jpg' } }] } }])

        expect(result.guardrails).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'skipped_value', detail: expect.stringContaining('pictures are changed with a picture edit') })]))
    })

    it('runPagePatch replaces the rows in order: a row keeps its id at the same position, captions are new or kept', () => {
        const { next, touched } = runPagePatch([NAV, GALLERY, FOOTER] as never, [
            { op: 'set_pictures', blockId: GALLERY_ID, path: 'images', items: [{ image: PICTURE, caption: 'New', mediaId: 31 }, { image: SECOND, mediaId: 32 }, { image: PICTURE, mediaId: 33 }] },
        ])

        expect(next.find((b) => b.id === GALLERY_ID)).toMatchObject({
            headline: 'Our shop',
            images: [
                { id: 'g1', image: 31, caption: 'New' },
                { id: 'g2', image: 32, caption: 'Old two' },
                { image: 33 },
            ],
        })
        expect(touched).toEqual(new Set([GALLERY_ID]))
        expect(GALLERY.images[0]).toEqual({ id: 'g1', image: 11, caption: 'Old one' })
    })

    it('apply copies every picture into the workspace first, then writes the list', async () => {
        await applySitePagePatch(planFor([{ op: 'set_pictures', blockId: GALLERY_ID, path: 'images', items }], { [GALLERY_ID]: blockHash(GALLERY) }), OWNER)

        expect(vi.mocked(ingestPicture).mock.calls.map((call) => call[1])).toEqual(items.map((item) => item.image))
        expect(state.events).toEqual(['ingest', 'ingest', 'ingest', 'write:pages'])
        const layout = state.writes.find((w) => w.collection === 'pages')!.arg.data.layout as Array<Record<string, unknown>>
        expect(layout.find((b) => b.id === GALLERY_ID)).toMatchObject({ images: [{ image: 77, caption: 'Our batik' }, { image: 77, caption: 'Old two' }, { image: 77, caption: 'The shop' }] })
    })
})
