/**
 * TC-F08-04-155 (new page) — GH-2079: a duplicate SKU the server RETURNS is handed back to the form as `{ fieldErrors }`
 * (no success toast, no redirect, no re-throw); a clean save still toasts + redirects; an unexpected error still throws.
 * Real: NewProductPage's save handler. Faked: next/*, sonner, the server action, ProductForm (stub that submits one payload).
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
const saveProductAction = vi.hoisted(() => vi.fn())
vi.mock('@/app/(dashboard)/products/actions', () => ({ saveProductAction }))

const outcome = vi.hoisted(() => ({ value: undefined as unknown, error: undefined as unknown }))
vi.mock('@/components/dashboard/product-form/ProductForm', () => ({
    ProductForm: ({ onSubmitForm }: { onSubmitForm: (d: unknown) => Promise<unknown> }) => (
        <button onClick={async () => {
            try { outcome.value = await onSubmitForm({ name: 'Brand new', baseSku: 'bea-002', hasVariants: false, images: [], categoryIds: [] }) }
            catch (e) { outcome.error = e }
        }}>submit</button>
    ),
}))

import NewProductPage from '@/app/(dashboard)/products/new/page'
import { I18nProvider } from '@/i18n'

const mount = () => render(<I18nProvider defaultLocale="en"><NewProductPage /></I18nProvider>)

beforeEach(() => {
    vi.clearAllMocks()
    outcome.value = undefined
    outcome.error = undefined
})
afterEach(cleanup)

describe('[TC-F08-04-155] new product page save handler', () => {
    it('duplicate SKU result → returns { fieldErrors } to the form; no success toast, no redirect, no throw', async () => {
        const fieldErrors = { baseSku: { code: 'SKU_ALREADY_IN_USE', values: ['bea-002'] } }
        saveProductAction.mockResolvedValue({ ok: false, code: 'FIELD_ERRORS', message: 'x', fieldErrors })
        mount()

        fireEvent.click(screen.getByText('submit'))

        await waitFor(() => expect(outcome.value).toEqual({ fieldErrors }))
        expect(outcome.error).toBeUndefined()
        expect(toast.success).not.toHaveBeenCalled()
        expect(router.push).not.toHaveBeenCalled()
    })

    it('success → toast + redirect to the list; unexpected error still reaches the form as a throw', async () => {
        saveProductAction.mockResolvedValueOnce({ id: 9 })
        mount()
        fireEvent.click(screen.getByText('submit'))
        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(router.push).toHaveBeenCalledWith('/products'), { timeout: 2500 })

        saveProductAction.mockRejectedValueOnce(new Error('Network timeout'))
        fireEvent.click(screen.getByText('submit'))
        await waitFor(() => expect(outcome.error).toBeInstanceOf(Error))
        expect((outcome.error as Error).message).toBe('Network timeout')
    })
})
