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
    saveAiProductAction: (...args: unknown[]) => mockSaveProduct(...args),
    getProductsAction: vi.fn(),
    getProductAction: vi.fn(),
    updateProductFieldAction: vi.fn(),
    deleteProductAction: vi.fn(),
}))

const mockI18nState: { locale: string; t: Record<string, unknown> } = {
    locale: 'en',
    t: {},
}

vi.mock('@/i18n', () => ({
    useI18n: () => mockI18nState,
}))

const mockGetCrateCartonId = vi.fn()
vi.mock('@/app/(dashboard)/actions/media', () => ({
    getOrCreateCrateCartonIdAction: (...args: unknown[]) => mockGetCrateCartonId(...args),
}))

const mockGetCategories = vi.fn()
const mockSaveCategory = vi.fn()
vi.mock('@/app/(dashboard)/products/categories/actions', () => ({
    getCategoriesByIdsAction: (...args: unknown[]) => mockGetCategories(...args),
    saveCategoryAction: (...args: unknown[]) => mockSaveCategory(...args),
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

vi.mock('@/components/dashboard/CategorySelect', () => ({
    CategorySelect: ({ categories, selectedIds, onChange, error, triggerId, ariaLabelledBy, errorId, disabled }: { categories: { id: string | number; name: string }[]; selectedIds: (string | number)[]; onChange: (ids: (string | number)[]) => void; error?: string; triggerId?: string; ariaLabelledBy?: string; errorId?: string; disabled?: boolean }) => (
        <div>
            <select
                id={triggerId}
                aria-label={ariaLabelledBy ? undefined : 'AI product category'}
                aria-labelledby={ariaLabelledBy}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                disabled={disabled}
                value={selectedIds[0] == null ? '' : String(selectedIds[0])}
                onChange= {event => {
                    const category = categories.find(item => String(item.id) === event.target.value)
                    onChange(category ? [category.id] : [])
                }}
            >
                <option value="">Select category</option>
                {categories.map(category => (
        <option key={category.id} value={String(category.id)}>
                        {category.name}
                    </option>
                ))}
            </select>
            {error ? <span id={errorId} role="alert">{error}</span> : null}
        </div>
    ),
}))

import { BulkCreateModal } from '@/components/dashboard/BulkCreateModal'

beforeEach(() => {
    mockGetCategories.mockReset().mockResolvedValue(DEFAULT_CATEGORIES)
    mockGetCrateCartonId.mockReset().mockResolvedValue(null)
    mockSaveCategory.mockReset()
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = [{ id: 'cat-1', name: 'Shoes' }]
const BASE_PRODUCT = {
    name: 'Test Shirt',
    price: 50,
    categoryId: 'cat-1',
    variants: [],
    sku: 'SHIRT-001',
}

function mockParseApi(products = [BASE_PRODUCT]) {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ products }),
    }) as unknown as typeof fetch
}

async function renderAndWaitForProducts(productList = [BASE_PRODUCT], i18nOverride: { locale?: string; t?: Record<string, unknown> } = {}, categories: { id: string | number; name: string }[] = DEFAULT_CATEGORIES) {
    mockI18nState.locale = i18nOverride.locale || 'en'
    mockI18nState.t = i18nOverride.t || {}
    mockParseApi(productList)
    const onClose = vi.fn()
    const onPartialSuccess = vi.fn()
    const onSuccess = vi.fn()
    render(<BulkCreateModal categories={categories} onClose={onClose} onPartialSuccess={onPartialSuccess} onSuccess={onSuccess} initialPrompt="test" />)
    // Wait for parsed drafts; Approve intentionally remains disabled if a category is unresolved.
    await waitFor(
        () => expect(screen.getAllByDisplayValue(productList[0].name).length).toBeGreaterThan(0),
        { timeout: 3000 },
    )
    return { onClose, onPartialSuccess, onSuccess }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BulkCreateModal — handleSave [TC-F08-04-27]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockI18nState.locale = 'en'
        mockI18nState.t = {}
    })

    it('TC-F08-04-27: success 1 product — id returned → singular toast, onSuccess + onClose called', async () => {
        // Arrange
        mockSaveProduct.mockResolvedValue({ id: 123, name: 'Test Shirt' })
        const { onClose, onSuccess } = await renderAndWaitForProducts()

        // Act
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /approve/i }))
        })

        // Assert
        await waitFor(() => {
            expect(mockToastSuccess).toHaveBeenCalledOnce()
        })
        expect(mockToastSuccess.mock.calls[0][0]).toContain('1 draft product')
        expect(mockToastSuccess.mock.calls[0][0]).not.toMatch(/\d+ draft products/)
        expect(onSuccess).toHaveBeenCalledOnce()
        expect(onClose).toHaveBeenCalledOnce()
        // TC-F08-04-27 (amend, GH-1502): router.refresh() removed — the parent's onSuccess()
        // callback (loadProducts()) now handles the refresh, avoiding a full page reload.
        expect(mockRouterRefresh).not.toHaveBeenCalled()
    })

    it('TC-F08-04-28: success 2 products — plural toast "2 draft products"', async () => {
        // Arrange
        const two = [BASE_PRODUCT, { ...BASE_PRODUCT, name: 'Test Pants', sku: 'PANTS-001' }]
        mockSaveProduct.mockResolvedValue({ id: 1 })
        const { onClose, onSuccess } = await renderAndWaitForProducts(two)

        // Act
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /approve/i }))
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
            .mockRejectedValueOnce(
                new Error(
                    JSON.stringify({
                        code: 'FIELD_ERRORS',
                        message: 'SKU already in use: SHIRT-001',
                    })
                )
            )
            .mockResolvedValueOnce({ id: 456 })
        const { onClose, onPartialSuccess, onSuccess } = await renderAndWaitForProducts(two)

        // Act
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /approve/i }))
        })

        // Assert: per-item error toast with parsed server message
        await waitFor(() => {
            expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('SKU already in use'))
        })

        // Second product still saves, while only the failed draft remains for retry.
        await waitFor(() => {
            expect(mockToastSuccess).toHaveBeenCalledOnce()
            expect(screen.getByDisplayValue('Test Shirt')).toBeInTheDocument()
            expect(screen.queryByDisplayValue('Second Product')).not.toBeInTheDocument()
        })
        expect(onPartialSuccess).toHaveBeenCalledOnce()
        expect(onSuccess).not.toHaveBeenCalled()
        expect(onClose).not.toHaveBeenCalled()
    })

    it('TC-F08-04-46: SKU conflict (real fieldErrors.baseSku shape) auto-retries with a regenerated SKU and succeeds silently', async () => {
        // Arrange: first attempt rejects with a genuine baseSku conflict, retry (fresh SKU) succeeds
        mockSaveProduct
            .mockRejectedValueOnce(
                new Error(
                    JSON.stringify({
                        code: 'FIELD_ERRORS',
                        fieldErrors: {
                            baseSku: { code: 'SKU_ALREADY_IN_USE', values: ['SHIRT-001'] },
                        },
                        message: 'SKU already in use: SHIRT-001',
                    })
                )
            )
            .mockResolvedValueOnce({ id: 789 })
        const { onSuccess, onClose } = await renderAndWaitForProducts()

        // Act
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /approve/i }))
        })

        // Assert: retried transparently — success toast shown, no error toast surfaced
        await waitFor(() => {
            expect(mockToastSuccess).toHaveBeenCalledOnce()
        })
        expect(mockToastError).not.toHaveBeenCalled()
        expect(mockSaveProduct).toHaveBeenCalledTimes(2)
        const firstSku = mockSaveProduct.mock.calls[0][0].sku
        const secondSku = mockSaveProduct.mock.calls[1][0].sku
        expect(secondSku).not.toBe(firstSku)
        expect(onSuccess).toHaveBeenCalledOnce()
        expect(onClose).toHaveBeenCalledOnce()
    })

    it('TC-F08-04-47: persistent SKU conflict exhausts retries then shows the error toast', async () => {
        // Arrange: every attempt rejects with the same baseSku conflict
        mockSaveProduct.mockRejectedValue(
            new Error(
                JSON.stringify({
                    code: 'FIELD_ERRORS',
                    fieldErrors: {
                        baseSku: { code: 'SKU_ALREADY_IN_USE', values: ['SHIRT-001'] },
                    },
                    message: 'SKU already in use: SHIRT-001',
                })
            )
        )
    // Wait until the Approve All button is enabled (products loaded, not parsing/saving)
    await renderAndWaitForProducts()

        // Act
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /approve/i }))
        })

        // Assert: category lookup failure aborts before every save-side effect.
        await waitFor(() => {
            expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('SKU already in use'))
        })
        expect(mockSaveProduct).toHaveBeenCalledTimes(3)
        expect(mockToastSuccess).not.toHaveBeenCalled()
    })

    it('TC-F08-04-30: action returns object without id → NOT counted as success → toast.error(saveFailed)', async () => {
        // Arrange
        mockSaveProduct.mockResolvedValue({})
        await renderAndWaitForProducts()

        // Act
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /approve/i }))
        })

        // Assert
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
            fireEvent.click(screen.getByRole('button', { name: /approve/i }))
        })

        // Assert
        await waitFor(() => {
            expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('Product management'))
        })
    })

    it('TC-F08-04-100: saves the canonical categoryId from selected-ID revalidation without auto-creating a category', async () => {
        mockGetCategories.mockResolvedValue([{ id: 42, name: 'Shoes' }])
        mockSaveProduct.mockResolvedValue({ id: 123 })
        await renderAndWaitForProducts([{ ...BASE_PRODUCT, categoryId: '42' }], {}, [{ id: 42, name: 'Shoes' }])

        // Act
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /approve/i }))
        })

        // Assert
        await waitFor(() => expect(mockSaveProduct).toHaveBeenCalledOnce())
        expect(mockSaveProduct.mock.calls[0][0].category).toEqual([42])
        expect(mockGetCategories).toHaveBeenCalledWith([42])
        expect(mockSaveCategory).not.toHaveBeenCalled()
    })

    it('TC-F08-04-101: stale or null AI category requires selecting an existing category before Approve', async () => {
        // Arrange
        mockGetCategories.mockResolvedValue(DEFAULT_CATEGORIES)
        mockSaveProduct.mockResolvedValue({ id: 123 })
        await renderAndWaitForProducts([
            { ...BASE_PRODUCT, name: 'Stale Category', categoryId: 'deleted-cat' },
            { ...BASE_PRODUCT, name: 'No Category', categoryId: null },
        ])
        const approve = screen.getByRole('button', { name: /approve/i })
        const categorySelectors = screen.getAllByRole('combobox')
        expect(approve).toBeDisabled()
        expect(categorySelectors).toHaveLength(2)
        expect(screen.getByTestId('ai-category-select-1')).toContainElement(categorySelectors[0])
        expect(screen.getByTestId('ai-category-select-2')).toContainElement(categorySelectors[1])
        expect(screen.getByRole('combobox', {
            name: 'Category for Stale Category, draft 1',
        })).toHaveAttribute('id', 'ai-category-trigger-1')
        expect(screen.getByRole('combobox', {
            name: 'Category for No Category, draft 2',
        })).toHaveAttribute('id', 'ai-category-trigger-2')
        expect(categorySelectors[0]).toHaveAttribute('aria-describedby', 'ai-category-error-1')
        expect(categorySelectors[0]).toHaveAttribute('aria-invalid', 'true')
        expect(screen.getAllByRole('alert')[0]).toHaveAttribute('id', 'ai-category-error-1')
        expect(categorySelectors[1]).toHaveAttribute('aria-describedby', 'ai-category-error-2')
        expect(categorySelectors[1]).toHaveAttribute('aria-invalid', 'true')
        expect(screen.getAllByRole('alert')[1]).toHaveAttribute('id', 'ai-category-error-2')
        expect(mockSaveProduct).not.toHaveBeenCalled()

        // Act
        fireEvent.change(categorySelectors[0], { target: { value: 'cat-1' } })
        fireEvent.change(categorySelectors[1], { target: { value: 'cat-1' } })
        await waitFor(() => expect(approve).not.toBeDisabled())

        await act(async () => {
            fireEvent.click(approve)
        })

        // Assert: retried transparently — success toast shown, no error toast surfaced
        await waitFor(() => expect(mockSaveProduct).toHaveBeenCalledTimes(2))
        expect(mockGetCategories).toHaveBeenCalledWith(['cat-1', 'cat-1'])
        expect(mockSaveProduct.mock.calls[0][0].category).toEqual(['cat-1'])
        expect(mockSaveProduct.mock.calls[1][0].category).toEqual(['cat-1'])
        expect(mockSaveCategory).not.toHaveBeenCalled()
    })

    it('TC-F08-04-102: aborts before carton and product side effects when selected-ID revalidation fails', async () => {
        mockGetCategories.mockRejectedValue(new Error('category service unavailable'))
        mockSaveProduct.mockResolvedValue({ id: 123 })
        await renderAndWaitForProducts()

        // Act
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /approve/i }))
        })

        // Assert: gives up after MAX_SKU_ATTEMPTS (3) and surfaces the error
        await waitFor(() => expect(mockToastError).toHaveBeenCalled())
        expect(mockGetCrateCartonId).not.toHaveBeenCalled()
        expect(mockSaveProduct).not.toHaveBeenCalled()
        expect(mockSaveCategory).not.toHaveBeenCalled()
    })

    it('TC-F08-04-102: category disappearing at revalidation clears selection and aborts all save side effects', async () => {
        // Arrange
        mockGetCategories.mockResolvedValue([])
        mockSaveProduct.mockResolvedValue({ id: 123 })
        await renderAndWaitForProducts()

        // Act
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /approve/i }))
        })

        // Assert: stale selection is cleared and cannot be resubmitted.
        await waitFor(() => expect(mockToastError).toHaveBeenCalled())
        expect(mockGetCategories).toHaveBeenCalledWith(['cat-1'])
        expect(mockGetCrateCartonId).not.toHaveBeenCalled()
        expect(mockSaveProduct).not.toHaveBeenCalled()
        expect(screen.getByRole('combobox')).toHaveValue('')
        expect(screen.queryByRole('option', { name: 'Shoes' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled()
        expect(mockSaveCategory).not.toHaveBeenCalled()
    })

    it('TC-F08-04-102: CATEGORY_INVALID from persistence is surfaced without retrying without category', async () => {
        // Arrange
        mockGetCategories.mockResolvedValue(DEFAULT_CATEGORIES)
        mockSaveProduct.mockResolvedValue({ ok: false, code: 'CATEGORY_INVALID' })
        await renderAndWaitForProducts()

        // Act
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /approve/i }))
        })

        // Assert
        await waitFor(() => expect(mockToastError).toHaveBeenCalled())
        expect(mockSaveProduct).toHaveBeenCalledOnce()
        expect(mockSaveProduct.mock.calls[0][0].category).toEqual(['cat-1'])
        expect(screen.getByRole('combobox')).toHaveValue('')
        expect(screen.queryByRole('option', { name: 'Shoes' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled()
        expect(mockToastSuccess).not.toHaveBeenCalled()
    })


    it('TC-F08-04-102: keeps only unsaved drafts when a later item loses its category during persistence', async () => {
        const two = [BASE_PRODUCT, { ...BASE_PRODUCT, name: 'Test Pants', sku: 'PANTS-001' }]
        mockSaveProduct
            .mockResolvedValueOnce({ id: 101 })
            .mockResolvedValueOnce({ ok: false, code: 'CATEGORY_INVALID' })
        const { onClose, onPartialSuccess, onSuccess } = await renderAndWaitForProducts(two)

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /approve/i }))
        })

        await waitFor(() => expect(mockSaveProduct).toHaveBeenCalledTimes(2))
        expect(screen.queryByDisplayValue('Test Shirt')).not.toBeInTheDocument()
        expect(screen.getByDisplayValue('Test Pants')).toBeInTheDocument()
        expect(screen.getByRole('combobox')).toHaveValue('')
        expect(screen.queryByRole('option', { name: 'Shoes' })).not.toBeInTheDocument()
        expect(onPartialSuccess).toHaveBeenCalledOnce()
        expect(onSuccess).not.toHaveBeenCalled()
        expect(onClose).not.toHaveBeenCalled()
    })

    it('[TC-F08-04-111] keeps a busy draft open when another item in the batch succeeds', async () => {
        const two = [BASE_PRODUCT, { ...BASE_PRODUCT, name: 'Test Pants', sku: 'PANTS-001' }]
        mockSaveProduct
            .mockRejectedValueOnce(new Error(JSON.stringify({
                code: 'CATEGORY_BUSY_RETRY',
                message: 'This category is busy. Please try again.',
            })))
            .mockResolvedValueOnce({ id: 202 })
        const { onClose, onPartialSuccess, onSuccess } = await renderAndWaitForProducts(two)

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /approve/i }))
        })

        await waitFor(() => expect(mockSaveProduct).toHaveBeenCalledTimes(2))
        expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('Please try again'))
        expect(screen.getByDisplayValue('Test Shirt')).toBeInTheDocument()
        expect(screen.queryByDisplayValue('Test Pants')).not.toBeInTheDocument()
        expect(screen.getByRole('combobox')).toHaveValue('cat-1')
        expect(onPartialSuccess).toHaveBeenCalledOnce()
        expect(onSuccess).not.toHaveBeenCalled()
        expect(onClose).not.toHaveBeenCalled()
    })

    it('[TC-F08-04-112] keeps a no-id draft open when another item succeeds', async () => {
        // Arrange
        const two = [BASE_PRODUCT, { ...BASE_PRODUCT, name: 'Test Pants', sku: 'PANTS-001' }]
        mockSaveProduct
            .mockResolvedValueOnce({ id: 202 })
            .mockResolvedValueOnce({})
        const { onClose, onPartialSuccess, onSuccess } = await renderAndWaitForProducts(two)

        // Act
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /approve/i }))
        })

        // Assert
        await waitFor(() => {
            expect(mockSaveProduct).toHaveBeenCalledTimes(2)
            expect(screen.queryByDisplayValue('Test Shirt')).not.toBeInTheDocument()
            expect(screen.getByDisplayValue('Test Pants')).toBeInTheDocument()
        })
        expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('Test Pants'))
        expect(onPartialSuccess).toHaveBeenCalledOnce()
        expect(onSuccess).not.toHaveBeenCalled()
        expect(onClose).not.toHaveBeenCalled()
    })

    it('TC-F08-04-109: freezes draft mutations while the save snapshot is pending', async () => {
        // Arrange
        let resolveCategories!: (value: typeof DEFAULT_CATEGORIES) => void
        const pendingCategories = new Promise<typeof DEFAULT_CATEGORIES>(resolve => {
            resolveCategories = resolve
        })
        mockGetCategories.mockReturnValue(pendingCategories)
        mockSaveProduct.mockResolvedValue({ id: 123 })
        await renderAndWaitForProducts(undefined, undefined, [
            ...DEFAULT_CATEGORIES,
            { id: 'cat-2', name: 'Accessories' },
        ])
        const nameInput = screen.getByDisplayValue('Test Shirt')
        const categorySelect = screen.getByRole('combobox')
        const removeButton = screen.getByRole('button', { name: 'Remove draft' })

        // Act
        fireEvent.click(screen.getByRole('button', { name: /approve/i }))
        await waitFor(() => expect(mockGetCategories).toHaveBeenCalledOnce())

        // Assert — the click-time snapshot cannot diverge from visible editable state.
        expect(nameInput).toBeDisabled()
        expect(categorySelect).toBeDisabled()
        expect(removeButton).toBeDisabled()
        fireEvent.change(nameInput, { target: { value: 'Edited during save' } })
        fireEvent.change(categorySelect, { target: { value: 'cat-2' } })
        fireEvent.click(removeButton)
        expect(screen.getByDisplayValue('Test Shirt')).toBeInTheDocument()
        expect(categorySelect).toHaveValue('cat-1')

        await act(async () => {
            resolveCategories(DEFAULT_CATEGORIES)
            await pendingCategories
        })
        await waitFor(() => expect(mockSaveProduct).toHaveBeenCalledOnce())
    })

    it('TC-F08-04-70: localizes regenerated variant tier labels during save for Malay drafts', async () => {
        const productWithVariants = {
            name: 'Baju',
            price: 50,
            categoryId: 'cat-1',
            sku: 'SHIRT-001',
            variants: [
                { name: 'Putih - S', price: 50, sku: 'SHIRT-WH-S', stock: 5 },
                { name: 'Putih - M', price: 50, sku: 'SHIRT-WH-M', stock: 7 },
            ],
        }
        mockSaveProduct.mockResolvedValue({ id: 321 })
        await renderAndWaitForProducts([productWithVariants], {
            locale: 'ms',
            t: {
                dashboard: {
                    products: {
                        form: {
                            sections: {
                                color: 'Warna',
                                size: 'Saiz',
                            },
                        },
                    },
                },
            },
        })

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /approve/i }))
        })

        await waitFor(() => {
            expect(mockSaveProduct).toHaveBeenCalledOnce()
        })

        expect(mockSaveProduct.mock.calls[0][0].variantConfigs).toEqual([
            { name: 'Warna', options: [{ value: 'Putih' }] },
            { name: 'Saiz', options: [{ value: 'S' }, { value: 'M' }] },
        ])
    })

    it('TC-F08-04-33 [GH-1491]: mounting locks body scroll; unmounting restores it', async () => {
        // Arrange
        document.body.style.overflow = ''
        const { unmount } = render(
            <BulkCreateModal onClose={vi.fn()} onSuccess={vi.fn()} initialPrompt="" />)

        // Act / Assert: locked immediately on mount — no internal open/closed toggle,
        // the parent controls visibility by mounting/unmounting this component.
        expect(document.body.style.overflow).toBe('hidden')

        unmount()
        expect(document.body.style.overflow).toBe('')
    })
})

