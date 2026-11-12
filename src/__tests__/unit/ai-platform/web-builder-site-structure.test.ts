/**
 * TC-AICP-293 (plan in jsonb key order) / TC-AIWB-32 / 33 — site-level copilot changes: one edit across several pages (all or nothing, undo of every
 * page) and a new page (address rules, page cap, sections, optional menu link; apply re-checks under the lock;
 * undo removes it again).
 * Real: site-structure.ts and appliers/site-structure.ts, site-patch.ts, site-prepare.ts (checkPagePatchOps,
 * draftPageEdit), site-nav.ts (currentFrame, frameFingerprint, appendMenuLink), site-blocks.ts,
 * new-page-layout.ts (homepageFrame), normalizeBlocksForPersistence, the block registry, the site access check.
 * Faked: Payload Local API (in memory: pages, the site row, the homepage and address lookups), the tenant row
 * lock (runs the callback; the raw SQL is recorded and rendered by drizzle), the plan gate, media cleanup and
 * picture ingest, the publish service and rate limiter (imported by the applier, not used by these tools),
 * the Next.js cache tag call.
 *
 * Sections drafted by prepare carry what the registry filled in (isVisible…); apply drops those quietly and
 * fills them in again, so an approved insert or new page goes through (fixed after these tests found it).
 */

import { revalidateTag } from 'next/cache'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ingestPicture } from '@/lib/ai-platform/appliers/picture-ingest'
import { ChangeSetApplyError } from '@/lib/ai-platform/appliers/errors'
import { applySitePageCreate, applySitePageRemove, applySitePagesPatch, applySitePagesRestore } from '@/lib/ai-platform/appliers/site-structure'
import { blockHash } from '@/lib/ai-platform/site/site-blocks'
import { currentFrame, frameFingerprint } from '@/lib/ai-platform/site/site-nav'
import { menuLinks, normalizeSlug, preparePageCreate, prepareSitePatch, reservedSlug, sectionOps } from '@/lib/ai-platform/site/site-structure'
import { FAQ, FOOTER, HERO, LAYOUT, NAV, OWNER, PAGE_ID, SITE_ID, jsonbOrder, page, site } from './web-builder-fixtures'

const NEW_PAGE_ID = 50
const PICTURE = { ref: 'pixabay:1234', url: 'https://cdn.pixabay.com/photo/1234.jpg', name: 'Batik fabric' }
const NEW_SECTION = { blockType: 'faq', id: '00000000-0000-4000-8000-0000000000f2', variant: 'accordion', headline: 'First', items: [{ question: 'Ship to Sabah?', answer: 'Yes' }] }

const state = vi.hoisted(() => ({
    site: null as Record<string, unknown> | null,
    pages: new Map<string, Record<string, unknown>>(),
    writes: [] as Array<{ collection: string; data: Record<string, unknown> }>,
    created: [] as Array<Record<string, unknown>>,
    sql: [] as Array<{ text: string; params: unknown[] }>,
    onLock: null as null | (() => void),
    subscription: { plan: 'PROFESSIONAL' } as null | { plan: string },
    newPageId: 50,
    baseStatus: 'draft' as string,
    failCreate: null as null | string,
}))

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

vi.mock('payload', () => {
    const siteId = () => String((state.site as { id?: unknown }).id)
    const livePages = () => [...state.pages.values()].filter((p) => !p.deletedAt && String(p.site) === siteId())
    const cms = {
        findByID: vi.fn(async ({ collection, id }: { collection: string; id: string | number }) => (collection === 'sites' ? state.site : (state.pages.get(String(id)) ?? null))),
        find: vi.fn(async ({ collection, where }: { collection: string; where: Record<string, unknown> }) => {
            if (collection !== 'pages') return { docs: [] }
            // homepageFrame asks for the homepage; the address check asks for live pages with that slug
            if ('isHomepage' in where) return { docs: livePages().filter((p) => p.isHomepage === true) }
            const clause = (where.and as Array<{ slug?: { equals: string } }> | undefined)?.find((c) => c.slug)
            return { docs: livePages().filter((p) => !clause || p.slug === clause.slug?.equals) }
        }),
        count: vi.fn(async () => ({ totalDocs: livePages().length })),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
            if (state.failCreate) throw new Error(state.failCreate)
            const doc = { ...data, id: state.newPageId }
            state.pages.set(String(state.newPageId), doc)
            state.created.push(data)
            return doc
        }),
        update: vi.fn(async ({ collection, id, data }: { collection: string; id: string | number; data: Record<string, unknown> }) => {
            state.writes.push({ collection, data })
            if (collection === 'pages') state.pages.set(String(id), { ...state.pages.get(String(id)), ...data })
            if (collection === 'sites') state.site = { ...state.site, ...data }
            return {}
        }),
    }
    return { getPayload: vi.fn(async () => cms) }
})

