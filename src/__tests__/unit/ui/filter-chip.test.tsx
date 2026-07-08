import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'

import { FilterChip } from '@/components/ui/filter-chip'

afterEach(cleanup)

const OPTIONS = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'draft', label: 'Draft' },
] as const

type Key = (typeof OPTIONS)[number]['key']

function setup(value: Key = 'all', onChange = vi.fn()) {
    const utils = render(
        <FilterChip<Key>
            label="Status"
            value={value}
            options={OPTIONS as unknown as { key: Key; label: string }[]}
            onChange={onChange}
        />,
    )
    return { ...utils, onChange }
}

// ── TC-DS1222-04-01 — Shows label + selected option ─────────────────────────
describe('[TC-DS1222-04-01] FilterChip shows label and selected option', () => {
    it('renders "Status :" plus the label of the option matching value', () => {
        setup('active')
        const trigger = screen.getByRole('button')
        expect(trigger).toHaveTextContent('Status')
        expect(trigger).toHaveTextContent('Active')
    })
})

// ── TC-DS1222-04-02 — Opening shows the option list ─────────────────────────
describe('[TC-DS1222-04-02] FilterChip opens its dropdown', () => {
    it('renders every option as a button after clicking the pill', () => {
        setup('all')
        // Closed: only the trigger exists.
        expect(screen.getAllByRole('button')).toHaveLength(1)
        fireEvent.click(screen.getByRole('button'))
        // Open: trigger + 3 options.
        expect(screen.getAllByRole('button')).toHaveLength(1 + OPTIONS.length)
        expect(screen.getByRole('button', { name: 'Draft' })).toBeInTheDocument()
    })
})

// ── TC-DS1222-04-03 — Selecting an option fires onChange + closes ───────────
describe('[TC-DS1222-04-03] FilterChip selection', () => {
    it('calls onChange with the option key and closes the dropdown', () => {
        const { onChange } = setup('all')
        fireEvent.click(screen.getByRole('button')) // open
        fireEvent.click(screen.getByRole('button', { name: 'Draft' }))
        expect(onChange).toHaveBeenCalledWith('draft')
        // Closed again → only the trigger remains.
        expect(screen.getAllByRole('button')).toHaveLength(1)
    })
})

// ── TC-DS1222-04-04 — Active highlight when value differs from default ──────
describe('[TC-DS1222-04-04] FilterChip active highlight', () => {
    it('uses the active (primary teal) style when value is not the first/default option', () => {
        // GH-1192: active chip nay dùng token --primary (teal), không còn hardcode blue.
        // Design-system pass (fix/design-system-temp): colors moved from inline `style` to
        // Tailwind classes so `hover:` can apply (inline style would always win over CSS).
        setup('active')
        const className = screen.getByRole('button').className
        expect(className).toContain('bg-[hsl(var(--primary)/0.12)]')
    })

    it('uses the neutral border token when value is the default option', () => {
        setup('all')
        const className = screen.getByRole('button').className
        expect(className).toContain('border-[hsl(var(--input-border))]')
    })
})
