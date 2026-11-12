/**
 * TC-AIS-CAP-UI-020..025 — shop page card "AI limit for this shop" and the override editor: sources, buttons, validation
 * (reason required), PUT body, server errors, remove with confirm. Real: ShopLimitCard, OverrideEditor, override-form. Faked: router, fetch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import React from 'react'

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/x', useSearchParams: () => new URLSearchParams() }))

import { OverrideEditor } from '@/app/studio/_components/ai-limits/override-editor'
import { ShopLimitCard } from '@/app/studio/performance/_components/shop-limit-card'
import { aiLimits, customOverride, shopView } from './caps-fixtures'

const fetchMock = vi.fn()
beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })
})
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })
const lastBody = () => JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))
const rowOf = (label: string) => screen.getByText(label).closest('tr') as HTMLElement

describe('TC-AIS-CAP-UI-020 card without an override', () => {
    it('shows the plan limits as what applies, all from the plan, with a Set override button', () => {
        render(<ShopLimitCard tenantId={7} shopName="Kedai Runcit" view={shopView()} retryHref="/x" />)
        expect(screen.getByRole('button', { name: 'Set override' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull()
        const budget = rowOf('AI budget')
        expect(within(budget).getByText('$0.15 / day', { selector: 'b' })).toBeInTheDocument()
        expect(within(budget).getByText('Plan')).toBeInTheDocument()
        expect(within(rowOf('Monthly AI budget')).getByText('Unlimited', { selector: 'b' })).toBeInTheDocument()
    })
})

describe('TC-AIS-CAP-UI-021 card with an override', () => {
    const view = shopView({ override: customOverride(), effective: aiLimits({ aiBudgetUsd: 0.5, aiBudgetUsdMonthly: 12, source: 'shop' }) })
    it('puts plan and override values side by side and marks the source of each row', () => {
        render(<ShopLimitCard tenantId={7} shopName="Kedai Runcit" view={view} retryHref="/x" />)
        const budget = rowOf('AI budget')
        expect(within(budget).getByText('$0.15 / day')).toBeInTheDocument()
        expect(within(budget).getAllByText('$0.5 / day')).toHaveLength(2) // the override column and "applies now"
        expect(within(budget).getByText('Override')).toBeInTheDocument()
        expect(within(rowOf('Pictures')).getByText('Plan')).toBeInTheDocument()
        expect(screen.getByText('Pilot customer')).toBeInTheDocument()
        expect(screen.getByText('Set by owner@primeweb.local')).toBeInTheDocument()
        expect(screen.getByText('Until removed')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    })
    it('marks an expired override and says the plan applies', () => {
        render(<ShopLimitCard tenantId={7} shopName="K" view={shopView({ override: customOverride({ expired: true, expiresAt: '2026-10-01T00:00:00.000Z' }) })} retryHref="/x" />)
        expect(screen.getAllByText('Expired').length).toBeGreaterThan(0)
        expect(screen.getByText('Expired: the plan applies.')).toBeInTheDocument()
    })
    it('Remove asks first, then DELETEs and refreshes the page data', async () => {
        render(<ShopLimitCard tenantId={7} shopName="K" view={view} retryHref="/x" />)
        fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
        expect(fetchMock).not.toHaveBeenCalled()
        fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove override' }))
        await waitFor(() => expect(router.refresh).toHaveBeenCalled())
        expect(fetchMock).toHaveBeenCalledWith('/api/admin/ai-settings/shops/7', { method: 'DELETE' })
    })
    it('shows the failure inside the confirm dialog and does not refresh', async () => {
        fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'Could not remove the shop override' }) })
        render(<ShopLimitCard tenantId={7} shopName="K" view={view} retryHref="/x" />)
        fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
        fireEvent.click(screen.getByRole('button', { name: 'Remove override' }))
        expect(await screen.findByText('Could not remove the shop override')).toBeInTheDocument()
        expect(router.refresh).not.toHaveBeenCalled()
    })
})

describe('TC-AIS-CAP-UI-022 card error state', () => {
    it('offers a retry instead of the table', () => {
        render(<ShopLimitCard tenantId={7} shopName="K" view={null} retryHref="/studio/performance/shops/7" />)
        expect(screen.getByRole('alert')).toHaveTextContent('Could not load this shop')
        expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/studio/performance/shops/7')
        expect(screen.queryByRole('table')).toBeNull()
    })
})

describe('TC-AIS-CAP-UI-023 override editor validation', () => {
    const open = (onSaved = vi.fn()) => {
        render(<OverrideEditor tenantId={7} shopName="Kedai Runcit" existing={null} planLabel="Starter" planHints={{ aiBudgetUsd: '$0.15' }} onClose={vi.fn()} onSaved={onSaved} />)
        return onSaved
    }
    it('does not send without a reason and names the field', () => {
        open()
        fireEvent.change(screen.getByLabelText('AI budget per day'), { target: { value: '1' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save override' }))
        expect(screen.getByText('Say why this shop has its own limits.')).toBeInTheDocument()
        expect(screen.getByLabelText('Reason (required)')).toHaveAttribute('aria-invalid', 'true')
        expect(fetchMock).not.toHaveBeenCalled()
    })
    it('a custom override with no number asks for at least one; fields show the plan value as a hint', () => {
        open()
        expect(screen.getByLabelText('AI budget per day')).toHaveAttribute('placeholder', 'Plan: $0.15')
        fireEvent.change(screen.getByLabelText('Reason (required)'), { target: { value: 'VIP' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save override' }))
        expect(screen.getByRole('alert')).toHaveTextContent('needs at least one limit')
        expect(fetchMock).not.toHaveBeenCalled()
    })
    it('PUTs the body (empty = keep plan) and tells the page it saved', async () => {
        const onSaved = open()
        fireEvent.change(screen.getByLabelText('AI budget per day'), { target: { value: '0.5' } })
        fireEvent.change(screen.getByLabelText('Monthly AI budget'), { target: { value: '12' } })
        fireEvent.change(screen.getByLabelText('Reason (required)'), { target: { value: 'Pilot customer' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save override' }))
        await waitFor(() => expect(onSaved).toHaveBeenCalled())
        expect(fetchMock).toHaveBeenCalledWith('/api/admin/ai-settings/shops/7', expect.objectContaining({ method: 'PUT' }))
        expect(lastBody()).toEqual({ mode: 'custom', aiBudgetUsd: 0.5, picturesPerDay: null, aiBudgetUsdMonthly: 12, siteBudgetUsd: null, reason: 'Pilot customer', expiresAt: null })
    })
    it('Unlimited and Blocked hide the numeric fields and send no numbers', async () => {
        const onSaved = open()
        fireEvent.click(screen.getByRole('radio', { name: 'Blocked' }))
        expect(screen.queryByLabelText('AI budget per day')).toBeNull()
        fireEvent.change(screen.getByLabelText('Reason (required)'), { target: { value: 'Abuse' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save override' }))
        await waitFor(() => expect(onSaved).toHaveBeenCalled())
        expect(lastBody()).toEqual({ mode: 'blocked', reason: 'Abuse', expiresAt: null })
    })
    it('shows a 422 sentence under its field and stays open', async () => {
        const onSaved = open()
        fetchMock.mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({ errors: [{ path: ['reason'], message: 'Say why this shop has its own limits.' }] }) })
        fireEvent.change(screen.getByLabelText('AI budget per day'), { target: { value: '1' } })
        fireEvent.change(screen.getByLabelText('Reason (required)'), { target: { value: 'x' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save override' }))
        expect(await screen.findByText('Say why this shop has its own limits.')).toBeInTheDocument()
        expect(onSaved).not.toHaveBeenCalled()
    })
    it('Escape closes the editor', () => {
        const onClose = vi.fn()
        render(<OverrideEditor tenantId={7} shopName="K" existing={null} planLabel="Free" onClose={onClose} onSaved={vi.fn()} />)
        fireEvent.keyDown(window, { key: 'Escape' })
        expect(onClose).toHaveBeenCalled()
    })
    it('opens an existing override filled in', () => {
        render(<OverrideEditor tenantId={7} shopName="K" existing={customOverride()} planLabel="Starter" onClose={vi.fn()} onSaved={vi.fn()} />)
        expect(screen.getByRole('dialog', { name: 'Edit AI override: K' })).toBeInTheDocument()
        expect(screen.getByLabelText('AI budget per day')).toHaveValue('0.5')
        expect(screen.getByLabelText('Reason (required)')).toHaveValue('Pilot customer')
    })
})