vi.mock('@/lib/payload/tenant-row-lock', () => ({
    withTenantRowLock: vi.fn(async (_cms: unknown, _tenant: unknown, operation: (req: { transactionID: string }) => Promise<unknown>) => {
        // a page changed by someone else after the copilot checked it and before the lock is taken
        state.onLock?.()
        return operation({ transactionID: 'tx' })
    }),
    lockTenantSiteRows: vi.fn(async () => undefined),
    executeTenantTransaction: vi.fn(async (_cms: unknown, _req: unknown, query: unknown) => {
        const { PgDialect } = await import('drizzle-orm/pg-core')
        const rendered = new PgDialect().sqlToQuery(query as Parameters<PgDialect['sqlToQuery']>[0])
        state.sql.push({ text: rendered.sql, params: rendered.params })
        // the base row's status (SELECT _status), answered from the fake
        if (/^\s*select/i.test(rendered.sql)) return { rows: [{ status: state.baseStatus }] }
        // the soft delete of a page: the base row carries deleted_at, the fake keeps the same meaning
        const target = state.pages.get(String(rendered.params[0]))
        if (/deleted_at/.test(rendered.sql) && target) target.deletedAt = new Date().toISOString()
        return { rows: [] }
    }),
}))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(async () => state.subscription),
    canUse: vi.fn(async () => true),
}))
vi.mock('@/lib/ai/media-injector', () => ({ stripOrphanMediaRefs: vi.fn(async () => undefined) }))
vi.mock('@/lib/ai-platform/appliers/picture-ingest', () => ({ ingestPicture: vi.fn() }))
vi.mock('@/lib/sites/publish-site', () => ({ publishSite: vi.fn() }))
vi.mock('@/lib/rateLimit', () => ({ checkTwoTierRateLimit: vi.fn(async () => ({ allowed: true })) }))

type Refusal = { code: string; message: string }
type Prepared = {
    error?: Refusal
    kind?: string
    risk?: string
    confirmText?: string
    diffs?: Array<{ entity: { kind: string; id: string }; field: string; before: string | null; after: string }>
    guardrails?: Array<{ rule: string; ok: boolean; detail: string }>
    plan?: Record<string, unknown>
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ingestPicture).mockResolvedValue({ id: 77, url: '/media/77.jpg' } as never)
    state.site = site({ headerBlock: { ...NAV, links: [{ label: 'Home', url: '/' }, { label: 'Shop', url: '/shop' }] } })
    state.pages = new Map([[String(PAGE_ID), page(structuredClone(LAYOUT))]])
    state.writes = []
    state.created = []
    state.sql = []
    state.onLock = null
    state.subscription = { plan: 'PROFESSIONAL' }
    state.newPageId = NEW_PAGE_ID
    state.baseStatus = 'draft'
    state.failCreate = null
})

const heroOp = (headline: string) => ({ op: 'set_fields', blockId: HERO.id, fields: { headline } })
const faqOp = (headline: string) => ({ op: 'set_fields', blockId: FAQ.id, fields: { headline } })
const faqBlock = (headline: string) => ({ blockType: 'faq', headline, items: [{ question: 'Ship to Sabah?', answer: 'Yes' }] })
const aboutPage = (overrides: Record<string, unknown> = {}) => page([NAV, FAQ, FOOTER], { id: 11, title: 'About', slug: '/about', isHomepage: false, ...overrides })
const extraPage = (id: number) => page(structuredClone(LAYOUT), { id, title: `Page ${id}`, slug: `/p${id}`, isHomepage: false })
const seedHomeAndAbout = () => {
    state.pages.set('11', aboutPage())
}
const seedPages = (count: number) => {
    state.pages = new Map(Array.from({ length: count }, (_, i) => [String(10 + i), extraPage(10 + i)]))
}
const layoutOf = (pageId: string) => state.pages.get(pageId)!.layout as Array<Record<string, unknown>>
const blockIn = (pageId: string, blockId: string) => layoutOf(pageId).find((b) => b.id === blockId)
const editBlock = (pageId: string, blockId: string, fields: Record<string, unknown>) => {
    state.pages.get(pageId)!.layout = layoutOf(pageId).map((b) => (b.id === blockId ? { ...b, ...fields } : b))
}
const pageWrites = () => state.writes.filter((w) => w.collection === 'pages')
const siteWrites = () => state.writes.filter((w) => w.collection === 'sites')
const deletes = () => state.sql.filter((s) => /deleted_at/.test(s.text))
const sitePatch = (pages: unknown[]) => prepareSitePatch(OWNER, { siteId: String(SITE_ID), why: 'Tidy the copy', pages }) as Promise<Prepared>
const createPage = (input: Record<string, unknown> = {}) =>
    preparePageCreate(OWNER, { siteId: String(SITE_ID), why: 'New page for the summer', title: 'Promo', slug: '/promo', sections: [faqBlock('First')], menuLabel: null, ...input }) as Promise<Prepared>
