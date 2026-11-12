/**
 * GH-2079 — the product pages against the server's answers.
 * TC-F08-04-155: a duplicate SKU the server RETURNS ({ ok:false, code:'FIELD_ERRORS' }) shows inline on the SKU / variant-SKU
 *   field + a localized toast (en / ms), keeps the typed data, and does not leave the page — on both the edit and new pages.
 * TC-F08-04-156: getProductAction → null (missing / another shop's product) → "not found" toast, back to /products, no form.
 * Real: ProductEditPage, new ProductPage, ProductForm, react-hook-form, i18n strings. Faked: next/*, sonner, server actions, form sections.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { useFormContext } from 'react-hook-form'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }))
const params = vi.hoisted(() => ({ id: '5' }))
vi.mock('next/navigation', () => ({ useRouter: () => router, useParams: () => params }))
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => React.createElement('a', { href, ...props }, children) }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/app/(dashboard)/products/categories/actions', () => ({ getCategoriesAction: vi.fn(async () => []) }))
vi.mock('@/components/dashboard/product-form/GeneralInfoSection', () => ({
    GeneralInfoSection: () => {
        const { register, formState } = useFormContext()
        const errors = formState.errors as Record<string, { message?: string }>
        return (
            <div>
                <input aria-label="name" {...register('name')} />
                <input aria-label="sku" {...register('baseSku')} />
                {errors.baseSku?.message && <p role="alert">{errors.baseSku.message}</p>}
            </div>
        )
    },
}))
for (const section of ['MasterFieldsSection', 'VariantOptionsSection', 'ShippingDimensionsSection', 'DescriptionSeoSection', 'AttributesSection']) {
    vi.doMock(`@/components/dashboard/product-form/${section}`, () => ({ [section]: () => null }))
}

const actions = vi.hoisted(() => ({ getProductAction: vi.fn(), saveProductAction: vi.fn(), deleteProductAction: vi.fn() }))
vi.mock('@/app/(dashboard)/products/actions', () => actions)

import ProductEditPage from '@/app/(dashboard)/products/[id]/page'
import NewProductPage from '@/app/(dashboard)/products/new/page'
import { I18nProvider } from '@/i18n'
import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'

Element.prototype.scrollIntoView = vi.fn()

const doc = { id: 5, name: 'Scarf', slug: 'scarf', price: 10, category: [{ id: 'c1' }], images: [], hasVariants: false, inventory: 1, sku: 'S', weight: 0.5, variantConfigs: [], variants: [], currency: 'MYR', updatedAt: '2026-11-10T01:00:00.000Z' }
const skuTaken = {
    ok: false, code: 'FIELD_ERRORS', message: 'SKU "bea-002" is already in use.',
    fieldErrors: { baseSku: { code: 'SKU_ALREADY_IN_USE', values: ['bea-002'] } },
}
const mount = (Page: React.ComponentType, locale: 'en' | 'ms' = 'en') => render(<I18nProvider defaultLocale={locale}><Page /></I18nProvider>)
const save = (label: RegExp) => fireEvent.click(screen.getByRole('button', { name: label }))

beforeEach(() => {
    vi.clearAllMocks()
    params.id = '5'
    actions.getProductAction.mockResolvedValue(doc)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
    cleanup()
    localStorage.clear()
    vi.restoreAllMocks()
})

describe('[TC-F08-04-155] duplicate SKU returned by the server', () => {
    it('edit page: inline error on the SKU field, localized toast, data kept, no navigation', async () => {
        actions.saveProductAction.mockResolvedValue(skuTaken)
        mount(ProductEditPage)
        const name = (await screen.findByLabelText('name')) as HTMLInputElement
        fireEvent.change(name, { target: { value: 'My typed name' } })
        fireEvent.change(screen.getByLabelText('sku'), { target: { value: 'bea-002' } })

        save(/save changes/i)

        expect(await screen.findByRole('alert')).toHaveTextContent('SKU "bea-002" is already in use.')
        expect(toast.error).toHaveBeenCalledWith('SKU "bea-002" is already in use.')
        expect(toast.success).not.toHaveBeenCalled()
        expect(name.value).toBe('My typed name')
        expect(router.push).not.toHaveBeenCalled()
    })

    it('edit page: ms locale uses the Malay string, not the server\'s English message', async () => {
        actions.saveProductAction.mockResolvedValue(skuTaken)
        localStorage.setItem('prefer_lang', 'ms')
        mount(ProductEditPage, 'ms')
        fireEvent.change(await screen.findByLabelText('name'), { target: { value: 'Nama baharu' } })

        fireEvent.click(await screen.findByRole('button', { name: new RegExp(ms.dashboard.products.form.saveChanges, 'i') }))

        const expected = ms.dashboard.products.form.errors.skuAlreadyInUse.replace('{value}', 'bea-002')
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expected))
        expect(toast.error).not.toHaveBeenCalledWith(skuTaken.message)
    })
})

describe('[TC-F08-04-156] product not found / other shop', () => {
    it('getProductAction → null: not-found toast, back to the list, no edit form', async () => {
        actions.getProductAction.mockResolvedValue(null)

        mount(ProductEditPage)

        await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/products'))
        expect(toast.error).toHaveBeenCalledWith(en.dashboard.products.form.notFound)
        expect(toast.error).not.toHaveBeenCalledWith(en.dashboard.products.form.failedLoad)
        // no (empty) edit form while the redirect completes
        expect(screen.queryByLabelText('name')).toBeNull()
        expect(screen.queryByRole('button', { name: /save changes/i })).toBeNull()
    })

    it('a real load failure keeps the "failed to load" toast (not folded into not-found)', async () => {
        actions.getProductAction.mockRejectedValue(new Error('db down'))

        mount(ProductEditPage)

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.dashboard.products.form.failedLoad))
        expect(router.replace).not.toHaveBeenCalled()
    })
})
