import type { ContextElement } from '@ech/agent-core'

/**
 * A click on the canvas puts what was clicked into the AI chat: the chip
 * follows the selection (Shift + click adds, up to three). One click can
 * report twice — the text (or picture) and the section around it, in either
 * order — so picks within a moment are merged and the more precise one wins.
 */

export const EDITOR_AI_PICK_EVENT = 'ech-editor:ai-pick'
export type EditorAiPickDetail = {
    element: ContextElement
    /** Shift + click: add to what is attached instead of replacing it */
    add: boolean
    /** the element's box on screen (viewport coordinates): the chip flies from here */
    from?: { x: number; y: number; width: number; height: number }
}

/** how long one click's reports are gathered before the chip changes */
export const PICK_MERGE_MS = 120

let waiting: { detail: EditorAiPickDetail; precise: boolean; timer: ReturnType<typeof setTimeout> } | null = null

/** `precise`: a text or a picture; a section is not, and gives way to one from the same click */
export function pickOnCanvas(detail: EditorAiPickDetail, precise: boolean): void {
    if (waiting) {
        if (waiting.precise && !precise) return
        clearTimeout(waiting.timer)
    }
    const timer = setTimeout(() => {
        waiting = null
        window.dispatchEvent(new CustomEvent<EditorAiPickDetail>(EDITOR_AI_PICK_EVENT, { detail }))
    }, PICK_MERGE_MS)
    waiting = { detail, precise, timer }
}

/** The header menu and the footer are shared by every page: their chip names the part, not a section. */
export function globalPartElement(blockType: string | null | undefined, pageId: string | number | null | undefined): ContextElement | null {
    const page = pageId === null || pageId === undefined || pageId === '' ? {} : { pageId: String(pageId) }
    if (blockType === 'navigation') return { kind: 'menu', label: 'Top of every page', ...page }
    if (blockType === 'footer') return { kind: 'footer', label: 'Bottom of every page', ...page }
    return null
}