const planOf = (prepared: Prepared) => prepared.plan as Record<string, unknown>

// ─── TC-AIWB-32 ────────────────────────────────────────────────────────────

describe('site.pages_patch — prepare: refusals and the card [TC-AIWB-32]', () => {
    it('refuses a page named twice, before any page is read (bad_patch)', async () => {
        const result = await sitePatch([
            { pageId: '10', ops: [heroOp('A')] },
            { pageId: '10', ops: [heroOp('B')] },
        ])

        expect(result.error).toEqual({ code: 'bad_patch', message: 'Name each page once, with all of its ops.' })
    })

    it('prefixes a page refusal with that page title and names no other page', async () => {
        seedHomeAndAbout()

        const result = await sitePatch([
            { pageId: '10', ops: [heroOp('Fresh')] },
            { pageId: '11', ops: [{ op: 'set_fields', blockId: 'ghost', fields: { headline: 'x' } }] },
        ])

        expect(result.error?.code).toBe('unknown_section')
        expect(result.error?.message).toMatch(/^Page "About": No section ghost on this page/)
    })

    it('refuses more than 200 changes in one go (too_large), counting the changes of every page', async () => {
        seedPages(7)
        // 7 pages x 30 inserts at the top of each page = 210 changes
        const inserts = Array.from({ length: 30 }, (_, n) => ({ op: 'insert_block', afterBlockId: null, block: faqBlock(`Q${n}`) }))

        const result = await sitePatch(Array.from({ length: 7 }, (_, i) => ({ pageId: String(10 + i), ops: inserts })))

        expect(result.error).toMatchObject({ code: 'too_large', message: 'That is more than 200 changes in one go — split it into fewer pages.' })
    })

    it.each([[2], [3]])('drafts %i pages as a medium-risk change, with no typed confirmation', async (count) => {
        seedPages(count)

        const result = await sitePatch(Array.from({ length: count }, (_, i) => ({ pageId: String(10 + i), ops: [heroOp(`Fresh ${i}`)] })))

        expect(result).toMatchObject({ kind: 'site.pages_patch', risk: 'medium' })
        expect(result.confirmText).toBeUndefined()
    })

    it('asks for the site name typed when more than three pages change (high risk)', async () => {
        seedPages(4)

        const result = await sitePatch(Array.from({ length: 4 }, (_, i) => ({ pageId: String(10 + i), ops: [heroOp(`Fresh ${i}`)] })))

        expect(result).toMatchObject({ kind: 'site.pages_patch', risk: 'high', confirmText: 'Kedai Batik' })
        expect(result.guardrails).toContainEqual(expect.objectContaining({ rule: 'all_or_nothing', ok: true }))
    })

    it('returns one plan entry per page with its ops and the fingerprints of the sections it touches', async () => {
        seedHomeAndAbout()

        const result = await sitePatch([
            { pageId: '10', ops: [heroOp('Fresh')] },
            { pageId: '11', ops: [faqOp('Shipping')] },
        ])

        expect(planOf(result)).toEqual({
            siteId: String(SITE_ID),
            pages: [
                { pageId: '10', ops: [{ op: 'set_fields', blockId: HERO.id, fields: { headline: 'Fresh' } }], expect: { [HERO.id]: blockHash(HERO) } },
                { pageId: '11', ops: [{ op: 'set_fields', blockId: FAQ.id, fields: { headline: 'Shipping' } }], expect: { [FAQ.id]: blockHash(FAQ) } },
            ],
        })
    })

    it('shows a line per drafted change and writes nothing while drafting', async () => {
        seedHomeAndAbout()
        const before = JSON.stringify([...state.pages.values()])

        const result = await sitePatch([
            { pageId: '10', ops: [heroOp('Fresh')] },
            { pageId: '11', ops: [faqOp('Shipping')] },
        ])

        expect(result.diffs).toEqual([
            expect.objectContaining({ field: 'Headline', after: 'Fresh' }),
            expect.objectContaining({ field: 'Headline', after: 'Shipping' }),
        ])
        expect(state.writes).toEqual([])
        expect(JSON.stringify([...state.pages.values()])).toBe(before)
    })
})

