/**
 * TC-AIWB-26 — `discardLocaleOverrides`, the undo of an automatic translation in the editor store: it empties only
 * the locale slots that still hold exactly what the automatic translation wrote, leaves slots edited since and
 * other locales alone, returns the count, and marks the store unsaved; nothing matching → no state change.
 * Real: editorStore.ts (the Zustand store). Faked: nothing; the store is reset before each test.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore, type BlockData } from '@/store/editorStore'

const HERO: BlockData = { blockType: 'hero', id: 'hero-1', variant: 'centered', headline: 'Batik for every day' }
const FAQ: BlockData = { blockType: 'faq', id: 'faq-1', variant: 'accordion', headline: 'Questions' }
const PRODUCTS: BlockData = { blockType: 'products-grid', id: 'products-1', variant: 'grid-3', headline: 'Shop' }

const WRITTEN_HERO = { headline: 'Batik untuk setiap hari' }
const WRITTEN_FAQ = { headline: 'Soalan lazim' }
const WRITTEN_PRODUCTS = { headline: 'Kedai' }

/** A site with three blocks: translations in `ms` as the automatic translation wrote them, plus an `en` override. */
function seed(localeOverrides: Record<string, Record<string, Record<string, unknown>>>) {
    useEditorStore.getState().init('site-1', [HERO, FAQ, PRODUCTS], {}, 'Kedai Batik', null, null, null, localeOverrides)
    useEditorStore.setState({ hasUnsavedChanges: false })
}

beforeEach(() => {
    useEditorStore.getState().reset()
})

