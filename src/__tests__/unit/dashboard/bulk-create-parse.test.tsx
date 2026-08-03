// @vitest-environment jsdom
// GH-1599: BulkCreateModal handleParse error-toast behavior on non-ok fetch responses.
// Covers: rate-limit countdown toast (new), aiQuotaExceeded regression after the
// JSON.stringify(data) throw refactor (previously matched on raw err.message).

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import enLocale from '@/i18n/locales/en.json'

// ── Mocks (must be top-level, before imports) ─────────────────────────────────

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: vi.fn() }),
}))

const mockToastError = vi.fn()
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: (...args: unknown[]) => mockToastError(...args),
    },
}))

vi.mock('@/app/(dashboard)/products/actions', () => ({
    saveProductAction: vi.fn(),
    getProductsAction: vi.fn(),
    getProductAction: vi.fn(),
    updateProductFieldAction: vi.fn(),
    deleteProductAction: vi.fn(),
}))

// Real locale strings (not a hand-copied duplicate) so the test proves the actual
// i18n key resolves and its {minutes} placeholder is interpolated correctly.
vi.mock('@/i18n', () => ({
    useI18n: () => ({ t: enLocale, locale: 'en' }),
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

import { BulkCreateModal } from '@/components/dashboard/BulkCreateModal'

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockParseApiError(status: number, body: Record<string, unknown>) {
    global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status,
        json: async () => body,
    }) as unknown as typeof fetch
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BulkCreateModal — handleParse error toasts [GH-1599]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-GH1599-01: 429 rateLimitExceeded → toast shows the real i18n string with computed minutes-until-reset', async () => {
        // Arrange: resetAt 5 minutes from now
        mockParseApiError(429, { error: 'rateLimitExceeded', resetAt: Date.now() + 5 * 60000 })

        // Act
        render(<BulkCreateModal onClose={vi.fn()} initialPrompt="test" />)

        // Assert: toast text matches the real en.json template with {minutes} replaced by 5
        const expected = enLocale.dashboard.products.bulkCreate.rateLimitExceeded.replace('{minutes}', '5')
        await waitFor(() => {
            expect(mockToastError).toHaveBeenCalledWith(expected)
        })
    })

    it('TC-GH1599-02: 429 rateLimitExceeded with an already-past resetAt clamps to a minimum of 1 minute (no "0 min"/negative)', async () => {
        mockParseApiError(429, { error: 'rateLimitExceeded', resetAt: Date.now() - 60000 })

        render(<BulkCreateModal onClose={vi.fn()} initialPrompt="test" />)

        const expected = enLocale.dashboard.products.bulkCreate.rateLimitExceeded.replace('{minutes}', '1')
        await waitFor(() => {
            expect(mockToastError).toHaveBeenCalledWith(expected)
        })
    })

    it('TC-GH1599-03: 429 rateLimitExceeded with a malformed/non-numeric resetAt clamps to 1 minute instead of showing "NaN min"', async () => {
        // Code-review adversarial finding: Math.max(1, NaN) is NaN (not 1) — a non-numeric
        // resetAt must be coerced BEFORE the minutes arithmetic, matching the coerceFiniteNumber
        // guard already used elsewhere in this file for untrusted numeric input.
        mockParseApiError(429, { error: 'rateLimitExceeded', resetAt: 'not-a-number' })

        render(<BulkCreateModal onClose={vi.fn()} initialPrompt="test" />)

        const expected = enLocale.dashboard.products.bulkCreate.rateLimitExceeded.replace('{minutes}', '1')
        await waitFor(() => {
            expect(mockToastError).toHaveBeenCalledWith(expected)
        })
        expect(mockToastError).not.toHaveBeenCalledWith(expect.stringContaining('NaN'))
    })

    it('TC-GH1599-04: 500 aiQuotaExceeded → regression guard: still resolves the correct toast after the JSON-throw refactor', async () => {
        mockParseApiError(500, { error: 'aiQuotaExceeded' })

        render(<BulkCreateModal onClose={vi.fn()} initialPrompt="test" />)

        await waitFor(() => {
            expect(mockToastError).toHaveBeenCalledWith(enLocale.dashboard.products.bulkCreate.aiQuotaExceeded)
        })
    })

    it('TC-GH1599-05: 500 aiTimeout → regression guard: still resolves the correct toast after the JSON-throw refactor', async () => {
        mockParseApiError(500, { error: 'aiTimeout' })

        render(<BulkCreateModal onClose={vi.fn()} initialPrompt="test" />)

        await waitFor(() => {
            expect(mockToastError).toHaveBeenCalledWith(enLocale.dashboard.products.bulkCreate.aiTimeout)
        })
    })

    it('TC-GH1599-06: unrecognized error code → falls back to the generic parseError toast', async () => {
        mockParseApiError(500, { error: 'somethingUnexpected' })

        render(<BulkCreateModal onClose={vi.fn()} initialPrompt="test" />)

        await waitFor(() => {
            expect(mockToastError).toHaveBeenCalledWith(enLocale.dashboard.products.bulkCreate.parseError)
        })
    })

    it('TC-F08-04-93: retryable locale mismatch exposes one manual retry without an automatic loop', async () => {
        // Arrange
        global.fetch = vi.fn()
            .mockResolvedValueOnce({
                ok: false,
                status: 422,
                json: async () => ({ error: 'merchantLanguageMismatch', retryable: true }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    products: [{ name: 'Recovered Hat', price: 10, stock: 0, category: '', variants: [] }],
                }),
            }) as unknown as typeof fetch
        render(<BulkCreateModal onClose={vi.fn()} initialPrompt="topi merah" />)

        // Act
        const retryButton = await screen.findByRole('button', { name: 'Retry' })

        // Assert: the retryable response does not trigger another request by itself.
        expect(global.fetch).toHaveBeenCalledTimes(1)
        fireEvent.click(retryButton)
        await waitFor(() => expect(screen.getByDisplayValue('Recovered Hat')).toBeVisible())
        expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('TC-F08-04-94: normalizes AI-provided line breaks before rendering the Product Name textarea', async () => {
        // Arrange
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                products: [{
                    name: 'Premium Backpack\r\nWith Extended\nProduct Name',
                    price: 10,
                    stock: 0,
                    category: '',
                    variants: [],
                }],
            }),
        }) as unknown as typeof fetch

        // Act
        render(<BulkCreateModal onClose={vi.fn()} initialPrompt="long product name" />)
        const nameField = await screen.findByLabelText('Product name')

        // Assert
        expect(nameField.tagName).toBe('TEXTAREA')
        expect(nameField).toHaveValue('Premium Backpack With Extended Product Name')
    })

    it('TC-F08-04-100: caps an AI-provided Product Name at the canonical save limit', async () => {
        // Arrange
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                products: [{
                    name: 'A'.repeat(121),
                    price: 10,
                    stock: 0,
                    category: '',
                    variants: [],
                }],
            }),
        }) as unknown as typeof fetch

        // Act
        render(<BulkCreateModal onClose={vi.fn()} initialPrompt="overlong product name" />)
        const nameField = await screen.findByLabelText('Product name')

        // Assert
        expect(nameField).toHaveAttribute('maxlength', '120')
        expect(nameField).toHaveValue('A'.repeat(120))
    })

    it('TC-F08-04-101: does not block Enter while explicit IME composition is active', async () => {
        // Arrange
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                products: [{
                    name: 'Vietnamese product',
                    price: 10,
                    stock: 0,
                    category: '',
                    variants: [],
                }],
            }),
        }) as unknown as typeof fetch

        // Act
        render(<BulkCreateModal onClose={vi.fn()} initialPrompt="IME product name" />)
        const nameField = await screen.findByLabelText('Product name')
        fireEvent.compositionStart(nameField)
        const composingEnterDispatched = fireEvent.keyDown(nameField, {
            key: 'Enter',
            isComposing: false,
        })
        fireEvent.compositionEnd(nameField)
        const normalEnterDispatched = fireEvent.keyDown(nameField, { key: 'Enter' })

        // Assert
        expect(composingEnterDispatched).toBe(true)
        expect(normalEnterDispatched).toBe(false)
    })
})
