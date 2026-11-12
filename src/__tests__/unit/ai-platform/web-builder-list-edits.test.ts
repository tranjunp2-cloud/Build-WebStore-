/**
 * TC-AIWB-49 / 50 — list items and single values: `edit_list` adds, removes and reorders a section's items
 * (cards, buttons, questions) with each item's picture following it; `set_value` changes one text / link
 * anywhere in a section. Prepare and apply run the same checks; the card names items, not indexes.
 * Real: site-prepare.ts, site-patch.ts, site-blocks.ts, the block registry. Faked: the Payload Local API.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FakeDb } from './web-builder-fixtures'
import { FOOTER, HERO, NAV, OWNER, PAGE_ID, SITE_ID, page, site } from './web-builder-fixtures'
import { checkPagePatchOps, preparePagePatch } from '@/lib/ai-platform/site/site-prepare'
import { runPagePatch, type PagePatchOp } from '@/lib/ai-platform/site/site-patch'
import { carryMedia, type PageBlock } from '@/lib/ai-platform/site/site-blocks'

const db = vi.hoisted((): { current: FakeDb } => ({ current: { site: null, page: null, products: [] } }))

vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        findByID: vi.fn(async ({ collection }: { collection: string }) => (collection === 'sites' ? db.current.site : db.current.page)),
        find: vi.fn(async ({ collection }: { collection: string }) => ({ docs: collection === 'products' ? db.current.products : [] })),
    })),
}))

const TEAM_ID = '00000000-0000-4000-8000-0000000000f1'
const TEAM = {
    blockType: 'team',
    id: TEAM_ID,
    variant: 'grid',
    headline: 'Our people',
    members: [
        { id: 'aaaaaaaaaaaaaaaaaaaaaaa1', name: 'Aisyah', role: 'Founder', image: 31 },
        { id: 'aaaaaaaaaaaaaaaaaaaaaaa2', name: 'Ben', role: 'Tailor', image: 32 },
        { id: 'aaaaaaaaaaaaaaaaaaaaaaa3', name: 'Chong', role: 'Shop', image: 33 },
    ],
}
const HERO_ID = HERO.id

type Result = Record<string, unknown> & {
    error?: { code: string; message: string }
    guardrails?: Array<{ rule: string; ok: boolean; detail: string }>
    plan?: { ops: PagePatchOp[] }
    diffs?: Array<{ field: string; before: string | null; after: string }>
}

const patch = (ops: unknown[]) => preparePagePatch(OWNER, { siteId: String(SITE_ID), pageId: String(PAGE_ID), why: 'Tidy the page', ops }) as Promise<Result>
const applied = (result: Result) => runPagePatch(page([NAV, HERO, TEAM, FOOTER]).layout as PageBlock[], result.plan!.ops).next

beforeEach(() => {
    db.current = { site: site(), page: page([NAV, HERO, TEAM, FOOTER]), products: [] }
})

describe('edit_list — add, remove, reorder items with their pictures [TC-AIWB-49]', () => {
    it('reorders and removes members; each kept member keeps its own picture and id', async () => {
        const result = await patch([{ op: 'edit_list', blockId: TEAM_ID, path: 'members', rows: [{ keep: 'aaaaaaaaaaaaaaaaaaaaaaa3' }, { keep: 'aaaaaaaaaaaaaaaaaaaaaaa1', fields: { role: 'Founder & designer' } }] }])

        expect(result.error).toBeUndefined()
        // the plan pins kept items by position (the version guard pins the rows)
        expect(result.plan?.ops).toEqual([{ op: 'edit_list', blockId: TEAM_ID, path: 'members', rows: [{ keep: 2 }, { keep: 0, fields: { role: 'Founder & designer' } }] }])
        const team = applied(result).find((b) => b.id === TEAM_ID) as typeof TEAM
        expect(team.members).toEqual([
            { id: 'aaaaaaaaaaaaaaaaaaaaaaa3', name: 'Chong', role: 'Shop', image: 33 },
            { id: 'aaaaaaaaaaaaaaaaaaaaaaa1', name: 'Aisyah', role: 'Founder & designer', image: 31 },
        ])
    })

    it('names items on the card: removed, changed field by field, and the new order', async () => {
        const result = await patch([{ op: 'edit_list', blockId: TEAM_ID, path: 'members', rows: [{ keep: 'aaaaaaaaaaaaaaaaaaaaaaa3' }, { keep: 'aaaaaaaaaaaaaaaaaaaaaaa1', fields: { role: 'Founder & designer' } }] }])

        const lines = result.diffs!.map((d) => [d.field, d.before, d.after])
        expect(lines).toContainEqual(['Members · “Ben”', 'Ben', 'Removed'])
        expect(lines).toContainEqual(['Members · “Aisyah” · Role', 'Founder', 'Founder & designer'])
        expect(lines).toContainEqual(['Members · order', '“Aisyah” · “Chong”', '“Chong” · “Aisyah”'])
        // [TC-AIWB-62] each line keeps where it is for "Show": a changed field at its new position
        expect(result.diffs!.find((d) => d.field === 'Members · “Aisyah” · Role')).toMatchObject({ path: 'members.1.role' })
        expect(result.diffs!.find((d) => d.field === 'Members · “Ben”')).toMatchObject({ path: 'members' })
    })

    it('adds a new item (no picture yet) and says how to give it one', async () => {
        const result = await patch([{ op: 'edit_list', blockId: TEAM_ID, path: 'members', rows: [{ keep: 0 }, { keep: 1 }, { keep: 2 }, { fields: { name: 'Dina', role: 'Sales' } }] }])

        expect(result.error).toBeUndefined()
        const team = applied(result).find((b) => b.id === TEAM_ID) as typeof TEAM
        expect(team.members[3]).toEqual({ name: 'Dina', role: 'Sales' })
        expect(result.diffs!.map((d) => d.field)).toContain('Members · new item 4 · Name')
        expect(result.guardrails).toContainEqual(expect.objectContaining({ rule: 'skipped_value', detail: expect.stringContaining('set_image path "members.3.image"') }))
    })

    it('never writes pictures, ids or unknown keys of an item, and drops an unsafe link', async () => {
        const result = await patch([{ op: 'edit_list', blockId: HERO_ID, path: 'ctaButtons', rows: [{ keep: 0, fields: { label: 'Buy', image: 99, id: 'x', nope: 1 } }, { fields: { label: 'Call', url: 'javascript:alert(1)' } }] }])

        // the new button lost its unsafe link, so it no longer fits the list (a button needs a link)
        expect(result.error).toMatchObject({ code: 'invalid_section' })
        const ok = await patch([{ op: 'edit_list', blockId: HERO_ID, path: 'ctaButtons', rows: [{ keep: 0, fields: { label: 'Buy', image: 99, id: 'x', nope: 1, url: 'javascript:alert(1)' } }] }])
        expect(ok.plan?.ops).toEqual([{ op: 'edit_list', blockId: HERO_ID, path: 'ctaButtons', rows: [{ keep: 0, fields: { label: 'Buy' } }] }])
        expect(ok.guardrails?.filter((g) => !g.ok).map((g) => g.detail).join(' | ')).toMatch(/no field "image"|pictures are changed/)
        expect(ok.guardrails?.map((g) => g.detail).join(' | ')).toContain('unsafe link')
    })

    it('refuses an unknown or repeated item, a path that is not a list of items, and a second edit of the list', async () => {
        expect((await patch([{ op: 'edit_list', blockId: TEAM_ID, path: 'members', rows: [{ keep: 'nope' }] }])).error).toMatchObject({ code: 'unknown_item' })
        expect((await patch([{ op: 'edit_list', blockId: TEAM_ID, path: 'members', rows: [{ keep: 0 }, { keep: 'aaaaaaaaaaaaaaaaaaaaaaa1' }] }])).error).toMatchObject({ code: 'bad_patch' })
        expect((await patch([{ op: 'edit_list', blockId: TEAM_ID, path: 'headline', rows: [] }])).error).toMatchObject({ code: 'bad_list' })
        expect((await patch([{ op: 'edit_list', blockId: TEAM_ID, path: '__proto__', rows: [] }])).error).toMatchObject({ code: 'bad_list' })
        expect((await patch([
            { op: 'edit_list', blockId: TEAM_ID, path: 'members', rows: [{ keep: 0 }] },
            { op: 'set_fields', blockId: TEAM_ID, fields: { members: [] } },
        ])).error).toMatchObject({ code: 'bad_patch' })
    })

    it('passes the same check again on apply (the stored plan is unchanged)', async () => {
        const result = await patch([{ op: 'edit_list', blockId: TEAM_ID, path: 'members', rows: [{ keep: 'aaaaaaaaaaaaaaaaaaaaaaa2', fields: { name: 'Benjamin' } }] }])
        const layout = page([NAV, HERO, TEAM, FOOTER]).layout as PageBlock[]

        const again = await checkPagePatchOps(OWNER, '1', layout, result.plan!.ops, 'apply')

        expect(again).toEqual({ ops: result.plan!.ops, skipped: [] })
    })
})

describe('set_value — one text or link anywhere in a section [TC-AIWB-50]', () => {
    it('changes one button label and its link, the card naming the button', async () => {
        const result = await patch([
            { op: 'set_value', blockId: HERO_ID, path: 'ctaButtons.0.label', value: 'Shop the sale' },
            { op: 'set_value', blockId: HERO_ID, path: 'ctaButtons.0.url', value: '/sale' },
        ])

        expect(result.error).toBeUndefined()
        const hero = applied(result).find((b) => b.id === HERO_ID) as typeof HERO
        expect(hero.ctaButtons).toEqual([{ label: 'Shop the sale', url: '/sale', style: 'primary' }])
        expect(result.diffs!.map((d) => [d.field, d.before, d.after])).toEqual([
            ['Buttons · “Shop” · Text', 'Shop', 'Shop the sale'],
            ['Buttons · “Shop” · Link', '/shop', '/sale'],
        ])
        // [TC-AIWB-62] the button's own field, for "Show"
        expect(result.diffs!.map((d) => (d as { path?: string }).path)).toEqual(['ctaButtons.0.label', 'ctaButtons.0.url'])
    })

    it('refuses to leave a required field empty — a button without its link would only fail at publish [TC-AIWB-66]', async () => {
        const result = await patch([{ op: 'set_value', blockId: HERO_ID, path: 'ctaButtons.0.url', value: '' }])

        expect(result.error).toMatchObject({ code: 'required_field' })
        expect(result.error?.message).toContain('ctaButtons.0.url is required')
        expect(result.error?.message).toContain('a page path like /contact')
    })

    it('refuses pictures, lists, unknown paths, unsafe links and a value the schema rejects', async () => {
        expect((await patch([{ op: 'set_value', blockId: TEAM_ID, path: 'members.0.image', value: 5 }])).error).toMatchObject({ code: 'bad_picture_field' })
        expect((await patch([{ op: 'set_value', blockId: TEAM_ID, path: 'members', value: 'x' }])).error).toMatchObject({ code: 'bad_path' })
        expect((await patch([{ op: 'set_value', blockId: TEAM_ID, path: 'members.9.name', value: 'x' }])).error).toMatchObject({ code: 'bad_path' })
        expect((await patch([{ op: 'set_value', blockId: HERO_ID, path: 'ctaButtons.0.url', value: 'javascript:alert(1)' }])).error).toMatchObject({ code: 'unsafe_link' })
        expect((await patch([{ op: 'set_value', blockId: HERO_ID, path: 'ctaButtons.0.style', value: 'neon' }])).error).toMatchObject({ code: 'invalid_section' })
        expect((await patch([{ op: 'set_value', blockId: HERO_ID, path: 'ctaButtons.0.constructor', value: 'x' }])).error).toMatchObject({ code: 'bad_path' })
    })

    it('does not mix with a whole-field edit of the same list, nor repeat a path', async () => {
        expect((await patch([
            { op: 'set_value', blockId: HERO_ID, path: 'ctaButtons.0.label', value: 'A' },
            { op: 'set_fields', blockId: HERO_ID, fields: { ctaButtons: [] } },
        ])).error).toMatchObject({ code: 'bad_patch' })
        expect((await patch([
            { op: 'set_value', blockId: HERO_ID, path: 'headline', value: 'A' },
            { op: 'set_value', blockId: HERO_ID, path: 'headline', value: 'B' },
        ])).error).toMatchObject({ code: 'bad_patch' })
    })
})

describe('set_fields on a list with item ids — pictures follow their item [TC-AIWB-49]', () => {
    it('carries each picture by item id, and by position only for items without ids', () => {
        const next = carryMedia(
            [{ id: 'aaaaaaaaaaaaaaaaaaaaaaa3', name: 'Chong' }, { id: 'new', name: 'Dina' }, { name: 'Eve' }],
            TEAM.members,
        )

        expect(next).toEqual([
            { id: 'aaaaaaaaaaaaaaaaaaaaaaa3', name: 'Chong', image: 33 },
            { id: 'new', name: 'Dina' },
            { name: 'Eve', image: 33 },
        ])
        expect(carryMedia([{ name: 'A' }, { name: 'B' }], [{ name: 'x', image: 1 }, { name: 'y', image: 2 }])).toEqual([{ name: 'A', image: 1 }, { name: 'B', image: 2 }])
    })
})
