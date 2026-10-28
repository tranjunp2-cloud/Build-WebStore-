import { create } from 'zustand'
import type { RevealTarget } from '@/lib/editor/reveal/reveal-target'

/**
 * The change walker: after "Show" on a line of a change card, the bar under
 * the canvas steps through every place that change touched (‹ 2/4 ›), each
 * one revealed in turn. Closed with Done or Esc.
 */
type ChangeWalker = {
    targets: RevealTarget[]
    index: number
    /** bumps on every step, so revealing the same place again still runs */
    seq: number
    open: (targets: RevealTarget[], index?: number) => void
    step: (delta: number) => void
    close: () => void
}

export const useChangeWalker = create<ChangeWalker>((set) => ({
    targets: [],
    index: 0,
    seq: 0,
    open: (targets, index = 0) =>
        set((state) => ({ targets, index: Math.min(Math.max(index, 0), Math.max(targets.length - 1, 0)), seq: state.seq + 1 })),
    step: (delta) =>
        set((state) => {
            const count = state.targets.length
            if (count === 0) return state
            return { index: (state.index + delta + count) % count, seq: state.seq + 1 }
        }),
    close: () => set({ targets: [], index: 0 }),
}))
