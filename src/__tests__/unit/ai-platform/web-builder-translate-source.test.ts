/**
 * TC-AIREL-245..249 — the copilot translates a page FROM the written language, never from the stored section
 * when that holds another language or template filler, and never from the target language's own copy; a copy
 * that is template filler or the written text itself counts as missing; "translate again" repairs it.
 * Real: site-seo-translate.ts, site-translate-source.ts, site-locale-view.ts, template-content.ts,
 * appliers/site-edits.ts (translation write), site-blocks.ts, @ech/ai-contracts, the block registry.
 * Faked: Payload Local API (in memory), tenant row lock, the locale_content SQL (run against the in-memory row),
 * plan gate, the AI task client (the translator).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangeSetApplyError } from '@/lib/ai-platform/appliers/errors'
import { applySiteTranslatePage } from '@/lib/ai-platform/appliers/site-edits'
import { getAiTaskClient } from '@/lib/ai-platform/task-client'
import { blockHash } from '@/lib/ai-platform/site/site-blocks'
import { prepareTranslatePage } from '@/lib/ai-platform/site/site-seo-translate'
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


const MALAY_HERO = { ...HERO, headline: 'Kopi Kampung Kedai — Kopi O', subheadline: 'Kedai kopi kampung di Kuala Lumpur', ctaButtons: [{ label: 'Mulakan', url: '/contact', style: 'primary' }] }
/** The English filler the editor saved into the layout after a failed switch (the editor's template text, brand filled). */
const FILLER_HERO = { ...HERO, headline: 'Welcome to Kedai Batik', subheadline: 'We deliver exceptional products and services that help you achieve your goals. Discover what makes us different.', ctaButtons: [{ label: 'Get Started', url: '/contact', style: 'primary' }] }

const runTask = vi.fn()
const translateInput = (input: Record<string, unknown> = {}) => prepareTranslatePage(OWNER, { siteId: String(SITE_ID), pageId: String(PAGE_ID), why: 'English version', locale: 'en', ...input }) as Promise<Result>
const sentTexts = () => runTask.mock.calls.flatMap(([, input]) => Object.values((input as { fields: Record<string, string> }).fields))

beforeEach(() => {
    vi.clearAllMocks()
    // a Malay site (written language ms) whose English copy is wanted
    // English added as the second language (Menu → Quick language): a translation goes only into a language the site has
    state.site = site({ generationLocale: 'ms', headerBlock: { secondaryLocale: 'en' } })
    state.page = page([NAV, MALAY_HERO, FAQ, FOOTER])
    state.localeContent = {}
    state.writes = []
    state.events = []
    state.subscription = { plan: 'PROFESSIONAL' }
    runTask.mockReset().mockImplementation(async (_task: string, input: { fields: Record<string, string> }) => ({
        output: { fields: Object.fromEntries(Object.entries(input.fields).map(([key, value]) => [key, `EN ${value}`])) },
    }))
    vi.mocked(getAiTaskClient).mockReturnValue({ runTask } as never)
})

describe('prepareTranslatePage — made from the written language [TC-AIREL-245]', () => {
    it('stored section = filler, written copy (ms) = the Malay text: the translator gets the Malay text, the card\'s "before" is it', async () => {
        state.page = page([NAV, FILLER_HERO, FOOTER])
        state.localeContent = { [HERO.id]: { ms: MALAY_HERO as never, en: {} } }

        const result = await translateInput()

        expect(sentTexts()).toContain('Kopi Kampung Kedai — Kopi O')
        expect(sentTexts()).not.toContain('Welcome to Kedai Batik')
        expect(result.plan!.entries![HERO.id]).toMatchObject({ headline: 'EN Kopi Kampung Kedai — Kopi O' })
        expect(result.diffs).toContainEqual(expect.objectContaining({ field: 'English · headline', before: 'Kopi Kampung Kedai — Kopi O', after: 'EN Kopi Kampung Kedai — Kopi O' }))
        expect(result.plan!.written).toBe('ms')
    })

    it('never translates the target language\'s own copy: an existing English copy is not the source', async () => {
        state.localeContent = { [HERO.id]: { en: { headline: 'Welcome to Kedai Batik' } } }

        await translateInput({ onlyMissing: false })

        expect(sentTexts()).toContain('Kopi Kampung Kedai — Kopi O')
        expect(sentTexts()).not.toContain('Welcome to Kedai Batik')
    })

    it('no written copy: the stored section is the written text', async () => {
        await translateInput()

        expect(sentTexts()).toContain('Kopi Kampung Kedai — Kopi O')
    })
})

