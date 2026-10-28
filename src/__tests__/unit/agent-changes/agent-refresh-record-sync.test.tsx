/**
 * TC-AICP-301 — <AgentRefresh> on a server-rendered page: refreshes the route only for the kinds it shows, once per
 * burst even when the layout and the page both mount one, and `when` can narrow it (a change that cannot alter a count).
 * TC-AICP-302 — an open form for the record the assistant changed: no unsaved edits → reloaded silently; unsaved edits →
 * `stale` (the notice), nothing reloaded until Reload; Keep mine dismisses without reloading; saving clears the notice;
 * a change of another record or kind is ignored. The notice itself offers both choices (en strings).
 * Real: bus, AgentRefresh, useAgentRecordSync, AgentChangedNotice. Faked: next/navigation.
 */
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentChangedNotice } from '@/components/agent/agent-changed-notice'
import { I18nProvider } from '@/i18n'
import { AgentRefresh } from '@/lib/agent-changes/agent-refresh'
import { announceAgentChange, resetAgentChangeBus } from '@/lib/agent-changes/bus'
import type { AgentChange } from '@/lib/agent-changes/types'
import { COALESCE_MS } from '@/lib/agent-changes/use-agent-changes'
import { useAgentRecordSync } from '@/lib/agent-changes/use-agent-record-sync'

const nav = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: nav.refresh }) }))

const change = (kind: string, id = '*', action = 'shop_product.update'): AgentChange => ({
    action: 'applied',
    kind: action,
    entities: [{ kind, id }],
    changeSetId: `cs_${kind}_${id}`,
    at: 1,
})

beforeEach(() => {
    vi.useFakeTimers()
    nav.refresh.mockClear()
})
afterEach(() => {
    cleanup()
    resetAgentChangeBus()
    vi.useRealTimers()
})

/** the coalescing window, then the shared refresh delay */
const settle = () => act(() => void vi.advanceTimersByTime(COALESCE_MS + 60))

describe('AgentRefresh [TC-AICP-301]', () => {
    it('refreshes for a matching kind and not for another', () => {
        render(<AgentRefresh kinds={['store_order']} />)
        act(() => announceAgentChange(change('blog_post', '1', 'blog.update')))
        settle()
        expect(nav.refresh).not.toHaveBeenCalled()
        act(() => announceAgentChange(change('store_order', '4', 'store.orders_patch')))
        settle()
        expect(nav.refresh).toHaveBeenCalledTimes(1)
    })

    it('refreshes once for a burst of three, and once with a layout and a page instance together', () => {
        render(
            <>
                <AgentRefresh kinds={['product', 'store_order']} />
                <AgentRefresh kinds={['product']} />
            </>,
        )
        act(() => {
            announceAgentChange(change('product', '1'))
            announceAgentChange(change('product', '2'))
            announceAgentChange(change('store_order', '3', 'store.orders_patch'))
        })
        settle()
        expect(nav.refresh).toHaveBeenCalledTimes(1)
    })

    it('a second burst refreshes again', () => {
        render(<AgentRefresh kinds={['product']} />)
        act(() => announceAgentChange(change('product', '1')))
        settle()
        act(() => announceAgentChange(change('product', '1')))
        settle()
        expect(nav.refresh).toHaveBeenCalledTimes(2)
    })

    it('`when` can hold a refresh back', () => {
        render(<AgentRefresh kinds={['product']} when={(b) => b.changes.some((c) => c.kind !== 'shop_product.update')} />)
        act(() => announceAgentChange(change('product', '1')))
        settle()
        expect(nav.refresh).not.toHaveBeenCalled()
        act(() => announceAgentChange(change('product', '2', 'shop_product.create_drafts')))
        settle()
        expect(nav.refresh).toHaveBeenCalledTimes(1)
    })

    it('stops refreshing once unmounted', () => {
        const { unmount } = render(<AgentRefresh kinds={['product']} />)
        unmount()
        act(() => announceAgentChange(change('product', '1')))
        settle()
        expect(nav.refresh).not.toHaveBeenCalled()
    })
})

describe('useAgentRecordSync [TC-AICP-302]', () => {
    const setup = (dirty: boolean, id = '7') => {
        const reload = vi.fn()
        const hook = renderHook((props: { dirty: boolean; id?: string }) => useAgentRecordSync({ kind: 'product', id: props.id, dirty: props.dirty, reload }), {
            initialProps: { dirty, id },
        })
        return { reload, ...hook }
    }

    it('reloads silently when there are no unsaved edits', () => {
        const { reload, result } = setup(false)
        act(() => announceAgentChange(change('product', '7')))
        settle()
        expect(reload).toHaveBeenCalledTimes(1)
        expect(result.current.stale).toBe(false)
    })

    it('with unsaved edits: marks stale and leaves the form alone; Reload then reloads', () => {
        const { reload, result } = setup(true)
        act(() => announceAgentChange(change('product', '7')))
        settle()
        expect(reload).not.toHaveBeenCalled()
        expect(result.current.stale).toBe(true)
        act(() => result.current.reloadNow())
        expect(reload).toHaveBeenCalledTimes(1)
        expect(result.current.stale).toBe(false)
    })

    it('Keep mine dismisses without reloading; saving also clears it', () => {
        const { reload, result, rerender } = setup(true)
        act(() => announceAgentChange(change('product', '7')))
        settle()
        act(() => result.current.keepMine())
        expect(result.current.stale).toBe(false)
        expect(reload).not.toHaveBeenCalled()
        act(() => announceAgentChange(change('product', '7')))
        settle()
        expect(result.current.stale).toBe(true)
        rerender({ dirty: false, id: '7' })
        expect(result.current.stale).toBe(false)
    })

    it('ignores another record, another kind, and a form with no record yet', () => {
        const other = setup(false)
        act(() => announceAgentChange(change('product', '8')))
        act(() => announceAgentChange(change('blog_post', '7', 'blog.update')))
        settle()
        expect(other.reload).not.toHaveBeenCalled()
        const fresh = setup(false, '')
        act(() => announceAgentChange(change('product', '*')))
        settle()
        expect(fresh.reload).not.toHaveBeenCalled()
    })

    it('a change that only knows the kind reaches the open record', () => {
        const { reload } = setup(false)
        act(() => announceAgentChange(change('product', '*')))
        settle()
        expect(reload).toHaveBeenCalledTimes(1)
    })
})

describe('AgentChangedNotice [TC-AICP-302]', () => {
    it('names the record and offers Reload and Keep mine', () => {
        const onReload = vi.fn()
        const onKeep = vi.fn()
        render(
            <I18nProvider>
                <AgentChangedNotice record="product" onReload={onReload} onKeep={onKeep} />
            </I18nProvider>,
        )
        expect(screen.getByRole('status').textContent).toContain('The assistant updated this product.')
        act(() => screen.getByRole('button', { name: 'Reload' }).click())
        act(() => screen.getByRole('button', { name: 'Keep mine' }).click())
        expect(onReload).toHaveBeenCalledTimes(1)
        expect(onKeep).toHaveBeenCalledTimes(1)
    })
})
