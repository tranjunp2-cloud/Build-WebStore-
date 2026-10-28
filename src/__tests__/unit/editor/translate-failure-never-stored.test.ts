/**
 * TC-AIREL-241..244 — a failed translation is never stored as a translation, and a page is never turned into
 * template filler by a language switch. Real: request-translation.ts, translate-sections.ts, template-content.ts,
 * the editor store (getDisplayBlock / getSourceBlock / setLocaleOverride), the add-section template content.
 * Faked: fetch (the /api/ai/translate route).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { requestTranslation } from '@/lib/i18n/request-translation'
import { translateSectionsIntoSlots } from '@/lib/i18n/translate-sections'
import { isTemplateCopy, templatePatch } from '@/lib/i18n/template-content'
import { type BlockData, useEditorStore } from '@/store/editorStore'

const fetchMock = vi.fn()
const json = (body: unknown, status = 200) => Response.json(body, { status })
const REQUEST = { blockType: 'hero-1', targetLocale: 'en', content: { headline: 'Kopi O' } }

const MALAY_HERO = { id: 'hero-1', blockType: 'hero', variant: 'centered', headline: 'Kopi Kampung Kedai — Kopi O', subheadline: 'Kedai kopi kampung di Kuala Lumpur' } as unknown as BlockData
const MALAY_FEATURES = { id: 'feat-1', blockType: 'features', variant: 'grid', headline: 'Ciri-ciri Perkhidmatan' } as unknown as BlockData

function openMalaySite() {
    const store = useEditorStore.getState()
    store.init('1', [MALAY_HERO, MALAY_FEATURES], {}, 'Kopi Kampung Kedai')
    store.setGenerationLocale('ms')
    store.setSiteLocale('ms')
    store.setActiveLocale('ms')
}

beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    useEditorStore.getState().reset()
})
afterEach(() => vi.unstubAllGlobals())

describe('requestTranslation — only a real translation is a result [TC-AIREL-241]', () => {
    it('returns the translated content of a 200 answer', async () => {
        fetchMock.mockResolvedValueOnce(json({ translated: { headline: 'Coffee' }, cached: false }))

        expect(await requestTranslation(REQUEST)).toEqual({ ok: true, translated: { headline: 'Coffee' } })
    })

    it.each([
        ['a 502 from the route', () => json({ ok: false, status: 'fallback', error: 'down' }, 502)],
        ['a 503 from the route', () => json({ ok: false, status: 'fallback', error: 'off' }, 503)],
        ['a 200 that says ok:false', () => json({ ok: false, translated: { headline: 'Kopi O' } })],
        ['a legacy 200 fallback carrying the original text', () => json({ translated: { headline: 'Kopi O' }, status: 'fallback' })],
        ['a 200 with no translated object', () => json({ cached: false })],
        ['a 200 with an empty translated object', () => json({ translated: {} })],
        ['a non-object body', () => json({ translated: 'Kopi O' })],
    ])('is a failure for %s', async (_name, reply) => {
        fetchMock.mockResolvedValueOnce(reply())

        expect(await requestTranslation(REQUEST)).toEqual({ ok: false, reason: 'unavailable' })
    })

    it('tells a quota answer apart (429) and a network error from a result', async () => {
        fetchMock.mockResolvedValueOnce(json({ error: 'limit' }, 429))
        expect(await requestTranslation(REQUEST)).toEqual({ ok: false, reason: 'rate_limited' })

        fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
        expect(await requestTranslation(REQUEST)).toEqual({ ok: false, reason: 'unavailable' })
    })

    it('a superseded switch is aborted, not a failure', async () => {
        const controller = new AbortController()
        fetchMock.mockImplementationOnce(async () => {
            controller.abort()
            return json({ translated: { headline: 'Coffee' } })
        })

        expect(await requestTranslation({ ...REQUEST, signal: controller.signal })).toEqual({ ok: false, reason: 'aborted' })
    })
})

describe('translateSectionsIntoSlots — the slot is written only by a real translation [TC-AIREL-242]', () => {
    const skipFields = new Set(['id', 'blockType', 'variant'])
    const run = (signal = new AbortController().signal) => {
        const store = useEditorStore.getState()
        return translateSectionsIntoSlots(store.blocks, 'en', {
            getSourceBlock: (block) => useEditorStore.getState().getSourceBlock(block),
            getSlot: (id) => useEditorStore.getState().localeOverrides[id]?.en,
            setSlot: (id, translated) => {
                useEditorStore.getState().setLocaleOverride(id, 'en', translated)
                return useEditorStore.getState().localeOverrides[id]?.en
            },
            skipFields,
            signal,
        })
    }

    it('platform down: every section fails, no slot is written, the notice count is the sections', async () => {
        openMalaySite()
        fetchMock.mockImplementation(async () => json({ ok: false, status: 'fallback', error: 'The AI service is unavailable right now.' }, 502))

        const result = await run()

        expect(result).toEqual({ written: {}, failed: 2 })
        expect(useEditorStore.getState().localeOverrides['hero-1']?.en ?? {}).toEqual({})
        expect(useEditorStore.getState().localeOverrides['feat-1']?.en ?? {}).toEqual({})
    })

    it('an old route answering 200 + the original text is still not stored', async () => {
        openMalaySite()
        fetchMock.mockImplementation(async (_url: string, init: { body: string }) => json({ translated: JSON.parse(init.body).content, status: 'fallback' }))

        const result = await run()

        expect(result.failed).toBe(2)
        expect(useEditorStore.getState().localeOverrides['hero-1']?.en ?? {}).toEqual({})
    })

    it('translates from the written language: the base copy, not the stored section (which may hold filler)', async () => {
        openMalaySite()
        // the layout was saved as shown in English with template filler; the Malay text lives in the ms copy
        const store = useEditorStore.getState()
        store.updateBlock(0, { headline: 'Welcome to Kopi Kampung Kedai' })
        store.setLocaleOverride('hero-1', 'ms', { headline: 'Kopi Kampung Kedai — Kopi O' })
        fetchMock.mockImplementation(async (_url: string, init: { body: string }) => {
            const { content } = JSON.parse(init.body) as { content: Record<string, unknown> }
            return json({ translated: { ...content, headline: `EN ${String(content.headline)}` }, cached: false })
        })

        const result = await run()

        expect(result.failed).toBe(0)
        const sent = fetchMock.mock.calls.map(([, init]) => JSON.parse((init as { body: string }).body))
        const hero = sent.find((body) => body.blockType === 'hero-hero-1')
        expect(hero.content.headline).toBe('Kopi Kampung Kedai — Kopi O')
        expect(useEditorStore.getState().localeOverrides['hero-1']?.en?.headline).toBe('EN Kopi Kampung Kedai — Kopi O')
    })

    it('a section that already has a copy is not asked again', async () => {
        openMalaySite()
        useEditorStore.getState().setLocaleOverride('hero-1', 'en', { headline: 'Kopi O' })
        fetchMock.mockImplementation(async () => json({ translated: { headline: 'Features' } }))

        const result = await run()

        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(Object.keys(result.written)).toEqual(['feat-1'])
    })

    it('a superseded switch writes nothing and counts no failure', async () => {
        openMalaySite()
        const controller = new AbortController()
        fetchMock.mockImplementation(async () => {
            controller.abort()
            return json({ translated: { headline: 'Coffee' } })
        })

        expect(await run(controller.signal)).toEqual({ written: {}, failed: 0 })
        expect(useEditorStore.getState().localeOverrides['hero-1']?.en ?? {}).toEqual({})
    })
})

describe('getDisplayBlock / getSourceBlock — a language with no copy yet [TC-AIREL-243]', () => {
    it('a saved section keeps the merchant\'s own text in a language with no copy (no template filler is saved)', () => {
        openMalaySite()
        useEditorStore.getState().setActiveLocale('en')

        const shown = useEditorStore.getState().getDisplayBlocks() as Array<Record<string, unknown>>

        expect(shown[0]!.headline).toBe('Kopi Kampung Kedai — Kopi O')
        expect(shown[0]!.subheadline).toBe('Kedai kopi kampung di Kuala Lumpur')
        expect(shown[1]!.headline).toBe('Ciri-ciri Perkhidmatan')
    })

    it('a field that still holds untouched template text takes the template of the language', () => {
        openMalaySite()
        const welcome = { id: 'hero-2', blockType: 'hero', headline: 'Welcome to Kopi Kampung Kedai', subheadline: 'Kedai kopi kampung' } as unknown as BlockData
        useEditorStore.getState().setActiveLocale('ms')
        useEditorStore.setState({ generationLocale: 'en', siteLocale: 'en' })

        const shown = useEditorStore.getState().getDisplayBlock(welcome) as Record<string, unknown>

        expect(shown.headline).not.toBe('Welcome to Kopi Kampung Kedai')
        expect(shown.subheadline).toBe('Kedai kopi kampung')
    })

    it('the written view lays the written language\'s copy over the stored section', () => {
        openMalaySite()
        const store = useEditorStore.getState()
        store.updateBlock(0, { headline: 'Welcome to Kopi Kampung Kedai', variant: 'split' })
        store.setLocaleOverride('hero-1', 'ms', { headline: 'Kopi Kampung Kedai — Kopi O', variant: 'centered' })

        const source = useEditorStore.getState().getSourceBlock(useEditorStore.getState().blocks[0]!) as Record<string, unknown>

        expect(source.headline).toBe('Kopi Kampung Kedai — Kopi O')
        // structure is site-wide: it always comes from the section
        expect(source.variant).toBe('split')
    })

    it('with no written copy the stored section is the source; a target copy is never the source', () => {
        openMalaySite()
        useEditorStore.getState().setLocaleOverride('hero-1', 'en', { headline: 'Welcome to Kopi Kampung Kedai' })

        const source = useEditorStore.getState().getSourceBlock(useEditorStore.getState().blocks[0]!) as Record<string, unknown>

        expect(source.headline).toBe('Kopi Kampung Kedai — Kopi O')
    })
})

describe('template-content — template text as a yardstick [TC-AIREL-244]', () => {
    it('templatePatch lists only the fields still holding template text, with the target language\'s template', () => {
        const block = { blockType: 'hero', headline: 'Welcome to Kopi Kampung Kedai', subheadline: 'Kedai kopi kampung' }

        const patch = templatePatch(block, 'ms', 'Kopi Kampung Kedai')

        expect(Object.keys(patch)).toContain('headline')
        expect(patch).not.toHaveProperty('subheadline')
        expect(patch.headline).not.toBe('Welcome to Kopi Kampung Kedai')
    })

    it('isTemplateCopy: the template\'s own text is a copy of it, also when the model reworded one text', () => {
        const hero = { headline: 'Welcome to Kopi Kampung Kedai', subheadline: 'We deliver exceptional products and services that help you achieve your goals. Discover what makes us different.' }
        expect(isTemplateCopy('hero', 'en', hero, 'Kopi Kampung Kedai')).toBe(true)
        const features = { headline: 'Why customers choose Kopi Kampung Kedai', subheadline: 'Three great reasons to trust this offer.' }
        expect(isTemplateCopy('features', 'en', features, 'Kopi Kampung Kedai')).toBe(true)
    })

    it('isTemplateCopy: a real translation, an empty copy and an unknown block type are not', () => {
        expect(isTemplateCopy('hero', 'en', { headline: 'Kopi O — the village coffee house' }, 'Kopi Kampung Kedai')).toBe(false)
        expect(isTemplateCopy('hero', 'en', {}, 'Kopi Kampung Kedai')).toBe(false)
        expect(isTemplateCopy('no-such-block', 'en', { headline: 'x' }, 'Kopi Kampung Kedai')).toBe(false)
    })
})
