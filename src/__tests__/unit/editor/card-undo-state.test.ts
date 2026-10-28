/**
 * TC-AIREL-314 — a chat card's Undo in the editor: which action it is and what the button says.
 * Real: components/editor/agent/card-undo-state, editor-undo-phrases.
 */
import { describe, expect, it } from 'vitest'
import { cardUndoState, undoRoute } from '@/components/editor/agent/card-undo-state'
import { editorUndoPhrases } from '@/components/editor/agent/editor-undo-phrases'

const phrases = editorUndoPhrases('en')
const applied = { status: 'applied' } as const
const base = { changeSet: applied, verdict: undefined, newer: null, phrases }

describe('undoRoute', () => {
    it('the newest timeline step is the header Undo itself', () => {
        for (const kind of ['page', 'theme', 'translate', 'nav']) expect(undoRoute(kind, 'head')).toBe('timeline')
    })

    it('a timeline step under newer steps is blocked, never a second undo path', () => {
        expect(undoRoute('page', 'behind')).toBe('blocked')
    })

    it('not on the timeline (reloaded, or already undone above) the saved version is put back from the server', () => {
        expect(undoRoute('page', 'none')).toBe('server')
        expect(undoRoute('page', 'undone')).toBe('server')
    })

    it('settings the timeline does not cover always undo from the card', () => {
        for (const kind of ['seo', 'structure', 'languages', 'publish', 'pages']) expect(undoRoute(kind, 'head')).toBe('server')
        expect(undoRoute(undefined, 'head')).toBe('server')
    })
})

describe('cardUndoState', () => {
    it('newest step: enabled, and says it is the same as the Undo at the top', () => {
        expect(cardUndoState({ ...base, kind: 'page', step: 'head' })).toEqual({ note: phrases.sameAsHeader })
    })

    it('under newer steps: disabled with "Newer changes first"', () => {
        expect(cardUndoState({ ...base, kind: 'page', step: 'behind' })).toEqual({ blocked: phrases.newerStepsFirst })
    })

    it('undone by the top Undo: disabled, Redo brings it back', () => {
        expect(cardUndoState({ ...base, kind: 'theme', step: 'undone' })).toEqual({ blocked: phrases.undoneHere })
    })

    it('after a reload: "Restore previous version" with what it does', () => {
        expect(cardUndoState({ ...base, kind: 'page', step: 'none' })).toEqual({ label: phrases.restore, note: phrases.restoreNote })
    })

    it('after a reload but edited since: disabled, says to change it back in the editor', () => {
        expect(cardUndoState({ ...base, kind: 'page', step: 'none', verdict: 'diverged' })).toEqual({ blocked: phrases.editedSince })
    })

    it('after a reload with a newer change of the chat on the same part: that one goes first', () => {
        const state = cardUndoState({ ...base, kind: 'page', step: 'none', newer: { title: 'Shorter headline' } })
        expect(state?.blocked).toBe('Undo “Shorter headline” first — it changed the same part later.')
    })

    it('a setting the timeline does not cover says it is undone here only; a newer overlapping change blocks it', () => {
        expect(cardUndoState({ ...base, kind: 'seo', step: 'none' })).toEqual({ note: phrases.cardOnly })
        expect(cardUndoState({ ...base, kind: 'seo', step: 'none', newer: { title: 'SEO again' } })?.blocked).toContain('SEO again')
    })

    it('several pages at once keeps its plain Undo (it also covers the other pages)', () => {
        expect(cardUndoState({ ...base, kind: 'pages', step: 'head' })).toBeUndefined()
    })

    it('says nothing for a change that is not applied or not a site change', () => {
        expect(cardUndoState({ ...base, changeSet: { status: 'reverted' }, kind: 'page', step: 'none' })).toBeUndefined()
        expect(cardUndoState({ ...base, kind: undefined, step: 'none' })).toBeUndefined()
    })

    it('has Malay and Vietnamese words for every phrase', () => {
        for (const locale of ['ms', 'vi']) {
            const words = editorUndoPhrases(locale)
            for (const key of Object.keys(phrases) as Array<keyof typeof phrases>) {
                expect(words[key], `${locale}.${key}`).toBeTruthy()
                expect(words[key], `${locale}.${key} differs from English`).not.toBe(phrases[key])
            }
        }
    })
})
