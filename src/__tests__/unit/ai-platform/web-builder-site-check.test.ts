/**
 * TC-AIWB-35 / 36 — "what is still missing?" (`site_read` views "check" and "navigation") and publishing
 * (`site.publish`): the check items with the tool that fixes each, the publish card, the apply against the
 * fingerprint, the rate limit and the publish service's answers. One routing test for the facade's site.* tools.
 * Real: site-check.ts (sitePages, publishFingerprint, readSiteCheck, preparePublish), site-nav.ts (readNavigation,
 * currentFrame, missingPaths), site-seo-translate.ts (readLocaleContent), site-read.ts (site access), site-blocks.ts,
 * appliers/site-structure.ts (applySitePublish), handle-agent-tool.ts (routing), the block registry.
 * Faked: Payload Local API (in memory; the raw SQL for soft-deleted pages and locale_content is rendered by drizzle
 * and answered from memory), the tenant row lock, the plan gate, the rate limiter, the local SEO evaluation, the
 * publish service (publishSite), the agent flag and the forwarded merchant.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangeSetApplyError } from '@/lib/ai-platform/appliers/errors'
import { applySitePublish } from '@/lib/ai-platform/appliers/site-structure'
import { handleAgentTool } from '@/lib/ai-platform/agent-tools/handle-agent-tool'
import { resolveToolActor } from '@/lib/ai-platform/agent-tools/tool-actor'
import { isAiAgentEnabled } from '@/lib/ai-platform/config'
import { publishFingerprint, preparePublish, readSiteCheck, readSiteCheckCounts } from '@/lib/ai-platform/site/site-check'
import { readNavigation } from '@/lib/ai-platform/site/site-nav'
import { checkTwoTierRateLimit } from '@/lib/rateLimit'
import { evaluateAuthoritativeLocalSeo } from '@/lib/seo/local-seo-evaluation'
import { PublishRolledBack, publishSite } from '@/lib/sites/publish-site'
import { withTenantRowLock } from '@/lib/payload/tenant-row-lock'
import { revalidateTag } from 'next/cache'
import { getPayload } from 'payload'
import { FAQ, FOOTER, HERO, LAYOUT, NAV, OWNER, PAGE_ID, PRODUCTS, SITE_ID, page, site } from './web-builder-fixtures'

const state = vi.hoisted(() => ({
    site: null as Record<string, unknown> | null,
    pages: new Map<string, Record<string, unknown>>(),
    deletedIds: [] as string[],
    pageLimits: [] as Array<number | undefined>,
    locale: {} as Record<string, Record<string, Record<string, Record<string, unknown>>>>,
    writes: [] as Array<{ collection: string; data: Record<string, unknown> }>,
    subscription: { plan: 'PROFESSIONAL' } as null | { plan: string },
    /** raw SQL answered from memory — the same on the pool and inside the tenant transaction */
    answer: async (query: unknown): Promise<{ rows: Array<Record<string, unknown>> }> => {
        const { PgDialect } = await import('drizzle-orm/pg-core')
        const rendered = new PgDialect().sqlToQuery(query as Parameters<PgDialect['sqlToQuery']>[0])
        if (/deleted_at IS NOT NULL/.test(rendered.sql)) return { rows: state.deletedIds.map((id) => ({ id })) }
        // one read for every page of the site: params are [siteId, ...pageIds]
        if (/locale_content/.test(rendered.sql)) return { rows: rendered.params.slice(1).map((id) => ({ id, locale_content: state.locale[String(id)] ?? {} })) }
        throw new Error(`unexpected query: ${rendered.sql}`)
    },
}))

vi.mock('payload', () => {
    const cms = {
        findByID: vi.fn(async ({ collection, id }: { collection: string; id: string | number }) => (collection === 'sites' ? state.site : (state.pages.get(String(id)) ?? null))),
        find: vi.fn(async ({ collection, where, limit }: { collection: string; where: Record<string, unknown>; limit?: number }) => {
            state.pageLimits.push(limit)
            if (collection !== 'pages') return { docs: [] }
            const siteId = (where.site as { equals?: unknown } | undefined)?.equals ?? (state.site as { id?: unknown }).id
            return { docs: [...state.pages.values()].filter((p) => String(p.site) === String(siteId)).slice(0, limit ?? 10_000) }
        }),
        update: vi.fn(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
            state.writes.push({ collection, data })
            if (collection === 'sites') state.site = { ...state.site, ...data }
            return {}
        }),
        db: {
            drizzle: {
                execute: vi.fn(async (query: unknown) => state.answer(query)),
            },
        },
    }
    return { getPayload: vi.fn(async () => cms) }
})

