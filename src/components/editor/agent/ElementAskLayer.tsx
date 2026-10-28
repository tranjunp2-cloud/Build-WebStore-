'use client'

import type { ContextElement } from '@ech/agent-core'
import { createPortal } from 'react-dom'
import { askEditorAgent } from './editor-agent-context'
import { ElementAskPopover } from './ElementAskPopover'

export type ViewportRect = { top: number; left: number; width: number; height: number }

const WIDTH = 380
const EST_HEIGHT = 150
const GAP = 10

/**
 * Ask AI anchored to an element on the canvas: under it, or over it when there
 * is no room below; kept inside the canvas. Sending hands the element (and the
 * prompt) to the chat — it flies there from `anchor`. Outside the canvas
 * (the SEO tab) it stays inside `bounds` all the same.
 */
export function ElementAskLayer({
    element,
    anchor,
    bounds,
    currentValue,
    onClose,
}: {
    element: ContextElement
    /** the element's box, viewport coordinates */
    anchor: ViewportRect
    /** the canvas box the popover stays in */
    bounds: { left: number; right: number }
    currentValue?: string
    onClose: () => void
}) {
    const width = Math.min(WIDTH, bounds.right - bounds.left - 16)
    const left = Math.max(bounds.left + 8, Math.min(anchor.left + anchor.width / 2 - width / 2, bounds.right - width - 8))
    const below = window.innerHeight - (anchor.top + anchor.height) >= EST_HEIGHT + GAP || anchor.top < EST_HEIGHT + GAP
    const style = below
        ? { position: 'fixed' as const, top: anchor.top + anchor.height + GAP, left, width }
        : { position: 'fixed' as const, top: anchor.top - GAP, left, width, transform: 'translateY(-100%)' }
    // portalled: the Settings panel's `contain: layout` would make `fixed` relative to the panel
    return createPortal(
        <div data-inline-edit-popover data-editor-control className="pointer-events-auto z-[210]" style={style} onMouseDown={(event) => event.stopPropagation()}>
            <ElementAskPopover
                element={element}
                currentValue={currentValue}
                onClose={onClose}
                onSend={(prompt) => {
                    askEditorAgent({ element, prompt, from: { x: anchor.left, y: anchor.top, width: anchor.width, height: anchor.height } })
                    onClose()
                }}
            />
        </div>,
        document.body,
    )
}
