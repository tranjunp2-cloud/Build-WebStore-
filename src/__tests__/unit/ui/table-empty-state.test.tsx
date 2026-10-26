import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'

import { TableEmptyState } from '@/components/ui/table-empty-state'

afterEach(cleanup)

// ── TC-DS1222-07-01 — Title + subtitle render ───────────────────────────────
describe('[TC-DS1222-07-01] TableEmptyState renders title and subtitle', () => {
    it('shows both the title and the subtitle text', () => {
        render(<TableEmptyState title="No discounts yet" subtitle="Create your first code" />)
        expect(screen.getByText('No discounts yet')).toBeInTheDocument()
        expect(screen.getByText('Create your first code')).toBeInTheDocument()
    })

    it('omits the subtitle node when none is given', () => {
        render(<TableEmptyState title="Empty" />)
        expect(screen.getByText('Empty')).toBeInTheDocument()
        expect(screen.queryByText('Create your first code')).not.toBeInTheDocument()
    })
})

// ── TC-DS1222-07-02 — Optional icon + action ────────────────────────────────
describe('[TC-DS1222-07-02] TableEmptyState optional icon and action', () => {
    it('renders the icon and action when provided', () => {
        render(
            <TableEmptyState
                title="Empty"
                icon={<svg data-testid="empty-icon" />}
                action={<button>Create</button>}
            />,
        )
        expect(screen.getByTestId('empty-icon')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
    })

    it('renders neither when not provided', () => {
        render(<TableEmptyState title="Empty" />)
        expect(screen.queryByTestId('empty-icon')).not.toBeInTheDocument()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
})

// ── TC-DS1222-07-03 — Surface + border tokens ───────────────────────────────
describe('[TC-DS1222-07-03] TableEmptyState uses dash surface + border tokens', () => {
    it('wraps content in a bordered surface card', () => {
        const { container } = render(<TableEmptyState title="Empty" />)
        const card = container.firstElementChild as HTMLElement
        const style = card.getAttribute('style') ?? ''
        expect(style).toContain('var(--dash-surface)')
        expect(style).toContain('var(--dash-border)')
    })
})

// ── TC-DS1222-07-04 — compact padding ───────────────────────────────────────
describe('[TC-DS1222-07-04] TableEmptyState compact padding', () => {
    // the mascot (104px compact / 148px default) carries the height the old padding did
    it('uses py-8 when compact', () => {
        const { container } = render(<TableEmptyState title="Empty" compact />)
        expect(container.firstElementChild).toHaveClass('py-8')
    })

    it('uses py-12 (md:py-16) by default', () => {
        const { container } = render(<TableEmptyState title="Empty" />)
        expect(container.firstElementChild).toHaveClass('py-12', 'md:py-16')
    })
})
