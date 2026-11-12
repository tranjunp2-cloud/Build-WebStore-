/**
 * TC-AIWB-102..103 — the web editor's one chat:
 *   102  "Start over" confirms first: what stays, which drafts go; a refusal keeps it open with the reason
 *   103  a click on the canvas becomes the chat's chip: one click reports text + section, the precise one wins;
 *        Shift adds; the header menu and footer get their own chips
 * Real: StartOver (@ech/agent-ui), canvas-pick. Faked: nothing.
 */

import type { ContextElement } from '@ech/agent-core'
import { StartOver } from '@ech/agent-ui'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    EDITOR_AI_PICK_EVENT,
    type EditorAiPickDetail,
    globalPartElement,
    PICK_MERGE_MS,
    pickOnCanvas,
} from '@/components/editor/agent/canvas-pick'

describe('Start over in the editor chat [TC-AIWB-102]', () => {
    it('is off while there is nothing to clear', () => {
        render(<StartOver disabled onConfirm={async () => undefined} />)

        expect(screen.getByRole('button', { name: 'Start over' })).toBeDisabled()
    })

    it('says what stays and which drafts go, then clears on confirm', async () => {
        const onConfirm = vi.fn(async () => undefined)
        render(<StartOver discarding={2} onConfirm={onConfirm} />)

        fireEvent.click(screen.getByRole('button', { name: 'Start over' }))
        const dialog = screen.getByRole('dialog', { name: 'Start a new chat?' })
        expect(dialog).toHaveTextContent('Changes already made stay on the page.')
        expect(dialog).toHaveTextContent('2 changes waiting for review in this chat will be discarded.')
        await act(async () => {
            fireEvent.click(screen.getAllByRole('button', { name: 'Start over' })[1]!)
        })

        expect(onConfirm).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('keeps the confirm open with the reason when clearing fails, and Escape closes it', async () => {
        const onConfirm = vi.fn(async () => {
            throw new Error('A change from this chat is being applied right now. Try again in a moment.')
        })
        render(<StartOver onConfirm={onConfirm} />)

        fireEvent.click(screen.getByRole('button', { name: 'Start over' }))
        expect(screen.getByRole('dialog')).not.toHaveTextContent('will be discarded')
        await act(async () => {
            fireEvent.click(screen.getAllByRole('button', { name: 'Start over' })[1]!)
        })

        expect(screen.getByRole('alert')).toHaveTextContent('being applied right now')
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
        expect(screen.queryByRole('dialog')).toBeNull()
    })
})

describe('a click on the canvas becomes the chat chip [TC-AIWB-103]', () => {
    const section: ContextElement = { kind: 'section', label: 'Hero', blockId: 'blk_hero', pageId: '42' }
    const title: ContextElement = { kind: 'text', label: 'Selamat datang', blockId: 'blk_hero', path: 'headline', pageId: '42' }
    let picks: EditorAiPickDetail[]
    const listen = (event: Event) => picks.push((event as CustomEvent<EditorAiPickDetail>).detail)

    beforeEach(() => {
        vi.useFakeTimers()
        picks = []
        window.addEventListener(EDITOR_AI_PICK_EVENT, listen)
    })
    afterEach(() => {
        window.removeEventListener(EDITOR_AI_PICK_EVENT, listen)
        vi.useRealTimers()
    })

    it('keeps the text over the section the same click reported, in either order', () => {
        pickOnCanvas({ element: title, add: false }, true)
        pickOnCanvas({ element: section, add: false }, false)
        vi.advanceTimersByTime(PICK_MERGE_MS)
        pickOnCanvas({ element: section, add: false }, false)
        pickOnCanvas({ element: title, add: true }, true)
        vi.advanceTimersByTime(PICK_MERGE_MS)

        expect(picks).toEqual([
            { element: title, add: false },
            { element: title, add: true },
        ])
    })

    it('sends a section clicked on its own', () => {
        pickOnCanvas({ element: section, add: false, from: { x: 10, y: 20, width: 300, height: 200 } }, false)
        vi.advanceTimersByTime(PICK_MERGE_MS)

        expect(picks).toEqual([{ element: section, add: false, from: { x: 10, y: 20, width: 300, height: 200 } }])
    })

    it('names the header menu and the footer, with the page as a string', () => {
        expect(globalPartElement('navigation', 42)).toEqual({ kind: 'menu', label: 'Top of every page', pageId: '42' })
        expect(globalPartElement('footer', null)).toEqual({ kind: 'footer', label: 'Bottom of every page' })
        expect(globalPartElement('breadcrumb', 42)).toBeNull()
    })
})
