/**
 * TC-AICP-308 — the product form while the copilot changes the same product: no unsaved edits -> the product is
 * loaded again silently and the form is reset with the new values (no notice); unsaved edits -> nothing is replaced and
 * the "assistant updated this product" notice shows; Reload loads and resets; Keep mine dismisses without loading;
 * another product's change, and a form opened for a new product, do nothing; edits typed while the fetch was in
 * flight are never replaced.
 * Real: ProductForm, react-hook-form, the agent-changes bus + hooks, AgentChangedNotice, en strings. Faked: next/*,
 * the category action, and the form sections (one name input stands in for them).
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { useFormContext } from 'react-hook-form'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => React.createElement('a', { href, ...props }, children) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/app/(dashboard)/products/categories/actions', () => ({ getCategoriesAction: vi.fn(async () => []) }))
vi.mock('@/components/dashboard/product-form/GeneralInfoSection', () => ({
    GeneralInfoSection: () => <input aria-label="name" {...useFormContext().register('name')} />,
}))
for (const section of ['MasterFieldsSection', 'VariantOptionsSection', 'ShippingDimensionsSection', 'DescriptionSeoSection', 'AttributesSection']) {
    vi.doMock(`@/components/dashboard/product-form/${section}`, () => ({ [section]: () => null }))
}

import { announceAgentChange } from '@/lib/agent-changes/bus'
import type { AgentChange } from '@/lib/agent-changes/types'
import { I18nProvider } from '@/i18n'
import type { ProductFormValues } from '@/components/dashboard/product-form/schema'

const base: Partial<ProductFormValues> = { name: 'Old name', urlSlug: 'old-name', categoryIds: [], images: [], description: '', hasVariants: false, basePrice: 10, baseInventory: 1, tiers: [], variants: [], attributes: [] }
const change = (id: string, at = 1): AgentChange => ({ action: 'applied', kind: 'shop_product.update', entities: [{ kind: 'product', id }], changeSetId: `cs-${at}`, at })
const announce = async (c: AgentChange) => { await act(async () => { announceAgentChange(c) }) }

async function mount(props: { recordId?: string; isEdit?: boolean; initialData?: Partial<ProductFormValues>; onSubmitForm?: (data: ProductFormValues) => Promise<void> } = {}) {
    const { ProductForm } = await import('@/components/dashboard/product-form/ProductForm')
    const onReload = vi.fn(async (_isStillClean: () => boolean) => ({ ...base, name: 'New name' }) as Partial<ProductFormValues> | null)
    render(
        <I18nProvider defaultLocale="en">
            <ProductForm isEdit={props.isEdit ?? true} recordId={'recordId' in props ? props.recordId : '5'} initialData={props.initialData ?? base} onReload={onReload} onSubmitForm={props.onSubmitForm} />
        </I18nProvider>,
    )
    const input = (await screen.findByLabelText('name')) as HTMLInputElement
    return { onReload, input }
}

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

describe('product form follows the copilot [TC-AICP-308]', () => {
    it('TC-AICP-308 no unsaved edits: loads again and resets the form with the new values, no notice', async () => {
        const { onReload, input } = await mount()
        expect(input.value).toBe('Old name')

        await announce(change('5'))
        await waitFor(() => expect(input.value).toBe('New name'))
        expect(onReload).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('status')).toBeNull()
        // the reset form is clean again: no save bar
        expect(screen.queryByText(/unsaved/i)).toBeNull()
    })

    it('TC-AICP-308 unsaved edits: keeps them, shows the notice, does not load', async () => {
        const { onReload, input } = await mount()
        fireEvent.change(input, { target: { value: 'My edit' } })

        await announce(change('5'))
        expect(await screen.findByText('The assistant updated this product.')).toBeInTheDocument()
        await new Promise(resolve => setTimeout(resolve, 250))
        expect(onReload).not.toHaveBeenCalled()
        expect(input.value).toBe('My edit')
    })

    it('TC-AICP-308 Reload loads and resets, then the notice is gone', async () => {
        const { onReload, input } = await mount()
        fireEvent.change(input, { target: { value: 'My edit' } })
        await announce(change('5'))
        fireEvent.click(await screen.findByRole('button', { name: 'Reload' }))

        await waitFor(() => expect(input.value).toBe('New name'))
        expect(onReload).toHaveBeenCalledTimes(1)
        expect(screen.queryByText('The assistant updated this product.')).toBeNull()
    })

    it('TC-AICP-308 Keep mine dismisses the notice without loading and without touching the edits', async () => {
        const { onReload, input } = await mount()
        fireEvent.change(input, { target: { value: 'My edit' } })
        await announce(change('5'))
        fireEvent.click(await screen.findByRole('button', { name: 'Keep mine' }))

        expect(screen.queryByText('The assistant updated this product.')).toBeNull()
        expect(onReload).not.toHaveBeenCalled()
        expect(input.value).toBe('My edit')
    })

    it('TC-AICP-308 does not replace what the merchant typed while the product was loading', async () => {
        const { onReload, input } = await mount()
        let release!: () => void
        onReload.mockImplementationOnce(async (isStillClean) => {
            await new Promise<void>(resolve => { release = resolve })
            return isStillClean() ? { ...base, name: 'New name' } : null
        })
        await announce(change('5'))
        await waitFor(() => expect(release).toBeDefined())

        fireEvent.change(input, { target: { value: 'typed later' } })
        await act(async () => { release() })
        expect(input.value).toBe('typed later')
    })

    it('TC-AICP-308 ignores another product, and a form with no record to follow', async () => {
        const other = await mount()
        await announce(change('99'))
        await new Promise(resolve => setTimeout(resolve, 250))
        expect(other.onReload).not.toHaveBeenCalled()
        cleanup()

        const fresh = await mount({ isEdit: false, recordId: undefined })
        await announce(change('5', 2))
        await new Promise(resolve => setTimeout(resolve, 250))
        expect(fresh.onReload).not.toHaveBeenCalled()
    })

    it('TC-AICP-308 a failed reload leaves the form as it was', async () => {
        const { onReload, input } = await mount()
        onReload.mockRejectedValueOnce(new Error('boom'))
        await announce(change('5'))
        await waitFor(() => expect(onReload).toHaveBeenCalledTimes(1))
        expect(input.value).toBe('Old name')
        expect(screen.queryByRole('status')).toBeNull()
    })
})

describe('[TC-F08-04-150] legacy attributes after a product reload', () => {
    it('submits unrelated edits using the successfully reloaded baseline through the real resolver', async () => {
        // Arrange
        const valid = { ...base, categoryIds: ['1'], baseSku: 'SKU-1', shippingWeight: 0.5 }
        const attributes = [{ key: 'Material', value: 'Cotton' }, { key: ' material ', value: 'Linen' }]
        const onSubmitForm = vi.fn(async (_data: ProductFormValues) => {})
        const { onReload, input } = await mount({ initialData: valid, onSubmitForm })
        onReload.mockResolvedValueOnce({ ...valid, name: 'Reloaded product', attributes })
        // Act
        await announce(change('5', 150))
        await waitFor(() => expect(input.value).toBe('Reloaded product'))
        fireEvent.change(input, { target: { value: 'Merchant rename' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
        // Assert
        await waitFor(() => expect(onSubmitForm).toHaveBeenCalledTimes(1))
        expect(onSubmitForm.mock.calls[0][0]).toMatchObject({ name: 'Merchant rename', attributes: [attributes[0], { key: 'material', value: 'Linen' }] })
    })

    it.each(['failed', 'empty', 'discarded'])('keeps the legacy baseline after a %s reload', async (mode) => {
        // Arrange
        const valid = { ...base, categoryIds: ['1'], baseSku: 'SKU-1', shippingWeight: 0.5,
            attributes: [{ key: 'Material', value: 'Cotton' }, { key: 'material', value: 'Linen' }] }
        const onSubmitForm = vi.fn(async (_data: ProductFormValues) => {})
        const { onReload, input } = await mount({ initialData: valid, onSubmitForm })
        let release!: () => void
        onReload.mockImplementationOnce(async () => {
            await new Promise<void>(resolve => { release = resolve })
            if (mode === 'failed') throw new Error('Reload failed')
            return mode === 'empty' ? null : { ...valid, attributes: [] }
        })
        // Act — typing during the fetch discards even a non-null reload result.
        await announce(change('5', 151))
        await waitFor(() => expect(release).toBeDefined())
        fireEvent.change(input, { target: { value: 'Merchant rename' } })
        await act(async () => { release() })
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
        // Assert
        await waitFor(() => expect(onSubmitForm).toHaveBeenCalledTimes(1))
        expect(onSubmitForm.mock.calls[0][0]).toMatchObject({ name: 'Merchant rename', attributes: valid.attributes })
    })

})
