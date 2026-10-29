/**
 * TC-AIWB-53 / 54 — anti-slop: copy the copilot writes onto the site is checked for filler that fits any shop,
 * claims visitors can't check, vague button labels and shouting. Drafting answers `generic_copy` (the model
 * rewrites with the shop's facts or asks); `keepWording` keeps the merchant's own words with a note on the card.
 * Only text the edit adds is checked. View "check" lists the filler and made-up sample content already on pages.
 * Real: site-copy-check.ts, content-rules.ts, site-samples.ts, site-prepare.ts, site-structure.ts, site-nav.ts,
 * the block registry. Faked: the Payload Local API.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FakeDb } from './web-builder-fixtures'
import { FOOTER, HERO, NAV, OWNER, PAGE_ID, SITE_ID, page, site } from './web-builder-fixtures'
import { copyProblem, sectionCopyNotes } from '@/lib/ai-platform/site/site-copy-check'
import { preparePagePatch } from '@/lib/ai-platform/site/site-prepare'
import { preparePageCreate } from '@/lib/ai-platform/site/site-structure'
import { prepareNavChange } from '@/lib/ai-platform/site/site-nav'
import { sampleText } from '@/lib/ai-platform/site/site-samples'

const db = vi.hoisted((): { current: FakeDb } => ({ current: { site: null, page: null, products: [] } }))

vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        findByID: vi.fn(async ({ collection }: { collection: string }) => (collection === 'sites' ? db.current.site : db.current.page)),
        find: vi.fn(async ({ collection }: { collection: string }) => ({ docs: collection === 'products' ? db.current.products : [] })),
        count: vi.fn(async () => ({ totalDocs: 1 })),
    })),
}))

const FEATURES = { blockType: 'features', id: '00000000-0000-4000-8000-0000000000f4', variant: 'grid-3', headline: 'Vì sao chọn chúng tôi?', features: [{ title: 'Giao hàng 2–3 ngày', description: 'Toàn Malaysia' }] }

type Result = { error?: { code: string; message: string }; guardrails?: Array<{ rule: string; ok: boolean; detail: string }>; plan?: unknown }
const patch = (ops: unknown[], extra: Record<string, unknown> = {}) =>
    preparePagePatch(OWNER, { siteId: String(SITE_ID), pageId: String(PAGE_ID), why: 'Copy', ops, ...extra }) as Promise<Result>

beforeEach(() => {
    db.current = { site: site(), page: page([NAV, HERO, FEATURES, FOOTER]), products: [] }
})

describe('copyProblem — what reads as slop [TC-AIWB-53]', () => {
    it('flags filler (vi / ms / en), unverifiable claims, vague button labels and shouting', () => {
        expect(copyProblem('headline', 'Vì sao chọn chúng tôi?')).toMatch(/filler/)
        expect(copyProblem('subheadline', 'Kami komited, kualiti terbaik untuk anda')).toMatch(/filler/)
        expect(copyProblem('headline', 'Elevate your style today')).toMatch(/filler/)
        expect(copyProblem('headline', 'Giá rẻ nhất Malaysia')).toMatch(/claim/)
        expect(copyProblem('label', 'Xem thêm')).toMatch(/vague button/)
        expect(copyProblem('ctaLabel', 'Submit')).toMatch(/vague button/)
        expect(copyProblem('headline', 'Sale lớn!!')).toMatch(/shouting/)
    })

    it('lets facts and specific copy through', () => {
        expect(copyProblem('headline', 'Best sellers')).toBeNull()
        expect(copyProblem('description', 'Áo dài 100% cotton, may tại Kelantan')).toBeNull()
        expect(copyProblem('label', 'Xem áo dài Raya')).toBeNull()
        expect(copyProblem('title', 'Xem thêm')).toBeNull()
    })
})

describe('drafting refuses slop unless the merchant gave the words [TC-AIWB-53]', () => {
    it('answers generic_copy with where, what and why; nothing is drafted', async () => {
        const result = await patch([{ op: 'set_value', blockId: HERO.id, path: 'headline', value: 'Chất lượng hàng đầu, giá tốt nhất' }])

        expect(result.error?.code).toBe('generic_copy')
        expect(result.error?.message).toContain('Hero · Home → headline')
        expect(result.error?.message).toContain('keepWording')
    })

    it('keepWording drafts it with a copy_check note on the card', async () => {
        const result = await patch([{ op: 'set_value', blockId: HERO.id, path: 'headline', value: 'Chất lượng hàng đầu' }], { keepWording: true })

        expect(result.error).toBeUndefined()
        expect(result.guardrails).toContainEqual(expect.objectContaining({ rule: 'copy_check', ok: false, detail: expect.stringContaining('“Chất lượng hàng đầu”') }))
    })

    it('checks only text the edit adds: a list rewrite that keeps the page\'s own filler passes', async () => {
        const result = await patch([{ op: 'set_fields', blockId: FEATURES.id, fields: { headline: 'Vì sao chọn chúng tôi?', subheadline: 'Áo dài may tại Kelantan, giao toàn Malaysia trong 2–3 ngày' } }])

        expect(result.error).toBeUndefined()
    })

    it('a new page and a footer tagline go through the same check', async () => {
        const created = (await preparePageCreate(OWNER, { siteId: String(SITE_ID), why: 'About', title: 'Về chúng tôi', slug: 've-chung-toi', sections: [{ blockType: 'features', headline: 'Trải nghiệm tuyệt vời', features: [{ title: 'A', description: 'B' }] }] })) as Result
        expect(created.error?.code).toBe('generic_copy')

        const nav = (await prepareNavChange(OWNER, { siteId: String(SITE_ID), why: 'Footer', footer: { tagline: 'Đẳng cấp và uy tín và chất lượng' } })) as Result
        expect(nav.error?.code).toBe('generic_copy')
    })
})

describe('view "check": filler and made-up content already on the site [TC-AIWB-54]', () => {
    it('names the filler of a section with its path', () => {
        expect(sectionCopyNotes(FEATURES as never)).toEqual([{ path: 'headline', text: '“Vì sao chọn chúng tôi?”', why: expect.stringMatching(/filler/) }])
    })

    it('says which sections show made-up samples (features, faq, stats, pricing, team)', () => {
        expect(sampleText({ blockType: 'features', features: [] })).toMatch(/4 made-up features/)
        expect(sampleText({ blockType: 'stats', stats: [] })).toMatch(/500\+ Happy Customers/)
        expect(sampleText({ blockType: 'faq', faqs: [], items: [] })).toMatch(/questions/)
        expect(sampleText({ blockType: 'pricing', variant: 'minimal', plans: [] })).toBeNull()
        expect(sampleText(FEATURES as never)).toBeNull()
    })
})
