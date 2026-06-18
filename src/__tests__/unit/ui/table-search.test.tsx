import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import React from 'react'

import { TableSearch } from '@/components/ui/table-search'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    cleanup()
})

// ── TC-DS1222-06-01 — Debounced onSearch ────────────────────────────────────
describe('[TC-DS1222-06-01] TableSearch debounces onSearch', () => {
    it('fires onSearch only after the debounce window elapses', () => {
        const onSearch = vi.fn()
        render(<TableSearch value="" onSearch={onSearch} debounceMs={400} />)

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'shoe' } })
        // Before the window: not yet.
        expect(onSearch).not.toHaveBeenCalled()

        act(() => { vi.advanceTimersByTime(400) })
        expect(onSearch).toHaveBeenCalledTimes(1)
        expect(onSearch).toHaveBeenCalledWith('shoe')
    })
})

// ── TC-DS1222-06-02 — No onSearch on mount ──────────────────────────────────
describe('[TC-DS1222-06-02] TableSearch does not fire on mount', () => {
    it('never calls onSearch for the initial value (avoids clobbering ?page=N)', () => {
        const onSearch = vi.fn()
        render(<TableSearch value="restored-query" onSearch={onSearch} debounceMs={400} />)
        act(() => { vi.advanceTimersByTime(1000) })
        expect(onSearch).not.toHaveBeenCalled()
    })
})

// ── TC-DS1222-06-03 — Re-syncs input on external value change ────────────────
describe('[TC-DS1222-06-03] TableSearch re-syncs from external value', () => {
    it('updates the input when the committed value prop changes (e.g. clear filters)', () => {
        const { rerender } = render(<TableSearch value="old" onSearch={vi.fn()} />)
        expect(screen.getByRole('textbox')).toHaveValue('old')
        rerender(<TableSearch value="" onSearch={vi.fn()} />)
        expect(screen.getByRole('textbox')).toHaveValue('')
    })
})
