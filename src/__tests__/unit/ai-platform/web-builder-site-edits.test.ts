/**
 * TC-AICP-292 / 294 / 295 — a plan read back from the AI platform's jsonb column (keys in another order) still applies.
 * TC-AIWB-05 / 07 / 39 — the applier writes an approved page or theme change into the DRAFT under the tenant lock,
 * guarded by the fingerprints it was drafted from; undo puts it back and refuses once the content moved on.
 * Real: site-edits.ts, site-patch.ts, site-prepare.ts (themeFingerprint), block normalisation.
 * Faked: Payload Local API (in memory), the tenant row lock (runs the callback; raw SQL answered from `state.localeContent`),
 * plan gate, media cleanup.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangeSetApplyError } from '@/lib/ai-platform/appliers/errors'
import { applySitePagePatch, applySitePageRestore, applySiteThemePatch, applySiteThemeRestore } from '@/lib/ai-platform/appliers/site-edits'
import { undoVerdict } from '@/lib/ai-platform/appliers/site-undo-verdict'
import { draftPageEdit, themeFingerprint } from '@/lib/ai-platform/site/site-prepare'
import { blockHash } from '@/lib/ai-platform/site/site-blocks'
import { FAQ, FOOTER, HERO, LAYOUT, NAV, OWNER, PAGE_ID, PRODUCTS, SITE_ID, jsonbOrder, page, site } from './web-builder-fixtures'

const state = vi.hoisted(() => ({
    site: null as Record<string, unknown> | null,
    page: null as Record<string, unknown> | null,
    updates: [] as Array<{ collection: string; data: Record<string, unknown> }>,
    subscription: { plan: 'PROFESSIONAL' } as null | { plan: string },
    /** pages.locale_content + the site's base language, as the raw SQL reads them (null = no row) */
    localeContent: null as Record<string, unknown> | null,
    baseLocale: 'ms',
    localeWrites: [] as Array<Record<string, unknown>>,
    /** editor_revision statements the appliers ran */
    revisionSql: [] as string[],
    /** store product ids of the workspace */
    storeProducts: ['1'] as string[],
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        findByID: vi.fn(async ({ collection }: { collection: string }) => {
            if (collection === 'sites') return state.site
            return state.page
        }),
        // the store's products (a product section may only show these)
        find: vi.fn(async ({ collection }: { collection: string }) =>
            collection === 'products' ? { docs: state.storeProducts.map((id) => ({ id })) } : { docs: [] }),
        update: vi.fn(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
            state.updates.push({ collection, data })
            if (collection === 'pages') state.page = { ...state.page!, layout: data.layout }
            if (collection === 'sites') state.site = { ...state.site!, theme: data.theme }
            return {}
        }),
    })),
}))
vi.mock('@/lib/payload/tenant-row-lock', () => ({
    withTenantRowLock: vi.fn(async (_cms: unknown, _tenant: unknown, operation: (req: { transactionID: string }) => Promise<unknown>) => operation({ transactionID: 'tx' })),
    lockTenantSiteRows: vi.fn(async () => undefined),
    executeTenantTransaction: vi.fn(async (_cms: unknown, _req: unknown, query: unknown) => {
        const { PgDialect } = await import('drizzle-orm/pg-core')
        const rendered = new PgDialect().sqlToQuery(query as Parameters<PgDialect['sqlToQuery']>[0])
        if (/editor_revision/.test(rendered.sql)) {
            state.revisionSql.push(rendered.sql)
            return { rows: [] }
        }
        if (/^\s*select/i.test(rendered.sql)) return { rows: state.localeContent ? [{ locale_content: state.localeContent, base: state.baseLocale }] : [] }
        const written = JSON.parse(String(rendered.params[0])) as Record<string, unknown>
        state.localeWrites.push(written)
        state.localeContent = written
        return { rows: [] }
    }),
}))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(async () => state.subscription),
    canUse: vi.fn(async () => true),
}))
vi.mock('@/lib/ai/media-injector', () => ({ stripOrphanMediaRefs: vi.fn(async () => undefined) }))

const CHANGED = 'This page changed after the assistant drafted the edit. Ask again so it starts from the latest version.'

function planFor(ops: unknown[], expect: Record<string, string>) {
    return { siteId: String(SITE_ID), pageId: String(PAGE_ID), ops, expect }
}

