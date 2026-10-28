/**
 * TC-AICP-331 — the product edit page + form against a stale save, end to end on the client (the server is a small fake
 * that applies the real version check): the form sends the updatedAt it loaded; the copilot changes the product, the
 * merchant picks Keep mine and saves -> refused, ONE conflict notice, their edits intact, no error toast; Load the latest
 * drops the edits and takes the current product + version; Save mine anyway sends the current version and the form's whole
 * content wins (including replacing the copilot's price); a silent reload moves the version on; two saves from one form
 * both succeed; a product whose version is unknown saves unchecked.
 * Real: ProductEditPage, ProductForm, react-hook-form, useSaveVersion, useAgentRecordSync, the bus, notices, en strings.
 * Faked: next/*, sonner, the page's server actions (fake server with isStaleVersion), the form sections (one name input).
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { useFormContext } from 'react-hook-form'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router, useParams: () => ({ id: '5' }) }))
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => React.createElement('a', { href, ...props }, children) }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/app/(dashboard)/products/categories/actions', () => ({ getCategoriesAction: vi.fn(async () => []) }))
vi.mock('@/components/dashboard/product-form/GeneralInfoSection', () => ({
    GeneralInfoSection: () => <input aria-label="name" {...useFormContext().register('name')} />,
}))
for (const section of ['MasterFieldsSection', 'VariantOptionsSection', 'ShippingDimensionsSection', 'DescriptionSeoSection', 'AttributesSection']) {
    vi.doMock(`@/components/dashboard/product-form/${section}`, () => ({ [section]: () => null }))
}

const server = vi.hoisted(() => ({ name: '', price: 0, updatedAt: '' as string | undefined, clock: 0 }))
const actions = vi.hoisted(() => ({
    getProductAction: vi.fn(),
    saveProductAction: vi.fn(),
    deleteProductAction: vi.fn(),
}))
vi.mock('@/app/(dashboard)/products/actions', () => actions)

import ProductEditPage from '@/app/(dashboard)/products/[id]/page'
import { I18nProvider } from '@/i18n'
import en from '@/i18n/locales/en.json'
import { announceAgentChange, resetAgentChangeBus } from '@/lib/agent-changes/bus'
import { COALESCE_MS } from '@/lib/agent-changes/use-agent-changes'
import { isStaleVersion } from '@/lib/save-version/save-version'

Element.prototype.scrollIntoView = vi.fn()

const V1 = '2026-10-22T01:00:00.000Z'
const V2 = '2026-10-22T02:00:00.000Z'
const copy = en.dashboard.agentChanged
const doc = () => ({
    id: 5, name: server.name, slug: 'scarf', price: server.price, category: [{ id: 'c1' }], images: [], hasVariants: false,
    inventory: 1, sku: 'S', weight: 0.5, variantConfigs: [], variants: [], currency: 'MYR', updatedAt: server.updatedAt,
})
const tick = () => new Date(Date.parse(V2) + ++server.clock * 60_000).toISOString()
/** the copilot approves a change: a new price on the server, and the bus says so */
const copilotChangesPrice = async () => {
    server.price = 99
    server.updatedAt = V2
    await act(async () => {
        announceAgentChange({ action: 'applied', kind: 'shop_product.update', entities: [{ kind: 'product', id: '5' }], changeSetId: `cs-${Math.random()}`, at: Date.now() })
        // the screen hears it once the change window closes: let that land before the next step
        await new Promise((resolve) => setTimeout(resolve, COALESCE_MS + 20))
    })
}
const nameInput = async () => (await screen.findByLabelText('name')) as HTMLInputElement
const type = (input: HTMLInputElement, value: string) => fireEvent.change(input, { target: { value } })
const save = () => fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
const mount = () => render(<I18nProvider defaultLocale="en"><ProductEditPage /></I18nProvider>)

