/**
 * GH-2096 — products list / form copy.
 * TC-F08-2096-01: the delete dialog no longer says the product is deleted permanently — delete is a soft delete
 *   with an Undo toast (PRD F08 BR-02).
 * TC-F08-2096-02: the "Please check these fields" toast names Weight and Compare-at price instead of the raw
 *   keys "shippingWeight" / "compareAtPrice".
 * Real: DeleteProductModal, ProductForm, zod schema, react-hook-form, en/ms strings. Faked: next/*, sonner, the
 * category action, and the form sections (the schema validation runs on initialData).
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => React.createElement('a', { href, ...props }, children) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: toastError } }))
vi.mock('@/app/(dashboard)/products/categories/actions', () => ({ getCategoriesAction: vi.fn(async () => []) }))
for (const section of ['GeneralInfoSection', 'MasterFieldsSection', 'VariantOptionsSection', 'ShippingDimensionsSection', 'DescriptionSeoSection', 'AttributesSection']) {
    vi.doMock(`@/components/dashboard/product-form/${section}`, () => ({ [section]: () => null }))
}

import { I18nProvider } from '@/i18n'
import { DeleteProductModal } from '@/components/dashboard/DeleteProductModal'
import type { ProductFormValues } from '@/components/dashboard/product-form/schema'
import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'

beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

describe('[TC-F08-2096-01] delete product dialog matches the soft delete', () => {
    it.each([
        ['en', en.dashboard.products.form.deleteWarning, /permanently|can't be undone/i],
        ['ms', ms.dashboard.products.form.deleteWarning, /kekal|tidak boleh dikembalikan/i],
    ] as const)('%s: says the delete can be undone, not that it is permanent', (locale, warning, permanentWording) => {
        // Arrange / Act
        render(
            <I18nProvider defaultLocale={locale}>
                <DeleteProductModal isOpen onClose={vi.fn()} onConfirm={vi.fn(async () => {})} productName="Cotton Tee" />
            </I18nProvider>,
        )

        // Assert
        expect(screen.getByText(warning)).toBeInTheDocument()
        expect(warning).not.toMatch(permanentWording)
        expect(screen.queryByText(permanentWording)).toBeNull()
    })
})

describe('[TC-F08-2096-02] invalid-fields toast uses readable field names', () => {
    // Name only (QC step: "Add product → only enter the name → Save as draft"), plus a compare-at price below the price.
    const invalid: Partial<ProductFormValues> = {
        name: 'Cotton Tee', urlSlug: 'cotton-tee', categoryIds: [], images: [], description: '', hasVariants: false,
        basePrice: 50, compareAtPrice: 10, baseInventory: 1, tiers: [], variants: [], attributes: [],
    }

    it.each([
        ['en', en.dashboard.products.form.fields],
        ['ms', ms.dashboard.products.form.fields],
    ] as const)('%s: names Weight and Compare-at price, never the raw keys', async (locale, fields) => {
        // Arrange
        const { ProductForm } = await import('@/components/dashboard/product-form/ProductForm')
        const { container } = render(
            <I18nProvider defaultLocale={locale}>
                <ProductForm initialData={invalid} />
            </I18nProvider>,
        )
        const form = await waitFor(() => {
            const el = container.querySelector('form')
            if (!el) throw new Error('form not mounted')
            return el
        })

        // Act
        fireEvent.submit(form)

        // Assert
        await waitFor(() => expect(toastError).toHaveBeenCalled())
        const message = String(toastError.mock.calls.at(-1)?.[0])
        expect(message).toContain(fields.weight)
        expect(message).toContain(fields.compareAtPrice)
        expect(message).not.toMatch(/shippingWeight|compareAtPrice/)
    })
})
