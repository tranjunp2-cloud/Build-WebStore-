// @vitest-environment jsdom
/**
 * TC-AICP-122 — the reply bubble over the mascot hides itself 8 s after a reply is done
 * (the clock pauses while the pointer is on it); a waiting question stays.
 * Real: AgentFloatDock + ReplyBubble from @ech/agent-ui. Faked: timers only.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentFloatDock, REPLY_DONE_MS, type ReplyBubbleState } from '@ech/agent-ui'

const done: ReplyBubbleState = { runId: 'run_1', phase: 'done', prompt: 'Add 3 dresses', line: '3 drafts ready to review', drafts: 3 }
const working: ReplyBubbleState = { ...done, phase: 'working', line: 'Drafting 3 products', drafts: 0 }

/** A finished reply only shows if it was still going while the panel was closed: work first, then done. */
function renderFinished() {
    const view = render(<AgentFloatDock reply={working} open={false} />)
    view.rerender(<AgentFloatDock reply={done} open={false} />)
    return view
}

beforeEach(() => {
    vi.useFakeTimers()
})
afterEach(() => {
    cleanup()
    vi.useRealTimers()
})

describe('reply bubble auto-hide [TC-AICP-122]', () => {
    it('hides a finished reply after 8 seconds', () => {
        const { container } = renderFinished()
        expect(container.querySelector('.ech-ag-reply')?.getAttribute('data-phase')).toBe('done')

        act(() => vi.advanceTimersByTime(REPLY_DONE_MS - 100))
        expect(container.querySelector('.ech-ag-reply')).not.toBeNull()
        act(() => vi.advanceTimersByTime(200))
        expect(container.querySelector('.ech-ag-reply')).toBeNull()
    })

    it('waits while the pointer is on it, then starts the clock again', () => {
        const { container } = renderFinished()
        const bubble = container.querySelector('.ech-ag-reply') as HTMLElement

        fireEvent.mouseEnter(bubble)
        act(() => vi.advanceTimersByTime(REPLY_DONE_MS * 2))
        expect(container.querySelector('.ech-ag-reply')).not.toBeNull()

        fireEvent.mouseLeave(bubble)
        act(() => vi.advanceTimersByTime(REPLY_DONE_MS + 100))
        expect(container.querySelector('.ech-ag-reply')).toBeNull()
    })

    it('does not bring up a reply that finished while the panel was open', () => {
        const { container } = render(<AgentFloatDock reply={done} open={false} />)
        expect(container.querySelector('.ech-ag-reply')).toBeNull()
    })

    it('keeps a waiting question until the merchant answers', () => {
        const asking: ReplyBubbleState = { ...done, phase: 'asking', line: 'Which family should these go in?' }
        const { container } = render(<AgentFloatDock reply={asking} open={false} />)

        act(() => vi.advanceTimersByTime(REPLY_DONE_MS * 3))
        expect(container.querySelector('.ech-ag-reply')).not.toBeNull()
    })
})