beforeEach(() => {
    state.site = site()
    state.page = page(structuredClone(LAYOUT))
    state.updates = []
    state.subscription = { plan: 'PROFESSIONAL' }
    state.localeContent = null
    state.baseLocale = 'ms'
    state.localeWrites = []
    state.revisionSql = []
    state.storeProducts = ['1']
})

describe('applySitePagePatch — the version guard and the draft write [TC-AIWB-05]', () => {
    it('writes the edit into the page draft and returns the undo record', async () => {
        const drafted = { [HERO.id]: blockHash(HERO) }

        const result = await applySitePagePatch(planFor([{ op: 'set_fields', blockId: '00000000-0000-4000-8000-0000000000b1', fields: { headline: 'Fresh batik' } }], drafted), OWNER)

        const write = state.updates.find((u) => u.collection === 'pages')!
        const layout = write.data.layout as Array<Record<string, unknown>>
        expect(layout.find((b) => b.id === '00000000-0000-4000-8000-0000000000b1')).toMatchObject({ headline: 'Fresh batik' })
        expect(result.undo).toMatchObject({ kind: 'site.page_restore', payload: { siteId: String(SITE_ID), pageId: String(PAGE_ID) } })
        expect(result.entities).toEqual([{ kind: 'site_page', id: String(PAGE_ID) }])
    })

    it('refuses with 409 and writes nothing when a touched section changed since it was drafted', async () => {
        const drafted = { '00000000-0000-4000-8000-0000000000b1': blockHash(HERO) }
        state.page = page(LAYOUT.map((b) => (b.id === '00000000-0000-4000-8000-0000000000b1' ? { ...b, headline: 'The merchant just edited this' } : b)))

        const failure = await applySitePagePatch(planFor([{ op: 'set_fields', blockId: '00000000-0000-4000-8000-0000000000b1', fields: { headline: 'Fresh batik' } }], drafted), OWNER).catch((e: unknown) => e)

        expect(failure).toBeInstanceOf(ChangeSetApplyError)
        expect(failure).toMatchObject({ status: 409, message: CHANGED })
        expect(state.updates.filter((u) => u.collection === 'pages')).toHaveLength(0)
    })

    it('refuses a page of another site with 409 before writing', async () => {
        state.page = page(LAYOUT, { site: 99 })

        await expect(applySitePagePatch(planFor([{ op: 'set_fields', blockId: '00000000-0000-4000-8000-0000000000b1', fields: { headline: 'x' } }], {}), OWNER)).rejects.toMatchObject({ status: 409 })
        expect(state.updates).toHaveLength(0)
    })

    it('refuses with 403 when the workspace plan no longer includes the website builder', async () => {
        state.subscription = null

        await expect(applySitePagePatch(planFor([{ op: 'set_fields', blockId: '00000000-0000-4000-8000-0000000000b1', fields: { headline: 'x' } }], {}), OWNER)).rejects.toMatchObject({ status: 403 })
        expect(state.updates).toHaveLength(0)
    })

    it('restores an undone page only if the touched sections still match (409 otherwise)', async () => {
        const applied = await applySitePagePatch(planFor([{ op: 'set_fields', blockId: '00000000-0000-4000-8000-0000000000b1', fields: { headline: 'Fresh batik' } }], { '00000000-0000-4000-8000-0000000000b1': blockHash(HERO) }), OWNER)
        const restore = (applied.undo!.payload as { restore: unknown[] }).restore

        state.page = page(((state.page!.layout as Array<Record<string, unknown>>)).map((b) => (b.id === '00000000-0000-4000-8000-0000000000b1' ? { ...b, headline: 'Edited since' } : b)))
        await expect(applySitePageRestore({ siteId: String(SITE_ID), pageId: String(PAGE_ID), restore }, OWNER)).rejects.toMatchObject({ status: 409 })
    })

    it('undoes an applied edit and puts the page draft back exactly', async () => {
        const applied = await applySitePagePatch(planFor([{ op: 'set_fields', blockId: '00000000-0000-4000-8000-0000000000b1', fields: { headline: 'Fresh batik' } }], { '00000000-0000-4000-8000-0000000000b1': blockHash(HERO) }), OWNER)
        const restore = (applied.undo!.payload as { restore: unknown[] }).restore

        await applySitePageRestore({ siteId: String(SITE_ID), pageId: String(PAGE_ID), restore }, OWNER)

        const layout = state.updates.filter((u) => u.collection === 'pages').at(-1)!.data.layout as Array<Record<string, unknown>>
        expect(layout.find((b) => b.id === '00000000-0000-4000-8000-0000000000b1')).toMatchObject({ headline: HERO.headline })
        expect(layout.map((b) => b.id)).toEqual(['00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000e1'])
    })
})