vi.mock('@/lib/payload/tenant-row-lock', () => ({
    withTenantRowLock: vi.fn(async (_cms: unknown, _tenant: unknown, operation: (req: { transactionID: string }) => Promise<unknown>) => operation({ transactionID: 'tx' })),
    lockTenantSiteRows: vi.fn(async () => undefined),
    executeTenantTransaction: vi.fn(async (_cms: unknown, _req: unknown, query: unknown) => state.answer(query)),
}))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(async () => state.subscription),
    canUse: vi.fn(async () => true),
}))
vi.mock('@/lib/ai/media-injector', () => ({ stripOrphanMediaRefs: vi.fn(async () => undefined) }))
vi.mock('@/lib/ai-platform/appliers/picture-ingest', () => ({ ingestPicture: vi.fn() }))
vi.mock('@/lib/sites/publish-site', () => ({
    publishSite: vi.fn(),
    PublishRolledBack: class PublishRolledBack extends Error {
        constructor(readonly result: unknown) {
            super('publish rolled back')
        }
    },
}))
vi.mock('@/lib/rateLimit', () => ({ checkTwoTierRateLimit: vi.fn(async () => ({ allowed: true })) }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@/lib/seo/local-seo-evaluation', () => ({ evaluateAuthoritativeLocalSeo: vi.fn() }))
vi.mock('@/lib/ai-platform/config', () => ({ isAiAgentEnabled: vi.fn(() => true) }))
vi.mock('@/lib/ai-platform/agent-tools/tool-actor', () => ({ resolveToolActor: vi.fn() }))

type Check = { code: string; message: string; pageId?: string; page?: string; count?: number; fix: string | null }
type CheckResult = { site: { id: string; name: string; status: string; pages: number }; items: Check[]; more?: number }
type Prepared = { error?: { code: string; message: string }; kind?: string; title?: string; risk?: string; confirmText?: string; diffs?: Array<{ entity: { kind: string; id: string }; field: string; before: string | null; after: string }>; guardrails?: Array<{ rule: string; ok: boolean; detail: string }>; plan?: Record<string, unknown> }

const SEO_OK = { title: 'Kedai Batik', description: 'Hand-made batik' }
const LINKS = [{ label: 'Home', url: '/' }, { label: 'About', url: '/about' }]
// the hero's button goes to a page the site has (a link to a missing page is a check item of its own)
const HOME = () => page(structuredClone(LAYOUT).map((b) => (b.blockType === 'hero' ? { ...b, ctaButtons: [{ label: 'Shop', url: '/about', style: 'primary' }] } : b)), { id: PAGE_ID, title: 'Home', slug: '/', isHomepage: true, seo: SEO_OK, _status: 'published' })
const ABOUT = (overrides: Record<string, unknown> = {}) => page([NAV, FAQ, FOOTER], { id: 11, title: 'About', slug: '/about', isHomepage: false, seo: SEO_OK, _status: 'published', ...overrides })
const emptyPage = (id: number, title: string, overrides: Record<string, unknown> = {}) =>
    page([NAV, FOOTER], { id, title, slug: `/${title.toLowerCase()}-${id}`, isHomepage: false, seo: SEO_OK, _status: 'published', ...overrides })

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(evaluateAuthoritativeLocalSeo).mockReset().mockResolvedValue({ response: { issues: [] } } as never)
    vi.mocked(checkTwoTierRateLimit).mockReset().mockResolvedValue({ allowed: true } as never)
    vi.mocked(publishSite).mockReset().mockResolvedValue({ status: 200, body: { success: true, data: { url: 'https://kedai.example', domain: 'kedai.example' } } })
    vi.mocked(isAiAgentEnabled).mockReturnValue(true)
    vi.mocked(resolveToolActor).mockReset().mockResolvedValue(OWNER)
    // a published site with a home page and an about page, both complete: nothing is missing until a test breaks it
    state.site = site({ status: 'published', headerBlock: { ...NAV, links: LINKS } })
    state.pages = new Map([
        [String(PAGE_ID), HOME()],
        ['11', ABOUT()],
    ])
    state.deletedIds = []
    state.locale = {}
    state.writes = []
    state.subscription = { plan: 'PROFESSIONAL' }
})

