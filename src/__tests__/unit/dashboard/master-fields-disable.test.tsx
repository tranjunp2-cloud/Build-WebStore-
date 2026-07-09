// @vitest-environment jsdom
import React, { useEffect } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { useForm, FormProvider } from 'react-hook-form'
import { TooltipProvider } from '@/components/ui/tooltip'

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            dashboard: {
                products: {
                    form: {
                        sections: {
                            variants: 'Variants & Inventory',
                            hasVariants: 'Product has multiple Options/Variants',
                            hasVariantsExample: 'Example: color, size, style',
                            price: 'Price (RM)',
                            comparePrice: 'Compare price (RM)',
                            sku: 'SKU code',
                            inventory: 'Inventory',
                            masterLockedTooltip: 'This product has variants — edit stock/price on each variant row below',
                        },
                    },
                },
            },
        },
    }),
}))

vi.mock('@/lib/utils', () => ({
    cn: (...args: (string | undefined | null | false)[]) => args.filter(Boolean).join(' '),
}))

import { MasterFieldsSection } from '@/components/dashboard/product-form/MasterFieldsSection'
import type { ProductFormValues } from '@/components/dashboard/product-form/schema'

// ── Test Harness: MasterFieldsSection Wrapper ─────────────────────────────────
function renderMasterFieldsSection(defaultValues: Partial<ProductFormValues>) {
    function Wrapper() {
        const methods = useForm<ProductFormValues>({
            defaultValues: {
                name: 'Test Product',
                categoryIds: [],
                images: [],
                hasVariants: false,
                basePrice: 50,
                baseInventory: 10,
                baseSku: 'SKU-001',
                tiers: [],
                variants: [],
                ...defaultValues,
            },
        })

        return (
            <TooltipProvider>
                <FormProvider {...methods}>
                    <MasterFieldsSection />
                </FormProvider>
            </TooltipProvider>
        )
    }

    return render(<Wrapper />)
}

// ── Tests ─────────────────────────────────────────────────────────────────────
// GH-1525 issue-1 update: locked master fields are HIDDEN entirely (not
// disabled+tooltip) — replaced by one explanatory line. baseSku always stays
// visible/editable in every state.

// ── TC-F08-1525-10..14: MasterFields Show/Hide Logic ──────────────────

