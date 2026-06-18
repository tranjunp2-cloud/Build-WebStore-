import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'

import { TablePagination } from '@/components/ui/table-pagination'

afterEach(cleanup)

// ── TC-DS1222-05-01 — "Showing from–to of total" ────────────────────────────
describe('[TC-DS1222-05-01] TablePagination range summary', () => {
    it('shows 1–10 of 50 on the first page with limit 10', () => {
        render(<TablePagination page={1} total={50} limit={10} onPageChange={vi.fn()} />)
        expect(screen.getByText('1–10')).toBeInTheDocument()
        expect(screen.getByText('50')).toBeInTheDocument()
    })

    it('clamps the upper bound to total on the last partial page', () => {
        // 50 items, limit 20, page 3 → items 41–50.
        render(<TablePagination page={3} total={50} limit={20} onPageChange={vi.fn()} />)
        expect(screen.getByText('41–50')).toBeInTheDocument()
    })
})

// ── TC-DS1222-05-02 — Ellipsis collapses long page ranges ───────────────────
describe('[TC-DS1222-05-02] TablePagination ellipsis', () => {
    it('renders an ellipsis when there are far more pages than the window', () => {
        // total 500 / limit 10 = 50 pages, current page 1 → gap after the window.
        render(<TablePagination page={1} total={500} limit={10} onPageChange={vi.fn()} />)
        expect(screen.getByText('…')).toBeInTheDocument()
    })
})

// ── TC-DS1222-05-03 — Prev/Next disabled at bounds ──────────────────────────
describe('[TC-DS1222-05-03] TablePagination prev/next bounds', () => {
    it('disables prev on the first page', () => {
        render(<TablePagination page={1} total={50} limit={10} onPageChange={vi.fn()} />)
        // Buttons: prev, [page numbers], next. Prev is the first button.
        const buttons = screen.getAllByRole('button')
        expect(buttons[0]).toBeDisabled()
        expect(buttons[buttons.length - 1]).not.toBeDisabled()
    })

    it('disables next on the last page', () => {
        render(<TablePagination page={5} total={50} limit={10} onPageChange={vi.fn()} />)
        const buttons = screen.getAllByRole('button')
        expect(buttons[buttons.length - 1]).toBeDisabled()
        expect(buttons[0]).not.toBeDisabled()
    })
})

// ── TC-DS1222-05-04 — Clicking a page number fires onPageChange ─────────────
describe('[TC-DS1222-05-04] TablePagination page click', () => {
    it('calls onPageChange with the clicked page number', () => {
        const onPageChange = vi.fn()
        render(<TablePagination page={1} total={50} limit={10} onPageChange={onPageChange} />)
        fireEvent.click(screen.getByRole('button', { name: '2' }))
        expect(onPageChange).toHaveBeenCalledWith(2)
    })
})

// ── TC-DS1222-05-05 — Rows-per-page selector ────────────────────────────────
describe('[TC-DS1222-05-05] TablePagination rows-per-page', () => {
    it('fires onLimitChange with the chosen number', () => {
        const onLimitChange = vi.fn()
        render(
            <TablePagination
                page={1}
                total={50}
                limit={10}
                onPageChange={vi.fn()}
                onLimitChange={onLimitChange}
            />,
        )
        fireEvent.change(screen.getByRole('combobox'), { target: { value: '25' } })
        expect(onLimitChange).toHaveBeenCalledWith(25)
    })

    it('hides the selector when onLimitChange is not provided', () => {
        render(<TablePagination page={1} total={50} limit={10} onPageChange={vi.fn()} />)
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    })
})

// ── TC-DS1222-05-06 — total=0 shows 0–0 ─────────────────────────────────────
describe('[TC-DS1222-05-06] TablePagination empty dataset', () => {
    it('shows 0–0 of 0 when there is no data', () => {
        render(<TablePagination page={1} total={0} limit={10} onPageChange={vi.fn()} />)
        expect(screen.getByText('0–0')).toBeInTheDocument()
    })
})