const readCheck = () => readSiteCheck(OWNER, SITE_ID) as Promise<CheckResult>
const itemsOf = (result: CheckResult, code: string) => result.items.filter((i) => i.code === code)
const edit = (pageId: string, blockId: string, fields: Record<string, unknown>) => {
    const doc = state.pages.get(pageId)!
    doc.layout = (doc.layout as Array<Record<string, unknown>>).map((b) => (b.id === blockId ? { ...b, ...fields } : b))
}

// ─── TC-AIWB-35: site_read view "check" ────────────────────────────────────

describe('site_read view "check" — what is still missing [TC-AIWB-35]', () => {
    it('reports nothing for a published site whose pages are complete', async () => {
        const result = await readCheck()

        expect(result.items).toEqual([])
        expect(result.site).toMatchObject({ id: String(SITE_ID), name: 'Kedai Batik', status: 'published', pages: 2 })
    })

    it('lists an empty page with the tool that adds sections (empty_page)', async () => {
        state.pages.set('12', emptyPage(12, 'Contact'))

        const result = await readCheck()

        expect(itemsOf(result, 'empty_page')).toEqual([
            { code: 'empty_page', pageId: '12', page: 'Contact', message: '"Contact" has no sections yet.', fix: 'propose_page_patch (insert_block)' },
        ])
    })

    it('lists a page without an SEO title or description, naming the one missing (missing_seo)', async () => {
        state.pages.set('12', emptyPage(12, 'Contact', { seo: { title: 'Contact us' } }))
        state.pages.set('13', emptyPage(13, 'Promo', { seo: null }))

        const result = await readCheck()

        expect(itemsOf(result, 'missing_seo')).toEqual([
            expect.objectContaining({ pageId: '12', message: '"Contact" has no SEO description.', fix: 'propose_page_seo' }),
            expect.objectContaining({ pageId: '13', message: '"Promo" has no SEO title or description.', fix: 'propose_page_seo' }),
        ])
    })

    it('lists the sections not translated into the second language, and not the translated ones (missing_translation)', async () => {
        state.site = { ...state.site, headerBlock: { ...NAV, links: LINKS, secondaryLocale: 'ms' } }
        state.locale = { [String(PAGE_ID)]: { [HERO.id]: { ms: { headline: 'Batik untuk setiap hari' } } } }

        const result = await readCheck()

        expect(itemsOf(result, 'missing_translation').find((i) => i.pageId === '10')).toEqual({
            code: 'missing_translation',
            pageId: '10',
            page: 'Home',
            count: 2,
            message: '"Home": 2 sections not translated into Bahasa Melayu.',
            fix: 'propose_page_translation (locale "ms")',
        })
    })

    it('reports no missing translation when every section has its second-language copy', async () => {
        state.site = { ...state.site, headerBlock: { ...NAV, links: LINKS, secondaryLocale: 'ms' } }
        state.locale = {
            [String(PAGE_ID)]: { [HERO.id]: { ms: { headline: 'a' } }, [FAQ.id]: { ms: { headline: 'b' } }, [PRODUCTS.id]: { ms: { headline: 'c' } } },
            '11': { [FAQ.id]: { ms: { headline: 'd' } } },
        }

        const result = await readCheck()

        expect(itemsOf(result, 'missing_translation')).toEqual([])
    })

    it('does not check translations when the second language is the site language itself', async () => {
        state.site = { ...state.site, headerBlock: { ...NAV, links: LINKS, secondaryLocale: 'en' } }

        const result = await readCheck()

        expect(itemsOf(result, 'missing_translation')).toEqual([])
    })

    it('flags menu and footer links to addresses no page has, each with the tool that fixes it (broken_menu_link)', async () => {
        state.site = { ...state.site, headerBlock: { ...NAV, links: [...LINKS, { label: 'Sale', url: '/sale' }] }, footerBlock: { ...FOOTER, columns: [{ title: 'Help', links: [{ label: 'FAQ', url: '/faq-old' }] }] } }

        const result = await readCheck()

        expect(itemsOf(result, 'broken_menu_link').map((i) => [i.message, i.fix])).toEqual([
            ['The menu or footer links to /sale, but no page has that address: visitors get "page not found".', expect.stringContaining('propose_navigation with a page that exists')],
            ['The menu or footer links to /faq-old, but no page has that address: visitors get "page not found".', expect.stringContaining('propose_new_page at /faq-old')],
        ])
    })

    // seen live: "Shop Now" → /products answered 404 and the check said nothing
    it('flags the menu button and section buttons that lead to a missing page (broken_menu_button, broken_link)', async () => {
        state.site = { ...state.site, headerBlock: { ...NAV, links: LINKS, ctaButton: { show: true, label: 'Shop Now', url: '/products' } } }
        state.pages.set(String(PAGE_ID), page(structuredClone(LAYOUT), { id: PAGE_ID, title: 'Home', slug: '/', isHomepage: true, seo: SEO_OK, _status: 'published' }))

        const result = await readCheck()

        expect(itemsOf(result, 'broken_menu_button')).toEqual([expect.objectContaining({ message: 'The menu button "Shop Now" links to /products, but no page has that address.', fix: expect.stringContaining('products-grid') })])
        expect(itemsOf(result, 'broken_link')).toEqual([expect.objectContaining({ message: expect.stringMatching(/^"Home" › Hero \(.+\) links to \/shop, but no page has that address\.$/) })])
    })

    it('says the website is not published yet on a draft site (not_published)', async () => {
        state.site = { ...state.site, status: 'draft' }

        const result = await readCheck()

        expect(itemsOf(result, 'not_published')).toEqual([{ code: 'not_published', message: 'The website is not published yet.', fix: 'propose_publish' }])
        expect(result.site.status).toBe('draft')
    })

    it('says what waits to go live on a published site: the page drafts and the menu draft (unpublished_changes)', async () => {
        state.pages.set('11', ABOUT({ _status: 'draft' }))
        state.site = { ...state.site, pendingHeaderBlock: { ...NAV, links: LINKS } }

        const result = await readCheck()

        expect(itemsOf(result, 'unpublished_changes')).toEqual([
            { code: 'unpublished_changes', count: 1, message: 'Changes are waiting to go live (1 page, the menu or footer).', fix: 'propose_publish' },
        ])
    })

    it('counts the page drafts that wait to go live, in the plural', async () => {
        state.pages.set('11', ABOUT({ _status: 'draft' }))
        state.pages.set('12', emptyPage(12, 'Contact', { _status: 'draft' }))

        const result = await readCheck()

        expect(itemsOf(result, 'unpublished_changes')).toEqual([expect.objectContaining({ count: 2, message: 'Changes are waiting to go live (2 pages).' })])
    })

    it('adds local SEO issues, leaving out the ones the items above already name, with no fix tool (local_seo)', async () => {
        vi.mocked(evaluateAuthoritativeLocalSeo).mockResolvedValueOnce({
            response: { issues: [{ code: 'meta-title', count: 1 }, { code: 'meta-description', count: 1 }, { code: 'store-unpublished', count: 1 }, { code: 'hours-missing', count: 2 }] },
        } as never)

        const result = await readCheck()

        expect(result.items).toEqual([{ code: 'local_seo:hours-missing', count: 2, message: 'Local SEO: hours missing (2).', fix: null }])
        expect(evaluateAuthoritativeLocalSeo).toHaveBeenCalledWith(expect.anything(), String(SITE_ID), OWNER.tenantId)
    })

    it('keeps the rest of the check when local SEO cannot be evaluated', async () => {
        state.pages.set('12', emptyPage(12, 'Contact'))
        vi.mocked(evaluateAuthoritativeLocalSeo).mockRejectedValueOnce(new Error('db down'))
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

        const result = await readCheck()

        expect(itemsOf(result, 'empty_page')).toHaveLength(1)
        expect(warn).toHaveBeenCalledWith('[site-check] local SEO evaluation skipped', 'db down')
        warn.mockRestore()
    })

    it('leaves soft-deleted pages out of the check and out of the page count', async () => {
        state.pages.set('12', emptyPage(12, 'Contact', { seo: null }))
        state.deletedIds = ['12']

        const result = await readCheck()

        expect(result.items.filter((i) => i.pageId === '12')).toEqual([])
        expect(result.site.pages).toBe(2)
    })

    it('names the tool that fixes each item (every item but the local SEO ones has one)', async () => {
        state.pages.set('12', emptyPage(12, 'Contact', { seo: null, _status: 'draft' }))
        state.site = { ...state.site, status: 'draft', headerBlock: { ...NAV, links: [...LINKS, { label: 'Sale', url: '/sale' }] } }

        const result = await readCheck()

        expect(result.items.length).toBeGreaterThan(3)
        for (const item of result.items.filter((i) => !i.code.startsWith('local_seo'))) expect(item.fix).toEqual(expect.any(String))
    })

    it('caps the list at 40 items and says how many more there are', async () => {
        // 21 empty pages without SEO = 42 items
        for (let i = 0; i < 21; i++) state.pages.set(String(100 + i), emptyPage(100 + i, `Page ${i}`, { seo: null }))

        const result = await readCheck()

        expect(result.items).toHaveLength(40)
        expect(result.more).toBe(2)
    })
})