describe('the editor base-language copy follows a copilot edit [TC-AIWB-39]', () => {
    const heroId = '00000000-0000-4000-8000-0000000000b1'

    it('writes the edited field into the base-language slot and undo puts it back', async () => {
        state.localeContent = { [heroId]: { ms: { headline: HERO.headline }, en: { headline: 'Welcome' } } }

        const applied = await applySitePagePatch(planFor([{ op: 'set_fields', blockId: heroId, fields: { headline: 'Fresh batik' } }], { [heroId]: blockHash(HERO) }), OWNER)

        expect(state.localeContent).toEqual({ [heroId]: { ms: { headline: 'Fresh batik' }, en: { headline: 'Welcome' } } })
        const restore = (applied.undo!.payload as { restore: unknown[] }).restore
        await applySitePageRestore({ siteId: String(SITE_ID), pageId: String(PAGE_ID), restore }, OWNER)
        expect(state.localeContent).toEqual({ [heroId]: { ms: { headline: HERO.headline }, en: { headline: 'Welcome' } } })
    })

    it('bumps the page draft revision, so an editor tab holding the older draft cannot save over it [TC-AIWB-41]', async () => {
        await applySitePagePatch(planFor([{ op: 'set_fields', blockId: heroId, fields: { headline: 'Fresh batik' } }], { [heroId]: blockHash(HERO) }), OWNER)

        expect(state.revisionSql.some((q) => /UPDATE pages SET editor_revision = editor_revision \+ 1/.test(q))).toBe(true)
    })

    it('writes nothing when the page has no base-language copy of the edited field', async () => {
        state.localeContent = { [heroId]: { en: { headline: 'Welcome' } } }

        await applySitePagePatch(planFor([{ op: 'set_fields', blockId: heroId, fields: { headline: 'Fresh batik' } }], { [heroId]: blockHash(HERO) }), OWNER)

        expect(state.localeWrites).toHaveLength(0)
    })
})

describe('a stored plan can no longer bring Product Master products into the store [TC-AIREL-71]', () => {
    const productsId = '00000000-0000-4000-8000-0000000000d1'

    it('refuses a pm:<id> product ref and an addToStore list: closed, nothing written', async () => {
        const plan = {
            ...planFor([{ op: 'set_fields', blockId: productsId, fields: { selectedProductIds: ['1', 'pm:prod_scarf'] } }], { [productsId]: blockHash(PRODUCTS) }),
            addToStore: [{ id: 'prod_scarf', title: 'Batik silk scarf' }],
        }

        const failure = await applySitePagePatch(plan, OWNER).catch((e: unknown) => e)

        expect(failure).toBeInstanceOf(ChangeSetApplyError)
        expect(failure).toMatchObject({ status: 422, final: true, message: expect.stringContaining('pm:prod_scarf') })
        expect(state.updates.filter((u) => u.collection === 'pages')).toHaveLength(0)
    })

    it('still applies a product section edit that shows only products of this store', async () => {
        const plan = planFor([{ op: 'set_fields', blockId: productsId, fields: { selectedProductIds: ['1'] } }], { [productsId]: blockHash(PRODUCTS) })

        const result = await applySitePagePatch(plan, OWNER)

        const layout = state.updates.find((u) => u.collection === 'pages')!.data.layout as Array<Record<string, unknown>>
        expect(layout.find((b) => b.id === productsId)!.selectedProductIds).toEqual(['1'])
        expect(result.entities).toEqual([{ kind: 'site_page', id: String(PAGE_ID) }])
    })
})