describe('discardLocaleOverrides — empties only the translations still as the automatic translation wrote them [TC-AIWB-26]', () => {
    it('empties every ms slot that still holds exactly the written translation and returns the count', () => {
        seed({
            'hero-1': { en: { headline: 'Edited in English' }, ms: { ...WRITTEN_HERO } },
            'faq-1': { en: {}, ms: { ...WRITTEN_FAQ } },
        })

        const discarded = useEditorStore.getState().discardLocaleOverrides('ms', { 'hero-1': WRITTEN_HERO, 'faq-1': WRITTEN_FAQ })

        expect(discarded).toBe(2)
        expect(useEditorStore.getState().localeOverrides['hero-1']!.ms).toEqual({ headline: 'Batik for every day' })
        expect(useEditorStore.getState().localeOverrides['faq-1']!.ms).toEqual({ headline: 'Questions' })
    })

    it('treats a slot read back with its keys in another order (Postgres jsonb) as unchanged', () => {
        seed({ 'hero-1': { en: {}, ms: { subheadline: 'Kain tenun', headline: 'Batik untuk setiap hari' } } })

        const discarded = useEditorStore.getState().discardLocaleOverrides('ms', { 'hero-1': { headline: 'Batik untuk setiap hari', subheadline: 'Kain tenun' } })

        expect(discarded).toBe(1)
        expect(useEditorStore.getState().localeOverrides['hero-1']!.ms).toEqual({ headline: 'Batik for every day' })
    })

    it('leaves a slot the merchant edited since the translation (it no longer matches what was written)', () => {
        seed({
            'hero-1': { en: {}, ms: { headline: 'Batik untuk setiap hari', subheadline: 'Ditambah pengguna' } },
            'faq-1': { en: {}, ms: { ...WRITTEN_FAQ } },
        })

        const discarded = useEditorStore.getState().discardLocaleOverrides('ms', { 'hero-1': WRITTEN_HERO, 'faq-1': WRITTEN_FAQ })

        expect(discarded).toBe(1)
        expect(useEditorStore.getState().localeOverrides['hero-1']!.ms).toEqual({ headline: 'Batik untuk setiap hari', subheadline: 'Ditambah pengguna' })
        expect(useEditorStore.getState().localeOverrides['faq-1']!.ms).toEqual({ headline: 'Questions' })
    })

    it('leaves the other locales alone, even when their slot matches the written text', () => {
        seed({
            'hero-1': { en: { ...WRITTEN_HERO }, ms: { ...WRITTEN_HERO } },
        })

        useEditorStore.getState().discardLocaleOverrides('ms', { 'hero-1': WRITTEN_HERO })

        expect(useEditorStore.getState().localeOverrides['hero-1']).toEqual({ en: { headline: 'Batik untuk setiap hari' }, ms: { headline: 'Batik for every day' } })
    })

    it('does not touch a block that the translation did not write at all', () => {
        seed({
            'products-1': { en: {}, ms: { headline: 'Kedai' } },
        })

        const discarded = useEditorStore.getState().discardLocaleOverrides('ms', { 'hero-1': WRITTEN_HERO })

        expect(discarded).toBe(0)
        expect(useEditorStore.getState().localeOverrides['products-1']!.ms).toEqual({ headline: 'Kedai' })
    })

    it('marks the store unsaved, resets the save status and bumps the content revision', () => {
        seed({ 'hero-1': { en: {}, ms: { ...WRITTEN_HERO } } })
        useEditorStore.setState({ saveStatus: 'saved' })
        const revision = useEditorStore.getState().contentRevision

        useEditorStore.getState().discardLocaleOverrides('ms', { 'hero-1': WRITTEN_HERO })

        const state = useEditorStore.getState()
        expect(state.hasUnsavedChanges).toBe(true)
        expect(state.saveStatus).toBe('idle')
        expect(state.contentRevision).toBe(revision + 1)
    })

    it('with nothing matching it returns 0 and changes no state at all', () => {
        seed({ 'hero-1': { en: {}, ms: { headline: 'Diedit pengguna' } } })
        const before = useEditorStore.getState()
        const overridesBefore = before.localeOverrides

        const discarded = useEditorStore.getState().discardLocaleOverrides('ms', { 'hero-1': WRITTEN_HERO, 'faq-1': WRITTEN_FAQ })

        const after = useEditorStore.getState()
        expect(discarded).toBe(0)
        expect(after.localeOverrides).toBe(overridesBefore)
        expect(after.hasUnsavedChanges).toBe(false)
        expect(after.contentRevision).toBe(before.contentRevision)
    })

    it('a written key the section does not have is left out of the slot (undefined values are skipped)', () => {
        seed({ 'hero-1': { en: {}, ms: { ...WRITTEN_HERO, subheadline: 'Terjemahan lama' } } })

        const discarded = useEditorStore.getState().discardLocaleOverrides('ms', { 'hero-1': { ...WRITTEN_HERO, subheadline: 'Terjemahan lama' } })

        expect(discarded).toBe(1)
        expect(useEditorStore.getState().localeOverrides['hero-1']!.ms).toEqual({ headline: 'Batik for every day' })
        expect(useEditorStore.getState().localeOverrides['hero-1']!.ms).not.toHaveProperty('subheadline')
    })

    it('the restored text is a deep copy: changing it later does not change the section', () => {
        const withList: BlockData = { blockType: 'faq', id: 'faq-list', variant: 'accordion', headline: 'Questions', items: [{ question: 'Ship to Sabah?', answer: 'Yes' }] }
        useEditorStore.getState().init('site-1', [withList], {}, 'Kedai Batik', null, null, null, { 'faq-list': { en: {}, ms: { items: [{ question: 'Ship to Sabah?', answer: 'Yes' }] } } })

        useEditorStore.getState().discardLocaleOverrides('ms', { 'faq-list': { items: [{ question: 'Ship to Sabah?', answer: 'Yes' }] } })

        const restored = useEditorStore.getState().localeOverrides['faq-list']!.ms as { items: Array<{ answer: string }> }
        const section = useEditorStore.getState().blocks.find((b) => b.id === 'faq-list') as unknown as { items: Array<{ answer: string }> }
        expect(restored).toEqual({ items: [{ question: 'Ship to Sabah?', answer: 'Yes' }] })
        expect(restored.items).not.toBe(section.items)
        restored.items[0]!.answer = 'Changed'
        expect(section.items[0]!.answer).toBe('Yes')
    })

    it('discards nothing for an empty written map', () => {
        seed({ 'hero-1': { en: {}, ms: { ...WRITTEN_HERO } } })

        expect(useEditorStore.getState().discardLocaleOverrides('ms', {})).toBe(0)
        expect(useEditorStore.getState().localeOverrides['hero-1']!.ms).toEqual(WRITTEN_HERO)
        expect(useEditorStore.getState().hasUnsavedChanges).toBe(false)
    })
})