// ─── TC-AIWB-35: site_read view "navigation" ───────────────────────────────

describe('site_read view "navigation" — the draft menu, footer and page addresses [TC-AIWB-35]', () => {
    it('returns the draft menu (with sub-links), the draft footer columns and the page addresses', async () => {
        state.site = {
            ...state.site,
            pendingHeaderBlock: { ...NAV, links: [{ label: 'Home', url: '/' }, { label: 'Shop', url: '/shop', children: [{ label: 'Rings', url: '/shop/rings' }] }] },
            pendingFooterBlock: { ...FOOTER, columns: [{ title: 'Help', links: [{ label: 'Contact', url: '/contact' }] }] },
        }

        const result = await readNavigation(OWNER, SITE_ID)

        expect(result.menu).toEqual([
            { label: 'Home', url: '/', children: [] },
            { label: 'Shop', url: '/shop', children: [{ label: 'Rings', url: '/shop/rings' }] },
        ])
        expect(result.footerColumns).toEqual([{ title: 'Help', links: [{ label: 'Contact', url: '/contact' }] }])
        expect([...result.pages].sort()).toEqual(['/', '/about'])
    })

    it('reads the live menu when there is no draft', async () => {
        const result = await readNavigation(OWNER, SITE_ID)

        expect(result.menu).toEqual(LINKS.map((l) => ({ label: l.label, url: l.url, children: [] })))
        expect(result.footerColumns).toEqual([])
    })
})

