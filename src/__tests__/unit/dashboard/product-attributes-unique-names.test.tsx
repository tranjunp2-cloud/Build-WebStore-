// @vitest-environment jsdom
// GH-2260: two attributes with the same name saved fine and the storefront showed both rows.

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'

const i18nState = vi.hoisted(() => ({ t: {} as unknown }))

vi.mock('@/i18n', () => ({
    useI18n: () => ({ t: i18nState.t }),
}))

import { AttributesSection } from '@/components/dashboard/product-form/AttributesSection'
import { getProductFormSchema, type ProductFormValues } from '@/components/dashboard/product-form/schema'

type Row = { key: string; value: string }

const attributeIssues = (dict: typeof en, attributes: Row[]) => {
    const result = getProductFormSchema(dict).safeParse({ name: 'Shirt', hasVariants: false, attributes })
    return (result.error?.issues ?? []).filter(issue => issue.path[0] === 'attributes')
}

function renderSection(dict: typeof en, attributes: Row[]) {
    i18nState.t = dict
    function Wrapper() {
        const methods = useForm<ProductFormValues>({
            resolver: zodResolver(getProductFormSchema(dict)),
            defaultValues: { name: 'Shirt', hasVariants: false, attributes },
        })
        return (
            <FormProvider {...methods}>
                <AttributesSection />
                <button type="button" onClick={() => methods.trigger()}>validate</button>
            </FormProvider>
        )
    }
    return render(<Wrapper />)
}

describe('[TC-F08-06-03][TC-F08.146] Attribute names must be unique', () => {
    beforeEach(() => cleanup())

    it.each([
        { lang: 'en', dict: en, message: 'Each attribute name must be unique.' },
        { lang: 'ms', dict: ms, message: 'Setiap nama atribut mesti berbeza dan tidak boleh berulang' },
    ])('$lang: a repeated name (any case, extra spaces) is rejected on the later row', ({ dict, message }) => {
        // Arrange / Act
        const issues = attributeIssues(dict, [
            { key: 'Material', value: 'Cotton' },
            { key: 'Origin', value: 'Malaysia' },
            { key: ' material ', value: 'Silk' },
        ])

        // Assert — only the later copy is flagged, at its name field
        expect(issues).toEqual([expect.objectContaining({ path: ['attributes', 2, 'key'], message })])
    })

    it.each([en, ms])('[TC-F08-04-149] preserves legacy duplicates until attributes change', (dict) => {
        // Arrange
        const attributes = [{ key: 'Material', value: 'Cotton' }, { key: ' material ', value: 'Silk' }]
        const schema = getProductFormSchema(dict, [], { isEdit: true, attributes })
        const product = { name: 'Shirt', categoryIds: ['1'], images: [], urlSlug: 'shirt', hasVariants: false, basePrice: 10, baseSku: 'SHIRT', baseInventory: 1, shippingWeight: 1, attributes }
        // Act / Assert
        expect(schema.safeParse({ ...product, name: 'Renamed shirt' }).success).toBe(true)
        const changed = schema.safeParse({ ...product, attributes: [attributes[0], { ...attributes[1], value: 'Linen' }] })
        expect(changed.error?.issues).toContainEqual(expect.objectContaining({ path: ['attributes', 1, 'key'], message: dict.dashboard.products.form.attributes.errorDuplicate }))
    })

    it('flags every extra copy, not just the first repeat', () => {
        // Arrange / Act
        const issues = attributeIssues(en, [
            { key: 'Brand', value: 'A' },
            { key: 'BRAND', value: 'B' },
            { key: 'brand', value: 'C' },
        ])

        // Assert
        expect(issues.map(issue => issue.path)).toEqual([['attributes', 1, 'key'], ['attributes', 2, 'key']])
    })

    it('different names pass, and the same value under different names is fine', () => {
        // Arrange / Act
        const issues = attributeIssues(en, [
            { key: 'Material', value: 'Cotton' },
            { key: 'Lining', value: 'Cotton' },
        ])

        // Assert
        expect(issues).toEqual([])
    })

    it('the form shows the message under the repeated row only', async () => {
        // Arrange
        renderSection(en, [
            { key: 'Material', value: 'Cotton' },
            { key: 'Material', value: 'Silk' },
        ])

        // Act
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'validate' })) })

        // Assert
        const message = screen.getByText('Each attribute name must be unique.')
        expect(screen.getAllByText('Each attribute name must be unique.')).toHaveLength(1)
        const nameInputs = screen.getAllByPlaceholderText(en.dashboard.products.form.sections.attributeKey)
        expect(nameInputs[0]).not.toHaveClass('border-destructive')
        expect(nameInputs[1]).toHaveClass('border-destructive')
        expect(nameInputs[1].parentElement).toContainElement(message)
    })
})
