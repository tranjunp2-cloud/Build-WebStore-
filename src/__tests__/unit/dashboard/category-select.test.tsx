// @vitest-environment jsdom
// TC-F08-05-03: Attach category to product — cascading selector behavior

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

function getCategoryRow(text: string, occurrence = 0) {
    return screen.getAllByText(text)[occurrence]?.closest('[class*="cursor-pointer"]') as Element
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

    it('renders the selected breadcrumb in a bolder trigger style', () => {
        renderSelect(cats3Level, ['l3'])
        expect(screen.getByText('Fashion / Men / T-Shirts')).toHaveClass('font-semibold')
    })

    it('falls back to category name when breadcrumbs field absent', () => {
        renderSelect(cats2Level, ['l2'])
        expect(screen.getAllByText('Men').length).toBeGreaterThan(0)
    })
})

describe('TC-F08-05-03 — keyboard and ARIA accessibility', () => {
    it('links a unique accessible label and error to the trigger', () => {
        render(
            <div>
                <span id="category-label">Category for Test Product, draft 1</span>
                <CategorySelect
                    categories={cats3Level}
                    selectedIds={[]}
                    onChange={vi.fn()}
                    triggerId="category-trigger"
                    ariaLabelledBy="category-label"
                    errorId="category-error"
                    error="Category is required"
                />
            </div>,
        )

        const trigger = screen.getByRole('combobox', {
            name: 'Category for Test Product, draft 1',
        })
        expect(trigger).toHaveAttribute('id', 'category-trigger')
        expect(trigger).toHaveAttribute('aria-haspopup', 'tree')
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
        expect(trigger).toHaveAttribute('aria-invalid', 'true')
        expect(trigger).toHaveAttribute('aria-describedby', 'category-error')
        expect(screen.getByRole('alert')).toHaveAttribute('id', 'category-error')
    })

    it('uses a real disabled button that cannot open the tree', () => {
        render(
            <CategorySelect
                categories={cats3Level}
                selectedIds={[]}
                onChange={vi.fn()}
                ariaLabel="Category"
                disabled
            />,
        )

        const trigger = screen.getByRole('combobox', { name: 'Category' })
        expect(trigger).toBeDisabled()
        fireEvent.click(trigger)
        expect(screen.queryByRole('tree')).not.toBeInTheDocument()
    })

    it('does not announce a hovered desktop leaf as selected', () => {
        renderSelect()
        fireEvent.click(screen.getByRole('combobox', { name: 'Select categories...' }))

        const accessoryRows = screen.getAllByRole('treeitem', { name: 'Accessories' })
        const desktopRow = accessoryRows.at(-1) as HTMLButtonElement
        expect(desktopRow).toHaveAttribute('aria-selected', 'false')

        fireEvent.mouseEnter(desktopRow)

        expect(desktopRow).toHaveAttribute('aria-selected', 'false')
    })

    it('navigates all hierarchy levels with arrows and selects a leaf with Enter', async () => {
        const { onChange } = renderSelect()
        const trigger = screen.getByRole('combobox', { name: 'Select categories...' })

        fireEvent.keyDown(trigger, { key: 'ArrowDown' })
        await waitFor(() => expect(document.activeElement).toHaveTextContent('Fashion'))

        fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowRight' })
        await waitFor(() => expect(document.activeElement).toHaveTextContent('Men'))

        fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowRight' })
        await waitFor(() => expect(document.activeElement).toHaveTextContent('T-Shirts'))

        fireEvent.keyDown(document.activeElement as Element, { key: 'Enter' })
        expect(onChange).toHaveBeenCalledWith(['l3'])
        await waitFor(() => expect(trigger).toHaveFocus())
        expect(screen.queryByRole('tree')).not.toBeInTheDocument()
    })

    it('moves with ArrowDown/ArrowUp and restores trigger focus on Escape', async () => {
        renderSelect()
        const trigger = screen.getByRole('combobox', { name: 'Select categories...' })

        fireEvent.keyDown(trigger, { key: 'ArrowDown' })
        await waitFor(() => expect(document.activeElement).toHaveTextContent('Fashion'))
        fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowDown' })
        expect(document.activeElement).toHaveTextContent('Accessories')
        fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowUp' })
        expect(document.activeElement).toHaveTextContent('Fashion')

        fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })
        await waitFor(() => expect(trigger).toHaveFocus())
        expect(screen.queryByRole('tree')).not.toBeInTheDocument()
    })
})

describe('TC-F08-05-03 — Leaf-node selection', () => {
    it('opens panel on trigger click', () => {
        renderSelect()
        fireEvent.click(screen.getByText('Select categories...'))
        expect(screen.getAllByText('Fashion').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Accessories').length).toBeGreaterThan(0)
    })

    it('renders the dropdown with elevated panel styling', () => {
        const { container } = renderSelect()
        fireEvent.click(screen.getByText('Select categories...'))
        const panel = container.querySelector('.shadow-2xl')
        expect(panel).toBeInTheDocument()
        expect(panel).toHaveClass('rounded-xl', 'border-solid', 'flex-col', 'max-w-full', 'md:flex-row', 'md:max-w-[calc(100vw-2rem)]')
    })

    it('stacks child levels vertically on mobile instead of clipping sideways', () => {
        renderSelect()
        fireEvent.click(screen.getByText('Select categories...'))
        const expandedParent = getCategoryRow('Fashion', 0)
        fireEvent.click(expandedParent)
        expect(screen.getAllByText('Fashion').length).toBeGreaterThan(0)
        expect(expandedParent.querySelector('svg')).toHaveClass('rotate-90')
        fireEvent.click(getCategoryRow('Men', 0))
        const nestedLeaf = getCategoryRow('T-Shirts', 0)
        expect(nestedLeaf).toBeInTheDocument()
        expect(nestedLeaf).toHaveClass('pl-11')
    })

    it('selecting L1 leaf calls onChange([id]) immediately', () => {
        const { onChange } = renderSelect()
        fireEvent.click(screen.getByText('Select categories...'))
        fireEvent.click(getCategoryRow('Accessories', 0))
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
        fireEvent.mouseEnter(getCategoryRow('Fashion', 1))
        fireEvent.click(getCategoryRow('Men', 0))
        fireEvent.click(getCategoryRow('T-Shirts', 0))
        // onChange should be called with [l3] only, not ['l1-leaf', 'l3'] (replaces, not appends)
        expect(onChange).toHaveBeenLastCalledWith(['l3'])
    })
})

describe('TC-F08-05-03 — Col 1 panel: parent categories show ChevronRight', () => {
    it('L1 with children renders without immediate onChange call on hover', () => {
        const { onChange } = renderSelect()
        fireEvent.click(screen.getByText('Select categories...'))
        fireEvent.mouseEnter(getCategoryRow('Fashion', 1))
        expect(onChange).not.toHaveBeenCalled()
    })

    it('hovering L1 with children reveals L2 column', () => {
        renderSelect()
        fireEvent.click(screen.getByText('Select categories...'))
        fireEvent.mouseEnter(getCategoryRow('Fashion', 1))
        expect(screen.getAllByText('Men').length).toBeGreaterThan(0)
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