// ─── TC-AIWB-36: prepare the publish ───────────────────────────────────────

describe('site.publish — prepare: refusals and the card [TC-AIWB-36]', () => {
    const draftPublish = (input: Record<string, unknown> = {}) => preparePublish(OWNER, { siteId: String(SITE_ID), why: 'Go live with the summer pages', ...input }) as Promise<Prepared>

    it('refuses a site with no pages (no_pages)', async () => {
        state.pages = new Map()

        const result = await draftPublish()

        expect(result.error).toEqual({ code: 'no_pages', message: 'This website has no pages to publish.' })
    })

    it('refuses when everything is already live (no_change)', async () => {
        const result = await draftPublish()

        expect(result.error).toEqual({ code: 'no_change', message: 'Everything is already live.' })
    })

    it('lists every page as going live on the first publish, with the high-risk confirmation typed as the site name', async () => {
        state.site = { ...state.site, status: 'draft' }

        const result = await draftPublish()

        expect(result).toMatchObject({ kind: 'site.publish', title: 'Publish the live site: Kedai Batik', risk: 'high', confirmText: 'Kedai Batik' })
        expect(result.diffs).toEqual([
            { entity: { kind: 'site_page', id: String(PAGE_ID), label: 'Home' }, field: 'live site', before: 'Not live yet', after: 'This draft (/)' },
            { entity: { kind: 'site_page', id: '11', label: 'About' }, field: 'live site', before: 'Not live yet', after: 'This draft (/about)' },
        ])
    })

    it('after the first publish lists only the page drafts and the menu, footer and widgets drafts', async () => {
        state.pages.set('11', ABOUT({ _status: 'draft' }))
        state.site = { ...state.site, pendingHeaderBlock: { ...NAV, links: LINKS }, pendingFooterBlock: FOOTER, pendingGlobalBlocks: [{ blockType: 'cart' }] }

        const result = await draftPublish()

        expect(result.title).toBe('Update the live site: Kedai Batik')
        expect(result.diffs!.map((d) => [d.entity.kind, d.field])).toEqual([
            ['site_page', 'live site'],
            ['site_navigation', 'menu'],
            ['site_navigation', 'footer'],
            ['site', 'widgets'],
        ])
        expect(result.diffs![0]).toMatchObject({ before: 'What visitors see now', after: 'This draft (/about)' })
    })

    it('shows the check warnings as guardrails, but not the not-published or waiting notes', async () => {
        state.pages.set('11', ABOUT({ _status: 'draft' }))
        state.pages.set('12', emptyPage(12, 'Contact'))

        const result = await draftPublish()

        const rules = (result.guardrails ?? []).map((g) => g.rule)
        expect(result.guardrails).toContainEqual({ rule: 'empty_page', ok: false, detail: '"Contact" has no sections yet.' })
        expect(rules).toEqual(expect.arrayContaining(['live', 'version_guard']))
        expect(rules).not.toContain('unpublished_changes')
        expect(rules).not.toContain('not_published')
    })

    it('fingerprints every page draft and the pending blocks as the plan', async () => {
        state.pages.set('11', ABOUT({ _status: 'draft' }))
        state.site = { ...state.site, pendingHeaderBlock: { ...NAV, links: LINKS } }

        const result = await draftPublish()

        expect(result.plan).toEqual({ siteId: String(SITE_ID), ...publishFingerprint(state.site as never, [...state.pages.values()] as never) })
    })

    it('publishes nothing and writes nothing while drafting', async () => {
        state.site = { ...state.site, status: 'draft' }

        await draftPublish()

        expect(publishSite).not.toHaveBeenCalled()
        expect(state.writes).toEqual([])
    })
})

