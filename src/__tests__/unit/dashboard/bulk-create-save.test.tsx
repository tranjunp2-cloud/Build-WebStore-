// @vitest-environment jsdom
// TC-F08-04-27 through TC-F08-04-31: BulkCreateModal handleSave behavior
// Covers: id verification, error toast with server message, singular/plural grammar.

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// ── Mocks (must be top-level, before imports) ─────────────────────────────────

const mockRouterRefresh = vi.fn()
vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: mockRouterRefresh }),
}))

const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
vi.mock('sonner', () => ({
    toast: {
        success: (...args: unknown[]) => mockToastSuccess(...args),
        error: (...args: unknown[]) => mockToastError(...args),
    },
}))

const mockSaveProduct = vi.fn()
vi.mock('@/app/(dashboard)/products/actions', () => ({
    saveProductAction: (...args: unknown[]) => mockSaveProduct(...args),
    getProductsAction: vi.fn(),
    getProductAction: vi.fn(),
    updateProductFieldAction: vi.fn(),
    deleteProductAction: vi.fn(),
}))

vi.mock('@/i18n', () => ({
    useI18n: () => ({ t: {}, locale: 'en' }),
}))

vi.mock('@/app/(dashboard)/actions/media', () => ({
    getOrCreateCrateCartonIdAction: () => Promise.resolve(null),
}))

vi.mock('@/app/(dashboard)/products/categories/actions', () => ({
    getCategoriesAction: () => Promise.resolve([]),
    saveCategoryAction: vi.fn(),
}))

vi.mock('@radix-ui/react-dialog', () => ({
    Root: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Overlay: () => null,
    Content: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Title: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
    Description: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
    Close: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { BulkCreateModal } from '../../../components/dashboard/BulkCreateModal'

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_PRODUCT = { name: 'Test Shirt', price: 50, category: '', variants: [], sku: 'SHIRT-001' }

function mockParseApi(products = [BASE_PRODUCT]) {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ products }),
    }) as unknown as typeof fetch
}

async function renderAndWaitForProducts(productList = [BASE_PRODUCT]) {
    mockParseApi(productList)
    const onClose = vi.fn()
    const onSuccess = vi.fn()
    render(
        <BulkCreateModal onClose={onClose} onSuccess={onSuccess} initialPrompt="test" />,
    )
    // Wait until save button is enabled (products loaded + selected, not parsing/saving)
    await waitFor(
        () => {
            const btn = screen.getByRole('button', { name: /save/i })
            expect(btn).not.toBeDisabled()
        },
        { timeout: 3000 },
    )
    return { onClose, onSuccess }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BulkCreateModal — handleSave [TC-F08-04-27]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-F08-04-27: success 1 product — id returned → singular toast, onSuccess + onClose called', async () => {
        // Arrange
        mockSaveProduct.mockResolvedValue({ id: 123, name: 'Test Shirt' })
        const { onClose, onSuccess } = await renderAndWaitForProducts()

        // Act
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /save/i }))
        })

        // Assert
        await waitFor(() => {
            expect(mockToastSuccess).toHaveBeenCalledOnce()
        })
        expect(mockToastSuccess.mock.calls[0][0]).toContain('1 draft product')
        expect(mockToastSuccess.mock.calls[0][0]).not.toMatch(/\d+ draft products/)
        expect(onSuccess).toHaveBeenCalledOnce()
        expect(onClose).toHaveBeenCalledOnce()
        expect(mockRouterRefresh).toHaveBeenCalledOnce()
    })

    it('TC-F08-04-28: success 2 products — plural toast "2 draft products"', async () => {
        // Arrange
        const two = [BASE_PRODUCT, { ...BASE_PRODUCT, name: 'Test Pants', sku: 'PANTS-001' }]
        mockSaveProduct.mockResolvedValue({ id: 1 })
        const { onClose, onSuccess } = await renderAndWaitForProducts(two)

        // Act
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /save/i }))
        })

        // Assert
        await waitFor(() => {
            expect(mockToastSuccess).toHaveBeenCalledOnce()
        })
        expect(mockToastSuccess.mock.calls[0][0]).toContain('2 draft products')
        expect(onSuccess).toHaveBeenCalledOnce()
        expect(onClose).toHaveBeenCalledOnce()
    })

    it('TC-F08-04-29: action throws JSON error → toast.error with parsed server message, loop continues for other products', async () => {
        // Arrange: 2 products; first throws a JSON error, second succeeds
        const two = [BASE_PRODUCT, { ...BASE_PRODUCT, name: 'Second Product', sku: 'SECOND-001' }]
        mockSaveProduct
            .mockRejectedValueOnce(new Error(JSON.stringify({ code: 'FIELD_ERRORS', message: 'SKU already in use: SHIRT-001' })))
            .mockResolvedValueOnce({ id: 456 })
        const { onSuccess } = await renderAndWaitForProducts(two)

        // Act
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /save/i }))
        })

        // Assert: per-item error toast with parsed server message
        await waitFor(() => {
            expect(mockToastError).toHaveBeenCalledWith(
                expect.stringContaining('SKU already in use'),
            )
        })

        // Second product still saved → success toast shown
        await waitFor(() => {
            expect(mockToastSuccess).toHaveBeenCalledOnce()
        })
        expect(onSuccess).toHaveBeenCalledOnce()
    })

    it('TC-F08-04-30: action returns object without id → NOT counted as success → toast.error(saveFailed)', async () => {
        // Arrange: server returns {} (no id) — simulates silent non-create
        mockSaveProduct.mockResolvedValue({})
        await renderAndWaitForProducts()

        // Act
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /save/i }))
        })

        // Assert: no-id response is treated as failure
        await waitFor(() => {
            expect(mockToastError).toHaveBeenCalled()
        })
        expect(mockToastSuccess).not.toHaveBeenCalled()
    })

    it('TC-F08-04-31: action throws plain Error → toast.error contains the error message', async () => {
        // Arrange
        mockSaveProduct.mockRejectedValue(new Error('Product management not available on your plan'))
        await renderAndWaitForProducts()

        // Act
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /save/i }))
        })

        // Assert
        await waitFor(() => {
            expect(mockToastError).toHaveBeenCalledWith(
                expect.stringContaining('Product management'),
            )
        })
    })

    it('TC-F08-04-33 [GH-1491]: mounting locks body scroll; unmounting restores it', async () => {
        // Arrange
        document.body.style.overflow = ''
        const { unmount } = render(
            <BulkCreateModal onClose={vi.fn()} onSuccess={vi.fn()} initialPrompt="" />,
        )

        // Act / Assert: locked immediately on mount — no internal open/closed toggle,
        // the parent controls visibility by mounting/unmounting this component.
        expect(document.body.style.overflow).toBe('hidden')

        unmount()
        expect(document.body.style.overflow).toBe('')
    })
})
