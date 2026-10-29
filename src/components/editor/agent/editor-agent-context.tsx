'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { create } from 'zustand'
import type { ChangeSetVerdict, ContextElement } from '@ech/agent-core'
import type { RevealTarget } from '@/lib/editor/reveal/reveal-target'

/**
 * The web builder copilot in the editor: whether the assistant runs here
 * (`isAiAgentEnabled`; off → the editor has no AI), and what the editor shows
 * right now (the section in view) — the chat pins that so "this section" means
 * the right one.
 */

const EditorAgentEnabledContext = createContext(false)

export function EditorAgentProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
    return <EditorAgentEnabledContext.Provider value={enabled}>{children}</EditorAgentEnabledContext.Provider>
}

export function useEditorAgentEnabled(): boolean {
    return useContext(EditorAgentEnabledContext)
}

type EditorAgentFocus = {
    /** id of the selected section (`index-N` for legacy rows without an id), or null */
    blockId: string | null
    blockLabel: string | null
    setBlock: (blockId: string | null, blockLabel?: string | null) => void
}

export const useEditorAgentFocus = create<EditorAgentFocus>((set) => ({
    blockId: null,
    blockLabel: null,
    setBlock: (blockId, blockLabel = null) => set({ blockId, blockLabel }),
}))

type EditorAgentRun = {
    /** a reply is being written by the copilot (the chat is mounted and running) */
    busy: boolean
    /** stops that reply; undefined when nothing runs or the backend can't stop runs */
    stop: (() => Promise<void>) | undefined
    set: (busy: boolean, stop: (() => Promise<void>) | undefined) => void
}

/**
 * The copilot's run, published by the chat so the rest of the editor (the
 * compact bottom bar) can show "AI is editing" and a Stop without owning the chat.
 */
export const useEditorAgentRun = create<EditorAgentRun>((set) => ({
    busy: false,
    stop: undefined,
    set: (busy, stop) => set({ busy, stop }),
}))

/** Same addressing as the server (site-blocks `blockIdOf`). */
export function editorBlockId(block: object | undefined, index: number): string {
    const id = (block as { id?: unknown } | undefined)?.id
    return typeof id === 'string' && id ? id : `index-${index}`
}

/**
 * The context pin the copilot gets with each request: the site, the page on
 * screen and the selected section. Payload ids reach the editor as numbers
 * (the pages API, typed string): the pin schema takes strings only, so a
 * number there made every request fail with "expected string".
 */
export function editorPin(input: {
    siteId: string | number
    pageId: string | number | null
    pageTitle?: string | null
    blockId?: string | null
    blockLabel?: string | null
    /** the language on the canvas ("en", "ms"): which slot a text edit changes */
    language?: string | null
    /** the website's languages, primary first (Menu → Quick language) */
    languages?: readonly string[]
    /** the language the pages are written in (their sections as stored) */
    writtenIn?: string | null
}): { module: string; entity?: { kind: string; id: string; label?: string }; filters: Record<string, string> } {
    const site = String(input.siteId)
    const pageId = input.pageId === null || input.pageId === '' ? null : String(input.pageId)
    return {
        module: 'editor',
        ...(pageId ? { entity: { kind: 'site_page', id: pageId, ...(input.pageTitle ? { label: input.pageTitle } : {}) } } : {}),
        filters: {
            site,
            ...(input.language ? { editingLanguage: input.language } : {}),
            // "en (primary), ms": what a translation or a language change can aim at
            ...(input.languages?.length ? { siteLanguages: input.languages.map((l, i) => (i === 0 ? `${l} (primary)` : l)).join(', ') } : {}),
            ...(input.writtenIn ? { pagesWrittenIn: input.writtenIn } : {}),
            ...(input.blockId ? { section: input.blockId } : {}),
            ...(input.blockLabel ? { sectionName: input.blockLabel } : {}),
        },
    }
}

/**
 * Show a place in the editor (`RevealTarget`): a change's line ("Show", the
 * change walker), handled by the editor page — page switched, Settings tab
 * opened, section selected, the element outlined on the canvas, its field
 * pulsed in Settings.
 */