// ─── TC-AIWB-36: apply the publish ─────────────────────────────────────────

describe('site.publish — apply: the fingerprint, the rate limit and the publish service [TC-AIWB-36]', () => {
    // a draft to publish: the About page has an unpublished change (everything else is live)
    const draftedPlan = async () => {
        state.pages.set('11', ABOUT({ _status: 'draft' }))
        return (await preparePublish(OWNER, { siteId: String(SITE_ID), why: 'Go live' }) as Prepared).plan as Record<string, unknown>
    }

    it('is rate-limited like the editor\'s Publish button: over the limit is a 409 that can be retried, and nothing is published', async () => {
        const plan = await draftedPlan()
        vi.mocked(checkTwoTierRateLimit).mockResolvedValueOnce({ allowed: false } as never)

        await expect(applySitePublish(plan, OWNER)).rejects.toMatchObject({ status: 409, final: false })
        expect(checkTwoTierRateLimit).toHaveBeenCalledWith('publish:7', 5, 30)
        expect(publishSite).not.toHaveBeenCalled()
    })

    it('refuses with 409 (final) when a translation changed after it was checked, and publishes nothing', async () => {
        const plan = await draftedPlan()
        state.locale = { [String(PAGE_ID)]: { [HERO.id]: { ms: { headline: 'Changed after the check' } } } }

        await expect(applySitePublish(plan, OWNER)).rejects.toMatchObject({ status: 409, final: true })
        expect(publishSite).not.toHaveBeenCalled()
    })

    it('refuses with 409 (final) when a page changed after it was checked, and publishes nothing', async () => {
        const plan = await draftedPlan()
        edit(String(PAGE_ID), HERO.id, { headline: 'Changed after the check' })

        await expect(applySitePublish(plan, OWNER)).rejects.toMatchObject({ status: 409, final: true })
        expect(publishSite).not.toHaveBeenCalled()
    })

    it('refuses with 409 (final) when the menu or footer changed after it was checked, and publishes nothing', async () => {
        const plan = await draftedPlan()
        state.site = { ...state.site, pendingHeaderBlock: { ...NAV, links: [{ label: 'Only', url: '/only' }] } }

        await expect(applySitePublish(plan, OWNER)).rejects.toMatchObject({ status: 409, final: true })
        expect(publishSite).not.toHaveBeenCalled()
    })

    it('checks and publishes in one tenant transaction under the site lock [TC-AIWB-42]', async () => {
        const plan = await draftedPlan()
        // a menu change committed by someone else just before the lock: the check inside the lock sees it
        vi.mocked(withTenantRowLock).mockImplementationOnce(async (_cms, _tenant, operation) => {
            state.site = { ...state.site, pendingHeaderBlock: { ...NAV, links: [{ label: 'Changed', url: '/changed' }] } }
            return operation({ transactionID: 'tx' } as never)
        })
        await expect(applySitePublish(plan, OWNER)).rejects.toMatchObject({ status: 409, final: true })
        expect(publishSite).not.toHaveBeenCalled()

        state.site = site({ status: 'published', headerBlock: { ...NAV, links: LINKS } })
        const fresh = await draftedPlan()
        vi.mocked(publishSite).mockImplementationOnce(async (input) => {
            input.tx?.afterCommit(() => revalidateTag('site-x', 'max'))
            expect(revalidateTag).not.toHaveBeenCalled()
            return { status: 200, body: { success: true, data: {} } }
        })
        await applySitePublish(fresh, OWNER)
        expect(vi.mocked(publishSite).mock.calls[0]![0].tx?.req).toEqual({ transactionID: 'tx' })
        // the revalidation handed to afterCommit ran once the transaction returned
        expect(revalidateTag).toHaveBeenCalledWith('site-x', 'max')
    })

    it('a publish rolled back because a page failed is a final refusal with the reason, nothing live [TC-AIWB-42]', async () => {
        const plan = await draftedPlan()
        vi.mocked(publishSite).mockRejectedValueOnce(new PublishRolledBack({
            status: 409,
            body: { success: false, error: { message: 'Failed to publish 1 page(s).', failures: [{ pageTitle: 'About', friendlyDetail: 'FAQ → title: This field is required.' }] } },
        }))

        await expect(applySitePublish(plan, OWNER)).rejects.toMatchObject({ status: 422, final: true, message: expect.stringContaining('About: FAQ → title') })
    })

    it('publishes exactly the checked site and returns the live address and the editor as links', async () => {
        state.pages.set('11', ABOUT({ _status: 'draft' }))
        const plan = await draftedPlan()

        const result = await applySitePublish(plan, OWNER)

        expect(publishSite).toHaveBeenCalledWith(expect.objectContaining({ siteId: String(SITE_ID), body: {}, pw1Grant: null, user: OWNER.user }))
        expect(result.entities).toEqual([{ kind: 'site', id: String(SITE_ID) }])
        expect(result.links).toEqual([
            { label: 'Open kedai.example', href: 'https://kedai.example' },
            { label: 'Open in the editor', href: `/editor/${SITE_ID}` },
        ])
    })

    it('turns a validation failure into a final 422 that names the page and the field', async () => {
        const plan = await draftedPlan()
        vi.mocked(publishSite).mockResolvedValueOnce({
            status: 409,
            body: { success: false, error: { message: 'Failed to publish 1 page(s). Please try again.', failures: [{ pageTitle: 'About', friendlyDetail: 'Hero → Headline: required' }] } },
        })

        const failure = await applySitePublish(plan, OWNER).catch((e: unknown) => e)

        expect(failure).toBeInstanceOf(ChangeSetApplyError)
        expect(failure).toMatchObject({ status: 422, final: true, message: 'Failed to publish 1 page(s). Please try again. About: Hero → Headline: required' })
    })

    it('keeps a 403 from the publish service (403, not final)', async () => {
        const plan = await draftedPlan()
        vi.mocked(publishSite).mockResolvedValueOnce({ status: 403, body: { success: false, error: { message: 'Not your site' } } })

        await expect(applySitePublish(plan, OWNER)).rejects.toMatchObject({ status: 403, final: false })
    })

    it('throws on a server fault from the publish service (500), so it is not shown as a refusal', async () => {
        const plan = await draftedPlan()
        vi.mocked(publishSite).mockResolvedValueOnce({ status: 500, body: { success: false } })

        const failure = await applySitePublish(plan, OWNER).catch((e: unknown) => e)

        expect(failure).toBeInstanceOf(Error)
        expect(failure).not.toBeInstanceOf(ChangeSetApplyError)
        expect((failure as Error).message).toBe('publish failed (500)')
    })
})

