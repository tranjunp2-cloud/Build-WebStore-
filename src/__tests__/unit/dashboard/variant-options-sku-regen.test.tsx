// @vitest-environment jsdom
import React, { useEffect } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
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

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    cleanup()
})

// Wrapper pushes `baseSku` prop into the live RHF form via setValue on prop change —
// mirrors typing in MasterFieldsSection's sibling `baseSku` input post-split (no remount).
function Wrapper({ baseSku }: { baseSku: string }) {
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
            tiers: [{ id: 't1', name: 'Color', options: ['Red', 'Blue'] }],
            variants: [],
        },
    })

    useEffect(() => {
        methods.setValue('baseSku', baseSku)
    }, [baseSku, methods])

    return (
        <TooltipProvider>
            <FormProvider {...methods}>
                <VariantOptionsSection />
            </FormProvider>
        </TooltipProvider>
    )
}

// ── TC-F08-1525-30: baseSku change regenerates SKU matrix post-split ────────
// Regression guard for the debounced `useWatch('baseSku')` effect that replaced
// the old onBlur→regenerateMatrix reaction (moved from MasterFieldsSection into
// VariantOptionsSection since baseSku now lives in a sibling component).

describe('[TC-F08-1525-30] VariantOptionsSection baseSku regen (post-split)', () => {
    it('TC-F08-1525-30: debounced baseSku change updates auto-generated SKU prefixes, preserves suffixes', async () => {
        // Arrange: generate the initial matrix with baseSku='SKU-001'
        const { rerender } = render(<Wrapper baseSku="SKU-001" />)

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /generate variants/i }))
            await Promise.resolve()
        })

        expect(screen.getAllByDisplayValue('SKU-001-RED').length).toBeGreaterThan(0)
        expect(screen.getAllByDisplayValue('SKU-001-BLU').length).toBeGreaterThan(0)

        // Act: change baseSku prefix and let the 300ms debounce elapse
        rerender(<Wrapper baseSku="NEWSKU" />)
        act(() => { vi.advanceTimersByTime(300) })

        // Assert: matrix SKUs regenerated with the new prefix, suffixes preserved
        expect(screen.getAllByDisplayValue('NEWSKU-RED').length).toBeGreaterThan(0)
        expect(screen.getAllByDisplayValue('NEWSKU-BLU').length).toBeGreaterThan(0)
        expect(screen.queryAllByDisplayValue('SKU-001-RED').length).toBe(0)
        expect(screen.queryAllByDisplayValue('SKU-001-BLU').length).toBe(0)
    })

    it('TC-F08-1525-30b: rapid baseSku edits within debounce window only regenerate once (final value wins)', async () => {
        // Arrange
        const { rerender } = render(<Wrapper baseSku="SKU-001" />)
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /generate variants/i }))
            await Promise.resolve()
        })

        // Act: two rapid changes within the debounce window
        rerender(<Wrapper baseSku="MID" />)
        act(() => { vi.advanceTimersByTime(150) })
        rerender(<Wrapper baseSku="FINAL" />)
        act(() => { vi.advanceTimersByTime(300) })

        // Assert: only the final value produced a regenerated matrix
        expect(screen.getAllByDisplayValue('FINAL-RED').length).toBeGreaterThan(0)
        expect(screen.queryAllByDisplayValue('MID-RED').length).toBe(0)
        expect(screen.queryAllByDisplayValue('SKU-001-RED').length).toBe(0)
    })
})
