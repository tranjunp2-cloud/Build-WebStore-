// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
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
                            masterLockedTooltip: 'This product has variants',
                        },
                        errors: {},
                    },
                },
            },
        },
    }),
}))

import { MasterFieldsSection } from '@/components/dashboard/product-form/MasterFieldsSection'
import { VariantOptionsSection } from '@/components/dashboard/product-form/VariantOptionsSection'
import type { ProductFormValues } from '@/components/dashboard/product-form/schema'

// ── TC-F08-1525-64: H1 fix must not violate GH-1525 issue-2 "decision #1" ──
// (see plans/260708-1525-product-detail-list-ux/phase-02-master-fields-disable.md:
// "re-enable + keep values when removed... Never call setValue/reset on toggle").
// TC-F08-1525-13 (master-fields-disable.test.tsx) guards decision #1 but renders
// MasterFieldsSection in isolation, so VariantOptionsSection's baseInventory-sync
// effect never runs there and can't catch a regression in it. This test mounts BOTH
// sibling components under one FormProvider — matching ProductForm.tsx in production —
// so the sync effect's real behavior is exercised. An earlier H1 fix attempt force-reset
// baseInventory to 0 whenever variants became empty, which passed TC-F08-1525-63 in
// isolation but silently broke decision #1 here.

function Wrapper() {
    const methods = useForm<ProductFormValues>({
        defaultValues: {
            name: 'Test Product',
            categoryIds: [],
            images: [],
            hasVariants: true,
            basePrice: 50,
            compareAtPrice: 0,
            baseInventory: 10,
            baseSku: 'SKU',
            tiers: [{ id: 't1', name: 'Color', options: ['Red', 'Blue'] }],
            variants: [],
        },
    })
    ;(window as unknown as { __methods: typeof methods }).__methods = methods

    return (
        <TooltipProvider>
            <FormProvider {...methods}>
                <MasterFieldsSection />
                <VariantOptionsSection />
            </FormProvider>
        </TooltipProvider>
    )
}

const getMethods = () => (window as unknown as { __methods: ReturnType<typeof useForm<ProductFormValues>> }).__methods

describe('[TC-F08-1525-64] MasterFieldsSection + VariantOptionsSection integration: clearing variants never force-resets baseInventory', () => {
    it('TC-F08-1525-64: generate variants → delete all options → baseInventory is retained (not reset to 0), Inventory field re-shows that retained value', async () => {
        render(<Wrapper />)
        const methods = getMethods()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /generate variants/i }))
            await Promise.resolve()
        })
        // Sanity: sum-synced from the two generated rows (10 seed each → 20)
        expect(Number(methods.getValues('baseInventory'))).toBe(20)

        function deleteOptionRowFor(displayValue: string) {
            const input = screen.getByDisplayValue(displayValue)
            const row = input.closest('div.flex.items-center.gap-2') as HTMLElement
            const btn = row.querySelector('button') as HTMLButtonElement
            fireEvent.click(btn)
        }
        await act(async () => { deleteOptionRowFor('Red') })
        await act(async () => { deleteOptionRowFor('Blue') })

        // Assert: variants cleared, baseInventory NEVER forced to 0 (decision #1)
        expect(methods.getValues('variants')).toEqual([])
        expect(Number(methods.getValues('baseInventory'))).not.toBe(0)

        // Assert: MasterFieldsSection re-shows the Inventory input with that retained value
        const retained = String(methods.getValues('baseInventory'))
        const inventoryInput = screen.getByDisplayValue(retained) as HTMLInputElement
        expect(inventoryInput.disabled).toBe(false)
    })
})