export const EDITOR_AI_LOCATE_EVENT = 'ech-editor:ai-locate'
export type EditorAiLocateDetail = RevealTarget

/** Light an element up on the canvas while the pointer is over its chat chip; `null` clears it. */
export const EDITOR_AI_HOVER_EVENT = 'ech-editor:ai-hover'
export type EditorAiHoverDetail = RevealTarget | null

/**
 * Ask AI on an element (a text, a button, a picture, a section, the SEO
 * title): the chat opens, the element flies from `from` into the message box
 * and is attached; with a prompt the message is sent at once.
 */
export const EDITOR_AI_ASK_EVENT = 'ech-editor:ai-ask'
export type EditorAiAskDetail = {
    element: ContextElement
    prompt?: string
    /** the element's box on screen (viewport coordinates), where the flight starts */
    from?: { x: number; y: number; width: number; height: number }
}

export function askEditorAgent(detail: EditorAiAskDetail): void {
    window.dispatchEvent(new CustomEvent<EditorAiAskDetail>(EDITOR_AI_ASK_EVENT, { detail }))
}

export function revealInEditor(target: RevealTarget): void {
    window.dispatchEvent(new CustomEvent<EditorAiLocateDetail>(EDITOR_AI_LOCATE_EVENT, { detail: target }))
}

export function hoverInEditor(target: RevealTarget | null): void {
    window.dispatchEvent(new CustomEvent<EditorAiHoverDetail>(EDITOR_AI_HOVER_EVENT, { detail: target }))
}

/** Fired by the copilot chat after a change set touching this editor is applied or undone. */
export const EDITOR_AI_CHANGED_EVENT = 'ech-editor:ai-changed'
export type EditorAiChangedDetail = {
    /** pages: several page drafts · structure: a page added or removed (and the menu) · nav: menu/footer · publish: the site went live */
    kind: 'page' | 'theme' | 'seo' | 'translate' | 'pages' | 'structure' | 'nav' | 'languages' | 'publish'
    pageId?: string
    /** the pages a 'pages' change touched */
    pageIds?: string[]
    label: string
    /** the change set this announces (its history step carries the id) */
    changeSetId?: string
    /** the chat's Undo took the change back (an apply is the default) */
    undone?: boolean
    /** a translation was applied: the language it wrote (the canvas switches to it) */
    locale?: string
    /** the store's content revision when the editor was held — edits after it would be replaced by the reload */
    heldRevision?: number
    /** turns autosave back on — call it once the new draft is in the store (or the reload failed) */
    resume?: () => void
}

/**
 * The page timeline, for the chat card: the header's Undo / Redo is the one undo for everything on the canvas, so a
 * card's Undo of a change that is the newest step runs the very same step. The editor page registers it.
 */
export type HistoryStepResult = { changeSetId?: string; saved: boolean }
type EditorHistoryControl = {
    step: ((direction: 'undo' | 'redo') => Promise<HistoryStepResult | null>) | null
    setStep: (step: EditorHistoryControl['step']) => void
}
export const useEditorHistoryControl = create<EditorHistoryControl>((set) => ({
    step: null,
    setStep: (step) => set({ step }),
}))

/** The editor's Undo / Redo crossed an assistant change (and saved): the chat settles that card's status. */
export const EDITOR_AI_RECONCILE_EVENT = 'ech-editor:ai-reconcile'
export type EditorAiReconcileDetail = { changeSetId: string }

export function requestReconcile(changeSetId: string): void {
    window.dispatchEvent(new CustomEvent<EditorAiReconcileDetail>(EDITOR_AI_RECONCILE_EVENT, { detail: { changeSetId } }))
}

/** What the server last said about each assistant change against the page draft (see POST …/reconcile). */
type ChangeVerdicts = {
    byId: Record<string, ChangeSetVerdict>
    set: (id: string, verdict: ChangeSetVerdict) => void
}
export const useChangeVerdicts = create<ChangeVerdicts>((set) => ({
    byId: {},
    set: (id, verdict) => set((state) => (state.byId[id] === verdict ? state : { byId: { ...state.byId, [id]: verdict } })),
}))