describe('theme changes — the fingerprint guard [TC-AIWB-07]', () => {
    it('applies a theme change when the touched keys are as drafted', async () => {
        const base = themeFingerprint(state.site!.theme, ['primaryColor'])

        const result = await applySiteThemePatch({ siteId: String(SITE_ID), base, changes: { primaryColor: '#f97316' } }, OWNER)

        expect(state.updates.find((u) => u.collection === 'sites')!.data.theme).toMatchObject({ primaryColor: '#f97316' })
        expect(result.undo).toMatchObject({ kind: 'site.theme_restore', payload: { siteId: String(SITE_ID), changes: { primaryColor: '#0ea5e9' } } })
    })

    it('refuses with 409 when the theme was edited after the assistant drafted the change', async () => {
        const base = themeFingerprint(state.site!.theme, ['primaryColor'])
        state.site = site({ theme: { primaryColor: '#111111', colorMode: 'light' } })

        const failure = await applySiteThemePatch({ siteId: String(SITE_ID), base, changes: { primaryColor: '#f97316' } }, OWNER).catch((e: unknown) => e)

        expect(failure).toMatchObject({ status: 409, message: expect.stringContaining('The theme changed after the assistant drafted this') })
        expect(state.updates.filter((u) => u.collection === 'sites')).toHaveLength(0)
    })

    it('restores the previous colour through the theme undo, unless the theme changed since', async () => {
        const base = themeFingerprint(state.site!.theme, ['primaryColor'])
        const applied = await applySiteThemePatch({ siteId: String(SITE_ID), base, changes: { primaryColor: '#f97316' } }, OWNER)
        const undo = applied.undo!.payload as { base: string; changes: Record<string, unknown> }

        await applySiteThemeRestore({ siteId: String(SITE_ID), base: undo.base, changes: undo.changes }, OWNER)

        expect(state.site!.theme).toMatchObject({ primaryColor: '#0ea5e9' })
    })

    it('refuses the theme undo when a key was changed again after the change', async () => {
        const base = themeFingerprint(state.site!.theme, ['primaryColor'])
        const applied = await applySiteThemePatch({ siteId: String(SITE_ID), base, changes: { primaryColor: '#f97316' } }, OWNER)
        const undo = applied.undo!.payload as { base: string; changes: Record<string, unknown> }
        state.site = site({ theme: { ...(state.site!.theme as object), primaryColor: '#222222' } })

        await expect(applySiteThemeRestore({ siteId: String(SITE_ID), base: undo.base, changes: undo.changes }, OWNER)).rejects.toMatchObject({ status: 409 })
    })
})

describe('Undo is idempotent and says what blocks it [TC-AIREL-303]', () => {
    const HERO_ID = '00000000-0000-4000-8000-0000000000b1'
    async function appliedHeroEdit() {
        const applied = await applySitePagePatch(planFor([{ op: 'set_fields', blockId: HERO_ID, fields: { headline: 'Fresh batik' } }], { [HERO_ID]: blockHash(HERO) }), OWNER)
        return (applied.undo!.payload as { restore: unknown[] }).restore
    }
    const pageWrites = () => state.updates.filter((u) => u.collection === 'pages').length

    it('a second Undo of the same change is a success that writes nothing', async () => {
        const restore = await appliedHeroEdit()
        await applySitePageRestore({ siteId: String(SITE_ID), pageId: String(PAGE_ID), restore }, OWNER)
        const writesAfterFirst = pageWrites()

        const second = await applySitePageRestore({ siteId: String(SITE_ID), pageId: String(PAGE_ID), restore }, OWNER)

        expect(second.entities).toEqual([{ kind: 'site_page', id: String(PAGE_ID) }])
        expect(pageWrites()).toBe(writesAfterFirst)
    })

    it('a change the merchant already took back in the editor is as undone: success, nothing written', async () => {
        const restore = await appliedHeroEdit()
        const writes = pageWrites()
        state.page = page(structuredClone(LAYOUT))

        await expect(applySitePageRestore({ siteId: String(SITE_ID), pageId: String(PAGE_ID), restore }, OWNER)).resolves.toBeDefined()
        expect(pageWrites()).toBe(writes)
    })

    it('a section edited by hand since is refused by name, with where to undo it (409)', async () => {
        const restore = await appliedHeroEdit()
        state.page = page((state.page!.layout as Array<Record<string, unknown>>).map((b) => (b.id === HERO_ID ? { ...b, headline: 'Typed by hand' } : b)))

        const failure = await applySitePageRestore({ siteId: String(SITE_ID), pageId: String(PAGE_ID), restore }, OWNER).catch((e: unknown) => e)

        expect(failure).toMatchObject({ status: 409, message: expect.stringMatching(/section was edited after the assistant changed it.*Undo it in the editor/) })
        expect(String((failure as Error).message)).not.toMatch(/Ask again/)
    })

    it('a theme change already put back is as undone; a theme edited since is refused without "ask again"', async () => {
        const base = themeFingerprint(state.site!.theme, ['primaryColor'])
        const applied = await applySiteThemePatch({ siteId: String(SITE_ID), base, changes: { primaryColor: '#f97316' } }, OWNER)
        const undo = applied.undo!.payload as { base: string; changes: Record<string, unknown> }
        await applySiteThemeRestore({ siteId: String(SITE_ID), base: undo.base, changes: undo.changes }, OWNER)
        const writes = state.updates.filter((u) => u.collection === 'sites').length

        await expect(applySiteThemeRestore({ siteId: String(SITE_ID), base: undo.base, changes: undo.changes }, OWNER)).resolves.toBeDefined()
        expect(state.updates.filter((u) => u.collection === 'sites')).toHaveLength(writes)

        state.site = site({ theme: { ...(state.site!.theme as object), primaryColor: '#222222' } })
        const failure = await applySiteThemeRestore({ siteId: String(SITE_ID), base: undo.base, changes: undo.changes }, OWNER).catch((e: unknown) => e)
        expect(failure).toMatchObject({ status: 409, message: expect.stringContaining('Change them back in Theme settings') })
        expect(String((failure as Error).message)).not.toMatch(/Ask again/)
    })
})