// ─── Facade routing: the site.* tools reach their functions ────────────────

describe('facade routing of the site.* tools [TC-AIWB-35]', () => {
    const call = async (tool: string, body: unknown) => {
        const res = await handleAgentTool(new Request(`http://localhost:3000/api/agent/tools/${tool}`, { method: 'POST', body: JSON.stringify(body) }), tool)
        return (await res.json()) as Record<string, unknown>
    }

    it('site.read view check returns the check items', async () => {
        const body = await call('site.read', { view: 'check', siteId: String(SITE_ID) })

        expect(body).toMatchObject({ site: { id: String(SITE_ID), pages: 2 }, items: [] })
    })

    it('site.read view navigation returns the menu and footer drafts', async () => {
        const body = await call('site.read', { view: 'navigation', siteId: String(SITE_ID) })

        expect(body).toMatchObject({ menu: LINKS.map((l) => ({ label: l.label, url: l.url, children: [] })), footerColumns: [] })
    })

    it('site.prepare_publish drafts the publish card', async () => {
        state.site = { ...state.site, status: 'draft' }

        const body = await call('site.prepare_publish', { siteId: String(SITE_ID), why: 'Go live' })

        expect(body).toMatchObject({ kind: 'site.publish', risk: 'high' })
    })

    it('site.prepare_pages reaches the multi-page draft (a page named twice is refused as bad_patch)', async () => {
        const body = await call('site.prepare_pages', {
            siteId: String(SITE_ID),
            why: 'Tidy',
            pages: [
                { pageId: String(PAGE_ID), ops: [{ op: 'set_fields', blockId: HERO.id, fields: { headline: 'x' } }] },
                { pageId: String(PAGE_ID), ops: [{ op: 'set_fields', blockId: HERO.id, fields: { headline: 'y' } }] },
            ],
        })

        expect(body).toMatchObject({ error: { code: 'bad_patch' } })
    })

    it('site.prepare_page_create reaches the new-page draft (a reserved address is refused as reserved_slug)', async () => {
        const body = await call('site.prepare_page_create', { siteId: String(SITE_ID), why: 'New', title: 'Checkout', slug: '/checkout', sections: [{ blockType: 'faq', headline: 'Q', items: [{ question: 'Q?', answer: 'A.' }] }] })

        expect(body).toMatchObject({ error: { code: 'reserved_slug' } })
    })

    it('site.prepare_nav reaches the menu draft (no menu and no footer is refused as no_change)', async () => {
        const body = await call('site.prepare_nav', { siteId: String(SITE_ID), why: 'Menu' })

        expect(body).toMatchObject({ error: { code: 'no_change' } })
    })
})