describe('prepareTranslatePage — onlyMissing counts filler as missing [TC-AIREL-246]', () => {
    const ENGLISH_DONE = { headline: 'Kopi Kampung Kedai — the village coffee', subheadline: 'A village coffee shop in Kuala Lumpur' }

    it('keeps a real translation out and takes an empty copy in', async () => {
        state.localeContent = { [HERO.id]: { en: ENGLISH_DONE } }

        const result = await translateInput()

        expect(Object.keys(result.plan!.entries!)).toEqual([FAQ.id])
    })

    it('a copy that is the editor\'s template text is missing, and so is one that repeats the written text', async () => {
        state.localeContent = {
            [HERO.id]: { en: { headline: 'Welcome to Kedai Batik', subheadline: FILLER_HERO.subheadline, ctaButtons: FILLER_HERO.ctaButtons } },
            [FAQ.id]: { en: { headline: FAQ.headline, items: FAQ.items } },
        }

        const result = await translateInput()

        expect(Object.keys(result.plan!.entries!).sort()).toEqual([FAQ.id, HERO.id].sort())
    })

    it('a template copy reworded by the model (one text changed) is still missing', async () => {
        state.localeContent = { [HERO.id]: { en: { headline: 'Welcome to Kedai Batik', subheadline: 'We deliver great products.' } } }

        expect(Object.keys((await translateInput()).plan!.entries!)).toContain(HERO.id)
    })
})

describe('translate again repairs a page the failed switch filled with filler [TC-AIREL-247]', () => {
    it('onlyMissing false: the English copy is rebuilt from the Malay text, over the filler copy and the filler section', async () => {
        state.page = page([NAV, FILLER_HERO, FOOTER])
        state.localeContent = {
            [HERO.id]: {
                ms: MALAY_HERO as never,
                en: { headline: 'Welcome to Kedai Batik', subheadline: FILLER_HERO.subheadline, ctaButtons: FILLER_HERO.ctaButtons },
            },
        }

        const result = await translateInput({ onlyMissing: false })
        await applySiteTranslatePage({ ...result.plan, siteId: String(SITE_ID), pageId: String(PAGE_ID) }, OWNER)

        const stored = state.localeContent as Record<string, Record<string, Record<string, unknown>>>
        expect(stored[HERO.id]!.en).toMatchObject({ headline: 'EN Kopi Kampung Kedai — Kopi O', subheadline: 'EN Kedai kopi kampung di Kuala Lumpur' })
        expect(JSON.stringify(stored[HERO.id]!.en)).not.toContain('Welcome to')
        // the Malay copy is untouched, and the stored layout is not written
        expect(stored[HERO.id]!.ms).toEqual(MALAY_HERO)
        expect(state.writes.filter((write) => write.collection === 'pages')).toEqual([])
    })

    it('the default (onlyMissing) repairs it too, because the filler copy counts as missing', async () => {
        state.localeContent = { [HERO.id]: { en: { headline: 'Welcome to Kedai Batik', subheadline: FILLER_HERO.subheadline } } }

        const result = await translateInput()

        expect(result.plan!.entries![HERO.id]).toMatchObject({ headline: 'EN Kopi Kampung Kedai — Kopi O' })
    })
})

describe('applySiteTranslatePage — guarded by the written text it was made from [TC-AIREL-248]', () => {
    it('refuses with 409 when the written copy changed after the card (the text it was made from moved)', async () => {
        state.page = page([NAV, FILLER_HERO, FOOTER])
        state.localeContent = { [HERO.id]: { ms: MALAY_HERO as never } }
        const result = await translateInput()
        state.localeContent = { [HERO.id]: { ms: { ...MALAY_HERO, headline: 'Kopi O Kampung' } as never } }

        await expect(applySiteTranslatePage({ ...result.plan, siteId: String(SITE_ID), pageId: String(PAGE_ID) }, OWNER)).rejects.toBeInstanceOf(ChangeSetApplyError)
        expect((state.localeContent as Record<string, Record<string, Record<string, unknown>>>)[HERO.id]!.en).toBeUndefined()
    })

    it('a plan from before (no `written`) still applies against the stored section', async () => {
        const result = await translateInput()
        const { written: _written, ...legacy } = result.plan!

        await applySiteTranslatePage({ ...legacy, siteId: String(SITE_ID), pageId: String(PAGE_ID) }, OWNER)

        const stored = state.localeContent as Record<string, Record<string, Record<string, unknown>>>
        expect(stored[HERO.id]!.en).toMatchObject({ headline: 'EN Kopi Kampung Kedai — Kopi O' })
    })
})
