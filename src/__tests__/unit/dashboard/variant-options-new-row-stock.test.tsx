// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { useForm, FormProvider } from 'react-hook-form'
import { TooltipProvider } from '@/components/ui/tooltip'

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: { dashboard: { products: { form: { sections: {}, errors: {} } } } },
    }),
}))

import { VariantOptionsSection } from '@/components/dashboard/product-form/VariantOptionsSection'
import type { ProductFormValues } from '@/components/dashboard/product-form/schema'

function Wrapper() {
    const methods = useForm<ProductFormValues>({
        defaultValues: {
            name: 'Test Product',
            categoryIds: [],
            images: [],
            hasVariants: true,
            basePrice: 100,
            compareAtPrice: 0,
            baseInventory: 40,
            baseSku: 'SKU',
            tiers: [{ id: 't1', name: 'Size', options: ['M', 'L'] }],
            variants: [],
        },
    })
    ;(window as unknown as { __methods: typeof methods }).__methods = methods

    return (
        <TooltipProvider>
            <FormProvider {...methods}>
                <VariantOptionsSection />
            </FormProvider>
        </TooltipProvider>
    )
}

const getMethods = () => (window as unknown as { __methods: ReturnType<typeof useForm<ProductFormValues>> }).__methods

// ── TC-F08-1525-62: new variant row defaults to stock=0 once the product already has variants ──
// Reported: "nếu product đã có variant và user muốn generate variant mới, stock của
// các variant mới phải là 0" — via a real "Generate variants" button click, not just
// the pure buildVariantMatrix function in isolation.

describe('[TC-F08-1525-62] VariantOptionsSection new-row stock defaults to 0 once variants already exist', () => {
    it('TC-F08-1525-62: first generate seeds from Inventory; a later-added option row starts at 0, not the inflated baseInventory', async () => {
        // Arrange: first-ever generate — M and L each seed from the typed Inventory (40)
        render(<Wrapper />)
        const methods = getMethods()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /generate variants/i }))
            await Promise.resolve()
        })
        const afterFirstGenerate = methods.getValues('variants') as Array<{ variantName: string; stock: number }>
        expect(afterFirstGenerate.find(v => v.variantName === 'M')!.stock).toBe(40)
        expect(afterFirstGenerate.find(v => v.variantName === 'L')!.stock).toBe(40)
        // Sanity: the baseInventory-sync effect has now inflated the master field to 80 (40+40)
        expect(Number(methods.getValues('baseInventory'))).toBe(80)

        // Act: add a new "XL" option (bar reappears) and regenerate
        await act(async () => {
            methods.setValue('tiers', [{ id: 't1', name: 'Size', options: ['M', 'L', 'XL'] }])
        })
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /generate variants/i }))
            await Promise.resolve()
        })

        // Assert: existing M/L keep their own stock; the brand-new XL row starts at 0,
        // NOT the now-inflated baseInventory (80)
        const result = methods.getValues('variants') as Array<{ variantName: string; stock: number }>
        expect(result.find(v => v.variantName === 'M')!.stock).toBe(40)
        expect(result.find(v => v.variantName === 'L')!.stock).toBe(40)
        expect(result.find(v => v.variantName === 'XL')!.stock).toBe(0)
    })
})

// ── TC-F08-1525-63: clear-then-regenerate no longer re-inflates stock, AND baseInventory
// stays intact (does not violate GH-1525 issue-2 "decision #1" — no reset) ──
// Code-review adversarial finding (H1): `isFirstEverGenerate` in buildVariantMatrix can't
// distinguish "product never had variants" from "product HAD variants, all options were
// cleared" — both present as `currentVariants.length === 0`. After Inventory=100 →
// generate 2 rows (each 100, synced total 200) → delete all options → re-add + generate
// again, every new row was re-seeded from the STALE total (200 each, not 0) — the exact
// "stock cộng dồn" bug class this file's other tests already guard against, just reachable
// via a clear-then-regenerate path instead of a repeated-Generate-click path.
// First fix attempt force-reset baseInventory to 0 on clear, which fixed H1 but broke the
// separately-documented, separately-tested "decision #1" contract (master fields retain
// their prior value when variants are cleared — phase-02-master-fields-disable.md,
// TC-F08-1525-13 in master-fields-disable.test.tsx). The correct fix tracks a session-level
// `hasEverGeneratedRef` (see VariantOptionsSection) so new-row seeding no longer trusts a
// possibly-stale baseInventory once the session has generated before — WITHOUT ever
// force-resetting the field itself.

describe('[TC-F08-1525-63] VariantOptionsSection: clear-then-regenerate seeds 0, baseInventory stays intact', () => {
    function deleteOptionRowFor(displayValue: string) {
        const input = screen.getByDisplayValue(displayValue)
        const row = input.closest('div.flex.items-center.gap-2') as HTMLElement
        const btn = row.querySelector('button') as HTMLButtonElement
        fireEvent.click(btn)
    }

    it('TC-F08-1525-63: Inventory=100 → generate → clear all options → re-add → generate again → rows start at 0, baseInventory left intact (not reset, not re-inflated)', async () => {
        // Arrange: generate Red/Blue at Inventory=100 (each row seeds 100, sum-synced to 200)
        render(<Wrapper />)
        const methods = getMethods()
        await act(async () => {
            methods.setValue('tiers', [{ id: 't1', name: 'Color', options: ['Red', 'Blue'] }])
            methods.setValue('baseInventory', 100)
        })
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /generate variants/i }))
            await Promise.resolve()
        })
        expect(Number(methods.getValues('baseInventory'))).toBe(200)

        // Act: delete both option rows — clears the matrix entirely (combinations=0)
        await act(async () => { deleteOptionRowFor('Red') })
        await act(async () => { deleteOptionRowFor('Blue') })

        // Assert: variants cleared, but baseInventory is left INTACT (not force-reset to 0) —
        // per decision #1, clearing variants must never force-reset a master field (matches
        // TC-F08-1525-13). Deleting one option row at a time means the sync effect re-fires
        // on the Red deletion (matrix shrinks to just Blue, stock 100) BEFORE the Blue
        // deletion empties the matrix entirely — so the last-synced value carried forward is
        // 100 (Blue's own stock), not the original 200 sum. Either way, the key invariant is
        // it's never force-reset to 0.
        expect(methods.getValues('variants')).toEqual([])
        expect(Number(methods.getValues('baseInventory'))).toBe(100)

        // Act: re-add the same options and generate again
        await act(async () => {
            methods.setValue('tiers', [{ id: 't1', name: 'Color', options: ['Red', 'Blue'] }])
        })
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /generate variants/i }))
            await Promise.resolve()
        })

        // Assert: new rows start at 0 — the session already generated once before, so the
        // still-intact-but-stale baseInventory (200) must NOT be used as a per-row seed
        const result = methods.getValues('variants') as Array<{ variantName: string; stock: number }>
        expect(result.find(v => v.variantName === 'Red')!.stock).toBe(0)
        expect(result.find(v => v.variantName === 'Blue')!.stock).toBe(0)
    })
})