describe('site.pages_patch — apply: all or nothing, checked under the lock [TC-AIWB-32]', () => {
    it('writes every page in one go and returns one undo that covers all of them', async () => {
        seedHomeAndAbout()
        const prepared = await sitePatch([
            { pageId: '10', ops: [heroOp('Fresh')] },
            { pageId: '11', ops: [faqOp('Shipping')] },
        ])

        const result = await applySitePagesPatch(planOf(prepared), OWNER)

        expect(blockIn('10', HERO.id)).toMatchObject({ headline: 'Fresh' })
        expect(blockIn('11', FAQ.id)).toMatchObject({ headline: 'Shipping' })
        expect(result.entities).toEqual([
            { kind: 'site_page', id: '10' },
            { kind: 'site_page', id: '11' },
        ])
        expect(result.undo).toMatchObject({ kind: 'site.pages_restore', payload: { siteId: String(SITE_ID) } })
        expect((result.undo!.payload as { pages: unknown[] }).pages).toHaveLength(2)
    })

    it('applies a section inserted by a multi-page change once approved', async () => {
        seedHomeAndAbout()
        const prepared = await sitePatch([
            { pageId: '10', ops: [{ op: 'insert_block', afterBlockId: HERO.id, block: faqBlock('New section') }] },
            { pageId: '11', ops: [faqOp('Shipping')] },
        ])

        await applySitePagesPatch(planOf(prepared), OWNER)

        expect(layoutOf('10').map((b) => b.headline)).toContain('New section')
    })

    it('refuses with 409 and copies no picture when one page is stale: every page is checked before any ingest', async () => {
        seedHomeAndAbout()
        const plan = {
            siteId: String(SITE_ID),
            pages: [
                { pageId: '10', ops: [{ op: 'set_image', blockId: HERO.id, path: 'image', image: PICTURE }], expect: { [HERO.id]: blockHash(HERO) } },
                { pageId: '11', ops: [faqOp('Shipping')], expect: { [FAQ.id]: blockHash(FAQ) } },
            ],
        }
        editBlock('11', FAQ.id, { headline: 'Edited by the merchant' })

        await expect(applySitePagesPatch(plan, OWNER)).rejects.toMatchObject({ status: 409, final: true })
        expect(ingestPicture).not.toHaveBeenCalled()
        expect(pageWrites()).toEqual([])
    })

    it('refuses (409, final) a page that is missing, before any picture is copied', async () => {
        seedHomeAndAbout()
        const plan = {
            siteId: String(SITE_ID),
            pages: [
                { pageId: '10', ops: [{ op: 'set_image', blockId: HERO.id, path: 'image', image: PICTURE }], expect: { [HERO.id]: blockHash(HERO) } },
                { pageId: '99', ops: [faqOp('Shipping')], expect: { [FAQ.id]: blockHash(FAQ) } },
            ],
        }

        await expect(applySitePagesPatch(plan, OWNER)).rejects.toMatchObject({ status: 409, final: true, message: 'One of these pages no longer exists.' })
        expect(ingestPicture).not.toHaveBeenCalled()
        expect(pageWrites()).toEqual([])
    })

    it('refuses (409, final) a page that belongs to another site, before any picture is copied', async () => {
        seedHomeAndAbout()
        state.pages.set('11', aboutPage({ site: 99 }))
        const plan = {
            siteId: String(SITE_ID),
            pages: [
                { pageId: '10', ops: [{ op: 'set_image', blockId: HERO.id, path: 'image', image: PICTURE }], expect: { [HERO.id]: blockHash(HERO) } },
                { pageId: '11', ops: [faqOp('Shipping')], expect: { [FAQ.id]: blockHash(FAQ) } },
            ],
        }

        await expect(applySitePagesPatch(plan, OWNER)).rejects.toMatchObject({ status: 409, final: true })
        expect(ingestPicture).not.toHaveBeenCalled()
        expect(pageWrites()).toEqual([])
    })

    it('writes nothing when a page goes stale between the check and the lock (the check runs again under the lock)', async () => {
        seedHomeAndAbout()
        const prepared = await sitePatch([
            { pageId: '10', ops: [heroOp('Fresh')] },
            { pageId: '11', ops: [faqOp('Shipping')] },
        ])
        state.onLock = () => editBlock('11', FAQ.id, { headline: 'Changed while the lock was taken' })

        await expect(applySitePagesPatch(planOf(prepared), OWNER)).rejects.toMatchObject({ status: 409, final: true })
        expect(pageWrites()).toEqual([])
        expect(blockIn('10', HERO.id)).toMatchObject({ headline: HERO.headline })
    })

    it('re-checks the ops of each page: a page whose change no longer passes the checks is refused (422) and nothing is written', async () => {
        seedHomeAndAbout()
        const plan = {
            siteId: String(SITE_ID),
            pages: [
                { pageId: '10', ops: [heroOp('Fresh')], expect: { [HERO.id]: blockHash(HERO) } },
                { pageId: '11', ops: [{ op: 'set_fields', blockId: FAQ.id, fields: { headline: 'Shipping', notAField: 'x' } }], expect: { [FAQ.id]: blockHash(FAQ) } },
            ],
        }

        await expect(applySitePagesPatch(plan, OWNER)).rejects.toMatchObject({ status: 422, final: true, message: expect.stringContaining('no longer passes') })
        expect(pageWrites()).toEqual([])
    })

    it('undo restores every page to the draft it had before the change', async () => {
        seedHomeAndAbout()
        const applied = await applySitePagesPatch(planOf(await sitePatch([
            { pageId: '10', ops: [heroOp('Fresh')] },
            { pageId: '11', ops: [faqOp('Shipping')] },
        ])), OWNER)

        await applySitePagesRestore(applied.undo!.payload, OWNER)

        expect(blockIn('10', HERO.id)).toMatchObject({ headline: HERO.headline })
        expect(blockIn('11', FAQ.id)).toMatchObject({ headline: FAQ.headline })
    })

    it('undo refuses (409) when one page was edited since, and restores neither page', async () => {
        seedHomeAndAbout()
        const applied = await applySitePagesPatch(planOf(await sitePatch([
            { pageId: '10', ops: [heroOp('Fresh')] },
            { pageId: '11', ops: [faqOp('Shipping')] },
        ])), OWNER)
        editBlock('11', FAQ.id, { headline: 'Edited since' })
        state.writes = []

        await expect(applySitePagesRestore(applied.undo!.payload, OWNER)).rejects.toMatchObject({ status: 409 })
        expect(pageWrites()).toEqual([])
        expect(blockIn('10', HERO.id)).toMatchObject({ headline: 'Fresh' })
    })
})