beforeEach(() => {
    vi.clearAllMocks()
    server.name = 'Old name'
    server.price = 10
    server.updatedAt = V1
    server.clock = 0
    actions.getProductAction.mockImplementation(async () => doc())
    // the real check, in place of the real database
    actions.saveProductAction.mockImplementation(async (body: { name: string; price: number }, _id: unknown, expected?: string | null) => {
        if (isStaleVersion(expected, server.updatedAt)) return { ok: false, code: 'VERSION_CONFLICT', current: server.updatedAt }
        server.name = body.name
        server.price = body.price
        server.updatedAt = tick()
        return doc()
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
    cleanup()
    resetAgentChangeBus()
    vi.restoreAllMocks()
})

describe('product page against a stale save [TC-AICP-331]', () => {
    it('TC-AICP-331: saves with the version it loaded; a second save from the same form sends the version the first returned', async () => {
        mount()
        type(await nameInput(), 'First edit')
        save()
        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
        expect(actions.saveProductAction).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'First edit' }), '5', V1)
        const afterFirst = server.updatedAt

        type(await nameInput(), 'Second edit')
        save()
        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(2))
        expect(actions.saveProductAction).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Second edit' }), '5', afterFirst)
        expect(screen.queryByRole('status')).toBeNull()
        expect(server.name).toBe('Second edit')
    })

    it('TC-AICP-357: a page left right after a save does not go to the product list later', async () => {
        mount()
        type(await nameInput(), 'Saved name')
        save()
        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))

        cleanup()
        await new Promise((resolve) => setTimeout(resolve, 1600))

        expect(router.push).not.toHaveBeenCalled()
    })

    it('TC-AICP-331: Keep mine, then Save is refused: one conflict notice, the name edit stays, no toast', async () => {
        mount()
        const input = await nameInput()
        type(input, 'My name')
        await copilotChangesPrice()
        expect(await screen.findByText(copy.product)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: copy.keepMine }))
        expect(screen.queryByText(copy.product)).toBeNull()

        save()

        expect(await screen.findByText(copy.conflict.product)).toBeInTheDocument()
        expect(screen.getAllByRole('status')).toHaveLength(1)
        expect(actions.saveProductAction).toHaveBeenCalledWith(expect.objectContaining({ name: 'My name' }), '5', V1)
        expect(input.value).toBe('My name')
        expect(server.name).toBe('Old name')
        expect(toast.success).not.toHaveBeenCalled()
        expect(toast.error).not.toHaveBeenCalled()
        expect(router.push).not.toHaveBeenCalled()
    })

    it('TC-AICP-331: Save mine anyway sends the current version; the whole form wins, replacing the copilot\'s price', async () => {
        mount()
        type(await nameInput(), 'My name')
        await copilotChangesPrice()
        save()
        await screen.findByText(copy.conflict.product)

        fireEvent.click(screen.getByRole('button', { name: copy.saveAnyway }))

        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
        expect(actions.saveProductAction).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'My name', price: 10 }), '5', V2)
        expect(server.name).toBe('My name')
        expect(server.price).toBe(10)
        expect(screen.queryByText(copy.conflict.product)).toBeNull()
    })

    it('TC-AICP-331: Load the latest drops the edits, shows the current product, and the next save carries the current version', async () => {
        mount()
        const input = await nameInput()
        type(input, 'My name')
        server.name = 'Copilot name'
        await copilotChangesPrice()
        save()
        await screen.findByText(copy.conflict.product)

        fireEvent.click(screen.getByRole('button', { name: copy.loadLatest }))

        await waitFor(() => expect(input.value).toBe('Copilot name'))
        expect(screen.queryByRole('status')).toBeNull()
        type(input, 'Copilot name 2')
        save()
        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
        expect(actions.saveProductAction).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Copilot name 2' }), '5', V2)
    })

    it('TC-AICP-331: a clean form reloads silently on the copilot\'s change, and its next save carries the new version', async () => {
        mount()
        const input = await nameInput()
        server.name = 'Copilot name'
        await copilotChangesPrice()
        await waitFor(() => expect(input.value).toBe('Copilot name'))
        expect(screen.queryByRole('status')).toBeNull()

        type(input, 'After reload')
        save()

        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
        expect(actions.saveProductAction).toHaveBeenLastCalledWith(expect.anything(), '5', V2)
        expect(screen.queryByRole('status')).toBeNull()
    })

    it('TC-AICP-331: a product whose version is unknown is saved unchecked (as before)', async () => {
        server.updatedAt = undefined
        mount()
        type(await nameInput(), 'No version')
        save()
        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
        expect(actions.saveProductAction).toHaveBeenLastCalledWith(expect.anything(), '5', undefined)
    })
})