describe('BulkCreateModal — handleParse variant-name dedup [TC-F08-04-52 code-review follow-up]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-F08-04-52: case-insensitively duplicate variant names are deduped at parse time (first occurrence kept), before buildSavePayload ever sees them', async () => {
        // Guards against products_variants_name_parent_uniq (DB unique index on lower(name) per
        // parent) — findConflictingSkus never checks variant-name uniqueness, only SKUs, so an
        // AI-hallucinated same-product name repeat (or case-only difference) would otherwise slip
        // past validation, hit this DB constraint, and get misclassified by translateDbSkuConflict
        // as a SKU conflict. Deduped here (parse time) rather than renamed later in
        // buildSavePayload — a post-parse rename would desync the row from buildVariantMatrix's
        // exact-string tier-combo matching (variant-utils.ts) and reset its price/sku/stock the
        // next time the merchant edits the tier matrix in ProductForm.
        const productWithDupeVariants = {
            name: 'Test Shirt',
            price: 39.9,
            categoryId: 'cat-1',
            sku: 'SHIRT-001',
            variants: [
                { name: 'Red', price: 39.9, sku: 'TS-R1', stock: 5 },
                { name: 'red', price: 39.9, sku: 'TS-R2', stock: 3 },
                { name: 'Blue', price: 39.9, sku: 'TS-B1', stock: 2 },
            ],
        }
        mockSaveProduct.mockResolvedValue({ id: 1 })
        await renderAndWaitForProducts([productWithDupeVariants])

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /approve/i }))
        })

        await waitFor(() => {
            expect(mockSaveProduct).toHaveBeenCalledOnce()
        })
        const savedVariants = mockSaveProduct.mock.calls[0][0].variants
        expect(savedVariants).toHaveLength(2)
        expect(savedVariants.map((v: { name: string }) => v.name)).toEqual(['Red', 'Blue'])
        // First occurrence's own sku/stock survive untouched — not merged/reset.
        expect(savedVariants[0].sku).toBe('TS-R1')
        expect(savedVariants[0].stock).toBe(5)
    })
})

