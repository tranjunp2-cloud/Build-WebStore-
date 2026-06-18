import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'

// ── Imports (from source — never re-implement) ──────────────────────────────
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    SortableHead,
    TableActionButton,
} from '@/components/ui/table'

afterEach(cleanup)

// ── TC-DS1222-01-01 — Table applies .dash-table class ───────────────────────
describe('[TC-DS1222-01-01] Table applies .dash-table class', () => {
    it('renders a <table> carrying the dash-table class the CSS row-border rule targets', () => {
        // Arrange / Act
        const { container } = render(
            <Table>
                <TableBody>
                    <TableRow>
                        <TableCell>cell</TableCell>
                    </TableRow>
                </TableBody>
            </Table>,
        )
        // Assert
        const table = container.querySelector('table')
        expect(table).not.toBeNull()
        expect(table).toHaveClass('dash-table')
    })

    it('merges a custom className alongside dash-table', () => {
        const { container } = render(<Table className="table-fixed w-full"><TableBody /></Table>)
        const table = container.querySelector('table')
        expect(table).toHaveClass('dash-table', 'table-fixed', 'w-full')
    })
})

// ── TC-DS1222-01-02 — Wrapper carries border token ──────────────────────────
describe('[TC-DS1222-01-02] Table wrapper carries --dash-border / --dash-surface tokens', () => {
    it('wraps the table in a bordered surface card using dash tokens', () => {
        const { container } = render(<Table><TableBody /></Table>)
        // Outer wrapper is the first element child of the render container.
        const wrapper = container.firstElementChild as HTMLElement
        const style = wrapper.getAttribute('style') ?? ''
        expect(style).toContain('var(--dash-border)')
        expect(style).toContain('var(--dash-surface)')
    })
})

// ── TC-DS1222-01-03 — Footer slot renders inside the card ───────────────────
describe('[TC-DS1222-01-03] Table footer slot', () => {
    it('renders footer content with a top-border separator when footer is provided', () => {
        const { container } = render(
            <Table footer={<div>pager-here</div>}><TableBody /></Table>,
        )
        expect(screen.getByText('pager-here')).toBeInTheDocument()
        const footer = screen.getByText('pager-here').parentElement as HTMLElement
        expect(footer.getAttribute('style') ?? '').toContain('var(--dash-border)')
    })

    it('omits the footer wrapper when no footer is passed', () => {
        render(<Table><TableBody /></Table>)
        expect(screen.queryByText('pager-here')).not.toBeInTheDocument()
    })
})

// ── TC-DS1222-01-04 — TableActionButton neutral by default, red on danger ───
describe('[TC-DS1222-01-04] TableActionButton variants', () => {
    it('default variant stays neutral (no red hover class)', () => {
        render(<TableActionButton aria-label="edit">e</TableActionButton>)
        const btn = screen.getByRole('button', { name: 'edit' })
        expect(btn.className).not.toContain('text-red')
        expect(btn.getAttribute('style') ?? '').toContain('var(--dash-text-muted)')
    })

    it('danger variant turns red on hover', () => {
        render(<TableActionButton variant="danger" aria-label="del">d</TableActionButton>)
        const btn = screen.getByRole('button', { name: 'del' })
        expect(btn.className).toContain('hover:text-red-400')
    })

    it('forwards onClick', () => {
        const onClick = vi.fn()
        render(<TableActionButton aria-label="go" onClick={onClick}>g</TableActionButton>)
        fireEvent.click(screen.getByRole('button', { name: 'go' }))
        expect(onClick).toHaveBeenCalledTimes(1)
    })
})

// ── TC-DS1222-01-05 — SortableHead affordance + onSort ──────────────────────
describe('[TC-DS1222-01-05] SortableHead affordance reflects active column', () => {
    function renderHead(active: boolean, dir: 'asc' | 'desc', onSort = vi.fn()) {
        const { container } = render(
            <table><thead><tr>
                <SortableHead
                    label="Name"
                    sortKey="name"
                    currentSort={active ? 'name' : 'created'}
                    currentDir={dir}
                    onSort={onSort}
                />
            </tr></thead></table>,
        )
        return { container, onSort }
    }

    it('active ascending column shows the up chevron', () => {
        const { container } = renderHead(true, 'asc')
        expect(container.querySelector('.lucide-chevron-up')).not.toBeNull()
        expect(container.querySelector('.lucide-chevron-down')).toBeNull()
    })

    it('active descending column shows the down chevron', () => {
        const { container } = renderHead(true, 'desc')
        expect(container.querySelector('.lucide-chevron-down')).not.toBeNull()
    })

    it('inactive column shows the muted updown affordance', () => {
        const { container } = renderHead(false, 'asc')
        expect(container.querySelector('.lucide-chevrons-up-down')).not.toBeNull()
    })

    it('clicking the header calls onSort with its key', () => {
        const { onSort } = renderHead(false, 'asc')
        fireEvent.click(screen.getByText('Name'))
        expect(onSort).toHaveBeenCalledWith('name')
    })
})

// ── TC-DS1222-01-01 (header) — TableHead renders muted label band ───────────
describe('[TC-DS1222-01-01] TableHead/TableHeader structure', () => {
    it('TableHead renders a <th> with muted text token', () => {
        const { container } = render(
            <table><thead><tr><TableHead>Status</TableHead></tr></thead></table>,
        )
        const th = container.querySelector('th') as HTMLElement
        expect(th).toHaveTextContent('Status')
        expect(th.getAttribute('style') ?? '').toContain('var(--dash-text-muted)')
    })
})
