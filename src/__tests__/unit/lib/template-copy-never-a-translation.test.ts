/**
 * TC-AIREL-250 … 256 — template text is never a translation, and what visitors get (review-main-worktree-261022 H1, M2, M4, M6):
 *   251  template-content: isTemplateSlot / withoutTemplateCopies / isTemplateText / templateLocaleOf
 *   252  locale-display: a copy that is template text is no copy (page slot, embedded slot, written language, brand)
 *   253  publish: the translations that go live leave the template copies out
 *   254  the editor store (canvas, getSourceBlock) and the drop-translate / switch rules (ownTextToTranslate, localeSwitchWork)
 *   255  a database error reading the live translations is not cached
 *   256  the language a visitor gets (primary, or the one chosen) and <html lang>
 * (TC-AIREL-250, a new section stores no language copy, lives in f26-05-language-switcher.test.tsx.)
 * Real: template-content.ts, locale-display.ts, publish-translations.ts, page-translations.ts, translate-sections.ts,
 * locale-switch-work.ts, lib/site-languages, the editor store, the add-section templates, the storefront layout.
 * Faked: Payload (getPayload + db.execute), next/cache unstable_cache (stores resolved values only, as Next does),
 * next/headers cookies, the cached tenant/site lookups.
 */

import { PgDialect } from 'drizzle-orm/pg-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveBlockContent } from '@/lib/ai/add-section-content'
import { localeSwitchWork } from '@/lib/i18n/locale-switch-work'
import { localizedBlock, localizedBlockOrNull, localizedSiteAndPage, siteBrand } from '@/lib/i18n/locale-display'
import { isTemplateSlot, isTemplateText, realFields, templateLocaleOf, withoutTemplateCopies } from '@/lib/i18n/template-content'
import { ownTextToTranslate } from '@/lib/i18n/translate-sections'
import { blockTypesOf, publishTranslations } from '@/lib/sites/publish-translations'
import { siteLanguagesOf, VISITOR_LANGUAGE_COOKIE, visitorLanguage } from '@/lib/site-languages'
import { type BlockData, useEditorStore } from '@/store/editorStore'

const state = vi.hoisted(() => ({
    rows: [] as Array<{ slots: unknown }>,
    failures: 0,
    reads: 0,
    cookie: undefined as string | undefined,
    site: null as Record<string, unknown> | null,
}))

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        db: {
            drizzle: {
                execute: vi.fn(async () => {
                    state.reads++
                    if (state.failures > 0) {
                        state.failures--
                        throw new Error('connection reset')
                    }
                    return { rows: state.rows }
                }),
            },
        },
    })),
}))
vi.mock('server-only', () => ({}))
// Next's data cache keeps what the function resolved with; a throw stores nothing
const cached = vi.hoisted(() => new Map<string, unknown>())
vi.mock('next/cache', () => ({
    unstable_cache: (fn: () => Promise<unknown>, keys: string[]) => async () => {
        const key = keys.join('|')
        if (cached.has(key)) return cached.get(key)
        const value = await fn()
        cached.set(key, value)
        return value
    },
}))
vi.mock('next/headers', () => ({
    headers: vi.fn(async () => new Headers()),
    cookies: vi.fn(async () => ({ get: (name: string) => (name === 'pw_lang' && state.cookie ? { value: state.cookie } : undefined) })),
}))
vi.mock('@/lib/cache/tenant', () => ({
    getCachedTenantBySlug: vi.fn(async () => ({ id: 1 })),
    getCachedTenantByDomain: vi.fn(async () => ({ id: 1 })),
    getCachedSiteByTenant: vi.fn(async () => state.site),
}))

const BRAND = 'Kedai Batik'
const HERO_ID = 'hero-1'
const hero = { id: HERO_ID, blockType: 'hero', variant: 'centered', headline: 'Batik for every day', subheadline: 'Hand-made in Kelantan' }
const msTemplate = () => resolveBlockContent('hero', 'ms', BRAND).content
const msReal = { headline: 'Batik setiap hari', subheadline: 'Dibuat dengan tangan di Kelantan' }

beforeEach(() => {
    state.rows = []
    state.failures = 0
    state.reads = 0
    state.cookie = undefined
    state.site = null
    cached.clear()
    useEditorStore.getState().reset()
})

