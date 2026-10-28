/**
 * TC-AIWB-34 — the menu and footer changes of the web builder copilot (`site.nav_patch`): building the new blocks
 * from the stored ones, the draft card, the apply against the draft (fingerprint guard, only the drafts written)
 * and the undo that puts the previous drafts back (null included).
 * Real: site-nav.ts (buildFrame, currentFrame, frameFingerprint, missingPaths, prepareNavChange),
 * appliers/site-structure.ts (applySiteNavPatch, applySiteNavRestore), site-blocks.ts (isSafeLink, linkHosts,
 * forValidation, fieldSchema, blockHash), the block registry, the site access check.
 * Faked: Payload Local API (in memory: the site row and its pages), the tenant row lock (runs the callback),
 * the plan gate, media cleanup, the publish service and rate limiter (imported by the applier, not used here).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applySiteNavPatch, applySiteNavRestore } from '@/lib/ai-platform/appliers/site-structure'
import { blockHash, isSafeLink } from '@/lib/ai-platform/site/site-blocks'
import { appendMenuLink, buildFrame, currentFrame, frameFingerprint, missingPaths, NavChangeError, prepareNavChange } from '@/lib/ai-platform/site/site-nav'
import { FOOTER, LAYOUT, NAV, OWNER, PAGE_ID, SITE_ID, page, site } from './web-builder-fixtures'

const state = vi.hoisted(() => ({
    site: null as Record<string, unknown> | null,
    pages: new Map<string, Record<string, unknown>>(),
    writes: [] as Array<{ collection: string; data: Record<string, unknown> }>,
    subscription: { plan: 'PROFESSIONAL' } as null | { plan: string },
}))

vi.mock('payload', () => {
    const siteId = () => String((state.site as { id?: unknown }).id)
    const cms = {
        findByID: vi.fn(async ({ collection, id }: { collection: string; id: string | number }) => (collection === 'sites' ? state.site : (state.pages.get(String(id)) ?? null))),
        // sitePaths asks for the site's live pages (their addresses)
        find: vi.fn(async ({ collection, where }: { collection: string; where: Record<string, unknown> }) => ({
            docs: collection === 'pages' ? [...state.pages.values()].filter((p) => String(p.site) === siteId()) : [],
            totalDocs: state.pages.size,
            where,
        })),
        update: vi.fn(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
            state.writes.push({ collection, data })
            if (collection === 'sites') state.site = { ...state.site, ...data }
            return {}
        }),
    }
    return { getPayload: vi.fn(async () => cms) }
})

vi.mock('@/lib/payload/tenant-row-lock', () => ({
    withTenantRowLock: vi.fn(async (_cms: unknown, _tenant: unknown, operation: (req: { transactionID: string }) => Promise<unknown>) => operation({ transactionID: 'tx' })),
    lockTenantSiteRows: vi.fn(async () => undefined),
    executeTenantTransaction: vi.fn(async () => ({ rows: [] })),
}))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(async () => state.subscription),
    canUse: vi.fn(async () => true),
}))
vi.mock('@/lib/ai/media-injector', () => ({ stripOrphanMediaRefs: vi.fn(async () => undefined) }))
vi.mock('@/lib/ai-platform/appliers/picture-ingest', () => ({ ingestPicture: vi.fn() }))
vi.mock('@/lib/sites/publish-site', () => ({ publishSite: vi.fn() }))
vi.mock('@/lib/rateLimit', () => ({ checkTwoTierRateLimit: vi.fn(async () => ({ allowed: true })) }))

type Block = Record<string, unknown>
type Prepared = {
    error?: { code: string; message: string }
    kind?: string
    diffs?: Array<{ entity: { kind: string; id: string; label?: string }; field: string; before: string | null; after: string }>
    guardrails?: Array<{ rule: string; ok: boolean; detail: string }>
    plan?: Record<string, unknown>
}

const LINKS = [
    { label: 'Home', url: '/' },
    { label: 'Shop', url: '/shop' },
    { label: 'About', url: '/about' },
]
const COLUMNS = [
    { title: 'Help', links: [{ label: 'Contact', url: '/contact' }] },
    { title: 'Shop', links: [{ label: 'Rings', url: '/shop/rings' }] },
]
const HEADER: Block = { ...NAV, links: LINKS }
const FOOTER_BLOCK: Block = { ...FOOTER, columns: COLUMNS }

beforeEach(() => {
    vi.clearAllMocks()
    state.site = site({ headerBlock: HEADER, footerBlock: FOOTER_BLOCK })
    state.pages = new Map([
        [String(PAGE_ID), page(structuredClone(LAYOUT))],
        ['11', page([NAV, FOOTER], { id: 11, title: 'About', slug: '/about', isHomepage: false })],
    ])
    state.writes = []
    state.subscription = { plan: 'PROFESSIONAL' }
})

const draftNav = (input: Record<string, unknown>) => prepareNavChange(OWNER, { siteId: String(SITE_ID), why: 'Tidy the menu', ...input }) as Promise<Prepared>
const planOf = (prepared: Prepared) => prepared.plan as Record<string, unknown>
const siteWrites = () => state.writes.filter((w) => w.collection === 'sites')
const liveFrame = () => currentFrame(state.site as never)

// ─── buildFrame: the new blocks from the stored ones ───────────────────────

describe('buildFrame — the menu and footer from the stored blocks [TC-AIWB-34]', () => {
    it('keeps every other field of the menu block (logo, style, locale) and replaces only the links', () => {
        const current = { header: { ...HEADER, secondaryLocale: 'ms' }, footer: null }

        const built = buildFrame(current, { header: { links: [{ label: 'Home', url: '/' }, { label: 'Shop Batik', url: '/shop' }] }, footer: null })

        expect(built.header).toMatchObject({ id: NAV.id, variant: 'default', logoText: NAV.logoText, secondaryLocale: 'ms', links: [{ label: 'Home', url: '/' }, { label: 'Shop Batik', url: '/shop' }] })
        expect(built.footer).toBeNull()
    })

    it('keeps the extra fields of a link whose address is unchanged, while the label may change', () => {
        const current = { header: { ...NAV, links: [{ label: 'Shop', url: '/shop', openInNewTab: true }] }, footer: null }

        const built = buildFrame(current, { header: { links: [{ label: 'All batik', url: '/shop' }] }, footer: null })

        expect(built.header!.links).toEqual([{ label: 'All batik', url: '/shop', openInNewTab: true }])
    })

    it('keeps the sub-links it sends and leaves out the old ones when it sends none', () => {
        const current = { header: { ...NAV, links: [{ label: 'Shop', url: '/shop', children: [{ label: 'Old', url: '/old' }] }] }, footer: null }

        const withChildren = buildFrame(current, { header: { links: [{ label: 'Shop', url: '/shop', children: [{ label: 'Rings', url: '/shop/rings' }] }] }, footer: null })
        const withoutChildren = buildFrame(current, { header: { links: [{ label: 'Shop', url: '/shop' }] }, footer: null })

        expect(withChildren.header!.links).toEqual([{ label: 'Shop', url: '/shop', children: [{ label: 'Rings', url: '/shop/rings' }] }])
        expect(withoutChildren.header!.links).toEqual([{ label: 'Shop', url: '/shop' }])
    })

    it.each([['javascript:alert(1)'], ['//evil.example/login'], ['ftp://files.example/menu'], ['/\\evil.com'], ['/\\t/evil.com'], ['/a b']])('refuses the unsafe link %s (NavChangeError)', (url) => {
        expect(() => buildFrame({ header: HEADER, footer: null }, { header: { links: [{ label: 'Pay', url }] }, footer: null })).toThrow(NavChangeError)
        expect(() => buildFrame({ header: HEADER, footer: null }, { header: { links: [{ label: 'Pay', url }] }, footer: null })).toThrow('is not a link a menu can hold')
    })

    it('refuses an unsafe sub-link and names it as a sub-link', () => {
        expect(() =>
            buildFrame({ header: HEADER, footer: null }, { header: { links: [{ label: 'Shop', url: '/shop', children: [{ label: 'Bad', url: 'javascript:void(0)' }] }] }, footer: null }),
        ).toThrow(/sub-link 1/)
    })

    it('accepts a label of exactly 60 characters and refuses one of 61', () => {
        const ok = buildFrame({ header: HEADER, footer: null }, { header: { links: [{ label: 'a'.repeat(60), url: '/shop' }] }, footer: null })
        expect(ok.header!.links).toEqual([{ label: 'a'.repeat(60), url: '/shop' }])

        expect(() => buildFrame({ header: HEADER, footer: null }, { header: { links: [{ label: 'a'.repeat(61), url: '/shop' }] }, footer: null })).toThrow(
            'a link needs a label of 1–60 characters',
        )
    })

    it('drops the replaced list from the locale copies and reports it (the other language shows the new labels)', () => {
        const current = { header: { ...HEADER, _localeContent: { ms: { links: [{ label: 'Laman', url: '/' }], logoText: 'Kedai Batik BM' }, en: { logoText: 'Kedai' } } }, footer: null }

        const built = buildFrame(current, { header: { links: [{ label: 'Home', url: '/' }] }, footer: null })

        expect(built.header!._localeContent).toEqual({ ms: { logoText: 'Kedai Batik BM' }, en: { logoText: 'Kedai' } })
        expect(built.localeDropped).toBe(true)
    })

    it('reports no locale drop when no locale copy holds the replaced list', () => {
        const built = buildFrame({ header: HEADER, footer: null }, { header: { links: [{ label: 'Home', url: '/' }] }, footer: null })

        expect(built.localeDropped).toBe(false)
    })

    it('builds the footer columns, keeps each column text and each link extras, and refuses a title over 60 characters', () => {
        const current = { header: null, footer: { ...FOOTER, columns: [{ title: 'Help', text: 'Call us', links: [{ label: 'Contact', url: '/contact', target: '_blank' }] }] } }

        const built = buildFrame(current, { header: null, footer: { columns: [{ title: 'Help', links: [{ label: 'Contact us', url: '/contact' }] }] } })

        expect(built.footer!.columns).toEqual([{ title: 'Help', text: 'Call us', links: [{ label: 'Contact us', url: '/contact', target: '_blank' }] }])
        expect(() => buildFrame({ header: null, footer: FOOTER }, { header: null, footer: { columns: [{ title: 'x'.repeat(61), links: [] }] } })).toThrow(
            'the title is longer than 60 characters',
        )
    })

    it('leaves the menu alone when only the footer is sent (and the reverse)', () => {
        const footerOnly = buildFrame({ header: HEADER, footer: FOOTER_BLOCK }, { header: null, footer: { columns: COLUMNS } })
        const menuOnly = buildFrame({ header: HEADER, footer: FOOTER_BLOCK }, { header: { links: LINKS }, footer: null })

        expect(footerOnly.header).toBeNull()
        expect(menuOnly.footer).toBeNull()
    })
})

// ─── currentFrame, frameFingerprint: the draft the editor shows ────────────

describe('currentFrame and frameFingerprint — the draft the editor shows [TC-AIWB-34]', () => {
    it('reads the draft when there is one, the live menu and footer otherwise, and null for neither', () => {
        const draft = { ...NAV, links: [{ label: 'Draft', url: '/draft' }] }

        expect(currentFrame({ headerBlock: HEADER, pendingHeaderBlock: draft })).toEqual({ header: draft, footer: null })
        expect(currentFrame({ headerBlock: HEADER, pendingHeaderBlock: null })).toEqual({ header: HEADER, footer: null })
        expect(currentFrame({})).toEqual({ header: null, footer: null })
    })

    it('fingerprints the menu and footer: equal for the same frame, different once the menu draft changes', () => {
        const first = frameFingerprint({ header: HEADER, footer: FOOTER_BLOCK })
        const same = frameFingerprint({ header: { ...HEADER }, footer: FOOTER_BLOCK })
        const changed = frameFingerprint({ header: { ...HEADER, links: [LINKS[0]!] }, footer: FOOTER_BLOCK })

        expect(same).toEqual(first)
        expect(changed.header).not.toBe(first.header)
        expect(changed.footer).toBe(first.footer)
    })
})

// ─── isSafeLink: the link rule every menu, footer and link field uses ───────

describe('isSafeLink — the rule for menu and footer links [TC-AIWB-34]', () => {
    it.each([['/\\evil.com'], ['/\\t/evil.com'], ['/a b'], ['/a\tb'], ['https://x.com/a\\b'], ['/about\u0001'], ['//evil.example'], ['javascript:alert(1)']])(
        'refuses %j: a backslash, whitespace, a control character, a protocol-relative or script address',
        (url) => {
            expect(isSafeLink(url)).toBe(false)
        },
    )

    it.each([['/about'], ['#x'], ['https://x.com'], ['mailto:hi@x.com'], ['tel:+60123456789'], ['/shop/rings?size=2#top']])('keeps %j as a safe link', (url) => {
        expect(isSafeLink(url)).toBe(true)
    })

    it('refuses the new-style unsafe link in a menu draft, like any other unsafe link (buildFrame)', () => {
        expect(() => buildFrame({ header: HEADER, footer: null }, { header: { links: [{ label: 'Evil', url: '/\\evil.com' }] }, footer: null })).toThrow(NavChangeError)
    })
})

// ─── appendMenuLink: the one new link added when a page is created ─────────

describe('appendMenuLink — the new link at the end, existing links untouched [TC-AIWB-34]', () => {
    it('appends the new link after the existing ones, which stay exactly as they are (extra fields, sub-links)', () => {
        const existing = { ...NAV, links: [{ label: 'Shop', url: '/shop', openInNewTab: true, children: [{ label: 'Rings', url: '/shop/rings', extra: 1 }] }] }

        const header = appendMenuLink(existing, 'Promo', '/promo')

        expect(header.links).toEqual([
            { label: 'Shop', url: '/shop', openInNewTab: true, children: [{ label: 'Rings', url: '/shop/rings', extra: 1 }] },
            { label: 'Promo', url: '/promo' },
        ])
        expect(header).toMatchObject({ id: NAV.id, logoText: NAV.logoText })
    })

    it('appends the new link to every locale copy of the links, and leaves locale copies without links alone', () => {
        const existing = { ...NAV, links: LINKS, _localeContent: { ms: { links: [{ label: 'Laman', url: '/' }], logoText: 'Kedai Batik BM' }, en: { logoText: 'Kedai' } } }

        const header = appendMenuLink(existing, 'Promo', '/promo')

        expect(header._localeContent).toEqual({
            ms: { links: [{ label: 'Laman', url: '/' }, { label: 'Promo', url: '/promo' }], logoText: 'Kedai Batik BM' },
            en: { logoText: 'Kedai' },
        })
    })

    it('creates a one-link navigation block when there is no menu yet', () => {
        expect(appendMenuLink(null, 'Promo', '/promo')).toEqual({ blockType: 'navigation', links: [{ label: 'Promo', url: '/promo' }] })
    })

    it('does not check the existing links: an odd one stays, the new one is still checked', () => {
        const existing = { ...NAV, links: [{ label: 'Pay', url: 'javascript:alert(1)' }] }

        expect(appendMenuLink(existing, 'Promo', '/promo').links).toEqual([{ label: 'Pay', url: 'javascript:alert(1)' }, { label: 'Promo', url: '/promo' }])
        expect(() => appendMenuLink(existing, 'Bad', '/\\evil.com')).toThrow(NavChangeError)
        expect(() => appendMenuLink(existing, 'x'.repeat(61), '/promo')).toThrow('a link needs a label of 1–60 characters')
    })
})

// ─── missingPaths: links that lead nowhere ─────────────────────────────────

describe('missingPaths — internal links to addresses no page has [TC-AIWB-34]', () => {
    it('flags internal addresses no page has, including sub-links and footer column links, without the query or hash', () => {
        const paths = new Set(['/about'])
        const links = [
            { label: 'Home', url: '/' },
            { label: 'About', url: '/about' },
            { label: 'Contact', url: '/contact?x=1#form' },
            { label: 'Parent', url: '/gone', children: [{ label: 'Child', url: '/child-gone' }] },
        ]

        expect([...missingPaths(links, paths)].sort()).toEqual(['/child-gone', '/contact', '/gone'])
        expect([...missingPaths([{ title: 'Help', links: [{ label: 'FAQ', url: '/faq-old' }] }], paths)]).toEqual(['/faq-old'])
    })

    it('does not flag anchors, external addresses, protocol-relative links, storefront routes, or the home page', () => {
        const links = [
            { label: 'Top', url: '#top' },
            { label: 'Ext', url: 'https://x.example/a' },
            { label: 'Proto', url: '//evil.example' },
            { label: 'Blog', url: '/blog/post' },
            { label: 'Product', url: '/products/x' },
            { label: 'Checkout', url: '/checkout' },
            { label: 'Home', url: '/' },
        ]

        expect(missingPaths(links, new Set())).toEqual(new Set())
    })

    // seen live: the menu button "Shop Now" → /products answered 404 (the site had no Products page) and nothing flagged it
    it('flags a bare /products, /shop or /blog without a page, and a menu button\'s link', () => {
        const links = [{ label: 'Products', url: '/products' }, { label: 'Shop', url: '/shop/' }, { label: 'Blog', url: '/blog' }]

        expect(missingPaths(links, new Set(['/about']))).toEqual(new Set(['/products', '/shop/', '/blog']))
        expect(missingPaths({ ctaButton: { show: true, label: 'Shop Now', url: '/products' } }, new Set())).toEqual(new Set(['/products']))
        expect(missingPaths(links, new Set(['/products', '/shop', '/blog']))).toEqual(new Set())
    })

    it('flags a missing merchant page whose address starts like a storefront route', () => {
        // input: a link to /shopping-tips, a page the merchant never made. Observed: not flagged, because the storefront
        // exclusion is a bare startsWith("/shop") with no segment boundary. Expected: flagged as missing.
        expect([...missingPaths([{ label: 'Tips', url: '/shopping-tips' }], new Set(['/about']))]).toEqual(['/shopping-tips'])
    })
})

// ─── prepareNavChange: the draft card ──────────────────────────────────────

describe('prepareNavChange — the card for a menu and footer change [TC-AIWB-34]', () => {
    it('refuses a request with neither menu nor footer (no_change)', async () => {
        const result = await draftNav({ header: null, footer: null })

        expect(result.error).toMatchObject({ code: 'no_change' })
    })

    it('refuses an unsafe link at draft time (invalid_link), and drafts nothing', async () => {
        const result = await draftNav({ header: { links: [{ label: 'Pay', url: 'javascript:alert(1)' }] } })

        expect(result.error?.code).toBe('invalid_link')
        expect(result.plan).toBeUndefined()
    })

    it('diffs the menu links, from the links before to the links after (path header.links for "Show" [TC-AIWB-62])', async () => {
        const result = await draftNav({ header: { links: [LINKS[0]!, { label: 'Shop Batik', url: '/shop' }, LINKS[2]!] } })

        expect(result).toMatchObject({ kind: 'site.nav_patch', risk: 'medium' })
        expect(result.diffs).toEqual([
            {
                entity: { kind: 'site_navigation', id: String(SITE_ID), label: 'Menu · Kedai Batik' },
                field: 'menu links',
                path: 'header.links',
                before: 'Home → / · Shop → /shop · About → /about',
                after: 'Home → / · Shop Batik → /shop · About → /about',
            },
        ])
    })

    it('diffs only the footer columns that changed', async () => {
        const result = await draftNav({ footer: { columns: [COLUMNS[0]!, { title: 'Shop', links: [COLUMNS[1]!.links[0]!, { label: 'Sarong', url: '/shop/sarong' }] }] } })

        expect(result.diffs).toHaveLength(1)
        expect(result.diffs![0]).toMatchObject({
            entity: { kind: 'site_navigation', id: String(SITE_ID), label: 'Footer · Kedai Batik' },
            field: 'footer column 2',
            before: 'Shop: Rings → /shop/rings',
            after: 'Shop: Rings → /shop/rings · Sarong → /shop/sarong',
        })
    })

    it('says the menu and footer already look like that when nothing would change (no_change)', async () => {
        const result = await draftNav({ header: { links: LINKS } })

        expect(result.error).toEqual({ code: 'no_change', message: 'The menu and footer already look like that.' })
    })

    it('flags a link to an address no page has (missing_page, not ok)', async () => {
        const result = await draftNav({ header: { links: [LINKS[0]!, { label: 'Sale', url: '/sale' }] } })

        expect(result.guardrails).toContainEqual({
            rule: 'missing_page',
            ok: false,
            detail: 'No page has the address /sale yet — that link would lead to "page not found".',
        })
    })

    it('flags a link that leaves the site, with its host (external_link)', async () => {
        const result = await draftNav({ header: { links: [LINKS[0]!, { label: 'Pay', url: 'https://pay.example/checkout' }] } })

        expect(result.guardrails).toContainEqual({ rule: 'external_link', ok: true, detail: 'Links to pay.example — check it is the address you want.' })
    })

    it('warns that the second language shows the new labels until translated (second_language, not ok)', async () => {
        state.site = { ...state.site, headerBlock: { ...HEADER, _localeContent: { ms: { links: LINKS } } } }

        const result = await draftNav({ header: { links: [LINKS[0]!] } })

        expect(result.guardrails).toContainEqual(expect.objectContaining({ rule: 'second_language', ok: false }))
    })

    it('writes nothing while drafting, and the plan carries the frame it was drafted on', async () => {
        const result = await draftNav({ header: { links: [LINKS[0]!] } })

        expect(state.writes).toEqual([])
        expect(planOf(result)).toMatchObject({ siteId: String(SITE_ID), change: { header: { links: [LINKS[0]!] }, footer: null } })
        expect(planOf(result).base).toEqual(frameFingerprint(liveFrame()))
    })
})

// ─── applySiteNavPatch: apply against the draft ────────────────────────────

describe('applySiteNavPatch — apply against the menu and footer draft [TC-AIWB-34]', () => {
    it('refuses an empty change (422)', async () => {
        const plan = { siteId: String(SITE_ID), change: { header: null, footer: null }, base: { header: 'x', footer: 'y' } }

        await expect(applySiteNavPatch(plan, OWNER)).rejects.toMatchObject({ status: 422, message: 'This change has nothing to apply.' })
    })

    it('refuses with 409 when the menu changed since drafting, and writes nothing', async () => {
        const prepared = await draftNav({ header: { links: [LINKS[0]!] } })
        state.site = { ...state.site, headerBlock: { ...HEADER, links: [LINKS[1]!] } }

        await expect(applySiteNavPatch(planOf(prepared), OWNER)).rejects.toMatchObject({ status: 409, final: true })
        expect(siteWrites()).toEqual([])
    })

    it('refuses with 409 when the footer changed since drafting, for a footer-only change', async () => {
        const prepared = await draftNav({ footer: { columns: [COLUMNS[0]!] } })
        state.site = { ...state.site, footerBlock: { ...FOOTER_BLOCK, columns: [COLUMNS[1]!] } }

        await expect(applySiteNavPatch(planOf(prepared), OWNER)).rejects.toMatchObject({ status: 409, final: true })
        expect(siteWrites()).toEqual([])
    })

    it('writes only the menu draft for a menu change', async () => {
        const prepared = await draftNav({ header: { links: [LINKS[0]!] } })

        await applySiteNavPatch(planOf(prepared), OWNER)

        expect(siteWrites()).toHaveLength(1)
        expect(Object.keys(siteWrites()[0]!.data)).toEqual(['pendingHeaderBlock'])
    })

    it('writes only the footer draft for a footer change', async () => {
        const prepared = await draftNav({ footer: { columns: [COLUMNS[0]!] } })

        await applySiteNavPatch(planOf(prepared), OWNER)

        expect(siteWrites()).toHaveLength(1)
        expect(Object.keys(siteWrites()[0]!.data)).toEqual(['pendingFooterBlock'])
    })

    it('rebuilds from the stored lists against the draft when there is one (pending, not live)', async () => {
        const draft = { ...HEADER, links: [LINKS[0]!] }
        state.site = { ...state.site, pendingHeaderBlock: draft }
        const prepared = await draftNav({ header: { links: [LINKS[0]!, { label: 'Shop Batik', url: '/shop' }] } })

        const result = await applySiteNavPatch(planOf(prepared), OWNER)

        expect((state.site as { pendingHeaderBlock: Block }).pendingHeaderBlock.links).toEqual([LINKS[0]!, { label: 'Shop Batik', url: '/shop' }])
        expect(result.undo).toMatchObject({ kind: 'site.nav_restore', payload: { header: { previous: draft } } })
    })

    it('returns the undo with the previous drafts, null when there was none', async () => {
        const prepared = await draftNav({ header: { links: [LINKS[0]!] } })

        const result = await applySiteNavPatch(planOf(prepared), OWNER)

        expect(result.undo).toMatchObject({
            kind: 'site.nav_restore',
            payload: { siteId: String(SITE_ID), header: { previous: null, after: blockHash((state.site as { pendingHeaderBlock: unknown }).pendingHeaderBlock) }, footer: null },
        })
        expect(result.entities).toEqual([{ kind: 'site_navigation', id: String(SITE_ID) }])
    })

    it('rebuilds with the same checks: an unsafe link in the stored plan is refused (422, final)', async () => {
        const plan = { siteId: String(SITE_ID), change: { header: { links: [{ label: 'X', url: 'javascript:alert(1)' }] }, footer: null }, base: frameFingerprint(liveFrame()) }

        await expect(applySiteNavPatch(plan, OWNER)).rejects.toMatchObject({ status: 422, final: true })
        expect(siteWrites()).toEqual([])
    })
})

// ─── applySiteNavRestore: undo ─────────────────────────────────────────────

describe('applySiteNavRestore — undo puts the previous drafts back [TC-AIWB-34]', () => {
    it('puts the previous menu draft back, and clears it when there was none (null included)', async () => {
        const prepared = await draftNav({ header: { links: [LINKS[0]!] } })
        const applied = await applySiteNavPatch(planOf(prepared), OWNER)

        await applySiteNavRestore(applied.undo!.payload, OWNER)

        expect((state.site as { pendingHeaderBlock: unknown }).pendingHeaderBlock).toBeNull()
    })

    it('puts back a menu draft that existed before the change', async () => {
        const draft = { ...HEADER, links: [LINKS[0]!] }
        state.site = { ...state.site, pendingHeaderBlock: draft }
        const applied = await applySiteNavPatch(planOf(await draftNav({ header: { links: [LINKS[0]!, { label: 'Shop Batik', url: '/shop' }] } })), OWNER)

        await applySiteNavRestore(applied.undo!.payload, OWNER)

        expect((state.site as { pendingHeaderBlock: unknown }).pendingHeaderBlock).toEqual(draft)
    })

    it('puts the previous footer draft back, null included', async () => {
        const applied = await applySiteNavPatch(planOf(await draftNav({ footer: { columns: [COLUMNS[0]!] } })), OWNER)

        await applySiteNavRestore(applied.undo!.payload, OWNER)

        expect((state.site as { pendingFooterBlock: unknown }).pendingFooterBlock).toBeNull()
    })

    it('refuses once the menu was edited since the change (409), and writes nothing', async () => {
        const applied = await applySiteNavPatch(planOf(await draftNav({ header: { links: [LINKS[0]!] } })), OWNER)
        state.site = { ...state.site, pendingHeaderBlock: { ...HEADER, links: [LINKS[2]!] } }
        state.writes = []

        await expect(applySiteNavRestore(applied.undo!.payload, OWNER)).rejects.toMatchObject({ status: 409 })
        expect(siteWrites()).toEqual([])
    })
})