describe('undoVerdict — where an applied change stands against the draft now [TC-AIREL-312]', () => {
    const HERO_ID = '00000000-0000-4000-8000-0000000000b1'
    const heroEdit = () => applySitePagePatch(planFor([{ op: 'set_fields', blockId: HERO_ID, fields: { headline: 'Fresh batik' } }], { [HERO_ID]: blockHash(HERO) }), OWNER)
    const withHero = (patch: Record<string, unknown>) => page((state.page!.layout as Array<Record<string, unknown>>).map((b) => (b.id === HERO_ID ? { ...b, ...patch } : b)))

    it('page: applied while the section is as the change left it, reverted once it is back, diverged once edited', async () => {
        const applied = await heroEdit()

        await expect(undoVerdict(applied.undo!, OWNER)).resolves.toBe('applied')

        const afterEdit = state.page
        state.page = page(structuredClone(LAYOUT))
        await expect(undoVerdict(applied.undo!, OWNER)).resolves.toBe('reverted')

        state.page = afterEdit
        state.page = withHero({ headline: 'Typed by hand' })
        await expect(undoVerdict(applied.undo!, OWNER)).resolves.toBe('diverged')
    })

    it('page: a vanished page is diverged, never an error', async () => {
        const applied = await heroEdit()
        state.page = page(LAYOUT, { site: 99 })

        await expect(undoVerdict(applied.undo!, OWNER)).resolves.toBe('diverged')
    })

    it('page: a moved section is reverted only when it is back in its place', async () => {
        const MOVED = '00000000-0000-4000-8000-0000000000d1'
        const applied = await applySitePagePatch(planFor([{ op: 'move_block', blockId: MOVED, afterBlockId: '00000000-0000-4000-8000-0000000000a1' }], { [MOVED]: blockHash(LAYOUT.find((b) => b.id === MOVED)) }), OWNER)

        await expect(undoVerdict(applied.undo!, OWNER)).resolves.toBe('applied')
        state.page = page(structuredClone(LAYOUT))
        await expect(undoVerdict(applied.undo!, OWNER)).resolves.toBe('reverted')
    })

    it('theme: applied, reverted, diverged by the touched keys', async () => {
        const original = state.site!.theme
        const applied = await applySiteThemePatch({ siteId: String(SITE_ID), base: themeFingerprint(original, ['primaryColor']), changes: { primaryColor: '#f97316' } }, OWNER)

        await expect(undoVerdict(applied.undo!, OWNER)).resolves.toBe('applied')
        state.site = site({ theme: original })
        await expect(undoVerdict(applied.undo!, OWNER)).resolves.toBe('reverted')
        state.site = site({ theme: { ...(original as object), primaryColor: '#222222' } })
        await expect(undoVerdict(applied.undo!, OWNER)).resolves.toBe('diverged')
    })

    it('a kind it does not cover is unknown, and it writes nothing', async () => {
        await expect(undoVerdict({ kind: 'blog.restore_fields', payload: {} }, OWNER)).resolves.toBe('unknown')
        expect(state.updates).toHaveLength(0)
    })
})