describe('template-content: filler is told from a translation [TC-AIREL-251]', () => {
    it('isTemplateSlot: the template of the language (brand filled in or not), not a translation, not a language without templates', () => {
        expect(isTemplateSlot('hero', 'ms', msTemplate(), BRAND)).toBe(true)
        expect(isTemplateSlot('hero', 'ms', resolveBlockContent('hero', 'ms', 'Your Brand').content, BRAND)).toBe(true)
        expect(isTemplateSlot('hero', 'en', resolveBlockContent('hero', 'en', BRAND).content, BRAND)).toBe(true)
        expect(isTemplateSlot('hero', 'ms', msReal, BRAND)).toBe(false)
        expect(isTemplateSlot('hero', 'vi', msTemplate(), BRAND)).toBe(false)
        expect(isTemplateSlot(undefined, 'ms', msTemplate(), BRAND)).toBe(false)
        expect(isTemplateSlot('hero', 'ms', {}, BRAND)).toBe(false)
        expect(isTemplateSlot('hero', 'ms', null, BRAND)).toBe(false)
    })

    it('isTemplateText: template text in any language; templateLocaleOf: en / ms, other written languages use en', () => {
        expect(isTemplateText('hero', resolveBlockContent('hero', 'en', BRAND).content, BRAND)).toBe(true)
        expect(isTemplateText('hero', msTemplate(), BRAND)).toBe(true)
        expect(isTemplateText('hero', hero, BRAND)).toBe(false)
        expect(templateLocaleOf('ms')).toBe('ms')
        expect(['en', 'vi', undefined, null].map(templateLocaleOf)).toEqual(['en', 'en', 'en', 'en'])
    })

    it('realFields: a translation whole; a mostly-filler copy only by its hand-edited texts; filler alone is nothing', () => {
        expect(realFields('hero', 'ms', msReal, BRAND)).toBe(msReal)
        expect(realFields('hero', 'ms', msTemplate(), BRAND)).toBeUndefined()
        expect(realFields('hero', 'ms', { ...msTemplate(), headline: 'Kedai Saya' }, BRAND)).toEqual({ headline: 'Kedai Saya' })
        expect(realFields('hero', 'ms', {}, BRAND)).toBeUndefined()
        expect(realFields('hero', 'ms', undefined, BRAND)).toBeUndefined()
    })

    it('withoutTemplateCopies drops the filler (a hand edit in a filler copy stays; a section left with nothing disappears)', () => {
        const slots = {
            [HERO_ID]: { ms: msTemplate(), en: { headline: 'Kept' } },
            'faq-1': { ms: { headline: 'Soalan', items: [{ question: 'Hantar ke Sabah?', answer: 'Ya' }] } },
            'other-1': { ms: msTemplate() },
        }

        const kept = withoutTemplateCopies(slots, new Map([[HERO_ID, 'hero'], ['faq-1', 'faq'], ['other-1', 'hero']]), BRAND)

        expect(kept).toEqual({ [HERO_ID]: { en: { headline: 'Kept' } }, 'faq-1': slots['faq-1'] })
        const edited = withoutTemplateCopies({ [HERO_ID]: { ms: { ...msTemplate(), headline: 'Kedai Saya' } } }, new Map([[HERO_ID, 'hero']]), BRAND)
        expect(edited).toEqual({ [HERO_ID]: { ms: { headline: 'Kedai Saya' } } })
    })
})

describe('locale-display: a template-text copy is no copy [TC-AIREL-252]', () => {
    it('keeps the stored text instead of the filler, shows a real translation, and the brand makes the difference', () => {
        expect(localizedBlock(hero, 'ms', { [HERO_ID]: { ms: msTemplate() } }, BRAND)).toBe(hero)
        expect(localizedBlockOrNull(hero, 'ms', { [HERO_ID]: { ms: msTemplate() } }, BRAND)).toBeNull()
        expect(localizedBlock(hero, 'ms', { [HERO_ID]: { ms: msReal } }, BRAND)).toMatchObject(msReal)
        // the filler of a site whose name is "Kedai Batik" is still filler when the caller gives no brand ('Your Brand' text)
        expect(localizedBlockOrNull(hero, 'ms', { [HERO_ID]: { ms: resolveBlockContent('hero', 'ms', 'Your Brand').content } })).toBeNull()
        expect(siteBrand({ name: BRAND })).toBe(BRAND)
        expect(siteBrand({ name: '' })).toBe('Your Brand')
    })

    it('also for the copy a menu or footer carries, and for the written language', () => {
        const nav = { blockType: 'navigation', id: 'nav', _localeContent: { ms: { logoText: 'Kedai' } } }
        const footer = { blockType: 'hero', id: 'f', headline: 'x', _localeContent: { ms: msTemplate() } }

        expect(localizedBlock(nav, 'ms', null, BRAND)).toMatchObject({ logoText: 'Kedai' })
        expect(localizedBlock(footer, 'ms', null, BRAND)).toBe(footer)
        // a hand edit inside a filler copy still shows (only the filler around it does not)
        expect(localizedBlock(hero, 'ms', { [HERO_ID]: { ms: { ...msTemplate(), headline: 'Kedai Saya' } } }, BRAND)).toMatchObject({ headline: 'Kedai Saya', subheadline: hero.subheadline })
        const enTemplate = resolveBlockContent('hero', 'en', BRAND).content
        expect(localizedBlock(hero, 'en', { [HERO_ID]: { en: enTemplate } }, BRAND)).toBe(hero)
    })

    it('localizedSiteAndPage: the page gets no filler on the live path, the real copy of another section still shows', () => {
        const faq = { id: 'faq-1', blockType: 'faq', headline: 'Questions' }
        const slots = { [HERO_ID]: { ms: msTemplate() }, 'faq-1': { ms: { headline: 'Soalan' } } }

        const { page } = localizedSiteAndPage({}, { layout: [hero, faq] }, 'ms', slots, BRAND)

        expect(page?.layout).toEqual([hero, { ...faq, headline: 'Soalan' }])
    })
})

