import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, renderHook } from '@testing-library/react'
import React from 'react'

import { TablePagination, useTablePageClamp } from '@/components/ui/table-pagination'

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

// ── TC-DS1222-05-06 — empty dataset renders nothing ─────────────────────────
describe('[TC-DS1222-05-06] TablePagination empty dataset', () => {
    it('renders nothing when there is no data (GH-1579 hide rule)', () => {
        const { container } = render(
            <TablePagination page={1} total={0} limit={10} onPageChange={vi.fn()} />,
        )
        expect(container.firstChild).toBeNull()
    })
})

// ── TC-DS1222-05-07 — hidden when total fits one default page ────────────────
describe('[TC-DS1222-05-07] TablePagination hidden for small datasets', () => {
    it('renders nothing when total equals the smallest rows option', () => {
        const { container } = render(
            <TablePagination page={1} total={10} limit={10} onPageChange={vi.fn()} />,
        )
        expect(container.firstChild).toBeNull()
    })

    it('renders nothing when total is below the smallest rows option', () => {
        const { container } = render(
            <TablePagination page={1} total={5} limit={10} onPageChange={vi.fn()} />,
        )
        expect(container.firstChild).toBeNull()
    })
})

// ── TC-DS1222-05-08 — boundary: total=11 shows the bar ──────────────────────
describe('[TC-DS1222-05-08] TablePagination boundary shows at 11', () => {
    it('renders the bar when total is one above the smallest rows option', () => {
        render(<TablePagination page={1} total={11} limit={10} onPageChange={vi.fn()} />)
        expect(screen.getByText('1–10')).toBeInTheDocument()
        expect(screen.getAllByRole('button').length).toBeGreaterThan(0)
    })
})

// ── TC-DS1222-05-09 — rows-per-page select shows a chevron icon ──────────────
describe('[TC-DS1222-05-09] TablePagination rows-per-page chevron', () => {
    it('renders a dropdown arrow next to the rows-per-page select', () => {
        const { container } = render(
            <TablePagination
                page={1}
                total={50}
                limit={10}
                onPageChange={vi.fn()}
                onLimitChange={vi.fn()}
            />,
        )
        expect(container.querySelector('svg.lucide-chevron-down')).toBeTruthy()
    })
})

// ── TC-DS1222-05-10 — page clamp when total shrinks (stranded page) ──────────
describe('[TC-DS1222-05-10] useTablePageClamp stranded page', () => {
    it('snaps back to the last valid page when total shrinks below the current page', () => {
        const onPageChange = vi.fn()
        const { rerender } = renderHook(
            ({ total }) => useTablePageClamp(2, total, 10, onPageChange),
            { initialProps: { total: 12 } },
        )
        expect(onPageChange).not.toHaveBeenCalled()
        rerender({ total: 10 })
        expect(onPageChange).toHaveBeenCalledWith(1)
    })

    it('does nothing while disabled (e.g. data still loading)', () => {
        const onPageChange = vi.fn()
        renderHook(() => useTablePageClamp(3, 0, 10, onPageChange, false))
        expect(onPageChange).not.toHaveBeenCalled()
    })
})
