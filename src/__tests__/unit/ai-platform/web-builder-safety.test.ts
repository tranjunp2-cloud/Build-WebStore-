/**
 * TC-AIWB-11 — what an AI page edit may never write (review fixes, plan 261021):
 * pictures stay as they are, links must be safe, the navigation/footer are not
 * the copilot's, sections need a saved id, and the role needs the builder permission.
 * Real: site-prepare.ts, site-blocks.ts, site-access.ts, the block registry. Faked: the Payload Local API.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentActor } from '@/lib/ai-platform/context'
import type { FakeDb } from './web-builder-fixtures'
import { FOOTER, HERO, LAYOUT, OWNER, PAGE_ID, SITE_ID, page, site } from './web-builder-fixtures'
import { preparePagePatch } from '@/lib/ai-platform/site/site-prepare'
import { carryMedia, isSafeLink, unsafeLinks } from '@/lib/ai-platform/site/site-blocks'

const db = vi.hoisted((): { current: FakeDb } => ({ current: { site: null, page: null, products: [] } }))

vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        findByID: vi.fn(async ({ collection }: { collection: string }) => (collection === 'sites' ? db.current.site : db.current.page)),
        find: vi.fn(async ({ collection }: { collection: string }) => ({ docs: collection === 'products' ? db.current.products : [] })),
    })),
}))

type Result = Record<string, unknown> & { error?: { code: string; message: string }; guardrails?: Array<{ rule: string; ok: boolean; detail: string }>; plan?: { ops: Array<{ fields?: Record<string, unknown> }> } }

const patch = (ops: unknown[], actor: AgentActor = OWNER) =>
    preparePagePatch(actor, { siteId: String(SITE_ID), pageId: String(PAGE_ID), why: 'Refresh the copy', ops }) as Promise<Result>

const HERO_WITH_IMAGE = { ...HERO, image: 12 }

beforeEach(() => {
    db.current = { site: site(), page: page([LAYOUT[0], HERO_WITH_IMAGE, ...LAYOUT.slice(2)]), products: [{ id: '1' }] }
})

describe('pictures are kept as they are [TC-AIWB-11]', () => {
    it('leaves the section picture alone when an edit sends another media id, and says so', async () => {
        const result = await patch([{ op: 'set_fields', blockId: HERO.id, fields: { headline: 'Fresh batik', image: 4711 } }])

        expect(result.error).toBeUndefined()
        expect(result.plan?.ops[0]?.fields).toEqual({ headline: 'Fresh batik' })
        expect(result.guardrails).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'skipped_value', detail: expect.stringContaining("pictures are changed with a picture edit") })]))
    })

    it('keeps list pictures by position and drops pictures the section never had', () => {
        const next = carryMedia([{ title: 'A', image: 99 }, { title: 'B', image: 98 }], [{ title: 'a', image: 1 }])

        expect(next).toEqual([{ title: 'A', image: 1 }, { title: 'B' }])
    })
})

describe('links must be safe [TC-AIWB-11]', () => {
    it.each([
        ['/contact', true], ['#faq', true], ['https://shop.my', true], ['mailto:hi@shop.my', true], ['tel:+60123', true], ['', true],
        ['javascript:alert(1)', false], ['//evil.example', false], ['data:text/html,x', false], ['ftp://x', false],
    ])('isSafeLink(%s) = %s', (url, safe) => {
        expect(isSafeLink(url)).toBe(safe)
    })

    it('finds unsafe links in nested URL-like fields only', () => {
        expect(unsafeLinks({ ctaButtons: [{ label: 'javascript:no', url: 'javascript:alert(1)' }], body: 'javascript: in text' })).toEqual(['javascript:alert(1)'])
    })

    it('leaves out a field holding an unsafe link and says so', async () => {
        const result = await patch([{ op: 'set_fields', blockId: HERO.id, fields: { headline: 'Fresh batik', ctaButtons: [{ label: 'Shop', url: 'javascript:alert(1)', style: 'primary' }] } }])

        expect(result.plan?.ops[0]?.fields).toEqual({ headline: 'Fresh batik' })
        expect(result.guardrails).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'skipped_value', detail: expect.stringContaining('unsafe link') })]))
    })
})

describe('the page frame and saved ids [TC-AIWB-11]', () => {
    it('refuses to edit the footer (shared by every page, edited in the header/footer settings)', async () => {
        const result = await patch([{ op: 'set_fields', blockId: FOOTER.id, fields: { copyrightText: '© New' } }])

        expect(result.error).toMatchObject({ code: 'structural' })
    })

    it('refuses a section without a saved id (undo could not find it again)', async () => {
        db.current.page = page([{ ...HERO, id: 'block-1' }])

        const result = await patch([{ op: 'set_fields', blockId: 'block-1', fields: { headline: 'x' } }])

        expect(result.error).toMatchObject({ code: 'unsaved_section' })
    })
})

describe('the builder permission [TC-AIWB-11]', () => {
    it('refuses a custom role without the builder permission', async () => {
        const staff: AgentActor = {
            ...OWNER,
            role: 'custom',
            user: { ...(OWNER.user as object), tenants: [{ tenant: { id: 1 }, status: 'active', role: 'custom', permissions: ['blog'] }] } as never,
        }

        await expect(patch([{ op: 'set_fields', blockId: HERO.id, fields: { headline: 'x' } }], staff)).rejects.toThrow("can't edit the website")
    })

    it('allows a custom role holding the builder permission', async () => {
        const builder: AgentActor = {
            ...OWNER,
            role: 'custom',
            user: { ...(OWNER.user as object), tenants: [{ tenant: { id: 1 }, status: 'active', role: 'custom', permissions: ['builder'] }] } as never,
        }

        const result = await patch([{ op: 'set_fields', blockId: HERO.id, fields: { headline: 'Fresh batik' } }], builder)

        expect(result.error).toBeUndefined()
    })
})
