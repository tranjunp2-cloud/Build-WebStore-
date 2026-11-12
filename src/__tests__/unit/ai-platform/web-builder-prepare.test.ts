/**
 * TC-AIWB-03 / 04 / 07 — the copilot drafts page and theme changes from a fresh read; nothing is written.
 * Real: site-prepare.ts, site-patch.ts, site-blocks.ts, the block registry. Faked: the Payload Local API.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FakeDb } from './web-builder-fixtures'
import { FOOTER, HERO, LAYOUT, NAV, OWNER, PAGE_ID, SITE_ID, page, site } from './web-builder-fixtures'
import { preparePagePatch, prepareThemeChange } from '@/lib/ai-platform/site/site-prepare'

const db = vi.hoisted((): { current: FakeDb } => ({ current: { site: null, page: null, products: [] } }))

vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        findByID: vi.fn(async ({ collection }: { collection: string }) => (collection === 'sites' ? db.current.site : db.current.page)),
        find: vi.fn(async ({ collection }: { collection: string }) => ({ docs: collection === 'products' ? db.current.products : [] })),
    })),
}))

type Result = Record<string, unknown> & { error?: { code: string; message: string }; guardrails?: Array<{ rule: string; ok: boolean; detail: string }>; plan?: Record<string, unknown> }

const patch = (ops: unknown[], extra: Record<string, unknown> = {}) =>
    preparePagePatch(OWNER, { siteId: String(SITE_ID), pageId: String(PAGE_ID), why: 'Refresh the copy', ops, ...extra }) as Promise<Result>

beforeEach(() => {
    db.current = { site: site(), page: page(), products: [{ id: '1' }] }
})

describe('preparePagePatch — refusals the model can act on [TC-AIWB-03]', () => {
    it('refuses a section id that is not on the page', async () => {
        const result = await patch([{ op: 'set_fields', blockId: 'nope', fields: { headline: 'x' } }])

        expect(result.error).toMatchObject({ code: 'unknown_section' })
    })

    it('drops identity keys and fields an edit cannot set, keeping the rest of the edit', async () => {
        const result = await patch([{ op: 'set_fields', blockId: '00000000-0000-4000-8000-0000000000b1', fields: { headline: 'Fresh batik', blockType: 'faq', id: 'x', notAField: 'y' } }])

        expect(result.error).toBeUndefined()
        expect(result.guardrails).toEqual(expect.arrayContaining([
            expect.objectContaining({ rule: 'skipped_value', ok: false, detail: 'Hero has no field "notAField" an edit can set.' }),
        ]))
        expect(JSON.stringify(result.guardrails)).not.toContain('blockType')
        expect(result.plan?.ops).toEqual([{ op: 'set_fields', blockId: '00000000-0000-4000-8000-0000000000b1', fields: { headline: 'Fresh batik' } }])
    })

    it('refuses a change that breaks the section schema (invalid_section)', async () => {
        const result = await patch([{ op: 'set_fields', blockId: '00000000-0000-4000-8000-0000000000b1', fields: { headline: { text: 'not a string' } } }])

        expect(result.error).toMatchObject({ code: 'invalid_section' })
        expect(result.error?.message).toContain('Hero')
    })

    it('refuses to insert a section type that is not offered (unknown_block_type)', async () => {
        const result = await patch([{ op: 'insert_block', afterBlockId: '00000000-0000-4000-8000-0000000000b1', block: { blockType: 'nonexistent', headline: 'x' } }])

        expect(result.error).toMatchObject({ code: 'unknown_block_type' })
    })

    it('refuses to remove the navigation or footer (structural)', async () => {
        expect((await patch([{ op: 'remove_block', blockId: '00000000-0000-4000-8000-0000000000a1' }])).error).toMatchObject({ code: 'structural' })
        expect((await patch([{ op: 'remove_block', blockId: '00000000-0000-4000-8000-0000000000e1' }])).error).toMatchObject({ code: 'structural' })
    })

    it('flags a link that leaves the site (external_link)', async () => {
        const result = await patch([{ op: 'set_fields', blockId: '00000000-0000-4000-8000-0000000000b1', fields: { ctaButtons: [{ label: 'Pay', url: 'https://pay.example/checkout', style: 'primary' }] } }])

        expect(result.error).toBeUndefined()
        expect(result.guardrails).toContainEqual(expect.objectContaining({ rule: 'external_link', ok: true, detail: expect.stringContaining('pay.example') }))
    })
})

describe('preparePagePatch — inserted sections [TC-AIWB-03]', () => {
    it('gives the new section a uuid id, the default variant and registry-validated data', async () => {
        const result = await patch([{ op: 'insert_block', afterBlockId: '00000000-0000-4000-8000-0000000000b1', block: { blockType: 'faq', headline: 'Shipping', items: [{ question: 'Where?', answer: 'Everywhere' }], variant: 'no-such-style' } }])

        expect(result.error).toBeUndefined()
        const insert = (result.plan?.ops as Array<{ op: string; block: Record<string, unknown> }>)[0]!
        expect(insert.op).toBe('insert_block')
        expect(String(insert.block.id)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
        expect(insert.block).toMatchObject({ blockType: 'faq', variant: 'accordion', headline: 'Shipping' })
    })

    it('refuses an incomplete new section (invalid_section)', async () => {
        const result = await patch([{ op: 'insert_block', afterBlockId: '00000000-0000-4000-8000-0000000000b1', block: { blockType: 'hero', subheadline: 'No headline yet' } }])

        expect(result.error).toMatchObject({ code: 'invalid_section' })
    })

    it('refuses to place a section after one that is not on the page', async () => {
        const result = await patch([{ op: 'insert_block', afterBlockId: 'ghost', block: { blockType: 'faq', headline: 'Q', items: [{ question: 'Q?', answer: 'A.' }] } }])

        expect(result.error).toMatchObject({ code: 'unknown_section' })
    })
})

describe('preparePagePatch — product ids belong to this store [TC-AIWB-04]', () => {
    it('refuses ids that are not products of this store instead of leaving them out silently', async () => {
        db.current.products = [{ id: '1' }, { id: '2' }]

        const result = await patch([{ op: 'set_fields', blockId: '00000000-0000-4000-8000-0000000000d1', fields: { selectedProductIds: ['1', '9'] } }])

        expect(result.error).toMatchObject({ code: 'unknown_products', message: expect.stringContaining('9') })
        expect(result.error?.message).not.toContain('addToStore')
    })

    it('refuses the same in a new product section', async () => {
        // a page without a products grid yet (a second one is refused first: TC-AIAUD-079)
        db.current.page = page(LAYOUT.filter((block) => block.blockType !== 'products-grid'))
        const result = await patch([{ op: 'insert_block', afterBlockId: '00000000-0000-4000-8000-0000000000b1', block: { blockType: 'products-grid', headline: 'Best sellers', selectedProductIds: ['1', '9'] } }])

        expect(result.error).toMatchObject({ code: 'unknown_products' })
    })

    it('leaves a product section alone when every id is known', async () => {
        const result = await patch([{ op: 'set_fields', blockId: '00000000-0000-4000-8000-0000000000d1', fields: { selectedProductIds: ['1'] } }])

        expect(result.guardrails?.some((g) => g.rule === 'skipped_value')).toBe(false)
    })
})

describe('preparePagePatch — no Product Master on this release [TC-AIREL-70]', () => {
    it('refuses a pm:<id> product ref: only products of this store can be shown', async () => {
        const result = await patch([{ op: 'set_fields', blockId: '00000000-0000-4000-8000-0000000000d1', fields: { selectedProductIds: ['pm:prod_scarf'] } }])

        expect(result.error).toMatchObject({ code: 'unknown_products', message: expect.stringContaining('pm:prod_scarf') })
        expect(result.error?.message).not.toContain('addToStore')
    })

    it('ignores an addToStore list a client still sends: it never reaches the plan or the card', async () => {
        const result = await patch(
            [{ op: 'set_fields', blockId: '00000000-0000-4000-8000-0000000000d1', fields: { selectedProductIds: ['1'] } }],
            { addToStore: [{ id: 'prod_scarf', title: 'Batik silk scarf' }] },
        ) as Result & { diffs?: Array<{ entity: { kind: string } }> }

        expect(result.error).toBeUndefined()
        expect(result.plan).not.toHaveProperty('addToStore')
        expect(result.diffs?.some((diff) => diff.entity.kind === 'product')).toBe(false)
        expect(JSON.stringify(result.guardrails)).not.toContain('Product Store')
    })
})

describe('prepareThemeChange [TC-AIWB-07]', () => {
    const theme = (changes: Record<string, unknown>) =>
        prepareThemeChange(OWNER, { siteId: String(SITE_ID), why: 'Warmer look', changes }) as Promise<Result & { kind?: string; risk?: string; confirmText?: string; diffs?: unknown[] }>

    it('drafts a high-risk theme change that must be confirmed with the site name', async () => {
        const result = await theme({ primaryColor: '#f97316', colorMode: 'dark' })

        expect(result).toMatchObject({ kind: 'site.theme_patch', risk: 'high', confirmText: 'Kedai Batik' })
        expect(result.diffs).toHaveLength(2)
        expect(result.plan).toMatchObject({ siteId: String(SITE_ID), changes: { primaryColor: '#f97316', colorMode: 'dark' } })
    })

    it('TC-AICHAT-019: names each theme setting in words, never the raw key (#2218)', async () => {
        const result = await theme({ primaryColor: '#E11D48', colorMode: 'dark' })

        expect((result.diffs as Array<{ field: string; path?: string }>).map((d) => [d.field, d.path])).toEqual([
            ['Primary color', 'primaryColor'],
            ['Color mode', 'colorMode'],
        ])
    })

    it('skips unknown keys, values that are not options, and colours that are not #rrggbb', async () => {
        const result = await theme({ primaryColor: '#f97316', bogusKey: 'x', colorMode: 'neon', accentColor: 'red' })

        expect(result.guardrails).toEqual(expect.arrayContaining([
            expect.objectContaining({ rule: 'skipped_value', detail: '"bogusKey" is not a theme option (or not one of its values).' }),
            expect.objectContaining({ rule: 'skipped_value', detail: 'accentColor needs a #rrggbb colour.' }),
        ]))
        expect(result.plan?.changes).toEqual({ primaryColor: '#f97316' })
    })

    it('refuses a change that would not change anything (no_change)', async () => {
        const result = await theme({ primaryColor: '#0ea5e9' })

        expect(result.error).toMatchObject({ code: 'no_change' })
    })

    it('does not touch the stored site (a draft only)', async () => {
        const before = JSON.stringify(db.current.site)
        await theme({ primaryColor: '#f97316' })

        expect(JSON.stringify(db.current.site)).toBe(before)
    })
})

// The page frame: the navigation and footer are edited, never moved, removed or duplicated.
describe('preparePagePatch — structural frame [TC-AIWB-03]', () => {
    it('refuses to move the navigation off the top of the page', async () => {
        const result = await patch([{ op: 'move_block', blockId: NAV.id, afterBlockId: HERO.id }])

        expect(result.error).toMatchObject({ code: 'structural' })
    })

    it('refuses to move the footer above the last section', async () => {
        const result = await patch([{ op: 'move_block', blockId: FOOTER.id, afterBlockId: null }])

        expect(result.error).toMatchObject({ code: 'structural' })
    })

    it('refuses to add a second navigation section', async () => {
        const result = await patch([{ op: 'insert_block', afterBlockId: HERO.id, block: { blockType: 'navigation', logoText: 'Second' } }])

        expect(result.error).toMatchObject({ code: 'structural' })
    })
})