// ─── TC-AIWB-33 ────────────────────────────────────────────────────────────

describe('normalizeSlug and reservedSlug — the address rules [TC-AIWB-33]', () => {
    it.each([
        ['About us', '/about-us'],
        ['  about-us/ ', '/about-us'],
        ['/promo/11-11', '/promo/11-11'],
        ['Promo/Sale Day', '/promo/sale-day'],
        ['a/b/c', '/a/b/c'],
    ])('turns %j into the page address %s', (raw, slug) => {
        expect(normalizeSlug(raw)).toBe(slug)
    })

    it.each(['a/b/c/d', 'about_us', 'tom&jerry', '', '/', 'about--us'])('refuses %j, which can not be a page address', (raw) => {
        expect(normalizeSlug(raw)).toBeNull()
    })

    // only addresses the storefront serves itself (app/sites/[slug]/*); /products, /shop, /blog are ordinary pages
    it.each(['/404', '/blog/spring', '/products/x', '/checkout', '/order-status', '/order-status/1'])('keeps %s for the shop itself (reserved)', (slug) => {
        expect(reservedSlug(slug)).toBe(true)
    })

    it.each(['/about', '/products', '/shop', '/blog', '/shopping', '/blogger', '/promo/blog'])('leaves %s free for a merchant page', (slug) => {
        expect(reservedSlug(slug)).toBe(false)
    })
})

describe('sectionOps and menuLinks — helpers the checks and the apply share [TC-AIWB-33]', () => {
    it('turns the sections into inserts at the top, in reverse, so the page reads in the given order', () => {
        const ops = sectionOps([{ blockType: 'faq', id: 'a' }, { blockType: 'faq', id: 'b' }])

        expect(ops).toEqual([
            { op: 'insert_block', afterBlockId: null, block: { blockType: 'faq', id: 'b' } },
            { op: 'insert_block', afterBlockId: null, block: { blockType: 'faq', id: 'a' } },
        ])
    })

    it('keeps the labels, addresses and sub-links of the menu in the strict shape, and [] without a menu', () => {
        const links = menuLinks({
            links: [
                { label: 'Shop', url: '/shop', style: 'primary', children: [{ label: 'Rings', url: '/shop/rings', extra: 1 }] },
                { label: 'About', url: '/about', children: [] },
            ],
        })

        expect(links).toEqual([
            { label: 'Shop', url: '/shop', children: [{ label: 'Rings', url: '/shop/rings' }] },
            { label: 'About', url: '/about' },
        ])
        expect(menuLinks(null)).toEqual([])
    })
})

