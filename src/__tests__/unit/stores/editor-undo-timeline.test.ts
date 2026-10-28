// @vitest-environment jsdom
/**
 * TC-AIREL-300 / 301 / 302 — the editor's Undo/Redo and save agree with the language copies and the assistant's steps.
 * Real: editorStore.ts, lib/editor/save-payload.ts, lib/editor/structural-block-fields.ts.
 * Faked: fetch (the save request).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSavePayload } from '@/lib/editor/save-payload'
import { aiStepState, useEditorStore } from '@/store/editorStore'

const HERO = { id: 'hero-1', blockType: 'hero', headline: 'Old headline', variant: 'split' }
const ABOUT = { id: 'about-1', blockType: 'about', headline: 'About us' }
const THEME = { primaryColor: '#0d9488' }
const SLOTS = { 'hero-1': { en: { headline: 'Old headline' }, ms: { headline: 'Tajuk lama' } } }

const store = () => useEditorStore.getState()

beforeEach(() => {
    store().reset()
    store().init('1', [structuredClone(HERO), structuredClone(ABOUT)], THEME, 'Shop', null, null, null, structuredClone(SLOTS))
    store().setActiveLocale('en')
    store().setGenerationLocale('en')
})
afterEach(() => vi.restoreAllMocks())

describe('TC-AIREL-300: one save body for autosave and the explicit save', () => {
    it('carries the language copies and the language on screen', () => {
        const body = buildSavePayload(store())

        expect(body).toMatchObject({ localeContent: SLOTS, locale: 'en', isDraft: true })
        expect(body.blocks).toHaveLength(2)
    })

    it('leaves out copies when there are none, the language when it is not en/ms, and globalBlocks when never set', () => {
        store().init('1', [structuredClone(HERO)], THEME, 'Shop')
        store().setActiveLocale('vi')

        const body = buildSavePayload(store())

        expect(body).not.toHaveProperty('localeContent')
        expect(body).not.toHaveProperty('locale')
        expect(body).not.toHaveProperty('globalBlocks')
    })

    it('sends the draft revision the editor is based on', () => {
        store().setDraftVersion('3.7')

        expect(buildSavePayload(store())).toMatchObject({ base: '3.7' })
    })

    it('autosave (performSave) sends localeContent and locale, like the explicit save', async () => {
        const sent: Array<Record<string, unknown>> = []
        vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
            sent.push(JSON.parse(init.body))
            return { ok: true, status: 200, headers: new Headers({ 'x-draft-version': '4.8' }) }
        }))
        store().editBlock(0, { headline: 'New headline' })

        const saved = await store().performSave()

        expect(saved).toBe(true)
        expect(sent[0]).toMatchObject({ locale: 'en', localeContent: { 'hero-1': { en: { headline: 'New headline' } } } })
        expect(store().draftVersion).toBe('4.8')
        vi.unstubAllGlobals()
    })
})

describe('TC-AIREL-301: editBlock writes the section and its language copy as ONE step', () => {
    it('base language: section and copy get the text, a single history step, Undo/Redo move both', () => {
        const before = store().history.length

        store().editBlock(0, { headline: 'Fresh' })

        expect(store().blocks[0]!.headline).toBe('Fresh')
        expect(store().localeOverrides['hero-1']!.en).toEqual({ headline: 'Fresh' })
        expect(store().history).toHaveLength(before + 1)
        // the step already holds the copy: replaying it restores both
        store().undo()
        expect(store().blocks[0]!.headline).toBe('Old headline')
        expect(store().localeOverrides['hero-1']!.en).toEqual({ headline: 'Old headline' })
        store().redo()
        expect(store().blocks[0]!.headline).toBe('Fresh')
        expect(store().localeOverrides['hero-1']!.en).toEqual({ headline: 'Fresh' })
    })

    it('another language on screen: only that language copy changes, the section keeps its text', () => {
        store().setActiveLocale('ms')

        store().editBlock(0, { headline: 'Tajuk baru' })

        expect(store().blocks[0]!.headline).toBe('Old headline')
        expect(store().localeOverrides['hero-1']!.ms).toEqual({ headline: 'Tajuk baru' })
        expect(store().localeOverrides['hero-1']!.en).toEqual({ headline: 'Old headline' })
    })

    it('a structural setting goes to the section and is purged from every language copy', () => {
        store().setLocaleOverride('hero-1', 'ms', { headline: 'Tajuk lama', variant: 'old-variant' })

        store().editBlock(0, { variant: 'video' })

        expect(store().blocks[0]!.variant).toBe('video')
        expect(store().localeOverrides['hero-1']!.ms).toEqual({ headline: 'Tajuk lama' })
    })

    it('a section without an id has no copy: the edit goes to the section only', () => {
        store().init('1', [{ blockType: 'hero', headline: 'No id' }], THEME, 'Shop')

        store().editBlock(0, { headline: 'Edited' })

        expect(store().blocks[0]!.headline).toBe('Edited')
        expect(store().localeOverrides).toEqual({})
    })

    it('an edit that changes nothing, or an index outside the page, adds no step', () => {
        const steps = store().history.length

        store().editBlock(9, { headline: 'x' })
        store().editBlock(0, {})

        expect(store().history).toHaveLength(steps)
    })

    it('autosave is scheduled and the page is marked unsaved', () => {
        store().editBlock(0, { headline: 'Fresh' })

        expect(store().hasUnsavedChanges).toBe(true)
        expect(store().autoSaveTimer).not.toBeNull()
        clearTimeout(store().autoSaveTimer!)
    })
})

describe('TC-AIREL-302: the assistant\'s steps in the history', () => {
    const layout = () => [{ ...structuredClone(HERO), headline: 'AI headline' }, structuredClone(ABOUT)]

    it('an applied change keeps its change set id on its step', () => {
        store().pushBatch(layout(), THEME, 'AI: Change hero', undefined, { changeSetId: 'cs-1' })

        const { history, historyIndex } = store()
        expect(history[historyIndex]).toMatchObject({ label: 'AI: Change hero', source: 'ai_chat', changeSetId: 'cs-1' })
    })

    it('Undo from the chat card right after the change removes the step, so header Undo cannot bring the change back', () => {
        store().editBlock(1, { headline: 'My edit' })
        store().pushBatch(layout(), THEME, 'AI: Change hero', undefined, { changeSetId: 'cs-1' })
        const restored = [structuredClone(HERO), { ...structuredClone(ABOUT), headline: 'My edit' }]

        store().pushBatch(restored, THEME, 'Undid: Change hero', undefined, { undoOf: 'cs-1' })

        expect(store().history.some((step) => step.changeSetId === 'cs-1')).toBe(false)
        expect(store().blocks[0]!.headline).toBe('Old headline')
        store().undo()
        // the step before the change: my edit, never the assistant's headline
        expect(store().blocks[0]!.headline).not.toBe('AI headline')
    })

    it('Undo from the card after the merchant edited again starts the history there (older steps would re-apply the change)', () => {
        store().pushBatch(layout(), THEME, 'AI: Change hero', undefined, { changeSetId: 'cs-1' })
        store().editBlock(1, { headline: 'Later edit' })
        const restored = [structuredClone(HERO), { ...structuredClone(ABOUT), headline: 'Later edit' }]

        store().pushBatch(restored, THEME, 'Undid: Change hero', undefined, { undoOf: 'cs-1' })

        expect(store().history).toHaveLength(1)
        expect(store().canUndo()).toBe(false)
        expect(store().blocks[0]!.headline).toBe('Old headline')
    })
})

describe('TC-AIREL-315: Undo / Redo report the step they crossed; the timeline knows the assistant\'s steps', () => {
    const layout = (headline: string, theme = THEME) => ({ blocks: [{ ...structuredClone(HERO), headline }, structuredClone(ABOUT)], theme })

    it('crossing an assistant step reports its change set id, both ways', () => {
        const next = layout('AI headline')
        store().pushBatch(next.blocks, next.theme, 'AI: Change hero', undefined, { changeSetId: 'cs-1', kind: 'page' })

        const undone = store().undo()
        const redone = store().redo()

        expect(undone).toMatchObject({ changeSetId: 'cs-1', label: 'AI: Change hero', themeChanged: false, canvasTyped: false })
        expect(redone).toMatchObject({ changeSetId: 'cs-1' })
        expect(store().history[store().historyIndex]).toMatchObject({ changeSetId: 'cs-1', aiKind: 'page' })
    })

    it('a merchant step carries no change set id; nothing to undo reports null', () => {
        expect(store().undo()).toBeNull()
        store().editBlock(0, { headline: 'Mine' })

        expect(store().undo()).toMatchObject({ changeSetId: undefined })
        expect(store().redo()).toMatchObject({ changeSetId: undefined })
        expect(store().redo()).toBeNull()
    })

    it('crossing a theme step says the theme changed (it is written to the live site)', () => {
        const themed = layout('Old headline', { primaryColor: '#1B5E20' })
        store().pushBatch(themed.blocks, themed.theme, 'AI: Change theme (live)', undefined, { changeSetId: 'cs-2', kind: 'theme' })

        expect(store().undo()).toMatchObject({ changeSetId: 'cs-2', themeChanged: true })
        expect(store().redo()).toMatchObject({ themeChanged: true })
    })

    it('a theme the merchant picks is a step labelled "(live)"', () => {
        store().updateTheme({ primaryColor: '#000000' })

        expect(store().undoLabel()).toBe('Updated theme (live)')
    })

    it('text typed on the canvas is flagged so the canvas reloads on Undo / Redo', () => {
        store().editBlock(0, { headline: 'Typed' }, undefined, { canvasTyped: true })

        expect(store().undo()).toMatchObject({ canvasTyped: true })
    })

    it('aiStepState: head, behind (newer steps), undone (Redo brings it back), none', () => {
        const next = layout('AI headline')
        store().pushBatch(next.blocks, next.theme, 'AI: Change hero', undefined, { changeSetId: 'cs-1' })
        const state = () => aiStepState(store().history, store().historyIndex, 'cs-1')

        expect(state()).toBe('head')
        store().editBlock(1, { headline: 'Later' })
        expect(state()).toBe('behind')
        store().undo()
        store().undo()
        expect(state()).toBe('undone')
        expect(aiStepState(store().history, store().historyIndex, 'cs-unknown')).toBe('none')
    })

    it('adoptServerFrame puts the menu and footer into the editor AND every step, so Undo never brings the older menu back', () => {
        store().editBlock(0, { headline: 'One' })
        store().editBlock(0, { headline: 'Two' })
        const header = { blockType: 'navigation', links: [{ label: 'New page', url: '/new' }] }

        store().adoptServerFrame({ headerBlock: header, footerBlock: null })
        store().undo()
        store().undo()

        expect(store().headerBlock).toEqual(header)
        expect(store().history.every((step) => step.headerBlock?.links !== undefined)).toBe(true)
    })
})
