// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { useForm, FormProvider } from 'react-hook-form'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { computeStockDisplay, singleSeverity } from '@/lib/products/stock-display'

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            dashboard: {
                products: {
                    form: {
                        sections: {
                            variants: 'Variants & Inventory',
                        },
                    },
                },
            },
        },
    }),
}))

import { MasterFieldsSection } from '@/components/dashboard/product-form/MasterFieldsSection'
import { VariantOptionsSection } from '@/components/dashboard/product-form/VariantOptionsSection'
import type { ProductFormValues } from '@/components/dashboard/product-form/schema'

// ── TC-F08-1525-20..24: Products List Stock Cell Rendering ──────────────────────

describe('[TC-F08-1525-20..24] Products list stock cell rendering', () => {
    // ── TC-F08-1525-20: Single number → plain badge ──────────────────────────

    it('TC-F08-1525-20: single stock → renders plain Badge with label', () => {
        // Arrange
        const product = { hasVariants: false, inventory: 15 }
        const stockDisplay = computeStockDisplay(product)

        // Act
        render(
            <Badge variant={stockDisplay.severity} dot>
                {stockDisplay.label}
            </Badge>,
        )

        // Assert
        const badge = screen.getByText('15')
        expect(badge).toBeInTheDocument()
        expect(badge.className).toContain('rounded-md')
    })

    // ── TC-F08-1525-21: Multi-variant total with breakdown → Tooltip wrapper ──

    it('TC-F08-1525-21: multi-variant stock with breakdown → renders Tooltip trigger + total Badge + breakdown content', () => {
        // Arrange
        const product = {
            hasVariants: true,
            variants: [
                { name: 'Red-S', stock: 5 },
                { name: 'Blue-L', stock: 15 },
            ],
        }
        const stockDisplay = computeStockDisplay(product)

        // Act
        render(
            <TooltipProvider>
                <Tooltip defaultOpen>
                    <TooltipTrigger asChild>
                        <div>
                            <Badge variant={stockDisplay.severity} dot>
                                {stockDisplay.label}
                            </Badge>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <ul>
                            {stockDisplay.breakdown?.map((item, idx) => (
                                <li key={idx}>{item.name}: {item.stock}</li>
                            ))}
                        </ul>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>,
        )

        // Assert — label is the master-inventory total (5+15=20), not a "5 - 15" range
        const badge = screen.getByText('20')
        expect(badge).toBeInTheDocument()
        expect(badge.className).toContain('rounded-md')

        // Breakdown should be in DOM (Tooltip content) — Radix renders a duplicate
        // visually-hidden a11y copy alongside the visible content, so query all.
        expect(screen.getAllByText('Red-S: 5').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Blue-L: 15').length).toBeGreaterThan(0)
    })

    // ── TC-F08-1525-22: Single variant → total (=that variant's stock), showVariantCount=true ──

    it('TC-F08-1525-22: single variant (1 option) → total badge, showVariantCount=true so caller shows "1 variant", breakdown still populated', () => {
        // Arrange
        const product = {
            hasVariants: true,
            variants: [{ name: 'Red-M', stock: 8 }],
        }
        const stockDisplay = computeStockDisplay(product)

        // Act
        render(
            <Badge variant={stockDisplay.severity} dot>
                {stockDisplay.label}
            </Badge>,
        )

        // Assert
        expect(screen.getByText('8')).toBeInTheDocument()
        expect(stockDisplay.showVariantCount).toBe(true)
        expect(stockDisplay.variantCount).toBe(1)
        // breakdown should be present (for consistency even if single)
        expect(stockDisplay.breakdown).toEqual([{ name: 'Red-M', stock: 8 }])
    })

    // ── TC-F08-1525-23: Breakdown length check ────────────────────────────────

    it('TC-F08-1525-23: breakdown.length > 1 with range → Tooltip; breakdown.length === 1 → plain Badge', () => {
        // Single variant case: breakdown.length === 1
        const single = {
            hasVariants: true,
            variants: [{ name: 'V1', stock: 10 }],
        }
        const singleDisplay = computeStockDisplay(single)

        // Multiple variant case: breakdown.length > 1 and differs
        const multiple = {
            hasVariants: true,
            variants: [
                { name: 'V1', stock: 5 },
                { name: 'V2', stock: 10 },
            ],
        }
        const multipleDisplay = computeStockDisplay(multiple)

        // Assert
        expect(singleDisplay.breakdown?.length).toBe(1)
        expect(multipleDisplay.breakdown?.length).toBe(2)
        expect(multipleDisplay.showVariantCount).toBe(true)

        // Single: no tooltip needed (only 1 variant to show)
        // Multiple: tooltip helpful to show all variants
    })

    // ── TC-F08-1525-42: Breakdown row color reflects EACH variant's own severity ──
    // GH-1525 issue-4 visual polish: the breakdown popup was plain text (no color
    // signal at all). Each row now gets a dot + text color from `singleSeverity`
    // applied to THAT row's own stock — not the overall range severity — so a
    // mixed-stock product visually distinguishes its out-of-stock variant from its
    // healthy one, even though the outer Badge shows a single range severity.

    it('TC-F08-1525-42: each breakdown row is colored by its own stock, not the range severity', () => {
        // Arrange: one destructive (0), one warning (3), one success (20) row —
        // the outer range severity would be 'warning' (min=0,max>0 → per rangeSeverity),
        // but each row must reflect its own value independently.
        const product = {
            hasVariants: true,
            variants: [
                { name: 'Out', stock: 0 },
                { name: 'Low', stock: 3 },
                { name: 'Healthy', stock: 20 },
            ],
        }
        const stockDisplay = computeStockDisplay(product)

        // Act: mirror the real per-row rendering (page.tsx Stock cell breakdown)
        render(
            <ul>
                {stockDisplay.breakdown!.map((v, i) => (
                    <li key={i} data-severity={singleSeverity(v.stock)}>
                        {v.name}: {v.stock}
                    </li>
                ))}
            </ul>,
        )

        // Assert: each row's computed severity is independent of the others
        expect(screen.getByText('Out: 0').closest('li')).toHaveAttribute('data-severity', 'destructive')
        expect(screen.getByText('Low: 3').closest('li')).toHaveAttribute('data-severity', 'warning')
        expect(screen.getByText('Healthy: 20').closest('li')).toHaveAttribute('data-severity', 'success')
    })

    // ── TC-F08-1525-24: ProductForm section order (Master before VariantOptions) ──

    it('TC-F08-1525-24: ProductForm renders MasterFieldsSection before VariantOptionsSection', () => {
        // Arrange: render the real split sections in ProductForm.tsx's actual order
        // (MasterFieldsSection then VariantOptionsSection, both inside one shared
        // "Variants & Inventory" card — src/components/dashboard/product-form/ProductForm.tsx).
        // The card's own h2 heading is owned by ProductForm.tsx, not either section
        // component, so this test anchors on a MasterFieldsSection-only field instead.
        function Wrapper() {
            const methods = useForm<ProductFormValues>({
                defaultValues: {
                    name: 'Test Product',
                    categoryIds: [],
                    images: [],
                    hasVariants: true,
                    basePrice: 50,
                    baseInventory: 10,
                    baseSku: 'SKU-001',
                    tiers: [{ id: 't1', name: 'Color', options: ['Red'] }],
                    variants: [],
                },
            })

            return (
                <TooltipProvider>
                    <FormProvider {...methods}>
                        <MasterFieldsSection />
                        <VariantOptionsSection />
                    </FormProvider>
                </TooltipProvider>
            )
        }

        // Act
        render(<Wrapper />)

        // Assert: MasterFieldsSection's basePrice input appears before the Variant tiers list in DOM order
        const masterPriceInput = screen.getByDisplayValue('50')
        const tiersList = document.getElementById('tiers')
        expect(tiersList).not.toBeNull()
        expect(masterPriceInput.compareDocumentPosition(tiersList as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    })
})

// ── Additional tests for severity rendering ────────────────────────────────────

describe('[TC-F08-1525] Stock severity rendering', () => {
    it('renders destructive (red) badge when severity=destructive', () => {
        const product = { hasVariants: false, inventory: 0 }
        const stockDisplay = computeStockDisplay(product)

        render(
            <Badge variant={stockDisplay.severity} dot>
                {stockDisplay.label}
            </Badge>,
        )

        expect(stockDisplay.severity).toBe('destructive')
        expect(screen.getByText(stockDisplay.label).className).toContain('bg-red-500')
    })

    it('renders warning (yellow) badge when severity=warning', () => {
        const product = {
            hasVariants: true,
            variants: [
                { name: 'V1', stock: 0 },
                { name: 'V2', stock: 10 },
            ],
        }
        const stockDisplay = computeStockDisplay(product)

        render(
            <Badge variant={stockDisplay.severity} dot>
                {stockDisplay.label}
            </Badge>,
        )

        expect(stockDisplay.severity).toBe('warning')
        expect(screen.getByText(stockDisplay.label).className).toContain('bg-amber-500')
    })

    it('renders success (green) badge when severity=success', () => {
        const product = {
            hasVariants: true,
            variants: [
                { name: 'V1', stock: 10 },
                { name: 'V2', stock: 20 },
            ],
        }
        const stockDisplay = computeStockDisplay(product)

        render(
            <Badge variant={stockDisplay.severity} dot>
                {stockDisplay.label}
            </Badge>,
        )

        expect(stockDisplay.severity).toBe('success')
        expect(screen.getByText(stockDisplay.label).className).toContain('bg-emerald-500')
    })
})