describe('preparePageCreate — refusals and the draft card [TC-AIWB-33]', () => {
    it.each(['404', 'blog/spring', 'products/x', 'checkout'])('refuses the reserved address %s (reserved_slug)', async (slug) => {
        const result = await createPage({ slug })

        expect(result.error?.code).toBe('reserved_slug')
    })

    it('refuses an address that is not a page path (bad_slug)', async () => {
        const result = await createPage({ slug: 'about_us' })

        expect(result.error?.code).toBe('bad_slug')
    })

    it('refuses the home address "/" with a refusal, never a page (observed code: bad_slug, not reserved_slug)', async () => {
        // normalizeSlug("/") is null, so the reserved check is never reached; the page is still refused
        const result = await createPage({ slug: '/' })

        expect(result.error).toBeDefined()
        expect(result.error?.code).toBe('bad_slug')
        expect(result.plan).toBeUndefined()
    })

    it('refuses an address a live page already has (slug_taken)', async () => {
        state.pages.set('11', aboutPage())

        const result = await createPage({ slug: 'About' })

        expect(result.error?.code).toBe('slug_taken')
    })

    it('allows an address that only a soft-deleted page had', async () => {
        state.pages.set('11', aboutPage({ deletedAt: '2026-10-01T00:00:00.000Z' }))

        const result = await createPage({ slug: '/about' })

        expect(result.error).toBeUndefined()
        expect(result.kind).toBe('site.page_create')
    })

    it.each([
        [99, undefined],
        [100, 'too_many_pages'],
    ])('with %i live pages the answer is %s (the site caps at 100 pages)', async (total, code) => {
        state.pages = new Map(Array.from({ length: total }, (_, i) => [String(PAGE_ID + i), i === 0 ? page(structuredClone(LAYOUT)) : extraPage(PAGE_ID + i)]))

        const result = await createPage({ slug: '/brand-new' })

        expect(result.error?.code).toBe(code)
    })

    it('refuses the menu and footer as new sections (structural)', async () => {
        expect((await createPage({ sections: [{ blockType: 'footer', copyrightText: '© Kedai Batik' }] })).error?.code).toBe('structural')
        expect((await createPage({ sections: [{ blockType: 'navigation', logoText: 'Second' }] })).error?.code).toBe('structural')
    })

    it('checks the sections like inserted sections: an incomplete hero is refused (invalid_section)', async () => {
        const result = await createPage({ sections: [{ blockType: 'hero', subheadline: 'No headline yet' }] })

        expect(result.error?.code).toBe('invalid_section')
    })

    it('refuses a section type that is not offered (unknown_block_type)', async () => {
        const result = await createPage({ sections: [{ blockType: 'nonexistent', headline: 'x' }] })

        expect(result.error?.code).toBe('unknown_block_type')
    })

    it('drafts one page line, one line per section in order, and a menu line with the new link at the end', async () => {
        const result = await createPage({ sections: [faqBlock('First'), faqBlock('Second')], menuLabel: 'Promo' })

        expect(result).toMatchObject({ kind: 'site.page_create', risk: 'medium' })
        expect(result.diffs?.map((d) => d.field)).toEqual(['page', 'section 1', 'section 2', 'menu links'])
        expect(result.diffs?.[0]).toMatchObject({ after: '"Promo" at /promo (draft)' })
        expect(result.diffs?.[3]).toMatchObject({ before: 'Home · Shop', after: 'Home · Shop · Promo' })
    })

    it('does not let an odd link already in the menu block the new page (only the new link is checked)', async () => {
        state.site = { ...state.site, headerBlock: { ...NAV, links: [{ label: 'x'.repeat(70), url: '/old' }] } }

        const result = await createPage({ menuLabel: 'Promo' })

        expect(result.error).toBeUndefined()
        expect(result.diffs?.find((d) => d.field === 'menu links')).toMatchObject({ after: `${'x'.repeat(70)} · Promo` })
    })

    it('keeps the draft, frame and undo guardrails on the card', async () => {
        const result = await createPage()

        expect(result.guardrails).toEqual(expect.arrayContaining([
            expect.objectContaining({ rule: 'draft_page', ok: true }),
            expect.objectContaining({ rule: 'frame', ok: true }),
            expect.objectContaining({ rule: 'undo', ok: true }),
        ]))
    })

    it('plans the sections in apply order, the menu label, and the fingerprint of the frame it was drafted on', async () => {
        const result = await createPage({ sections: [faqBlock('First'), faqBlock('Second')], menuLabel: 'Promo' })

        const plan = planOf(result)
        expect(plan).toMatchObject({ siteId: String(SITE_ID), title: 'Promo', slug: '/promo', menuLabel: 'Promo' })
        expect((plan.sections as Array<{ block: { headline: string } }>).map((op) => op.block.headline)).toEqual(['Second', 'First'])
        expect(plan.base).toEqual(frameFingerprint(currentFrame(state.site as never)))
    })

    it('writes nothing while drafting', async () => {
        await createPage({ menuLabel: 'Promo' })

        expect(state.created).toEqual([])
        expect(state.writes).toEqual([])
    })
})

