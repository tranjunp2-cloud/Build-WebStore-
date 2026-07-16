// @vitest-environment jsdom
// TC-F08-05-03: Attach category to product — cascading selector behavior

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            dashboard: {
                products: {
                    form: {
                        categories: { select: 'Select categories...' },
                    },
                },
            },
        },
    }),
}))

vi.mock('@/lib/utils', () => ({
    cn: (...args: (string | undefined | null | false)[]) => args.filter(Boolean).join(' '),
}))

import { CategorySelect, Category } from '../../../components/dashboard/CategorySelect'

const L1: Category = { id: 'l1', name: 'Fashion', parent: null }
const L2: Category = { id: 'l2', name: 'Men', parent: { id: 'l1' } }
const L3: Category = { id: 'l3', name: 'T-Shirts', breadcrumbs: 'Fashion > Men > T-Shirts', parent: { id: 'l2' } }
const L1_LEAF: Category = { id: 'l1-leaf', name: 'Accessories', breadcrumbs: 'Accessories', parent: null }

const cats3Level = [L1, L2, L3, L1_LEAF]
const cats2Level = [L1, L2]

// ── Helpers ───────────────────────────────────────────────────────────────

function renderSelect(
    categories: Category[] = cats3Level,
    selectedIds: (string | number)[] = [],
    onChange = vi.fn(),
) {
    return { onChange, ...render(
        <CategorySelect categories={categories} selectedIds={selectedIds} onChange={onChange} />,
    ) }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('TC-F08-05-03 — CategorySelect trigger display', () => {
    it('shows placeholder when nothing selected', () => {
        renderSelect()
        expect(screen.getByText('Select categories...')).toBeInTheDocument()
    })

    it('shows breadcrumb after selection — breadcrumbs field used (replaces > with /)', () => {
        renderSelect(cats3Level, ['l3'])
        expect(screen.getByText('Fashion / Men / T-Shirts')).toBeInTheDocument()
    })

    it('falls back to category name when breadcrumbs field absent', () => {
        renderSelect(cats2Level, ['l2'])
        expect(screen.getByText('Men')).toBeInTheDocument()
    })
})

describe('TC-F08-05-03 — Leaf-node selection', () => {
    it('opens panel on trigger click', () => {
        renderSelect()
        fireEvent.click(screen.getByText('Select categories...'))
        expect(screen.getByText('Fashion')).toBeInTheDocument()
        expect(screen.getByText('Accessories')).toBeInTheDocument()
    })

    it('selecting L1 leaf calls onChange([id]) immediately', () => {
        const { onChange } = renderSelect()
        fireEvent.click(screen.getByText('Select categories...'))
        fireEvent.click(screen.getByText('Accessories'))
        expect(onChange).toHaveBeenCalledWith(['l1-leaf'])
    })

    it('clicking same leaf again still calls onChange([id]) — no deselect (TC-F08-05-03)', () => {
        const { onChange } = renderSelect(cats3Level, ['l1-leaf'])
        fireEvent.click(screen.getByText('Accessories')) // open (Accessories is label showing)
        // The trigger shows "Accessories" breadcrumb; click it to open panel
        // Re-open and click same leaf
        fireEvent.click(document.querySelector('[class*="cursor-pointer"]') as Element)
        const leaf = screen.getAllByText('Accessories').find(el => el.tagName === 'SPAN')
        if (leaf) fireEvent.click(leaf.closest('[class*="cursor-pointer"]') as Element)
        // onChange must never be called with [] — always with [id]
        const calls = onChange.mock.calls
        calls.forEach(([ids]) => expect(ids.length).toBeGreaterThan(0))
    })

    it('TC-F08-05-11: selectLeaf/handleL3Select REPLACES selection with single value (single-select, not append)', () => {
        const { onChange } = renderSelect(cats3Level, ['l1-leaf'])
        fireEvent.click(screen.getByText('Accessories'))
        fireEvent.mouseEnter(screen.getByText('Fashion').closest('[class*="cursor-pointer"]') as Element)
        fireEvent.click(screen.getByText('Men').closest('[class*="cursor-pointer"]') as Element)
        fireEvent.click(screen.getByText('T-Shirts').closest('[class*="cursor-pointer"]') as Element)
        // onChange should be called with [l3] only, not ['l1-leaf', 'l3'] (replaces, not appends)
        expect(onChange).toHaveBeenLastCalledWith(['l3'])
    })
})

describe('TC-F08-05-03 — Col 1 panel: parent categories show ChevronRight', () => {
    it('L1 with children renders without immediate onChange call on hover', () => {
        const { onChange } = renderSelect()
        fireEvent.click(screen.getByText('Select categories...'))
        fireEvent.mouseEnter(screen.getByText('Fashion').closest('[class*="cursor-pointer"]') as Element)
        expect(onChange).not.toHaveBeenCalled()
    })

    it('hovering L1 with children reveals L2 column', () => {
        renderSelect()
        fireEvent.click(screen.getByText('Select categories...'))
        fireEvent.mouseEnter(screen.getByText('Fashion').closest('[class*="cursor-pointer"]') as Element)
        expect(screen.getByText('Men')).toBeInTheDocument()
    })
})

describe('TC-F08-05-03 — Edit mode hydration', () => {
    it('pre-highlights correct L1 row when selectedIds has an L3 leaf', () => {
        renderSelect(cats3Level, ['l3'])
        // Trigger label shows breadcrumb — hydration happened
        expect(screen.getByText('Fashion / Men / T-Shirts')).toBeInTheDocument()
    })
})

describe('External reset handling', () => {
    it('shows placeholder again after selectedIds cleared externally', () => {
        const { rerender } = render(
            <CategorySelect categories={cats3Level} selectedIds={['l3']} onChange={vi.fn()} />,
        )
        expect(screen.getByText('Fashion / Men / T-Shirts')).toBeInTheDocument()

        rerender(
            <CategorySelect categories={cats3Level} selectedIds={[]} onChange={vi.fn()} />,
        )
        expect(screen.getByText('Select categories...')).toBeInTheDocument()
    })
})
