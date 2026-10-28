/**
 * TC-AICP-333 — discount form against a stale save: PUT carries the `expectedUpdatedAt` the discount was loaded with; a 409
 * VERSION_CONFLICT shows ONE conflict notice (no toast, no navigation) and keeps the edit; Load the latest reads the discount
 * again and drops the edit; Save mine anyway sends the version the 409 reported; Keep mine on the assistant notice, then Save,
 * hits the conflict; a duplicate-code 409 is still the field error, not a conflict; a new discount sends no version.
 * TC-AICP-334 — customer detail: same flow with the server action's typed result (Load the latest uses the detail action).
 * Real: DiscountForm, CustomersDetail, useSaveVersion, useAgentRecordSync, the bus, the notices, en strings.
 * Faked: fetch (a fake discount API applying the real version check), the customer server actions, next/*, sonner.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/x', useSearchParams: () => new URLSearchParams() }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/app/(dashboard)/customers/actions', () => ({
    getShopCustomersAction: vi.fn(),
    getShopCustomerDetailAction: vi.fn(),
    updateShopCustomerAction: vi.fn(),
    exportShopCustomersCsvAction: vi.fn(),
    getCustomerOrdersAction: vi.fn(async () => ({ orders: [], total: 0, totalPages: 1 })),
}))

import { CustomersDetail } from '@/app/(dashboard)/customers/_components/customers-detail'
import * as customerActions from '@/app/(dashboard)/customers/actions'
import type { ShopCustomerRecord } from '@/app/(dashboard)/customers/_lib/shop-customer-record'
import { DiscountForm, type DiscountDoc } from '@/app/(dashboard)/discounts/_components/discount-form'
import { TooltipProvider } from '@/components/ui/tooltip'
import { I18nProvider } from '@/i18n'
import en from '@/i18n/locales/en.json'
import { announceAgentChange, resetAgentChangeBus } from '@/lib/agent-changes/bus'
import { isStaleVersion } from '@/lib/save-version/save-version'

const V1 = '2026-10-22T01:00:00.000Z'
const V2 = '2026-10-22T02:00:00.000Z'
const copy = en.dashboard.agentChanged
const wrap = (ui: React.ReactElement) => render(<I18nProvider defaultLocale="en"><TooltipProvider>{ui}</TooltipProvider></I18nProvider>)
const assistantChanges = async (kind: string, id: string) => {
    await act(async () => {
        announceAgentChange({ action: 'applied', kind: `${kind}.patch`, entities: [{ kind, id }], changeSetId: `cs-${Math.random()}`, at: Date.now() })
    })
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
    cleanup()
    resetAgentChangeBus()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('discount form against a stale save [TC-AICP-333]', () => {
    const base: DiscountDoc = { id: 'd1', code: 'SAVE10', type: 'percentage', value: 10, status: 'active', usageCount: 0, createdAt: '2026-01-01T00:00:00Z', updatedAt: V1 }
    const db = { code: 'SAVE10', value: 10, updatedAt: V1 }
    const putBodies: Array<Record<string, unknown>> = []
    const apiDoc = () => ({ ...base, code: db.code, value: db.value, updatedAt: db.updatedAt })
    const code = () => screen.getByPlaceholderText('SUMMER50') as HTMLInputElement
    const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    beforeEach(() => {
        db.code = 'SAVE10'
        db.value = 10
        db.updatedAt = V1
        putBodies.length = 0
        vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
            if (init?.method !== 'PUT') return new Response(JSON.stringify({ success: true, data: apiDoc() }), { status: 200 })
            const body = JSON.parse(String(init.body)) as Record<string, unknown>
            putBodies.push(body)
            if (isStaleVersion(body.expectedUpdatedAt as string | undefined, db.updatedAt)) {
                return new Response(JSON.stringify({ success: false, ok: false, code: 'VERSION_CONFLICT', current: db.updatedAt }), { status: 409 })
            }
            db.code = String(body.code)
            db.updatedAt = V2
            return new Response(JSON.stringify({ success: true, data: apiDoc() }), { status: 200 })
        }))
    })

    const assistantRenames = async () => {
        db.code = 'SAVE15'
        db.updatedAt = V2
        await assistantChanges('store_discount', 'd1')
    }

    it('TC-AICP-333: the loaded version goes with the PUT; the discount is saved and the page leaves', async () => {
        wrap(<DiscountForm discount={base} tenantName="Kedai" />)
        fireEvent.change(code(), { target: { value: 'MINE' } })
        save()
        await waitFor(() => expect(router.push).toHaveBeenCalledWith('/discounts'))
        expect(putBodies[0]).toMatchObject({ code: 'MINE', expectedUpdatedAt: V1 })
    })

    it('TC-AICP-333: Keep mine, then Save: one conflict notice, the edit stays, no toast, no navigation', async () => {
        wrap(<DiscountForm discount={base} tenantName="Kedai" />)
        fireEvent.change(code(), { target: { value: 'MINE' } })
        await assistantRenames()
        fireEvent.click(await screen.findByRole('button', { name: copy.keepMine }))

        save()

        expect(await screen.findByText(copy.conflict.discount)).toBeInTheDocument()
        expect(screen.getAllByRole('status')).toHaveLength(1)
        expect(code().value).toBe('MINE')
        expect(toast.error).not.toHaveBeenCalled()
        expect(router.push).not.toHaveBeenCalled()
        expect(db.code).toBe('SAVE15')
    })

    it('TC-AICP-333: Save mine anyway sends the version the 409 reported', async () => {
        wrap(<DiscountForm discount={base} tenantName="Kedai" />)
        fireEvent.change(code(), { target: { value: 'MINE' } })
        await assistantRenames()
        save()
        await screen.findByText(copy.conflict.discount)

        fireEvent.click(screen.getByRole('button', { name: copy.saveAnyway }))

        await waitFor(() => expect(router.push).toHaveBeenCalledWith('/discounts'))
        expect(putBodies.at(-1)).toMatchObject({ code: 'MINE', expectedUpdatedAt: V2 })
        expect(db.code).toBe('MINE')
    })

    it('TC-AICP-333: Load the latest reads the discount again and drops the edit', async () => {
        wrap(<DiscountForm discount={base} tenantName="Kedai" />)
        fireEvent.change(code(), { target: { value: 'MINE' } })
        await assistantRenames()
        save()
        await screen.findByText(copy.conflict.discount)

        fireEvent.click(screen.getByRole('button', { name: copy.loadLatest }))

        await waitFor(() => expect(code().value).toBe('SAVE15'))
        expect(screen.queryByRole('status')).toBeNull()
        fireEvent.change(code(), { target: { value: 'AFTER' } })
        save()
        await waitFor(() => expect(router.push).toHaveBeenCalledWith('/discounts'))
        expect(putBodies.at(-1)).toMatchObject({ code: 'AFTER', expectedUpdatedAt: V2 })
    })

    it('TC-AICP-333: a duplicate-code 409 stays the field error, not a conflict; a new discount sends no version', async () => {
        const dup = vi.fn(async () => new Response(JSON.stringify({ success: false, error: { code: 'DUPLICATE_CODE', message: 'taken' } }), { status: 409 }))
        vi.stubGlobal('fetch', dup)
        wrap(<DiscountForm discount={base} tenantName="Kedai" />)
        fireEvent.change(code(), { target: { value: 'TAKEN' } })
        save()
        await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
        expect(screen.queryByText(copy.conflict.discount)).toBeNull()
        cleanup()

        const created = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { id: 'n' } }), { status: 201 }))
        vi.stubGlobal('fetch', created)
        wrap(<DiscountForm tenantName="Kedai" />)
        fireEvent.change(code(), { target: { value: 'NEWONE' } })
        fireEvent.change(screen.getByPlaceholderText('50') as HTMLInputElement, { target: { value: '10' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save discount' }))
        await waitFor(() => expect(created).toHaveBeenCalled())
        const [url, init] = created.mock.calls[0] as unknown as [string, RequestInit]
        expect(url).toBe('/api/v1/discounts')
        expect(JSON.parse(String(init.body))).not.toHaveProperty('expectedUpdatedAt')
    })
})

describe('customer detail against a stale save [TC-AICP-334]', () => {
    const update = vi.mocked(customerActions.updateShopCustomerAction)
    const detail = vi.mocked(customerActions.getShopCustomerDetailAction)
    const customer = (over: Partial<ShopCustomerRecord> = {}): ShopCustomerRecord => ({
        id: 5, email: 'aisyah@x.my', name: 'Aisyah', phone: null, rank: null, notes: null, addresses: [], firstOrderAt: null,
        orderCount: 2, lifetime: 100, completedRate: 100, failedRate: 0, latestOrderAt: null,
        createdAt: '2026-01-01T00:00:00Z', updatedAt: V1, ...over,
    })
    const nameInput = () => screen.getByDisplayValue(/Aisyah|Mine|Theirs/) as HTMLInputElement
    const save = () => fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    const conflict = { ok: false, code: 'VERSION_CONFLICT', current: V2 }

    it('TC-AICP-334: the loaded version goes with the save; a stale save shows ONE notice, keeps the edit, no toast', async () => {
        update.mockResolvedValueOnce(conflict as never)
        wrap(<CustomersDetail customer={customer()} />)
        fireEvent.change(nameInput(), { target: { value: 'Mine' } })
        await assistantChanges('store_customer', '5')
        fireEvent.click(await screen.findByRole('button', { name: copy.keepMine }))

        save()

        expect(await screen.findByText(copy.conflict.customer)).toBeInTheDocument()
        expect(update).toHaveBeenCalledWith(5, expect.objectContaining({ name: 'Mine' }), V1)
        expect(screen.getAllByRole('status')).toHaveLength(1)
        expect(nameInput().value).toBe('Mine')
        expect(toast.error).not.toHaveBeenCalled()
        expect(router.push).not.toHaveBeenCalled()
    })

    it('TC-AICP-334: Save mine anyway sends the reported version and saves', async () => {
        update.mockResolvedValueOnce(conflict as never).mockResolvedValueOnce(customer({ name: 'Mine', updatedAt: '2026-10-22T03:00:00.000Z' }) as never)
        wrap(<CustomersDetail customer={customer()} />)
        fireEvent.change(nameInput(), { target: { value: 'Mine' } })
        save()
        await screen.findByText(copy.conflict.customer)

        fireEvent.click(screen.getByRole('button', { name: copy.saveAnyway }))

        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
        expect(update).toHaveBeenLastCalledWith(5, expect.objectContaining({ name: 'Mine' }), V2)
        expect(router.push).toHaveBeenCalledWith('/customers')
    })

    it('TC-AICP-334: Load the latest takes the current customer and its version; the next save carries it', async () => {
        update.mockResolvedValueOnce(conflict as never).mockResolvedValueOnce(customer({ name: 'Theirs 2', updatedAt: '2026-10-22T03:00:00.000Z' }) as never)
        detail.mockResolvedValue(customer({ name: 'Theirs', updatedAt: V2 }) as never)
        wrap(<CustomersDetail customer={customer()} />)
        fireEvent.change(nameInput(), { target: { value: 'Mine' } })
        save()
        await screen.findByText(copy.conflict.customer)

        fireEvent.click(screen.getByRole('button', { name: copy.loadLatest }))

        await waitFor(() => expect(nameInput().value).toBe('Theirs'))
        expect(screen.queryByRole('status')).toBeNull()
        fireEvent.change(nameInput(), { target: { value: 'Theirs 2' } })
        save()
        await waitFor(() => expect(update).toHaveBeenCalledTimes(2))
        expect(update).toHaveBeenLastCalledWith(5, expect.objectContaining({ name: 'Theirs 2' }), V2)
    })
})
