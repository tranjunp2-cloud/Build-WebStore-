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