describe('applySitePageCreate — the draft page between the homepage menu and footer [TC-AIWB-33]', () => {
    it('creates the page as a draft between the homepage menu and footer once approved', async () => {
        const plan = planOf(await createPage({ sections: [faqBlock('First'), faqBlock('Second')] }))

        await applySitePageCreate(plan, OWNER)

        const layout = (state.created[0]!.layout ?? []) as Array<Record<string, unknown>>
        expect(state.created[0]).toMatchObject({ title: 'Promo', slug: '/promo', site: SITE_ID, isVisible: true, _status: 'draft' })
        expect(layout.map((b) => b.blockType)).toEqual(['navigation', 'faq', 'faq', 'footer'])
        expect(layout.slice(1, -1).map((b) => b.headline)).toEqual(['First', 'Second'])
    })

    it('creates the page from a plan returned in jsonb key order, with an announcement banner section [TC-AICP-293]', async () => {
        const banner = { blockType: 'announcement-bar', variant: 'gradient', message: 'Weekend promo: 10% off with code WEEKEND10.', linkText: 'Shop', linkUrl: '/shop', dismissible: true, showLink: true, linkIsInternal: true }
        const stored = jsonbOrder(JSON.parse(JSON.stringify(planOf(await createPage({ sections: [banner, faqBlock('First')] })))))
        expect(Object.keys((stored.sections as Array<object>)[0]!)).toEqual(['op', 'block', 'afterBlockId'])

        await applySitePageCreate(stored, OWNER)

        const layout = (state.created[0]!.layout ?? []) as Array<Record<string, unknown>>
        expect(layout.map((b) => b.blockType)).toEqual(['navigation', 'announcement-bar', 'faq', 'footer'])
    })

    it('re-checks the address under the lock: an address taken since the draft is refused (409, final)', async () => {
        const plan = planOf(await createPage())
        state.pages.set('11', aboutPage({ slug: '/promo' }))

        await expect(applySitePageCreate(plan, OWNER)).rejects.toMatchObject({ status: 409, final: true })
        expect(state.created).toEqual([])
    })

    it('re-checks the sections under the lock: a section that no longer passes is refused (422, final)', async () => {
        const plan = planOf(await createPage())
        const tampered = { ...plan, sections: [{ op: 'insert_block', afterBlockId: null, block: { blockType: 'hero', id: '00000000-0000-4000-8000-0000000000f9', subheadline: 'No headline' } }] }

        await expect(applySitePageCreate(tampered, OWNER)).rejects.toMatchObject({ status: 422, final: true, message: expect.stringContaining('no longer passes') })
        expect(state.created).toEqual([])
    })

    it('refuses a title that is empty once cleaned (422, final), before anything is locked or written', async () => {
        const plan = { ...planOf(await createPage()), title: '   ' }

        await expect(applySitePageCreate(plan, OWNER)).rejects.toMatchObject({ status: 422, final: true, message: 'The page needs a title. Ask again.' })
        expect(state.created).toEqual([])
    })

    it('a duplicate address raised by the database is refused as 409 (final)', async () => {
        const plan = planOf(await createPage())
        state.failCreate = 'duplicate key value violates unique constraint "pages_site_slug_idx"'

        await expect(applySitePageCreate(plan, OWNER)).rejects.toMatchObject({ status: 409, final: true })
    })

    it('writes the menu link at the end of the menu draft and returns the undo that removes the page', async () => {
        // unreachable until the isVisible round trip is fixed: the section check runs before the menu write
        const plan = planOf(await createPage({ menuLabel: 'Promo' }))

        const result = await applySitePageCreate(plan, OWNER)

        expect((state.site as { pendingHeaderBlock: { links: unknown[] } }).pendingHeaderBlock.links).toEqual([
            { label: 'Home', url: '/' },
            { label: 'Shop', url: '/shop' },
            { label: 'Promo', url: '/promo' },
        ])
        expect(result.undo).toMatchObject({ kind: 'site.page_remove', payload: { siteId: String(SITE_ID), pageId: String(NEW_PAGE_ID), menu: { previous: null } } })
    })

    it('refuses with 409 when the menu was changed since the draft, and writes no menu', async () => {
        // the menu guard (appliers/site-structure.ts:206) is unreachable until the isVisible round trip is fixed:
        // the section check (line 183) refuses first with 422
        const plan = planOf(await createPage({ menuLabel: 'Promo' }))
        state.site = { ...state.site, pendingHeaderBlock: { ...NAV, links: [{ label: 'Other', url: '/other' }] } }

        // the page row is rolled back with the rest of the transaction (withTenantRowLock is a drizzle transaction);
        // the mocked lock does not roll back, so this asserts the refusal and the untouched menu draft
        await expect(applySitePageCreate(plan, OWNER)).rejects.toMatchObject({ status: 409, final: true })
        expect(siteWrites()).toEqual([])
    })
})