describe('BulkCreateModal — review drawer: remove-draft [TC-F08-04-55 design-alignment follow-up]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-F08-04-55: removing a draft excludes it from save — the review drawer has no select/deselect checkbox, only a per-draft remove button', async () => {
        const two = [BASE_PRODUCT, { ...BASE_PRODUCT, name: 'Test Pants', sku: 'PANTS-001' }]
        mockSaveProduct.mockResolvedValue({ id: 1 })
        await renderAndWaitForProducts(two)

        expect(screen.getByText('2 drafts')).toBeInTheDocument()

        // Remove the first draft ("Test Shirt")
        const removeButtons = screen.getAllByRole('button', { name: /remove draft/i,
        })
        fireEvent.click(removeButtons[0])

        expect(screen.getByText('1 draft')).toBeInTheDocument()
        expect(screen.queryByDisplayValue('Test Shirt')).not.toBeInTheDocument()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /approve/i }))
        })

        await waitFor(() => {
            expect(mockSaveProduct).toHaveBeenCalledOnce()
        })
        expect(mockSaveProduct.mock.calls[0][0].name).toBe('Test Pants')
    })
})

describe('BulkCreateModal — review drawer: price coercion on parse [TC-F08-04-56 bug fix]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-F08-04-56: an AI response with a non-numeric/missing price renders "0" in the Price input, not a raw invalid value', async () => {
        // Untrusted AI output — the parse prompt asks for "0 if not specified", but on
        // unparseable/gibberish input the model can still omit or malform this field.
        // Reproduces a real observed bug: the Price <input type="number"> received the raw
        // parsed value directly, showing a dash/blank instead of a coerced 0.
        const garbageProduct = { name: 'QÉDRHG', price: null,
            categoryId: 'cat-1', variants: [], sku: 'X-001',
        }
        await renderAndWaitForProducts([garbageProduct as unknown as typeof BASE_PRODUCT])

        // Both the Price and Stock inputs legitimately default to "0" for this product (no
        // price/stock in the AI response) — assert both render as valid "0", not an empty/raw
        // invalid value (e.g. the design mockup's own "—" placeholder, which this must not mimic).
        expect(screen.getAllByDisplayValue('0')).toHaveLength(2)

        mockSaveProduct.mockResolvedValue({ id: 1 })
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /approve/i }))
        })

        await waitFor(() => {
            expect(mockSaveProduct).toHaveBeenCalledOnce()
        })
        expect(mockSaveProduct.mock.calls[0][0].price).toBe(0)
    })

    it('TC-F08-04-58 (review-comment follow-up): a non-numeric string variant stock ("N/A") also coerces to "0" — `?? 0` alone does not catch NaN', async () => {
        // `Number("N/A") ?? 0` still evaluates to NaN — NaN is neither null nor undefined, so the
        // `??` fallback never fires. Only an explicit Number.isFinite check (coerceFiniteNumber)
        // catches this, applied at parse time to the variant's own stock (drives both the
        // drawer's Stock display, which reads variants[0].stock, and the saved payload).
        const garbageStockProduct = {
            name: 'Weird Stock Product',
            price: 10,
            categoryId: 'cat-1',
            sku: 'WS-001',
            variants: [{ name: 'Default', price: 10, sku: 'WS-001-D', stock: 'N/A' }],
        }
        mockSaveProduct.mockResolvedValue({ id: 1 })
        await renderAndWaitForProducts([garbageStockProduct as unknown as typeof BASE_PRODUCT])

        // Stock input (second number input in the row, after Price) renders "0", not "N/A" or blank.
        expect(document.querySelectorAll('input[type="number"]')[1]).toHaveValue(0)

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /approve/i }))
        })

        await waitFor(() => {
            expect(mockSaveProduct).toHaveBeenCalledOnce()
        })
        const saved = mockSaveProduct.mock.calls[0][0]
        expect(saved.inventory).toBe(0)
        expect(saved.variants[0].stock).toBe(0)
    })
})

