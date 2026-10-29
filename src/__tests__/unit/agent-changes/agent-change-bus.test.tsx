/**
 * TC-AICP-296 — the change bus: a hook hears only the entity kinds (and ids) its screen shows; a change that only knows
 * the kind ("*") reaches every id; disabled hooks hear nothing.
 * TC-AICP-297 — a burst (Approve all, the steps of one card) reaches a screen as ONE call with the merged entities after
 * ~150 ms; the latest handler runs; unmounting drops what was queued.
 * TC-AICP-298 — other tabs: a change is posted on the `ech-agent-changes` channel and a change heard there reaches the
 * screens; malformed messages are dropped; without BroadcastChannel everything still works in the tab.
 * Real: bus, use-agent-changes. Faked: BroadcastChannel (jsdom has none).
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { announceAgentChange, resetAgentChangeBus } from '@/lib/agent-changes/bus'
import type { AgentChange } from '@/lib/agent-changes/types'
import { COALESCE_MS, useAgentChanges } from '@/lib/agent-changes/use-agent-changes'

const change = (over: Partial<AgentChange> = {}): AgentChange => ({
    action: 'applied',
    kind: 'shop_product.update',
    entities: [{ kind: 'product', id: '7' }],
    changeSetId: 'cs_1',
    at: 1,
    ...over,
})

class FakeChannel {
    static all: FakeChannel[] = []
    onmessage: Array<(e: MessageEvent) => void> = []
    posted: unknown[] = []
    closed = false
    constructor(readonly name: string) {
        FakeChannel.all.push(this)
    }
    addEventListener(_type: string, fn: (e: MessageEvent) => void) {
        this.onmessage.push(fn)
    }
    postMessage(data: unknown) {
        this.posted.push(data)
    }
    close() {
        this.closed = true
    }
    receive(data: unknown) {
        for (const fn of this.onmessage) fn({ data } as MessageEvent)
    }
}

beforeEach(() => {
    vi.useFakeTimers()
    FakeChannel.all = []
    vi.stubGlobal('BroadcastChannel', FakeChannel)
})
afterEach(() => {
    resetAgentChangeBus()
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

const flush = () => act(() => void vi.advanceTimersByTime(COALESCE_MS))

describe('useAgentChanges filtering [TC-AICP-296]', () => {
    it('calls the handler for a matching kind only', () => {
        const handler = vi.fn()
        renderHook(() => useAgentChanges({ kinds: ['product'] }, handler))
        act(() => announceAgentChange(change({ entities: [{ kind: 'blog_post', id: '1' }] })))
        flush()
        expect(handler).not.toHaveBeenCalled()
        act(() => announceAgentChange(change()))
        flush()
        expect(handler).toHaveBeenCalledTimes(1)
        expect(handler.mock.calls[0]?.[0].entities).toEqual([{ kind: 'product', id: '7' }])
    })

    it('filters by id, and a kind-only change ("*") matches every id', () => {
        const handler = vi.fn()
        renderHook(() => useAgentChanges({ kinds: ['product'], ids: ['7'] }, handler))
        act(() => announceAgentChange(change({ entities: [{ kind: 'product', id: '8' }] })))
        flush()
        expect(handler).not.toHaveBeenCalled()
        act(() => announceAgentChange(change({ entities: [{ kind: 'product', id: '*' }] })))
        flush()
        expect(handler).toHaveBeenCalledTimes(1)
    })

    it('hears nothing while disabled, and again once enabled', () => {
        const handler = vi.fn()
        const { rerender } = renderHook(({ enabled }) => useAgentChanges({ kinds: ['product'], enabled }, handler), { initialProps: { enabled: false } })
        act(() => announceAgentChange(change()))
        flush()
        expect(handler).not.toHaveBeenCalled()
        rerender({ enabled: true })
        act(() => announceAgentChange(change()))
        flush()
        expect(handler).toHaveBeenCalledTimes(1)
    })
})

describe('useAgentChanges coalescing [TC-AICP-297]', () => {
    it('merges a burst into one call with every entity', () => {
        const handler = vi.fn()
        renderHook(() => useAgentChanges({ kinds: ['product'] }, handler))
        act(() => {
            announceAgentChange(change({ changeSetId: 'a', entities: [{ kind: 'product', id: '1' }] }))
            announceAgentChange(change({ changeSetId: 'b', entities: [{ kind: 'product', id: '2' }] }))
            announceAgentChange(change({ changeSetId: 'c', action: 'undone', entities: [{ kind: 'product', id: '3' }] }))
        })
        act(() => void vi.advanceTimersByTime(COALESCE_MS - 1))
        expect(handler).not.toHaveBeenCalled()
        act(() => void vi.advanceTimersByTime(1))
        expect(handler).toHaveBeenCalledTimes(1)
        const batch = handler.mock.calls[0]?.[0]
        expect(batch.changes.map((c: AgentChange) => c.changeSetId)).toEqual(['a', 'b', 'c'])
        expect(batch.entities.map((e: { id: string }) => e.id)).toEqual(['1', '2', '3'])
    })

    it('runs the latest handler, and a later burst is a new call', () => {
        const first = vi.fn()
        const second = vi.fn()
        const { rerender } = renderHook(({ fn }) => useAgentChanges({ kinds: ['product'] }, fn), { initialProps: { fn: first } })
        act(() => announceAgentChange(change()))
        rerender({ fn: second })
        flush()
        expect(first).not.toHaveBeenCalled()
        expect(second).toHaveBeenCalledTimes(1)
        act(() => announceAgentChange(change()))
        flush()
        expect(second).toHaveBeenCalledTimes(2)
    })

    it('drops a queued burst on unmount and stops listening', () => {
        const handler = vi.fn()
        const { unmount } = renderHook(() => useAgentChanges({ kinds: ['product'] }, handler))
        act(() => announceAgentChange(change()))
        unmount()
        flush()
        act(() => announceAgentChange(change()))
        flush()
        expect(handler).not.toHaveBeenCalled()
    })
})

describe('other tabs [TC-AICP-298]', () => {
    it('posts an announced change on the channel', () => {
        renderHook(() => useAgentChanges({ kinds: ['product'] }, vi.fn()))
        const c = change()
        act(() => announceAgentChange(c))
        expect(FakeChannel.all).toHaveLength(1)
        expect(FakeChannel.all[0]?.name).toBe('ech-agent-changes')
        expect(FakeChannel.all[0]?.posted).toEqual([c])
    })

    it('delivers a change heard from another tab and does not echo it back', () => {
        const handler = vi.fn()
        renderHook(() => useAgentChanges({ kinds: ['product'] }, handler))
        act(() => FakeChannel.all[0]?.receive(change({ changeSetId: 'elsewhere' })))
        flush()
        expect(handler).toHaveBeenCalledTimes(1)
        expect(handler.mock.calls[0]?.[0].changes[0].changeSetId).toBe('elsewhere')
        expect(FakeChannel.all[0]?.posted).toEqual([])
    })

    it('drops malformed messages', () => {
        const handler = vi.fn()
        renderHook(() => useAgentChanges({}, handler))
        act(() => {
            FakeChannel.all[0]?.receive(null)
            FakeChannel.all[0]?.receive({ action: 'applied' })
            FakeChannel.all[0]?.receive(change({ entities: [{ kind: 1 } as never] }))
            FakeChannel.all[0]?.receive(change({ action: 'deleted' as never }))
        })
        flush()
        expect(handler).not.toHaveBeenCalled()
    })

    it('still works in the tab when the browser has no BroadcastChannel', () => {
        vi.stubGlobal('BroadcastChannel', undefined)
        const handler = vi.fn()
        renderHook(() => useAgentChanges({ kinds: ['product'] }, handler))
        act(() => announceAgentChange(change()))
        flush()
        expect(handler).toHaveBeenCalledTimes(1)
    })
})
