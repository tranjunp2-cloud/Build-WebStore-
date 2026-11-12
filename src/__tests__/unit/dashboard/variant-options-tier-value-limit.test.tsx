// @vitest-environment jsdom
// GH-2261: a tier could get more than 30 values and the limit message never showed under it,
// because zodResolver puts array errors on `options.root` while the UI only read `options.message`.

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { TooltipProvider } from '@/components/ui/tooltip'
import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'

const i18nState = vi.hoisted(() => ({ t: {} as unknown }))

vi.mock('@/i18n', () => ({
    useI18n: () => ({ t: i18nState.t }),
}))

import { VariantOptionsSection } from '@/components/dashboard/product-form/VariantOptionsSection'
import { getProductFormSchema, MAX_OPTIONS_PER_TIER, type ProductFormValues } from '@/components/dashboard/product-form/schema'

const values = (count: number) => Array.from({ length: count }, (_, i) => `V${i + 1}`)

function renderSection(dict: typeof en, options: string[], name = 'Color') {
    i18nState.t = dict
    function Wrapper() {
        const methods = useForm<ProductFormValues>({
            resolver: zodResolver(getProductFormSchema(dict)),
            defaultValues: {
                name: 'Test Product', categoryIds: [], images: [], hasVariants: true,
                basePrice: 50, compareAtPrice: 0, baseInventory: 0, baseSku: 'SKU-001',
                tiers: [{ id: 't1', name, options }], variants: [],
            },
        })
        return (
            <TooltipProvider>
                <FormProvider {...methods}>
                    <VariantOptionsSection />
                    <button type="button" onClick={() => methods.trigger()}>validate</button>
                </FormProvider>
            </TooltipProvider>
        )
    }
    return render(<Wrapper />)
}

const addValuesButton = (dict: typeof en) => screen.getByRole('button', { name: dict.dashboard.products.form.sections.addOption })

async function validate() {
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'validate' })) })
}

describe('[TC-F08.169] Tier value limit in the schema', () => {
    it('accepts 30 values and rejects 31 with the limit message', () => {
        // Arrange
        const schema = getProductFormSchema(en)
        const tierIssues = (count: number) => {
            const result = schema.safeParse({ name: 'Shirt', hasVariants: true, tiers: [{ id: 't1', name: 'Color', options: values(count) }], variants: [] })
            return (result.error?.issues ?? []).filter(issue => issue.path[0] === 'tiers')
        }

        // Act
        const at30 = tierIssues(MAX_OPTIONS_PER_TIER)
        const at31 = tierIssues(MAX_OPTIONS_PER_TIER + 1)

        // Assert
        expect(MAX_OPTIONS_PER_TIER).toBe(30)
        expect(at30).toEqual([])
        expect(at31).toEqual([expect.objectContaining({ path: ['tiers', 0, 'options'], message: 'You can add up to 30 options per tier.' })])
    })
})

describe('[TC-F08-02-08] Tier value limit in the variant form', () => {
    beforeEach(() => cleanup())

    it.each([
        { lang: 'en', dict: en, message: 'You can add up to 30 options per tier.' },
        { lang: 'ms', dict: ms, message: 'Anda boleh tambah sehingga 30 pilihan setiap tahap.' },
    ])('$lang: reaching 30 values disables "Add values" and shows the limit', ({ dict, message }) => {
        // Arrange
        renderSection(dict, values(29))
        expect(addValuesButton(dict)).toBeEnabled()
        expect(screen.queryByText(message)).not.toBeInTheDocument()

        // Act
        fireEvent.click(addValuesButton(dict))

        // Assert
        expect(addValuesButton(dict)).toBeDisabled()
        expect(screen.getByText(message)).toBeInTheDocument()
    })

    it('a saved tier with more than 30 values shows the limit once, under that tier, on validate', async () => {
        // Arrange
        renderSection(en, values(35))

        // Act
        await validate()

        // Assert — the array error from zodResolver (options.root) is now rendered, not duplicated by the hint
        const shown = screen.getAllByText('You can add up to 30 options per tier.')
        expect(shown).toHaveLength(1)
        expect(shown[0]).toHaveClass('text-destructive')
    })

    it('a named tier with no values still shows "at least one option" (arrives on options.message, kept working)', async () => {
        // Arrange
        renderSection(en, [])

        // Act
        await validate()

        // Assert
        expect(screen.getByText(en.dashboard.products.form.errors.optionMin)).toBeInTheDocument()
    })

    it('duplicate values are reported on the rows only, not again under the tier', async () => {
        // Arrange
        renderSection(en, ['Red', 'red'])

        // Act
        await validate()

        // Assert — each duplicate row is flagged; the array-level "must be unique" line stays hidden
        expect(screen.getAllByText(en.dashboard.products.form.sections.duplicateValue)).toHaveLength(2)
        expect(screen.queryByText(en.dashboard.products.form.errors.uniqueOptions)).not.toBeInTheDocument()
    })
})
