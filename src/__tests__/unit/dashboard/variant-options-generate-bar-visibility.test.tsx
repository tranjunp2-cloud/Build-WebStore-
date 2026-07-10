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

function renderSection(defaultValues: Partial<ProductFormValues>) {
    function Wrapper() {
        const methods = useForm<ProductFormValues>({
            defaultValues: {
                name: 'Test Product',
                categoryIds: [],
                images: [],
                hasVariants: true,
                basePrice: 50,
                compareAtPrice: 0,
                baseInventory: 0,
                baseSku: 'SKU-001',
                tiers: [],
                variants: [],
                ...defaultValues,
            },
        })

        return (
            <TooltipProvider>
                <FormProvider {...methods}>
                    <VariantOptionsSection />
                </FormProvider>
            </TooltipProvider>
        )
    }

    return render(<Wrapper />)
}

const generateButton = () => screen.queryByRole('button', { name: /generate variants/i })

// ── TC-F08-1525-43..45: "Generate variants" bar visibility (GH-1525 follow-up) ──
// Issue-4 follow-up UX: hide the Generate bar when there isn't enough info to
// generate, hide it again once a matrix already matches the current tiers, and
// only show it again when the user edits an option/value after a successful
// generate (making the existing matrix stale).

describe('[TC-F08-1525-43..45] VariantOptionsSection "Generate variants" bar visibility', () => {
    it('TC-F08-1525-43: insufficient tier info (empty name/options) → bar hidden', () => {
        // Arrange & Act: toggle-on auto-appends an empty tier — name/options both blank
        renderSection({ tiers: [{ id: 't1', name: '', options: [] }], variants: [] })

        // Assert
        expect(generateButton()).toBeNull()
    })

    it('TC-F08-1525-44: sufficient info → bar visible; hides again after a successful generate', async () => {
        // Arrange
        renderSection({
            tiers: [{ id: 't1', name: 'Color', options: ['Red', 'Blue'] }],
            variants: [],
        })

        // Assert: enough info now → bar visible
        expect(generateButton()).not.toBeNull()

        // Act: click Generate
        await act(async () => {
            fireEvent.click(generateButton()!)
            await Promise.resolve()
        })

        // Assert: matrix now matches tiers → bar hides
        expect(generateButton()).toBeNull()
        expect(screen.getAllByDisplayValue('SKU-001-RED').length).toBeGreaterThan(0)
    })

    it('TC-F08-1525-45: editing an option value after a successful generate re-shows the bar', async () => {
        // Arrange: generate once so the bar is hidden
        renderSection({
            tiers: [{ id: 't1', name: 'Color', options: ['Red', 'Blue'] }],
            variants: [],
        })
        await act(async () => {
            fireEvent.click(generateButton()!)
            await Promise.resolve()
        })
        expect(generateButton()).toBeNull()

        // Act: user edits an option value (Red → Crimson) — tiers no longer match the matrix
        const redInput = screen.getByDisplayValue('Red')
        fireEvent.change(redInput, { target: { value: 'Crimson' } })

        // Assert: bar reappears since the matrix is now stale
        expect(generateButton()).not.toBeNull()
    })

    // ── TC-F08-1525-46: edit-mode initial mount (code-review fix) ────────────
    // `lastGeneratedTiersSignatureRef` used to start unconditionally `null`, so
    // opening an EXISTING product (variants already loaded from the server,
    // matching tiers) incorrectly showed the bar on mount — the ref had nothing
    // to compare against yet, even though the matrix was already correct.

    it('TC-F08-1525-46: mounting with pre-loaded variants matching tiers (edit-mode) → bar hidden immediately', () => {
        // Arrange & Act: mirrors loading an existing product for editing — variants
        // already exist and match the tiers, as they would from a server fetch.
        renderSection({
            tiers: [{ id: 't1', name: 'Size', options: ['M', 'L'] }],
            variants: [
                { id: 'v1', variantName: 'M', skuCode: 'SKU-001-M', price: 50, stock: 10 },
                { id: 'v2', variantName: 'L', skuCode: 'SKU-001-L', price: 50, stock: 10 },
            ],
        })

        // Assert: no reason to regenerate — bar must not appear just because this is a fresh mount
        expect(generateButton()).toBeNull()
    })
})
