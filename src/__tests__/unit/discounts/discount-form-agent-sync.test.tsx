/**
 * TC-AICP-312 — discount detail: when the assistant changes the discount that is open, a form without unsaved edits is
 * reset to the new values silently (read again from the discount API); with unsaved edits nothing is overwritten and the
 * notice offers Reload (new values) or Keep mine (dismiss, edits stay); a change of another discount is ignored; a
 * discount the assistant deleted takes the merchant back to the list, as the server page does.
 * Real: DiscountForm, useAgentRecordSync, AgentChangedNotice, announceAgentChange (the bus), en strings.
 * Faked: fetch, next/navigation, sonner.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { DiscountForm, type DiscountDoc } from '@/app/(dashboard)/discounts/_components/discount-form'
import { I18nProvider } from '@/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import en from '@/i18n/locales/en.json'
import { announceAgentChange, resetAgentChangeBus } from '@/lib/agent-changes/bus'
import type { AgentChange } from '@/lib/agent-changes/types'

const base: DiscountDoc = { id: 'd1', code: 'SAVE10', type: 'percentage', value: 10, status: 'active', usageCount: 0, createdAt: '2026-01-01T00:00:00Z' }
const notice = en.dashboard.agentChanged.discount
const change = (id: string, kind = 'store_discount'): AgentChange => ({
    action: 'applied', kind: 'store.discounts_patch', entities: [{ kind, id }], changeSetId: `cs-${id}-${Math.random()}`, at: Date.now(),
})
const fetchMock = vi.fn<(url: string) => Promise<Response>>()
const answer = (over: Partial<DiscountDoc>) => fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ success: true, data: { ...base, ...over } }), { status: 200 }),
)
const code = () => screen.getByPlaceholderText('SUMMER50') as HTMLInputElement
const settle = () => act(() => new Promise((r) => setTimeout(r, 260)))
const mount = () => render(<I18nProvider defaultLocale="en"><TooltipProvider><DiscountForm discount={base} tenantName="Kedai" /></TooltipProvider></I18nProvider>)

beforeEach(() => {
    fetchMock.mockReset()
    router.replace.mockClear()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
    cleanup()
    resetAgentChangeBus()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('discount detail follows the assistant [TC-AICP-312]', () => {
    it('TC-AICP-312: no unsaved edits: the form is reset to the new values silently', async () => {
        answer({ code: 'SAVE15', value: 15 })
        mount()
        expect(code().value).toBe('SAVE10')

        act(() => announceAgentChange(change('d1')))
        await waitFor(() => expect(code().value).toBe('SAVE15'))
        expect(fetchMock).toHaveBeenCalledWith('/api/v1/discounts/d1', expect.anything())
        expect(screen.queryByText(notice)).toBeNull()
        // the save bar only shows for edits: the reset form is clean
        expect(screen.queryByRole('button', { name: /save/i })).toBeNull()
    })

    it('TC-AICP-312: unsaved edits: notice, nothing overwritten; Reload takes the new values', async () => {
        answer({ code: 'SAVE15' })
        mount()
        fireEvent.change(code(), { target: { value: 'MINE' } })

        act(() => announceAgentChange(change('d1')))
        await waitFor(() => expect(screen.getByText(notice)).toBeInTheDocument())
        await settle()
        expect(fetchMock).not.toHaveBeenCalled()
        expect(code().value).toBe('MINE')

        fireEvent.click(screen.getByRole('button', { name: en.dashboard.agentChanged.reload }))
        await waitFor(() => expect(code().value).toBe('SAVE15'))
        expect(screen.queryByText(notice)).toBeNull()
    })

    it('TC-AICP-312: Keep mine dismisses the notice and keeps the edits', async () => {
        answer({ code: 'SAVE15' })
        mount()
        fireEvent.change(code(), { target: { value: 'MINE' } })
        act(() => announceAgentChange(change('d1')))
        await waitFor(() => expect(screen.getByText(notice)).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: en.dashboard.agentChanged.keepMine }))
        expect(screen.queryByText(notice)).toBeNull()
        expect(code().value).toBe('MINE')
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('TC-AICP-312: another discount or kind is ignored', async () => {
        answer({ code: 'SAVE15' })
        mount()
        act(() => announceAgentChange(change('d2')))
        act(() => announceAgentChange(change('d1', 'store_order')))
        await settle()
        expect(fetchMock).not.toHaveBeenCalled()
        expect(code().value).toBe('SAVE10')
    })

    it('TC-AICP-312: a discount deleted by the assistant leads back to the list; a failed read keeps the form', async () => {
        fetchMock.mockResolvedValueOnce(new Response('{}', { status: 500 }))
        mount()
        act(() => announceAgentChange(change('d1')))
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
        await settle()
        expect(router.replace).not.toHaveBeenCalled()
        expect(code().value).toBe('SAVE10')

        fetchMock.mockResolvedValueOnce(new Response('{}', { status: 404 }))
        act(() => announceAgentChange(change('d1')))
        await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/discounts'))
    })
})
