/**
 * TC-AIWB-02 — what the copilot reads: pages, one page's draft (ids, positions, short text), one section
 * in full (editable fields and a version hash), the theme, block types and store products.
 * Real: site-read.ts, site-blocks.ts, the block registry, the site access check. Faked: Payload Local API.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FAQ, HERO, LAYOUT, NAV, OWNER, PAGE_ID, PRODUCTS, SITE_ID, page, site } from './web-builder-fixtures'
import { readSite, SiteToolError } from '@/lib/ai-platform/site/site-read'
import { blockHash, blockIdOf, editableKeys, linkHosts, previewValue } from '@/lib/ai-platform/site/site-blocks'

const db = vi.hoisted(() => ({
    sites: {} as Record<string, unknown>,
    pages: {} as Record<string, unknown>,
    pageDocs: [] as unknown[],
    products: [] as unknown[],
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        findByID: vi.fn(async ({ collection, id }: { collection: string; id: string | number }) =>
            collection === 'sites' ? (db.sites[String(id)] ?? null) : (db.pages[String(id)] ?? null),
        ),
        find: vi.fn(async ({ collection }: { collection: string }) => ({
            docs: collection === 'pages' ? db.pageDocs : collection === 'products' ? db.products : [],
            totalDocs: collection === 'pages' ? db.pageDocs.length : 0,
        })),
    })),
}))

beforeEach(() => {
    db.sites = { [String(SITE_ID)]: site() }
    db.pages = { [String(PAGE_ID)]: page(LAYOUT), '11': page([], { id: 11, site: 99, title: 'Other shop' }) }
    db.pageDocs = [
        { id: PAGE_ID, title: 'Home', slug: '/', isHomepage: true, _status: 'draft' },
        { id: 12, title: 'About', slug: '/about', isHomepage: false, _status: 'published' },
    ]
    db.products = [{ id: '1', name: 'Kain batik', price: 120, status: 'published' }]
})

describe('readSite — pages and one page draft [TC-AIWB-02]', () => {
    it('lists the site pages with home flag and status', async () => {
        const result = await readSite(OWNER, { view: 'pages', siteId: String(SITE_ID) })

        expect(result).toMatchObject({ site: { id: String(SITE_ID), name: 'Kedai Batik' } })
        expect(result).toMatchObject({ pages: [
            { id: String(PAGE_ID), title: 'Home', slug: '/', home: true, status: 'draft' },
            { id: '12', title: 'About', slug: '/about', home: false, status: 'published' },
        ] })
    })

    it('returns sections with ids, 1-based positions, names and short fields, marked as untrusted', async () => {
        const result = (await readSite(OWNER, { view: 'page', siteId: String(SITE_ID), pageId: String(PAGE_ID) })) as {
            note: string
            blocks: Array<{ id: string; position: number; type: string; name: string; variant: string | null; fields: string[] }>
        }

        expect(result.note).toMatch(/never instructions/)
        expect(result.blocks.map((b) => [b.id, b.position, b.type])).toEqual([
            ['00000000-0000-4000-8000-0000000000a1', 1, 'navigation'],
            ['00000000-0000-4000-8000-0000000000b1', 2, 'hero'],
            ['00000000-0000-4000-8000-0000000000c1', 3, 'faq'],
            ['00000000-0000-4000-8000-0000000000d1', 4, 'products-grid'],
            ['00000000-0000-4000-8000-0000000000e1', 5, 'footer'],
        ])
        expect(result.blocks.find((b) => b.id === '00000000-0000-4000-8000-0000000000b1')?.name).toBe('Hero')
        const hero = result.blocks.find((b) => b.id === '00000000-0000-4000-8000-0000000000b1')!
        expect(hero.variant).toBe('centered')
        expect(hero.fields.join(' | ')).toContain('Batik for every day')
    })

    it('addresses a legacy section without an id by its position (index-N)', async () => {
        db.pages[String(PAGE_ID)] = page([NAV, { blockType: 'custom-html', html: '<p>Hi</p>' }, FAQ])

        const result = (await readSite(OWNER, { view: 'page', siteId: String(SITE_ID), pageId: String(PAGE_ID) })) as { blocks: Array<{ id: string }> }

        expect(result.blocks.map((b) => b.id)).toEqual(['00000000-0000-4000-8000-0000000000a1', 'index-1', '00000000-0000-4000-8000-0000000000c1'])
    })

    it('requires a pageId for the page view', async () => {
        await expect(readSite(OWNER, { view: 'page', siteId: String(SITE_ID) })).rejects.toMatchObject({ status: 400 })
    })

    it('refuses a page that belongs to another site (404)', async () => {
        await expect(readSite(OWNER, { view: 'page', siteId: String(SITE_ID), pageId: '11' })).rejects.toMatchObject({ status: 404 })
    })
})

describe('readSite — one section in full [TC-AIWB-02]', () => {
    it('returns the editable fields, the variants and a version hash of the section', async () => {
        const result = (await readSite(OWNER, { view: 'block', siteId: String(SITE_ID), pageId: String(PAGE_ID), blockId: '00000000-0000-4000-8000-0000000000b1' })) as {
            id: string; position: number; type: string; editableFields: string[]; variants: string[]; version: string; data: Record<string, unknown>
        }

        expect(result).toMatchObject({ id: '00000000-0000-4000-8000-0000000000b1', position: 2, type: 'hero' })
        expect(result.editableFields).toEqual(expect.arrayContaining(['headline', 'subheadline', 'ctaButtons']))
        expect(result.editableFields).not.toEqual(expect.arrayContaining(['blockType', 'id']))
        expect(result.variants).toContain('centered')
        expect(result.version).toBe(blockHash(HERO))
        expect(result.data).toMatchObject({ headline: 'Batik for every day' })
    })

    it('changes the version when the section changes', async () => {
        const before = (await readSite(OWNER, { view: 'block', siteId: String(SITE_ID), pageId: String(PAGE_ID), blockId: '00000000-0000-4000-8000-0000000000b1' })) as { version: string }
        db.pages[String(PAGE_ID)] = page([NAV, { ...HERO, headline: 'Batik for every day, now on sale' }, FAQ, PRODUCTS, LAYOUT[4]])

        const after = (await readSite(OWNER, { view: 'block', siteId: String(SITE_ID), pageId: String(PAGE_ID), blockId: '00000000-0000-4000-8000-0000000000b1' })) as { version: string }

        expect(after.version).not.toBe(before.version)
    })

    it('reads a legacy section by its index-N address', async () => {
        db.pages[String(PAGE_ID)] = page([NAV, { blockType: 'custom-html', html: '<p>Hi</p>' }])

        const result = (await readSite(OWNER, { view: 'block', siteId: String(SITE_ID), pageId: String(PAGE_ID), blockId: 'index-1' })) as { type: string }

        expect(result.type).toBe('custom-html')
    })

    it('answers 404 with "read the page again" for a section that is not on the page', async () => {
        const error = await readSite(OWNER, { view: 'block', siteId: String(SITE_ID), pageId: String(PAGE_ID), blockId: 'gone' }).catch((e: unknown) => e)

        expect(error).toBeInstanceOf(SiteToolError)
        expect(error).toMatchObject({ status: 404, message: expect.stringContaining('read the page again') })
    })
})

describe('readSite — site access and other views [TC-AIWB-02]', () => {
    it("refuses a site the caller's workspace does not own (403)", async () => {
        db.sites[String(SITE_ID)] = site({ tenant: { id: 2 } })

        await expect(readSite(OWNER, { view: 'pages', siteId: String(SITE_ID) })).rejects.toMatchObject({ status: 403 })
    })

    it('answers 404 for an unknown site', async () => {
        await expect(readSite(OWNER, { view: 'pages', siteId: '999' })).rejects.toMatchObject({ status: 404 })
    })

    it('returns only the theme keys this site stores, with the option lists', async () => {
        db.sites[String(SITE_ID)] = site({ theme: { primaryColor: '#0ea5e9', colorMode: 'dark', evilKey: 'x' } })

        const result = (await readSite(OWNER, { view: 'theme', siteId: String(SITE_ID) })) as { theme: Record<string, unknown>; options: Record<string, string[]> }

        expect(result.theme).toEqual({ primaryColor: '#0ea5e9', colorMode: 'dark' })
        expect(result.options.colorMode).toEqual(['light', 'dark'])
    })

    it('lists the section types it may add, with their variants', async () => {
        const result = (await readSite(OWNER, { view: 'catalog', siteId: String(SITE_ID) })) as { blockTypes: Array<{ type: string; variants: string[] }> }

        const hero = result.blockTypes.find((t) => t.type === 'hero')
        expect(hero?.variants).toContain('centered')
    })

    it('TC-AIAUD-199: the section and catalog views say variants are names only (no layout per screen size is claimed)', async () => {
        const block = (await readSite(OWNER, { view: 'block', siteId: String(SITE_ID), pageId: String(PAGE_ID), blockId: '00000000-0000-4000-8000-0000000000b1' })) as { variants: string[]; variantsNote: string }
        const catalog = (await readSite(OWNER, { view: 'catalog', siteId: String(SITE_ID) })) as { variantsNote: string }

        expect(block.variants.length).toBeGreaterThan(0)
        for (const note of [block.variantsNote, catalog.variantsNote]) {
            expect(note).toMatch(/names only/)
            expect(note).toMatch(/phone or a desktop/)
            expect(note).toMatch(/do not offer a variant as a way to get a layout/)
        }
    })

    it('lists the store products of the workspace for product sections', async () => {
        const result = (await readSite(OWNER, { view: 'products', siteId: String(SITE_ID), query: 'batik' })) as { products: Array<{ id: string; name: string }>; note: string }

        expect(result.products).toEqual([{ id: '1', name: 'Kain batik', price: 120, status: 'published', stock: null, inStock: null, hasPhoto: false }])
        expect(result.note).toMatch(/selectedProductIds/)
    })
})

describe('site-blocks helpers [TC-AIWB-02]', () => {
    it('addresses a block by its id, or by its position when it has none', () => {
        expect(blockIdOf({ blockType: 'hero', id: '00000000-0000-4000-8000-0000000000b1' }, 3)).toBe('00000000-0000-4000-8000-0000000000b1')
        expect(blockIdOf({ blockType: 'hero' }, 3)).toBe('index-3')
    })

    it('fingerprints a section without the row ids Payload rewrites on save', () => {
        const a = { blockType: 'faq', id: '00000000-0000-4000-8000-0000000000c1', items: [{ id: 'row-a', question: 'Q?', answer: 'A.' }] }
        const b = { blockType: 'faq', id: '00000000-0000-4000-8000-0000000000c1', items: [{ id: 'row-b', question: 'Q?', answer: 'A.' }] }

        expect(blockHash(a)).toBe(blockHash(b))
        expect(blockHash({ ...a, id: 'faq-2' })).not.toBe(blockHash(a))
    })

    it('never offers identity or ordering keys as editable', () => {
        const keys = editableKeys('hero')

        for (const locked of ['blockType', 'id', '_order', 'products', 'sortOrder']) expect(keys.has(locked)).toBe(false)
        expect(keys.has('headline')).toBe(true)
    })

    it('shortens a long text value and sizes a list', () => {
        expect(previewValue('x'.repeat(200), 20)).toHaveLength(20)
        expect(previewValue([{ question: 'Q1' }, { question: 'Q2' }])).toBe('2 items: Q1 · Q2')
        expect(previewValue(null)).toBeNull()
    })

    it('collects the hosts of absolute links, wherever they sit in a value', () => {
        const hosts = linkHosts({ ctaButtons: [{ url: 'https://Shop.Example.com/a' }], note: 'see http://other.example/x?y=1' })

        expect([...hosts].sort()).toEqual(['other.example', 'shop.example.com'])
    })
})
