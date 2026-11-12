/**
 * TC-AIS-CAP-UI-030..037 — /studio/settings/ai: Platform caps section, per-plan AI switch (greys the inputs), the four numeric limits
 * incl. "edit separately", Shop overrides table (edit / remove / expired / empty / error), recent alerts, save bar + confirm + PUT body.
 * Real: the components and lib helpers. Faked: fetch, next/navigation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import React from 'react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/studio/settings/ai', useSearchParams: () => new URLSearchParams() }))

import { AiSettingsClient } from '@/app/studio/settings/ai/_components/ai-settings-client'
import { AlertsSection } from '@/app/studio/settings/ai/_components/alerts-section'
import { CapsSection } from '@/app/studio/settings/ai/_components/caps-section'
import { LimitsSection } from '@/app/studio/settings/ai/_components/limits-section'
import { ShopOverridesSection } from '@/app/studio/settings/ai/_components/shop-overrides-section'
import { capsDraftFromView } from '@/lib/admin/ai-usage/caps-form'
import { resolveCaps } from '@/lib/admin/ai-caps/caps-config'
import { ALL_PLAN_CODES } from '@/lib/admin/ai-settings/plan-groups'
import type { AiSettingsData, LimitValues } from '@/lib/admin/ai-settings/types'
import type { ShopOverrideListItem } from '@/lib/admin/ai-caps/shop-overrides'
import { capsView, status } from '../studio-ai-usage/caps-fixtures'

const every = (value: string) => Object.fromEntries(ALL_PLAN_CODES.map((code) => [code, value])) as LimitValues['budget']
const limits = (over: Partial<LimitValues> = {}): LimitValues => ({
    budget: every('0.15'), pictures: every('3'), monthly: every('UNLIMITED'), site: every('UNLIMITED'), enabled: every('YES'), ...over,
})
const settings = (over: Partial<AiSettingsData> = {}): AiSettingsData => ({
    limits: limits(), config: { prices: {}, images: {}, models: {} }, caps: capsView(), configUpdatedAt: null, configInvalid: false, stats: [], unpriced: [], ...over,
})
const override = (over: Partial<ShopOverrideListItem> = {}): ShopOverrideListItem => ({
    tenantId: 7, shopName: 'Kedai Runcit', plan: 'STARTER_TM_USER', mode: 'custom', aiBudgetUsd: 0.5, picturesPerDay: null, aiBudgetUsdMonthly: 12, siteBudgetUsd: null,
    reason: 'Pilot customer', expiresAt: null, expired: false, setBy: { id: 1, email: 'owner@primeweb.local' }, updatedAt: '2026-10-29T01:00:00.000Z', ...over,
})

const fetchMock = vi.fn()
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) }) })
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('TC-AIS-CAP-UI-030 Platform caps section', () => {
    const renderCaps = (view = capsView(), onChange = vi.fn()) => {
        render(<CapsSection view={view} draft={capsDraftFromView(view)} problems={{}} onChange={onChange} />)
        return onChange
    }
    it('shows the four settings and what applies now', () => {
        renderCaps()
        expect(screen.getByTestId('caps-effective')).toHaveTextContent('daily $20 (saved here) · monthly $500 · alerts at 50 %, 80 %, 100 % · Free paused at 80 %')
        expect(screen.getByLabelText('Daily cap (all shops)', { selector: 'input' })).toHaveValue('20')
        expect(screen.getByLabelText('Monthly cap (all shops)', { selector: 'input' })).toHaveValue('500')
        expect(screen.getByLabelText('Pause Free first at', { selector: 'input' })).toHaveValue('80')
        expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['50 %', '80 %', '100 %'])
    })
    it('says "From environment: $20" while nothing is saved for the daily cap', () => {
        renderCaps(resolveCaps(null, { AI_DAILY_BUDGET_USD: '20' }))
        expect(screen.getByText('From environment: $20. Type an amount to set your own.')).toBeInTheDocument()
        expect(screen.getByTestId('caps-effective')).toHaveTextContent('daily $20 (from the environment) · monthly Off')
        expect(screen.getByLabelText('Daily cap (all shops)', { selector: 'input' })).toHaveAttribute('placeholder', '20')
    })
    it('typing a daily cap, adding and removing an alert threshold report the new draft', () => {
        const onChange = renderCaps()
        fireEvent.change(screen.getByLabelText('Daily cap (all shops)', { selector: 'input' }), { target: { value: '25' } })
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ daily: { mode: 'on', value: '25' } }))
        fireEvent.change(screen.getByLabelText('Add alert threshold in percent'), { target: { value: '90' } })
        fireEvent.click(screen.getByRole('button', { name: 'Add' }))
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ alerts: [50, 80, 90, 100] }))
        fireEvent.click(screen.getByRole('button', { name: 'Remove 50 %' }))
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ alerts: [80, 100] }))
    })
    it('rejects a threshold that is already there', () => {
        const onChange = renderCaps()
        fireEvent.change(screen.getByLabelText('Add alert threshold in percent'), { target: { value: '80' } })
        fireEvent.click(screen.getByRole('button', { name: 'Add' }))
        expect(screen.getByRole('alert')).toHaveTextContent('80 % is already there.')
        expect(onChange).not.toHaveBeenCalled()
    })
})

describe('TC-AIS-CAP-UI-031 plan limits: AI switch and the four numbers', () => {
    const renderLimits = (values = limits(), onSet = vi.fn()) => {
        render(<LimitsSection limits={values} stats={[]} errors={new Map()} onSet={onSet} />)
        return onSet
    }
    it('shows the AI switch and the monthly and website setup limits for every plan group', () => {
        renderLimits()
        expect(screen.getAllByRole('switch', { name: 'AI on' })).toHaveLength(4)
        expect(screen.getAllByText('Monthly budget per shop')).toHaveLength(4)
        expect(screen.getAllByText('Website setup budget per shop / day')).toHaveLength(4)
        expect(screen.getAllByText('Calendar month, Malaysia time.').length).toBeGreaterThan(0)
    })
    it('switching AI off writes NO to every code of the group', () => {
        const onSet = renderLimits()
        fireEvent.click(screen.getAllByRole('switch', { name: 'AI on' })[1])
        expect(onSet).toHaveBeenCalledWith('enabled', ['STARTER_TM_USER', 'STARTER_NON_TM_USER'], 'NO')
    })
    it('an off plan says so and greys out and disables its inputs', () => {
        renderLimits(limits({ enabled: { ...every('YES'), FREEMIUM: 'NO' } }))
        expect(screen.getByRole('status')).toHaveTextContent('AI is off for this plan')
        const freeFields = screen.getByRole('status').nextElementSibling as HTMLElement
        for (const input of within(freeFields).getAllByRole('textbox')) expect(input).toBeDisabled()
        for (const unlimited of within(freeFields).getAllByRole('switch')) expect(unlimited).toBeDisabled()
        // the other plans stay editable
        expect(screen.getByRole('switch', { name: 'AI off' })).toBeInTheDocument()
        expect(screen.getAllByRole('switch', { name: 'AI on' })).toHaveLength(3)
    })
    it('editing a monthly budget writes the monthly kind', () => {
        const onSet = renderLimits(limits({ monthly: every('12') }))
        const field = screen.getAllByLabelText('Monthly budget per shop', { selector: 'input' })[0]
        expect(field).toHaveValue('12')
        fireEvent.change(field, { target: { value: '15' } })
        expect(onSet).toHaveBeenCalledWith('monthly', ['FREEMIUM'], '15')
    })
    it('"Edit separately" covers all five kinds for each code', () => {
        renderLimits()
        fireEvent.click(screen.getAllByRole('button', { name: /Edit separately/ })[0])
        const section = screen.getByText('STARTER_TM_USER', { selector: 'span' }).parentElement as HTMLElement
        expect(within(section).getByRole('switch', { name: 'AI is on' })).toBeInTheDocument()
        for (const label of ['AI budget per shop / day', 'Pictures per shop / day', 'Monthly budget per shop', 'Website setup budget per shop / day']) {
            expect(within(section).getByText(label)).toBeInTheDocument()
        }
    })
    it('a group whose codes differ shows "differs" for the switch', () => {
        renderLimits(limits({ enabled: { ...every('YES'), STARTER_NON_TM_USER: 'NO' } }))
        expect(screen.getByRole('switch', { name: 'AI differs' })).toHaveAttribute('aria-checked', 'mixed')
    })
})

describe('TC-AIS-CAP-UI-032 shop overrides table', () => {
    it('lists shops with mode, values, reason, who set it and when it ends', () => {
        render(<ShopOverridesSection initial={[override(), override({ tenantId: 8, shopName: 'Old Deal', mode: 'blocked', expired: true, expiresAt: '2026-10-01T00:00:00.000Z' })]} failure={null} limits={limits()} />)
        const row = screen.getByRole('link', { name: 'Kedai Runcit' }).closest('tr') as HTMLElement
        expect(screen.getByRole('link', { name: 'Kedai Runcit' })).toHaveAttribute('href', '/studio/performance/shops/7')
        expect(within(row).getByText('Custom')).toBeInTheDocument()
        expect(within(row).getByText('$0.5/day · $12/month')).toBeInTheDocument()
        expect(within(row).getByText('Pilot customer')).toBeInTheDocument()
        expect(within(row).getByText('owner@primeweb.local')).toBeInTheDocument()
        expect(within(row).getByText('Until removed')).toBeInTheDocument()
        const old = screen.getByRole('link', { name: 'Old Deal' }).closest('tr') as HTMLElement
        expect(within(old).getAllByText('Expired')).toHaveLength(2)
    })
    it('Edit opens the same editor with the plan values as hints', () => {
        render(<ShopOverridesSection initial={[override()]} failure={null} limits={limits()} />)
        fireEvent.click(screen.getByRole('button', { name: 'Edit override of Kedai Runcit' }))
        expect(screen.getByRole('dialog', { name: 'Edit AI override: Kedai Runcit' })).toBeInTheDocument()
        expect(screen.getByLabelText('Pictures per day')).toHaveAttribute('placeholder', 'Plan: 3')
    })
    it('Remove asks first, DELETEs, then reloads the list', async () => {
        fetchMock.mockImplementation(async (url: string, init?: RequestInit) => init?.method === 'DELETE'
            ? { ok: true, status: 200, json: async () => ({ ok: true }) }
            : { ok: true, status: 200, json: async () => ({ overrides: [] }) })
        render(<ShopOverridesSection initial={[override()]} failure={null} limits={limits()} />)
        fireEvent.click(screen.getByRole('button', { name: 'Remove override of Kedai Runcit' }))
        expect(fetchMock).not.toHaveBeenCalled()
        fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove override' }))
        expect(await screen.findByText(/No shop has its own limits/)).toBeInTheDocument()
        expect(fetchMock).toHaveBeenCalledWith('/api/admin/ai-settings/shops/7', { method: 'DELETE' })
    })
    it('shows empty and error states', () => {
        const { unmount } = render(<ShopOverridesSection initial={[]} failure={null} limits={limits()} />)
        expect(screen.getByText('No shop has its own limits. Every shop follows its plan.')).toBeInTheDocument()
        unmount()
        render(<ShopOverridesSection initial={null} failure="db down" limits={limits()} />)
        expect(screen.getByRole('alert')).toHaveTextContent('Could not load shop overrides')
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    })
})

describe('TC-AIS-CAP-UI-033 recent alerts', () => {
    it('lists alerts with scope, shop, threshold and spend against the cap; has empty and error states', () => {
        const alerts = [status().recentAlerts[0], { ...status().recentAlerts[0], id: 2, scope: 'shop-daily', tenantId: 7, shopName: 'Kedai Runcit', threshold: 80, spentUsd: 0.12, capUsd: 0.15, notifiedLark: false }]
        const { unmount } = render(<AlertsSection alerts={alerts} failure={null} />)
        expect(screen.getByText('Platform, daily')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Kedai Runcit' })).toHaveAttribute('href', '/studio/performance/shops/7')
        expect(screen.getByText('$0.12 / $0.15')).toBeInTheDocument()
        unmount()
        const empty = render(<AlertsSection alerts={[]} failure={null} />)
        expect(screen.getByText('No alerts yet.')).toBeInTheDocument()
        empty.unmount()
        render(<AlertsSection alerts={null} failure="boom" />)
        expect(screen.getByRole('alert')).toHaveTextContent('Could not load alerts')
    })
})

describe('TC-AIS-CAP-UI-034 save bar, confirm and the PUT body', () => {
    it('lists caps and plan changes together and saves both in one PUT', async () => {
        const next = settings({ caps: capsView({ dailyUsd: 30 }) })
        fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, settings: next }) })
        render(<AiSettingsClient initial={settings()} failure={null} overrides={[]} alerts={[]} />)
        fireEvent.change(screen.getByLabelText('Daily cap (all shops)', { selector: 'input' }), { target: { value: '30' } })
        fireEvent.click(screen.getAllByRole('switch', { name: 'AI on' })[0])
        expect(screen.getByText('2 unsaved changes')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
        const confirm = screen.getByRole('alertdialog')
        expect(confirm).toHaveTextContent('Platform daily cap: $20 → $30')
        expect(confirm).toHaveTextContent('Free · AI: On → Off')
        fireEvent.click(within(confirm).getByRole('button', { name: 'Save changes' }))
        await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
        const body = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))
        expect(body.caps).toEqual({ dailyUsd: 30, monthlyUsd: 500, alertPercents: [50, 80, 100], pauseFreeAtPercent: 80 })
        expect(body.limits).toEqual([{ planCode: 'FREEMIUM', kind: 'enabled', value: 'NO' }])
        expect(screen.queryByRole('region', { name: 'Unsaved changes' })).toBeNull()
    })
    it('does not send caps when only a plan limit changed', async () => {
        render(<AiSettingsClient initial={settings()} failure={null} overrides={[]} alerts={[]} />)
        // unlimited is on, so the field is disabled: turn the switch off first
        expect(screen.getAllByLabelText('Monthly budget per shop', { selector: 'input' })[0]).toBeDisabled()
        fireEvent.click(screen.getAllByRole('switch', { name: 'Monthly budget per shop Unlimited' })[0])
        fireEvent.change(screen.getAllByLabelText('Monthly budget per shop', { selector: 'input' })[0], { target: { value: '9' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
        fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Save changes' }))
        await waitFor(() => expect(fetchMock).toHaveBeenCalled())
        const body = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))
        expect(body.caps).toBeUndefined()
        expect(body.limits).toEqual([{ planCode: 'FREEMIUM', kind: 'monthly', value: '9' }])
    })
    it('blocks saving while a cap field is invalid', () => {
        render(<AiSettingsClient initial={settings()} failure={null} overrides={[]} alerts={[]} />)
        fireEvent.change(screen.getByLabelText('Daily cap (all shops)', { selector: 'input' }), { target: { value: '' } })
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
        expect(screen.getByText(/Enter an amount above \$0/)).toBeInTheDocument()
    })
    it('shows the error card when the settings could not load', () => {
        render(<AiSettingsClient initial={null} failure="plan-features did not answer." />)
        expect(screen.getByRole('alert')).toHaveTextContent('Could not load AI settings')
    })
})