describe('publish: the translations going live are not template text [TC-AIREL-253]', () => {
    it('blockTypesOf maps the section ids of a layout to their types', () => {
        expect(blockTypesOf([{ id: 'a', blockType: 'hero' }, { id: 7, blockType: 'faq' }, { blockType: 'cta' }, null])).toEqual(new Map([['a', 'hero'], ['7', 'faq']]))
        expect(blockTypesOf(undefined)).toEqual(new Map())
    })

    it('writes each live page its translations without the filler copies, and an empty object for a page with none', async () => {
        const statements: Array<{ sql: string; params: unknown[] }> = []
        const run = vi.fn(async (query: Parameters<PgDialect['sqlToQuery']>[0]) => {
            const compiled = new PgDialect().sqlToQuery(query)
            statements.push(compiled)
            return /^\s*select/i.test(compiled.sql)
                ? { rows: [{ id: 11, locale_content: { [HERO_ID]: { ms: msTemplate() }, 'faq-1': { ms: { headline: 'Soalan' } } } }, { id: 12, locale_content: null }] }
                : { rows: [] }
        })

        await publishTranslations(run as never, 5, new Map([[11, new Map([[HERO_ID, 'hero'], ['faq-1', 'faq']])]]), BRAND)

        const updates = statements.filter((s) => /^\s*update/i.test(s.sql))
        expect(updates).toHaveLength(2)
        expect(updates[0]!.sql).toContain('SET published_locale_content')
        expect(updates[0]!.sql).toContain('site_id')
        expect(JSON.parse(String(updates[0]!.params[0]))).toEqual({ 'faq-1': { ms: { headline: 'Soalan' } } })
        expect(updates[0]!.params).toContain(11)
        expect(JSON.parse(String(updates[1]!.params[0]))).toEqual({})
        expect(updates[1]!.params).toContain(5)
    })
})