describe('[TC-F08-1525-10..14] MasterFieldsSection show/hide logic', () => {
    // ── TC-F08-1525-10: Visible when no variants ──────────────────────────────

    it('TC-F08-1525-10: no variants → all master fields visible and enabled, no locked note', () => {
        // Arrange & Act
        renderMasterFieldsSection({
            hasVariants: false,
            variants: [],
        })

        // Assert
        const priceInput = screen.getByDisplayValue('50') as HTMLInputElement
        const inventoryInput = screen.getByDisplayValue('10') as HTMLInputElement
        const skuInput = screen.getByDisplayValue('SKU-001') as HTMLInputElement

        expect(priceInput.disabled).toBe(false)
        expect(inventoryInput.disabled).toBe(false)
        expect(skuInput.disabled).toBe(false)

        // No locked-note text should be visible
        expect(screen.queryByText(/This product has variants/i)).toBeNull()
    })

    // ── TC-F08-1525-11: Hidden when variants > 0 ─────────────────────────────

    it('TC-F08-1525-11: hasVariants=true + 1+ variants → price/compareAtPrice/inventory HIDDEN, sku stays visible', () => {
        // Arrange & Act
        renderMasterFieldsSection({
            hasVariants: true,
            basePrice: 50,
            compareAtPrice: 100,
            baseInventory: 10,
            baseSku: 'SKU-BASE',
            variants: [
                { id: '1', name: 'Red', stock: 5 },
            ],
        })

        // Assert: hidden fields are not in the DOM at all (not just disabled)
        expect(screen.queryByDisplayValue('50')).toBeNull()
        expect(screen.queryByDisplayValue('100')).toBeNull()
        expect(screen.queryByDisplayValue('10')).toBeNull()

        // Assert: SKU remains visible and enabled
        const skuInput = screen.getByDisplayValue('SKU-BASE') as HTMLInputElement
        expect(skuInput.disabled).toBe(false)
    })

    // ── TC-F08-1525-12: Explanatory note replaces the hidden fields ───────────

    it('TC-F08-1525-12: locked → single explanatory note shown in place of the 3 hidden fields', () => {
        // Arrange & Act
        renderMasterFieldsSection({
            hasVariants: true,
            basePrice: 50,
            compareAtPrice: 100,
            baseInventory: 10,
            variants: [
                { id: '1', name: 'Variant1', stock: 5 },
            ],
        })

        // Assert: exactly one explanatory note, not a per-field tooltip
        const notes = screen.getAllByText(/This product has variants/i)
        expect(notes).toHaveLength(1)
    })

    // ── TC-F08-1525-13: Re-show and retain values when variants cleared ─────

    it('TC-F08-1525-13: delete all variants → fields reappear, prior values retained', () => {
        // Arrange: a form-owning wrapper that pushes `variants` prop changes into the
        // live form via setValue — mirrors real "delete all variant rows" UX (no remount).
        function Wrapper({ variants }: { variants: ProductFormValues['variants'] }) {
            const methods = useForm<ProductFormValues>({
                defaultValues: {
                    name: 'Test Product',
                    categoryIds: [],
                    images: [],
                    hasVariants: true,
                    basePrice: 50,
                    compareAtPrice: 100,
                    baseInventory: 10,
                    baseSku: 'SKU-001',
                    tiers: [],
                    variants,
                },
            })

            useEffect(() => {
                methods.setValue('variants', variants)
            }, [variants, methods])

            return (
                <TooltipProvider>
                    <FormProvider {...methods}>
                        <MasterFieldsSection />
                    </FormProvider>
                </TooltipProvider>
            )
        }

        const { rerender } = render(<Wrapper variants={[{ id: '1', name: 'Red', stock: 5 }]} />)

        // Assert: initially locked — fields hidden, note shown
        expect(screen.queryByDisplayValue('50')).toBeNull()
        expect(screen.getByText(/This product has variants/i)).toBeInTheDocument()

        // Act: rerender with empty variants
        rerender(<Wrapper variants={[]} />)

        // Assert: fields reappear with prior values retained (RHF preserves state across unmount)
        const priceInput = screen.getByDisplayValue('50') as HTMLInputElement
        const compareAtPriceInput = screen.getByDisplayValue('100') as HTMLInputElement
        const inventoryInput = screen.getByDisplayValue('10') as HTMLInputElement

        expect(priceInput.disabled).toBe(false)
        expect(compareAtPriceInput.disabled).toBe(false)
        expect(inventoryInput.disabled).toBe(false)
        expect(priceInput.value).toBe('50')
        expect(compareAtPriceInput.value).toBe('100')
        expect(inventoryInput.value).toBe('10')
        expect(screen.queryByText(/This product has variants/i)).toBeNull()
    })

    // ── TC-F08-1525-14: Empty variants array but hasVariants=true → shown ─

    it('TC-F08-1525-14: hasVariants=true but empty variants → fields visible and enabled (toggle-on-before-generate)', () => {
        // Arrange & Act
        renderMasterFieldsSection({
            hasVariants: true,
            variants: [],
            basePrice: 75,
            baseInventory: 20,
        })

        // Assert
        const priceInput = screen.getByDisplayValue('75') as HTMLInputElement
        const inventoryInput = screen.getByDisplayValue('20') as HTMLInputElement

        expect(priceInput.disabled).toBe(false)
        expect(inventoryInput.disabled).toBe(false)

        // Locked note should NOT be visible (lockMaster requires both hasVariants AND variantCount > 0)
        expect(screen.queryByText(/This product has variants/i)).toBeNull()
    })

    // ── TC-F08-1525-70: dead "auto-filled" note removed (code-review fix) ────
    // Was gated on `hasVariants && !lockMaster` — exactly the window BEFORE any
    // auto-fill has happened (fields still fully editable) — and hidden exactly
    // when auto-fill actually starts (once locked). Misleading in every state;
    // removed entirely rather than re-gated, since `lockedNoteText` already
    // covers the locked state adequately.

    it('TC-F08-1525-70: no "auto-filled from variants" text renders in any state', () => {
        // toggle-on-before-generate: the state that used to (incorrectly) show it
        renderMasterFieldsSection({ hasVariants: true, variants: [] })
        expect(screen.queryByText(/auto-filled/i)).toBeNull()
    })
})
