// @vitest-environment jsdom
// GH-2163 (TC-F08-02-06): turning off "has variants" with matrix data must ask first.

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { useForm, FormProvider, type UseFormReturn } from 'react-hook-form'
import { TooltipProvider } from '@/components/ui/tooltip'
import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'

const i18nState = vi.hoisted(() => ({ t: {} as unknown }))

vi.mock('@/i18n', () => ({
    useI18n: () => ({ t: i18nState.t }),
}))

import { VariantOptionsSection } from '@/components/dashboard/product-form/VariantOptionsSection'
import type { ProductFormValues } from '@/components/dashboard/product-form/schema'

const row = (variantName: string, sku: string) => ({
    id: sku, variantName, sku, price: 50, stock: 5, compareAtPrice: undefined,
}) as unknown as ProductFormValues['variants'][number]

const MATRIX = [row('Black-M', 'S-1'), row('Black-L', 'S-2'), row('White-M', 'S-3'), row('White-L', 'S-4')]
const TIERS = [
    { id: 't1', name: 'Colour', options: ['Black', 'White'] },
    { id: 't2', name: 'Size', options: ['M', 'L'] },
]

let form: UseFormReturn<ProductFormValues>

function renderSection(dict: typeof en, overrides: Partial<ProductFormValues>) {
    i18nState.t = dict
    function Wrapper() {
        form = useForm<ProductFormValues>({
            defaultValues: {
                name: 'Test', categoryIds: [], images: [], hasVariants: true,
                basePrice: 50, compareAtPrice: 0, baseInventory: 20, baseSku: 'SKU',
                tiers: [], variants: [], ...overrides,
            },
        })
        return (
            <TooltipProvider>
                <FormProvider {...form}>
                    <VariantOptionsSection />
                </FormProvider>
            </TooltipProvider>
        )
    }
    return render(<Wrapper />)
}

const toggle = () => screen.getByRole('switch')

describe('[TC-F08-02-06] Confirm before turning off variants', () => {
    beforeEach(() => cleanup())

    it.each([
        { lang: 'en', dict: en, yes: 'Yes', no: 'No' },
        { lang: 'ms', dict: ms, yes: 'Ya', no: 'Tidak' },
    ])('$lang: shows a warning and keeps variants On until confirmed', ({ dict, yes, no }) => {
        // Arrange
        renderSection(dict, { tiers: TIERS, variants: MATRIX })

        // Act
        fireEvent.click(toggle())

        // Assert
        const s = dict.dashboard.products.form.sections
        expect(screen.getByText(s.disableVariantsConfirmDesc)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: yes })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: no })).toBeInTheDocument()
        expect(form.getValues('hasVariants')).toBe(true)
        expect(form.getValues('variants')).toHaveLength(4)
    })

    it('No keeps the switch On with tiers and matrix intact', () => {
        // Arrange
        renderSection(en, { tiers: TIERS, variants: MATRIX })
        fireEvent.click(toggle())

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'No' }))

        // Assert
        expect(toggle()).toBeChecked()
        expect(form.getValues('hasVariants')).toBe(true)
        expect(form.getValues('variants')).toHaveLength(4)
        expect(form.getValues('tiers')).toHaveLength(2)
    })

    it('Yes turns variants Off and clears tiers + variants but not base fields', async () => {
        // Arrange
        renderSection(en, { tiers: TIERS, variants: MATRIX })
        fireEvent.click(toggle())

        // Act
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Yes' })) })

        // Assert
        expect(form.getValues('hasVariants')).toBe(false)
        expect(form.getValues('variants')).toEqual([])
        expect(form.getValues('tiers')).toEqual([])
        expect(form.getValues('baseInventory')).toBe(20)
        expect(form.getValues('basePrice')).toBe(50)
        expect(toggle()).not.toBeChecked()
    })

    it('Yes then turning variants back On appends exactly one fresh empty tier', async () => {
        // Arrange
        renderSection(en, { tiers: TIERS, variants: MATRIX })
        fireEvent.click(toggle())
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Yes' })) })

        // Act
        await act(async () => { fireEvent.click(toggle()) })

        // Assert
        expect(form.getValues('hasVariants')).toBe(true)
        const tiers = form.getValues('tiers')
        expect(tiers).toHaveLength(1)
        expect(tiers[0]).toMatchObject({ name: '', options: [] })
        expect(form.getValues('variants')).toEqual([])
    })

    it('a non-empty tier without generated rows still asks first', () => {
        // Arrange
        renderSection(en, { tiers: TIERS, variants: [] })

        // Act
        fireEvent.click(toggle())

        // Assert
        expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument()
        expect(form.getValues('hasVariants')).toBe(true)
    })

    it('with no matrix data it turns off immediately without a dialog', () => {
        // Arrange
        renderSection(en, { tiers: [{ id: 't1', name: '', options: [] }], variants: [] })

        // Act
        fireEvent.click(toggle())

        // Assert
        expect(screen.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument()
        expect(form.getValues('hasVariants')).toBe(false)
    })
})
