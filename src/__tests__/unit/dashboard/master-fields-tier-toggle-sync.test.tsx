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

import { MasterFieldsSection } from '@/components/dashboard/product-form/MasterFieldsSection'
import { VariantOptionsSection } from '@/components/dashboard/product-form/VariantOptionsSection'
import type { ProductFormValues } from '@/components/dashboard/product-form/schema'

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

// ── TC-F08-1525-31: MasterFieldsSection Switch → VariantOptionsSection tier sync ──
// Regression guard: MasterFieldsSection and VariantOptionsSection each own an
// independent useFieldArray('tiers') instance. Appending via one instance's
// `append()` does NOT update the sibling instance's rendered `fields` — only a
// whole-array `setValue('tiers', [...])` write is observed cross-component.
// This test exercises the real Switch click (not seeded `defaultValues`) so it
// catches the desync class of bug that defaultValues-seeded tests miss.

describe('[TC-F08-1525-31] MasterFieldsSection ↔ VariantOptionsSection tier sync on toggle', () => {
    it('TC-F08-1525-31: toggling hasVariants on renders exactly one tier input row in VariantOptionsSection', async () => {
        // Arrange: VariantOptionsSection renders null while hasVariants is off
        render(<Wrapper />)
        expect(document.getElementById('tiers')).toBeNull()

        // Act: flip the switch (mirrors real user interaction, not defaultValues seeding)
        await act(async () => {
            fireEvent.click(screen.getByRole('switch'))
        })

        // Assert: exactly one tier row renders — no ghost/duplicate tier from a desync
        const tiersList = document.getElementById('tiers')
        expect(tiersList?.children.length).toBe(1)
        expect(screen.getAllByPlaceholderText(/color/i).length).toBe(1)
    })
})