describe('the editor store and the drop / switch rules [TC-AIREL-254]', () => {
    const open = (written: 'en' | 'ms', active: 'en' | 'ms') => {
        const store = useEditorStore.getState()
        store.init('1', [hero as unknown as BlockData], {}, BRAND)
        store.setGenerationLocale(written)
        store.setSiteLocale(written)
        store.setActiveLocale(active)
    }

    it('the canvas ignores a legacy copy that is template text: the section\'s own text, or the template of the language for untouched filler', () => {
        open('en', 'ms')
        useEditorStore.getState().setLocaleOverride(HERO_ID, 'ms', msTemplate())

        // the copy is filler: the stored hero holds real text ("Batik for every day"), which stays
        const shown = useEditorStore.getState().getDisplayBlock(hero as unknown as BlockData) as unknown as Record<string, unknown>
        expect(shown.headline).toBe('Batik for every day')

        useEditorStore.getState().setLocaleOverride(HERO_ID, 'ms', { ...msReal })
        expect((useEditorStore.getState().getDisplayBlock(hero as unknown as BlockData) as unknown as Record<string, unknown>).headline).toBe('Batik setiap hari')
    })

    it('getSourceBlock: the written language\'s real copy over the section; filler is not a copy', () => {
        open('en', 'en')
        const store = useEditorStore.getState()
        store.setLocaleOverride(HERO_ID, 'en', resolveBlockContent('hero', 'en', BRAND).content)
        expect(store.getSourceBlock(hero as unknown as BlockData)).toMatchObject({ headline: 'Batik for every day' })

        store.setLocaleOverride(HERO_ID, 'en', { headline: 'Written copy' })
        expect(useEditorStore.getState().getSourceBlock(hero as unknown as BlockData)).toMatchObject({ headline: 'Written copy' })
    })

    it('ownTextToTranslate: the merchant\'s text without non-text fields; nothing while it is only template text', () => {
        const skip = new Set(['id', 'blockType', 'variant'])

        expect(ownTextToTranslate(hero, 'hero', skip, BRAND)).toEqual({ headline: hero.headline, subheadline: hero.subheadline })
        expect(ownTextToTranslate({ ...hero, ...resolveBlockContent('hero', 'en', BRAND).content }, 'hero', skip, BRAND)).toBeNull()
        expect(ownTextToTranslate({ id: 'x', blockType: 'hero' }, 'hero', skip, BRAND)).toBeNull()
    })

    it('localeSwitchWork: a copilot-driven switch only re-renders (menu, footer, widgets stay); the merchant\'s switch translates all', () => {
        expect(localeSwitchWork()).toEqual({ menuFooterWidgets: true, sections: true, pageTitles: true })
        expect(localeSwitchWork({ viewOnly: false })).toEqual({ menuFooterWidgets: true, sections: true, pageTitles: true })
        expect(localeSwitchWork({ viewOnly: true })).toEqual({ menuFooterWidgets: true, sections: false, pageTitles: false })
    })
})

describe('live translations: a read error is not cached [TC-AIREL-255]', () => {
    it('a failed read answers none now and is read again by the next visitor; a good read is cached', async () => {
        const { getCachedPublishedTranslations, readPageTranslations } = await import('@/lib/i18n/page-translations')
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        state.rows = [{ slots: { [HERO_ID]: { ms: msReal } } }]
        state.failures = 1

        expect(await getCachedPublishedTranslations('5', 10)).toEqual({})
        expect(await getCachedPublishedTranslations('5', 10)).toEqual({ [HERO_ID]: { ms: msReal } })
        expect(state.reads).toBe(2)
        // now cached: no third read
        expect(await getCachedPublishedTranslations('5', 10)).toEqual({ [HERO_ID]: { ms: msReal } })
        expect(state.reads).toBe(2)
        // the draft read has no cache and also answers none on an error
        state.failures = 1
        expect(await readPageTranslations(10, 'draft')).toEqual({})
        expect(warn).toHaveBeenCalledTimes(2)
        warn.mockRestore()
    })
})

describe('the language a visitor gets [TC-AIREL-256]', () => {
    it('visitorLanguage: the choice when the site has it, else the primary language', () => {
        expect(visitorLanguage(['en', 'ms'], 'ms')).toBe('ms')
        expect(visitorLanguage(['en', 'ms'], 'vi')).toBe('en')
        expect(visitorLanguage(['en'], 'ms')).toBe('en')
        expect(visitorLanguage(['ms', 'en'], undefined)).toBe('ms')
        expect(visitorLanguage(['en', 'ms'], ' ms ')).toBe('ms')
        expect(VISITOR_LANGUAGE_COOKIE).toBe('pw_lang')
    })

    const layoutLang = async () => {
        const { default: StorefrontLayout } = await import('@/app/sites/[slug]/layout')
        const tree = (await StorefrontLayout({ children: null, params: Promise.resolve({ slug: 'kedai' }) })) as { props: { children: Array<{ props: { locale: string | null } }> } }
        return tree.props.children[0]!.props.locale
    }

    it('<html lang> is the published primary language, not the language last viewed in the editor (Sites.locale)', async () => {
        state.site = { generationLocale: 'en', locale: 'ms', headerBlock: { primaryLocale: 'en', secondaryLocale: 'ms' }, pendingHeaderBlock: { primaryLocale: 'ms', secondaryLocale: 'en' } }
        expect(siteLanguagesOf(state.site as never, 'live')).toEqual(['en', 'ms'])

        expect(await layoutLang()).toBe('en')
    })

    it('...or the language the visitor chose in the language switcher, when the site has it', async () => {
        state.site = { generationLocale: 'en', locale: 'en', headerBlock: { primaryLocale: 'en', secondaryLocale: 'ms' } }
        state.cookie = 'ms'
        expect(await layoutLang()).toBe('ms')

        state.cookie = 'vi'
        expect(await layoutLang()).toBe('en')
    })
})
