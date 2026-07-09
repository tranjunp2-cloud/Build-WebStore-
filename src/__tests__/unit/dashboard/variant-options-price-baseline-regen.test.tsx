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
            basePrice: 300,
            compareAtPrice: 390,
            baseInventory: 0,
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

// ── TC-F08-1525-53: regenerate never wipes a variant-level compareAtPrice edit ──
// Reported: "generate lại thì compare price và price lại ghi đè xuống các variant
// đã được generate trước đó" — regenerating (via the "Generate variants" button)
// after adding a new tier option was silently resetting a row's manually-edited
// compareAtPrice back to the master value, whenever that row's PRICE was unchanged.

describe('[TC-F08-1525-53] VariantOptionsSection regenerate preserves per-row compareAtPrice edits', () => {
    it('TC-F08-1525-53: lowering one row\'s compareAtPrice survives a real Generate-button regenerate that adds a new option', async () => {
        // Arrange: generate the initial 2-row matrix (M, L), both inherit master compareAtPrice=390
        render(<Wrapper />)
        const methods = getMethods()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /generate variants/i }))
            await Promise.resolve()
        })
        expect(methods.getValues('variants').every((v: { compareAtPrice: number }) => v.compareAtPrice === 390)).toBe(true)

        // Act: user manually lowers L's compareAtPrice — price on L is untouched
        await act(async () => {
            const variants = methods.getValues('variants')
            methods.setValue(
                'variants',
                variants.map((v: { variantName: string }) => (v.variantName === 'L' ? { ...v, compareAtPrice: 350 } : v)),
            )
        })

        // Act: add a new option (XL) — this brings the "Generate variants" bar back — then regenerate
        await act(async () => {
            methods.setValue('tiers', [{ id: 't1', name: 'Size', options: ['M', 'L', 'XL'] }])
        })
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /generate variants/i }))
            await Promise.resolve()
        })

        // Assert: L's manual edit survived; M (untouched) and the new XL row still track master (390)
        const result = methods.getValues('variants') as Array<{ variantName: string; compareAtPrice: number }>
        expect(result.find(v => v.variantName === 'L')!.compareAtPrice).toBe(350)
        expect(result.find(v => v.variantName === 'M')!.compareAtPrice).toBe(390)
        expect(result.find(v => v.variantName === 'XL')!.compareAtPrice).toBe(390)
    })
})

// ── TC-F08-1525-54: adversarial-review Critical fix — "spooky action at a
// distance" price reset via the Bug-7 auto-fill effect ──────────────────────
// The "auto-fill basePrice/compareAtPrice from variant matrix" effect syncs the
// (hidden) master basePrice field to min(all variant prices) whenever ANY row's
// price changes — but that effect used to leave lastGeneratedBasePriceRef stale.
// Editing ONE row's price, then regenerating for an unrelated reason (e.g. adding
// a tier option), compared OTHER untouched rows against the stale ref and
// silently reset their price to the drifted master value.

describe('[TC-F08-1525-54] VariantOptionsSection regenerate baseline stays in sync with the auto-fill effect', () => {
    it('TC-F08-1525-54: editing one row\'s price, then regenerating for an unrelated tier change, must NOT reset an untouched row\'s price', async () => {
        // Arrange: generate Red/Blue at basePrice=100
        render(<Wrapper />)
        const methods = getMethods()
        await act(async () => {
            methods.setValue('tiers', [{ id: 't1', name: 'Color', options: ['Red', 'Blue'] }])
            methods.setValue('basePrice', 100)
        })
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /generate variants/i }))
            await Promise.resolve()
        })
        expect(methods.getValues('variants').every((v: { price: number }) => v.price === 100)).toBe(true)

        // Act: user edits ONLY Red's price to 50 — this drifts the hidden master
        // basePrice to 50 via the Bug-7 auto-fill effect (verified below)
        await act(async () => {
            const variants = methods.getValues('variants')
            methods.setValue(
                'variants',
                variants.map((v: { variantName: string }) => (v.variantName === 'Red' ? { ...v, price: 50 } : v)),
            )
        })
        expect(Number(methods.getValues('basePrice'))).toBe(50)

        // Act: add an unrelated new option (Green) and regenerate
        await act(async () => {
            methods.setValue('tiers', [{ id: 't1', name: 'Color', options: ['Red', 'Blue', 'Green'] }])
        })
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /generate variants/i }))
            await Promise.resolve()
        })

        // Assert: Blue was never touched by the user — must stay 100, not silently
        // drop to the drifted master price (50)
        const result = methods.getValues('variants') as Array<{ variantName: string; price: number }>
        expect(result.find(v => v.variantName === 'Blue')!.price).toBe(100)
        expect(result.find(v => v.variantName === 'Red')!.price).toBe(50)
    })
})
