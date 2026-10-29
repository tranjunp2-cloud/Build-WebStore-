/**
 * TC-AIS-CAP-UI-010..018 — "AI limits" block of the Overview: figures, meter colours, lists, empty / error states,
 * quick edit (PUT body), per-plan switches (confirm + PUT), plan table "Off". Real: the components and lib helpers.
 * Faked: next/navigation router, fetch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import React from 'react'

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/studio/performance', useSearchParams: () => new URLSearchParams() }))

import { PlanTable } from '@/app/studio/performance/_components/overview-tables'
import { LimitsPanel, LimitsPanelSkeleton } from '@/app/studio/performance/_components/limits-panel'
import { status } from './caps-fixtures'

const fetchMock = vi.fn()
beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })
})
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

const meter = (name: string) => screen.getByRole('progressbar', { name })
const lastBody = () => JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))

describe('TC-AIS-CAP-UI-010 platform figures', () => {
    it('shows today against the daily cap, the month with its forecast, and the state chip', () => {
        render(<LimitsPanel status={status()} retryHref="/studio/performance" />)
        expect(screen.getByText('Platform today')).toBeInTheDocument()
        expect(screen.getByText('$8.00')).toBeInTheDocument()
        expect(screen.getByText('of $20')).toBeInTheDocument()
        expect(screen.getByText('$210.00')).toBeInTheDocument()
        expect(screen.getByText('of $500')).toBeInTheDocument()
        expect(screen.getByText(/Forecast \$340\.00 at the current pace \(68% of the cap\)/)).toBeInTheDocument()
        expect(screen.getByLabelText('Platform state: OK')).toHaveClass('acl-tone-ok')
        expect(screen.getByRole('link', { name: /All limits/ })).toHaveAttribute('href', '/studio/settings/ai')
    })
    it('names the environment as the source of an unsaved daily cap', () => {
        render(<LimitsPanel status={status({ caps: { ...status().caps, saved: null, dailySource: 'env' } })} retryHref="/x" />)
        expect(screen.getByText(/40% of the daily cap \(from the environment\)/)).toBeInTheDocument()
    })
    it('shows Free paused and All paused chips', () => {
        const { rerender } = render(<LimitsPanel status={status({}, { state: 'free-paused', dailyPercent: 85 })} retryHref="/x" />)
        expect(screen.getByLabelText('Platform state: Free paused')).toHaveClass('acl-tone-warn')
        rerender(<LimitsPanel status={status({}, { state: 'all-paused', dailyPercent: 100 })} retryHref="/x" />)
        expect(screen.getByLabelText('Platform state: All paused')).toHaveClass('acl-tone-danger')
    })
})

describe('TC-AIS-CAP-UI-011 progress colours follow the alert thresholds', () => {
    it.each([
        [40, 'ok'], [50, 'warn'], [85, 'warn'], [100, 'full'], [130, 'full'],
    ])('%s %% of the daily cap is %s', (percent, tone) => {
        render(<LimitsPanel status={status({}, { dailyPercent: percent })} retryHref="/x" />)
        expect(meter('Spend against the daily cap')).toHaveAttribute('data-tone', tone)
        expect(Number(meter('Spend against the daily cap').getAttribute('aria-valuenow'))).toBe(Math.min(100, percent))
    })
    it('uses the same thresholds for the monthly cap', () => {
        render(<LimitsPanel status={status({}, { monthlyPercent: 79 })} retryHref="/x" />)
        expect(meter('Spend against the monthly cap')).toHaveAttribute('data-tone', 'warn')
    })
})

describe('TC-AIS-CAP-UI-012 lists and their empty states', () => {
    it('lists near-limit shops (link to the shop page), blocked shops, disabled plans and recent alerts', () => {
        render(<LimitsPanel status={status({ disabledPlans: ['STANDARD_TM_USER', 'STANDARD_NON_TM_USER'] })} retryHref="/x" />)
        const near = screen.getByRole('region', { name: 'Near limit' })
        expect(within(near).getByRole('link', { name: 'Kedai Runcit' })).toHaveAttribute('href', '/studio/performance/shops/7')
        expect(within(near).getByText('87%')).toBeInTheDocument()
        const off = screen.getByRole('region', { name: 'Blocked or off' })
        expect(within(off).getByText('Standard plan')).toBeInTheDocument()
        expect(within(off).getByRole('link', { name: 'Kopi Tiam' })).toHaveAttribute('href', '/studio/performance/shops/9')
        expect(within(off).getByText('Blocked by an override')).toBeInTheDocument()
        const alerts = screen.getByRole('region', { name: 'Recent alerts' })
        expect(within(alerts).getByText('Platform, daily 50%')).toBeInTheDocument()
        expect(within(alerts).getByRole('link', { name: 'Alerts on the settings page' })).toHaveAttribute('href', '/studio/settings/ai#alerts')
    })
    it('shows only the last 5 alerts and links to all of them', () => {
        const recentAlerts = Array.from({ length: 8 }, (_, i) => ({ ...status().recentAlerts[0], id: i + 1, threshold: i + 1 }))
        render(<LimitsPanel status={status({ recentAlerts })} retryHref="/x" />)
        const alerts = screen.getByRole('region', { name: 'Recent alerts' })
        expect(within(alerts).getAllByRole('listitem')).toHaveLength(5)
        expect(within(alerts).getByRole('link', { name: 'Show all alerts' })).toBeInTheDocument()
    })
    it('says so when nothing is near, blocked or alerted', () => {
        render(<LimitsPanel status={status({ nearLimit: [], blocked: [], recentAlerts: [] })} retryHref="/x" />)
        expect(screen.getByText('No shop is close to its own limit.')).toBeInTheDocument()
        expect(screen.getByText('Nothing is blocked. AI is on for every plan.')).toBeInTheDocument()
        expect(screen.getByText(/No alert yet/)).toBeInTheDocument()
    })
    it('explains that no platform cap is on', () => {
        const caps = { ...status().caps, effective: { ...status().caps.effective, dailyUsd: null, monthlyUsd: null }, dailySource: 'off' as const }
        render(<LimitsPanel status={status({ caps }, { dailyPercent: null, monthlyPercent: null, forecastMonthlyPercent: null })} retryHref="/x" />)
        expect(screen.getByText(/No platform cap is on/)).toBeInTheDocument()
        expect(screen.queryByRole('progressbar', { name: 'Spend against the daily cap' })).toBeNull()
    })
})

describe('TC-AIS-CAP-UI-013 loading and error states', () => {
    it('shows an alert with a retry link when the status could not load', () => {
        render(<LimitsPanel status={null} retryHref="/studio/performance?period=30d" />)
        expect(screen.getByRole('alert')).toHaveTextContent('Could not load the AI limits')
        expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/studio/performance?period=30d')
        expect(screen.queryByRole('button', { name: /Edit/ })).toBeNull()
    })
    it('has a busy skeleton', () => {
        render(<LimitsPanelSkeleton />)
        expect(screen.getByLabelText('Loading AI limits')).toHaveAttribute('aria-busy', 'true')
    })
})

describe('TC-AIS-CAP-UI-014 quick edit builds the PUT body', () => {
    it('changes daily cap, monthly cap and pause-Free %, asks to confirm, then PUTs the caps block and refreshes', async () => {
        render(<LimitsPanel status={status()} retryHref="/x" />)
        fireEvent.click(screen.getByRole('button', { name: /Edit/ }))
        const dialog = screen.getByRole('dialog', { name: 'Edit platform caps' })
        expect(within(dialog).queryByText('Alert thresholds')).toBeNull()
        fireEvent.change(within(dialog).getByLabelText('Daily cap (all shops)', { selector: 'input' }), { target: { value: '30' } })
        fireEvent.change(within(dialog).getByLabelText('Monthly cap (all shops)', { selector: 'input' }), { target: { value: '800' } })
        fireEvent.change(within(dialog).getByLabelText('Pause Free first at', { selector: 'input' }), { target: { value: '70' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Review changes' }))
        const confirm = screen.getByRole('alertdialog')
        expect(confirm).toHaveTextContent('Platform daily cap: $20 → $30')
        expect(confirm).toHaveTextContent('Platform monthly cap: $500 → $800')
        expect(confirm).toHaveTextContent('Pause Free first at: 80 % → 70 %')
        fireEvent.click(within(confirm).getByRole('button', { name: 'Save changes' }))
        await waitFor(() => expect(router.refresh).toHaveBeenCalled())
        expect(fetchMock).toHaveBeenCalledWith('/api/admin/ai-settings', expect.objectContaining({ method: 'PUT' }))
        expect(lastBody()).toEqual({ caps: { dailyUsd: 30, monthlyUsd: 800, alertPercents: [50, 80, 100], pauseFreeAtPercent: 70 } })
    })
    it('turning the daily cap off sends null; nothing to review until something changes; a bad number blocks review', () => {
        render(<LimitsPanel status={status()} retryHref="/x" />)
        fireEvent.click(screen.getByRole('button', { name: /Edit/ }))
        const dialog = screen.getByRole('dialog')
        const review = within(dialog).getByRole('button', { name: 'Review changes' })
        expect(review).toBeDisabled()
        fireEvent.change(within(dialog).getByLabelText('Daily cap (all shops)', { selector: 'input' }), { target: { value: 'abc' } })
        expect(review).toBeDisabled()
        expect(within(dialog).getByText(/Enter an amount above \$0/)).toBeInTheDocument()
        fireEvent.click(within(dialog).getAllByRole('switch')[0])
        expect(review).toBeEnabled()
    })
    it('shows the server sentence when the save fails and keeps the dialog open', async () => {
        fetchMock.mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({ errors: [{ path: ['caps', 'dailyUsd'], message: 'Too big' }] }) })
        render(<LimitsPanel status={status()} retryHref="/x" />)
        fireEvent.click(screen.getByRole('button', { name: /Edit/ }))
        fireEvent.change(screen.getByLabelText('Daily cap (all shops)', { selector: 'input' }), { target: { value: '99' } })
        fireEvent.click(screen.getByRole('button', { name: 'Review changes' }))
        fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Save changes' }))
        expect(await screen.findByText('Too big')).toBeInTheDocument()
        expect(router.refresh).not.toHaveBeenCalled()
    })
})

describe('TC-AIS-CAP-UI-015 per-plan AI switches', () => {
    it('asks before turning a plan off, then PUTs enabled = NO for every code of the group', async () => {
        render(<LimitsPanel status={status()} retryHref="/x" />)
        const group = screen.getByRole('group', { name: 'AI on or off per plan' })
        const starter = within(group).getByRole('switch', { name: 'Starter' })
        expect(starter).toHaveAttribute('aria-checked', 'true')
        fireEvent.click(starter)
        const confirm = screen.getByRole('alertdialog', { name: 'Turn AI off for the Starter plan?' })
        expect(fetchMock).not.toHaveBeenCalled()
        fireEvent.click(within(confirm).getByRole('button', { name: 'Turn off' }))
        await waitFor(() => expect(router.refresh).toHaveBeenCalled())
        expect(lastBody()).toEqual({ limits: [
            { planCode: 'STARTER_TM_USER', kind: 'enabled', value: 'NO' }, { planCode: 'STARTER_NON_TM_USER', kind: 'enabled', value: 'NO' },
        ] })
    })
    it('cancel changes nothing; an off plan shows off and turns back on with YES', async () => {
        render(<LimitsPanel status={status({ disabledPlans: ['FREEMIUM'] })} retryHref="/x" />)
        const free = screen.getByRole('switch', { name: 'Free' })
        expect(free).toHaveAttribute('aria-checked', 'false')
        fireEvent.click(free)
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
        expect(fetchMock).not.toHaveBeenCalled()
        fireEvent.click(free)
        fireEvent.click(screen.getByRole('button', { name: 'Turn on' }))
        await waitFor(() => expect(lastBody()).toEqual({ limits: [{ planCode: 'FREEMIUM', kind: 'enabled', value: 'YES' }] }))
    })
})

describe('TC-AIS-CAP-UI-016 plan table', () => {
    it('shows Off instead of a budget for a plan with AI switched off', () => {
        const limits = { free: { budgetUsd: 0.05, picturesPerDay: 1, varies: false, off: true }, starter: { budgetUsd: 0.15, picturesPerDay: 3, varies: false, off: false } }
        render(<PlanTable rows={[]} limits={limits} />)
        const free = screen.getByText('Free').closest('tr')!
        expect(within(free).getByText('Off')).toBeInTheDocument()
        expect(within(screen.getByText('Starter').closest('tr')!).getByText('$0.15')).toBeInTheDocument()
    })
})