describe('applySitePageRemove — undo of a new page and its menu link [TC-AIWB-33]', () => {
    // The undo record the create apply returns is built here from the fingerprints it writes (the page layout as
    // created, the menu draft after the change), so the undo contract is tested without the create round trip.
    const MENU_AFTER = { ...NAV, links: [{ label: 'Home', url: '/' }, { label: 'Shop', url: '/shop' }, { label: 'Promo', url: '/promo' }] }
    const NEW_LAYOUT = [NAV, NEW_SECTION, FOOTER]
    const seedNewPage = (pendingHeaderBlock: unknown, overrides: Record<string, unknown> = {}) => {
        state.pages.set(String(NEW_PAGE_ID), page(structuredClone(NEW_LAYOUT), { id: NEW_PAGE_ID, title: 'Promo', slug: '/promo', isHomepage: false, ...overrides }))
        state.site = { ...state.site, pendingHeaderBlock }
    }
    const undoRecord = (previous: unknown) => ({
        siteId: String(SITE_ID),
        pageId: String(NEW_PAGE_ID),
        layout: blockHash(NEW_LAYOUT),
        menu: { previous, after: blockHash(MENU_AFTER) },
    })

    it('soft-deletes the page and puts the menu back as it was (no draft before: null)', async () => {
        seedNewPage(MENU_AFTER)

        await applySitePageRemove(undoRecord(null), OWNER)

        expect(deletes()).toEqual([expect.objectContaining({ text: expect.stringContaining('deleted_at'), params: [NEW_PAGE_ID, SITE_ID] })])
        expect(state.pages.get(String(NEW_PAGE_ID))!.deletedAt).toBeTruthy()
        expect((state.site as { pendingHeaderBlock: unknown }).pendingHeaderBlock).toBeNull()
    })

    it('puts back the menu draft that was there before the change', async () => {
        const before = { ...NAV, links: [{ label: 'Home', url: '/' }] }
        seedNewPage(MENU_AFTER)

        await applySitePageRemove(undoRecord(before), OWNER)

        expect((state.site as { pendingHeaderBlock: unknown }).pendingHeaderBlock).toEqual(before)
    })

    it('invalidates the site cache tag after the delete', async () => {
        seedNewPage(MENU_AFTER)

        await applySitePageRemove(undoRecord(null), OWNER)

        expect(revalidateTag).toHaveBeenCalledWith(`site-${SITE_ID}`, { expire: 0 })
    })

    it('refuses a page that went live (base row published): 409, deletes nothing', async () => {
        seedNewPage(MENU_AFTER)
        state.baseStatus = 'published'

        await expect(applySitePageRemove(undoRecord(null), OWNER)).rejects.toMatchObject({ status: 409 })
        expect(deletes()).toEqual([])
    })

    it('refuses the homepage: 409, deletes nothing', async () => {
        seedNewPage(MENU_AFTER, { isHomepage: true })

        await expect(applySitePageRemove(undoRecord(null), OWNER)).rejects.toMatchObject({ status: 409 })
        expect(deletes()).toEqual([])
    })

    it('refuses once the page was edited since it was made (409), and deletes nothing', async () => {
        seedNewPage(MENU_AFTER)
        const undo = undoRecord(null)
        state.pages.get(String(NEW_PAGE_ID))!.layout = NEW_LAYOUT.map((b) => (b.blockType === 'faq' ? { ...b, headline: 'Edited' } : b))

        await expect(applySitePageRemove(undo, OWNER)).rejects.toMatchObject({ status: 409 })
        expect(deletes()).toEqual([])
    })

    it('refuses once the menu was edited since (409), and deletes nothing', async () => {
        seedNewPage({ ...NAV, links: [{ label: 'Only', url: '/only' }] })

        await expect(applySitePageRemove(undoRecord(null), OWNER)).rejects.toMatchObject({ status: 409 })
        expect(deletes()).toEqual([])
    })

    it('refuses an undo whose stored previous menu is not a navigation block (422)', async () => {
        seedNewPage(MENU_AFTER)

        await expect(applySitePageRemove(undoRecord({ blockType: 'footer' }), OWNER)).rejects.toMatchObject({ status: 422, message: 'This undo is not valid.' })
        expect(deletes()).toEqual([])
    })

    it('refuses (422) an undo that would bring back a menu holding an unsafe link, and deletes nothing', async () => {
        seedNewPage(MENU_AFTER)
        const unsafePrevious = { ...NAV, links: [{ label: 'Pay', url: 'javascript:alert(1)' }] }

        await expect(applySitePageRemove(undoRecord(unsafePrevious), OWNER)).rejects.toMatchObject({ status: 422, message: expect.stringContaining('unsafe link') })
        expect(deletes()).toEqual([])
    })
})

// TC-AIWB-60 — seen live: "Shop Now" → /products (no such page); creating the Products page added a second "Products"
// menu entry and the copilot offered to repoint the button that already pointed there.
describe('preparePageCreate — a page for links that lead nowhere [TC-AIWB-60]', () => {
    it('says which links it fixes and adds no second menu entry for an address the menu already has', async () => {
        state.site = { ...state.site, pendingHeaderBlock: { ...NAV, links: [{ label: 'Products', url: '/products' }], ctaButton: { show: true, label: 'Shop Now', url: '/products' } } }

        const result = await createPage({ title: 'Products', slug: 'products', menuLabel: 'Products' })

        expect(result.error).toBeUndefined()
        expect(result.plan).toMatchObject({ slug: '/products', menuLabel: null })
        expect(result.diffs?.some((d) => d.field === 'menu links')).toBe(false)
        expect(result.guardrails).toEqual(expect.arrayContaining([
            expect.objectContaining({ rule: 'fixes_links', detail: 'Links to /products work once this page is published: menu “Products”, the menu button “Shop Now”.' }),
            expect.objectContaining({ rule: 'already_in_menu' }),
        ]))
    })
})