describe('BulkCreateModal — review drawer: variant-product Stock input [TC-F08-04-57 uniform-fill follow-up]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-F08-04-57: editing Stock for a variant product fills the same value into every variant; saved inventory is their sum', async () => {
        const variantProduct = {
            name: 'T-Shirt',
            price: 39.9,
            categoryId: 'cat-1',
            sku: 'TS-001',
            variants: [
                { name: 'Small', price: 39.9, sku: 'TS-S', stock: 0 },
                { name: 'Large', price: 39.9, sku: 'TS-L', stock: 0 },
            ],
        }
        mockSaveProduct.mockResolvedValue({ id: 1 })
        await renderAndWaitForProducts([variantProduct as unknown as typeof BASE_PRODUCT])

        // The Stock input (not disabled) is the second number input in the row — Price is first.
        const numberInputs = document.querySelectorAll('input[type="number"]')
        const stockInput = numberInputs[1]
        fireEvent.change(stockInput, { target: { value: '7' } })

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /approve/i }))
        })

        await waitFor(() => {
            expect(mockSaveProduct).toHaveBeenCalledOnce()
        })
        const saved = mockSaveProduct.mock.calls[0][0]
        expect(saved.variants.map((v: { stock: number }) => v.stock)).toEqual([7, 7])
        expect(saved.inventory).toBe(14)
    })
})