// ─── TC-AICP-194: the lean counts behind the dashboard To do card ───────────────

describe('readSiteCheckCounts — website problems for the To do list [TC-AICP-194]', () => {
    const counts = async (tenantId: string | number = 1) => readSiteCheckCounts(await getPayload({} as never), SITE_ID, tenantId)

    it('counts nothing for a published site whose pages are complete', async () => {
        expect(await counts()).toEqual({ siteId: String(SITE_ID), published: true, pages: 2, unpublished: 0, brokenLinks: 0, pagesMissingSeo: 0 })
    })

    it('counts broken menu / footer / section links, pages without SEO and pages with an unpublished draft', async () => {
        state.site = { ...state.site, headerBlock: { ...NAV, links: [...LINKS, { label: 'Sale', url: '/sale' }] }, footerBlock: { ...FOOTER, columns: [{ title: 'Help', links: [{ label: 'FAQ', url: '/faq-old' }] }] } }
        state.pages.set('12', emptyPage(12, 'Promo', { seo: null, _status: 'draft' }))
        state.pages.set('13', emptyPage(13, 'Offers', { seo: { title: 'Offers' }, _status: 'draft' }))

        const result = await counts()

        expect(result).toMatchObject({ pages: 4, brokenLinks: 2, pagesMissingSeo: 2, unpublished: 2 })
    })

    it('counts a menu or footer draft as one change waiting even when every page is live', async () => {
        state.site = { ...state.site, pendingHeaderBlock: { ...NAV, links: LINKS } }

        expect(await counts()).toMatchObject({ published: true, unpublished: 1 })
    })

    it('reports a site that never went live as not published', async () => {
        state.site = { ...state.site, status: 'draft' }

        expect(await counts()).toMatchObject({ published: false })
    })

    it('skips the slow checks: no translation review, no sample-copy review, no local SEO evaluation', async () => {
        state.site = { ...state.site, headerBlock: { ...NAV, links: LINKS, secondaryLocale: 'ms' } }

        const result = await counts()

        expect(result).toMatchObject({ brokenLinks: 0, pagesMissingSeo: 0 })
        expect(evaluateAuthoritativeLocalSeo).not.toHaveBeenCalled()
    })

    it('reads at most 60 page drafts for the counts, while the full check keeps its 200 [TC-AICP-277]', async () => {
        for (let id = 100; id < 170; id += 1) state.pages.set(String(id), emptyPage(id, `Page ${id}`, { seo: null, _status: 'published' }))
        state.pageLimits = []

        const result = await counts()

        expect(result?.pages).toBe(60)
        expect(state.pageLimits).toEqual([60])
        state.pageLimits = []
        await readSiteCheck(OWNER, SITE_ID)
        expect(state.pageLimits).toContain(200)
    })

    it('reads nothing of another workspace\'s site, or of a site that does not exist', async () => {
        expect(await counts(2)).toBeNull()
        state.site = null
        expect(await counts()).toBeNull()
    })
})