describe('untouched sections [TC-AIWB-06]', () => {
    it('keeps a section the patch did not touch exactly as it was', async () => {
        await applySitePagePatch(planFor([{ op: 'set_fields', blockId: '00000000-0000-4000-8000-0000000000b1', fields: { headline: 'Fresh batik' } }], { '00000000-0000-4000-8000-0000000000b1': blockHash(HERO) }), OWNER)

        const layout = state.updates.find((u) => u.collection === 'pages')!.data.layout as Array<Record<string, unknown>>
        expect(layout.find((b) => b.id === '00000000-0000-4000-8000-0000000000c1')).toMatchObject({ headline: FAQ.headline, variant: FAQ.variant })
        expect(layout.find((b) => b.id === '00000000-0000-4000-8000-0000000000d1')).toMatchObject({ headline: PRODUCTS.headline })
        expect(layout.find((b) => b.id === '00000000-0000-4000-8000-0000000000e1')).toMatchObject({ copyrightText: FOOTER.copyrightText })
        expect(layout.find((b) => b.id === '00000000-0000-4000-8000-0000000000a1')).toMatchObject({ logoText: NAV.logoText })
    })
})

describe('a plan read back from the platform applies though its keys came back in another order [TC-AICP-292]', () => {
    const BANNER = {
        blockType: 'announcement-bar',
        variant: 'gradient',
        message: 'Weekend promo: 10% off store-wide with code WEEKEND10 until Sunday, 25 October 2026.',
        showLink: true,
        linkText: 'View the menu',
        linkUrl: '/menu',
        linkIsInternal: true,
        dismissible: true,
        isVisible: true,
    }

    /** The plan the way prepare stores it, then the way the platform returns it (jsonb key order). */
    async function storedPlan(ops: unknown[]) {
        const drafted = await draftPageEdit(OWNER, '1', state.page as never, ops as never, true)
        if ('error' in drafted) throw new Error(drafted.error.message)
        return jsonbOrder(JSON.parse(JSON.stringify({ siteId: String(SITE_ID), pageId: String(PAGE_ID), ops: drafted.ops, expect: drafted.expect })))
    }

    it('inserts the announcement banner after the hero (the campaign banner that answered 422)', async () => {
        const plan = await storedPlan([{ op: 'insert_block', afterBlockId: HERO.id, block: BANNER }])
        // the stored op really is in another key order than the checks build it
        expect(Object.keys(plan.ops[0]!)).toEqual(['op', 'block', 'afterBlockId'])

        await applySitePagePatch(plan, OWNER)

        const layout = state.updates.find((u) => u.collection === 'pages')!.data.layout as Array<Record<string, unknown>>
        expect(layout.map((b) => b.blockType)).toEqual(['navigation', 'hero', 'announcement-bar', 'faq', 'products-grid', 'footer'])
        expect(layout[2]).toMatchObject({ message: BANNER.message, linkUrl: '/menu', variant: 'gradient' })
    })

    it('still sets several fields of a section when the plan comes back in jsonb key order (control: set_fields reads its keys from the stored plan) [TC-AICP-294]', async () => {
        const plan = await storedPlan([{ op: 'set_fields', blockId: HERO.id, fields: { subheadline: 'Hand-made, ready to ship', headline: 'Fresh batik' } }])
        expect(Object.keys((plan.ops[0] as { fields: object }).fields)).toEqual(['headline', 'subheadline'])

        await applySitePagePatch(plan, OWNER)

        const layout = state.updates.find((u) => u.collection === 'pages')!.data.layout as Array<Record<string, unknown>>
        expect(layout.find((b) => b.id === HERO.id)).toMatchObject({ headline: 'Fresh batik', subheadline: 'Hand-made, ready to ship' })
    })

    it('still refuses a plan whose content differs from what the checks give: key order is ignored, data is not [TC-AICP-295]', async () => {
        const plan = await storedPlan([{ op: 'insert_block', afterBlockId: HERO.id, block: BANNER }])
        const tampered = jsonbOrder({ ...plan, ops: [{ ...plan.ops[0], block: { ...(plan.ops[0] as { block: object }).block, notAField: 'x' } }] })

        await expect(applySitePagePatch(tampered, OWNER)).rejects.toMatchObject({ status: 422, final: true, message: expect.stringContaining('no longer passes') })
        expect(state.updates.filter((u) => u.collection === 'pages')).toHaveLength(0)
    })
})
