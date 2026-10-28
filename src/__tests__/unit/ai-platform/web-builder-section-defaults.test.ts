/**
 * TC-AIWB-66..70 — a section the copilot adds gets the editor's safety nets back: starter wording (in the
 * site's language) for the lists the model left empty, template buttons pointed at the site's real pages,
 * nothing invented for reviews / prices / people, and the stored plan passes the apply-time check unchanged.
 * Real: site-prepare.ts, site-section-defaults.ts, lib/ai/add-section.ts, the block registry.
 * Faked: the Payload Local API.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FakeDb } from './web-builder-fixtures'
import { FOOTER, HERO, NAV, OWNER, PAGE_ID, SITE_ID, page, site } from './web-builder-fixtures'
import { checkPagePatchOps, preparePagePatch } from '@/lib/ai-platform/site/site-prepare'
import type { PagePatchOp } from '@/lib/ai-platform/site/site-patch'
import type { PageBlock } from '@/lib/ai-platform/site/site-blocks'

const db = vi.hoisted((): { current: FakeDb; pages: Array<{ id: number; slug: string; isHomepage?: boolean }> } => ({ current: { site: null, page: null, products: [] }, pages: [] }))

vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        findByID: vi.fn(async ({ collection }: { collection: string }) => (collection === 'sites' ? db.current.site : db.current.page)),
        find: vi.fn(async ({ collection }: { collection: string }) => ({ docs: collection === 'pages' ? db.pages : collection === 'products' ? db.current.products : [] })),
    })),
}))

type Result = Record<string, unknown> & {
    error?: { code: string; message: string }
    guardrails?: Array<{ rule: string; ok: boolean; detail: string }>
    plan?: { ops: PagePatchOp[] }
}
type Inserted = Record<string, unknown> & { id: string; blockType: string }

const insert = (block: Record<string, unknown>) =>
    preparePagePatch(OWNER, { siteId: String(SITE_ID), pageId: String(PAGE_ID), why: 'Add a section', ops: [{ op: 'insert_block', afterBlockId: HERO.id, block }] }) as Promise<Result>
const inserted = (result: Result) => (result.plan!.ops[0] as { block: Inserted }).block
const notes = (result: Result) => (result.guardrails ?? []).filter((g) => g.rule === 'skipped_value').map((g) => g.detail)

beforeEach(() => {
    db.current = { site: site(), page: page([NAV, HERO, FOOTER]), products: [] }
    db.pages = [{ id: 1, slug: '/', isHomepage: true }, { id: 2, slug: 'contact' }]
})

describe('starter wording for what the model left empty [TC-AIWB-66]', () => {
    it('fills an FAQ the model sent without questions, in the site language, and says so on the card', async () => {
        db.current.site = site({ generationLocale: 'ms' })
        const result = await insert({ blockType: 'faq', headline: 'Soalan lazim' })

        expect(result.error).toBeUndefined()
        const faqs = inserted(result).faqs as Array<{ question: string; answer: string }>
        expect(faqs.length).toBeGreaterThanOrEqual(3)
        expect(faqs[0]!.question).toContain('Kedai Batik')
        expect(inserted(result).headline).toBe('Soalan lazim')
        expect(notes(result)).toEqual([expect.stringContaining('starter wording')])
    })

    it('uses English for a site language the templates do not have', async () => {
        db.current.site = site({ locale: 'vi' })
        const result = await insert({ blockType: 'faq', headline: 'Questions' })

        expect(JSON.stringify(inserted(result).faqs)).toMatch(/What |How |Do you /)
    })

    it('fills the other fields too when the section is not valid without them', async () => {
        const result = await insert({ blockType: 'features' })

        expect(result.error).toBeUndefined()
        expect(inserted(result)).toMatchObject({ blockType: 'features' })
        expect((inserted(result).features as unknown[]).length).toBeGreaterThanOrEqual(3)
        expect(String(inserted(result).headline).length).toBeGreaterThan(0)
    })
})

describe('what the model wrote is never replaced [TC-AIWB-67]', () => {
    it('keeps the model\'s own questions and adds no note', async () => {
        const faqs = [{ question: 'Do you ship to Sabah?', answer: 'Yes, in 3 days.' }]
        const result = await insert({ blockType: 'faq', headline: 'Shipping', faqs })

        expect(result.error).toBeUndefined()
        expect(inserted(result).faqs).toEqual(faqs)
        expect(notes(result)).toEqual([])
    })

    it('keeps the model\'s headline when only the list was missing', async () => {
        const result = await insert({ blockType: 'features', headline: 'Why Kedai Batik', subheadline: 'Hand-made in Kelantan' })

        expect(inserted(result)).toMatchObject({ headline: 'Why Kedai Batik', subheadline: 'Hand-made in Kelantan' })
        expect((inserted(result).features as unknown[]).length).toBeGreaterThanOrEqual(3)
    })
})

describe('template buttons point at real pages [TC-AIWB-68]', () => {
    it('gives a hero without buttons a button to the site\'s contact page', async () => {
        const result = await insert({ blockType: 'hero', headline: 'Batik for every day' })

        expect(result.error).toBeUndefined()
        const buttons = inserted(result).ctaButtons as Array<{ url: string }>
        expect(buttons.length).toBeGreaterThan(0)
        expect(buttons.every((b) => b.url === '/contact')).toBe(true)
    })

    it('adds no button when the site has no page to send it to (no dead links)', async () => {
        db.pages = [{ id: 1, slug: '/', isHomepage: true }]
        const result = await insert({ blockType: 'hero', headline: 'Batik for every day' })

        expect(result.error).toBeUndefined()
        expect(inserted(result).ctaButtons).toEqual([])
    })

    it('keeps the model\'s own buttons as they are', async () => {
        const ctaButtons = [{ label: 'Shop', url: '/shop', style: 'primary' }]
        const result = await insert({ blockType: 'hero', headline: 'Batik for every day', ctaButtons })

        expect(inserted(result).ctaButtons).toEqual(ctaButtons)
    })
})

describe('nothing invented [TC-AIWB-69]', () => {
    it.each(['testimonials', 'team', 'pricing'])('%s stays as the model sent it (no made-up reviews, people or prices)', async (blockType) => {
        const result = await insert({ blockType })

        const block = inserted(result)
        expect(notes(result)).toEqual([])
        for (const key of ['testimonials', 'members', 'plans']) if (key in block) expect(block[key]).toEqual([])
    })

    it('still refuses a hero without a headline instead of inventing one', async () => {
        const result = await insert({ blockType: 'hero', subheadline: 'No headline yet' })

        expect(result.error).toMatchObject({ code: 'invalid_section' })
    })
})

describe('the stored plan passes the apply-time check unchanged [TC-AIWB-70]', () => {
    it('apply re-checks the filled section without a note and with the same ops', async () => {
        const result = await insert({ blockType: 'faq', headline: 'Questions' })
        const ops = result.plan!.ops

        const again = await checkPagePatchOps(OWNER, '1', page([NAV, HERO, FOOTER]).layout as PageBlock[], ops, 'apply')

        expect('error' in again).toBe(false)
        const checked = again as { ops: PagePatchOp[]; skipped: string[] }
        expect(checked.skipped).toEqual([])
        expect(JSON.stringify(checked.ops)).toBe(JSON.stringify(ops))
    })
})
