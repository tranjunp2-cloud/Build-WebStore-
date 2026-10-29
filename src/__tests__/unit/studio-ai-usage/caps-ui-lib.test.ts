/**
 * TC-AIS-CAP-UI-001..008 — pure logic behind the AI caps screens: meter thresholds, platform caps editor, shop override form,
 * the shop card rows and the per-plan switches. Real: caps-display, caps-form, override-form, shop-limit-rows, plan-switch, plan-limits-read.
 */
import { describe, expect, it } from 'vitest'
import { meterTone, fmtCapUsd, fmtSpendUsd } from '@/lib/admin/ai-usage/caps-display'
import {
    addAlertPercent, capsBody, capsDraftFromView, capsProblems, dailyIsOn, describeCapsChanges, type CapsDraft,
} from '@/lib/admin/ai-usage/caps-form'
import { emptyOverrideForm, formFromOverride, hintsFromStored, mapServerErrors, validateOverrideForm } from '@/lib/admin/ai-usage/override-form'
import { enabledChanges, planSwitches } from '@/lib/admin/ai-usage/plan-switch'
import { groupLimits } from '@/lib/admin/ai-usage/plan-limits-read'
import { limitRows } from '@/lib/admin/ai-usage/shop-limit-rows'
import { AiCapsSchema } from '@/lib/ai-platform/ai-config-schema'
import { resolveCaps } from '@/lib/admin/ai-caps/caps-config'
import { aiLimits, capsView, customOverride } from './caps-fixtures'

describe('TC-AIS-CAP-UI-001 meter colour thresholds', () => {
    const alerts = [50, 80, 100]
    it('is green below the first alert, amber from it, red from 100 %', () => {
        expect(meterTone(0, alerts)).toBe('ok')
        expect(meterTone(49.9, alerts)).toBe('ok')
        expect(meterTone(50, alerts)).toBe('warn')
        expect(meterTone(99.9, alerts)).toBe('warn')
        expect(meterTone(100, alerts)).toBe('full')
        expect(meterTone(140, alerts)).toBe('full')
    })
    it('follows the first alert threshold that is set, and stays green with no cap', () => {
        expect(meterTone(60, [70, 90])).toBe('ok')
        expect(meterTone(70, [70, 90])).toBe('warn')
        expect(meterTone(95, [])).toBe('ok')
        expect(meterTone(null, alerts)).toBe('ok')
    })
    it('formats caps without noise', () => {
        expect(fmtCapUsd(20)).toBe('$20')
        expect(fmtCapUsd(0.15)).toBe('$0.15')
        expect(fmtCapUsd(1250)).toBe('$1,250')
        expect(fmtCapUsd(null)).toBe('Off')
    })
})

describe('TC-AIS-CAP-UI-002 platform caps editor state', () => {
    it('starts "inherit" when no daily cap is saved, and follows the environment default', () => {
        const view = resolveCaps(null, { AI_DAILY_BUDGET_USD: '20' })
        const draft = capsDraftFromView(view)
        expect(draft.daily).toEqual({ mode: 'inherit', value: '' })
        expect(dailyIsOn(draft, view)).toBe(true)
        expect(capsBody(draft)).toEqual({ monthlyUsd: null, alertPercents: [50, 80, 100], pauseFreeAtPercent: null })
        expect(dailyIsOn(capsDraftFromView(resolveCaps(null, { AI_DAILY_BUDGET_USD: '0' })), resolveCaps(null, { AI_DAILY_BUDGET_USD: '0' }))).toBe(false)
    })
    it('builds a block the server schema accepts for on / off / inherit', () => {
        const view = capsView()
        const base = capsDraftFromView(view)
        const on = capsBody({ ...base, daily: { mode: 'on', value: '35.5' } })
        const off = capsBody({ ...base, daily: { mode: 'off', value: '' }, monthly: { on: false, value: '' }, pause: { on: false, value: '' } })
        expect(on).toMatchObject({ dailyUsd: 35.5, monthlyUsd: 500, pauseFreeAtPercent: 80 })
        expect(off).toMatchObject({ dailyUsd: null, monthlyUsd: null, pauseFreeAtPercent: null })
        for (const body of [on, off, capsBody({ ...base, daily: { mode: 'inherit', value: '' } })]) expect(AiCapsSchema.safeParse(body).success).toBe(true)
    })
    it('names every field that cannot be saved', () => {
        const bad: CapsDraft = { daily: { mode: 'on', value: '' }, monthly: { on: true, value: '-3' }, alerts: [50], pause: { on: true, value: '101' } }
        expect(Object.keys(capsProblems(bad)).sort()).toEqual(['daily', 'monthly', 'pause'])
        expect(capsProblems({ ...bad, daily: { mode: 'on', value: '0' } }).daily).toMatch(/above \$0/)
        expect(capsProblems(capsDraftFromView(capsView()))).toEqual({})
    })
    it('adds alert thresholds ascending, unique and within 1..100', () => {
        expect(addAlertPercent([50, 100], '80')).toEqual({ list: [50, 80, 100] })
        expect(addAlertPercent([50], '50')).toHaveProperty('error')
        expect(addAlertPercent([50], '0')).toHaveProperty('error')
        expect(addAlertPercent([50], '101')).toHaveProperty('error')
        expect(addAlertPercent([50], '7.5')).toHaveProperty('error')
    })
    it('lists only what changed', () => {
        const view = capsView()
        const draft = { ...capsDraftFromView(view), daily: { mode: 'on' as const, value: '30' }, pause: { on: false, value: '' } }
        expect(describeCapsChanges(draft, view)).toEqual(['Platform daily cap: $20 → $30', 'Pause Free first at: 80 % → Off (everyone pauses at 100 %)'])
        expect(describeCapsChanges(capsDraftFromView(view), view)).toEqual([])
    })
})

describe('TC-AIS-CAP-UI-003 shop override form validation', () => {
    const NOW = Date.parse('2026-10-29T06:00:00Z')
    it('requires a reason', () => {
        const { errors, body } = validateOverrideForm({ ...emptyOverrideForm(), aiBudgetUsd: '1' }, NOW)
        expect(body).toBeNull()
        expect(errors.reason).toBe('Say why this shop has its own limits.')
    })
    it('needs at least one number for a custom override, and rejects negatives and fractional pictures', () => {
        expect(validateOverrideForm({ ...emptyOverrideForm(), reason: 'x' }, NOW).errors.mode).toMatch(/at least one limit/)
        const bad = validateOverrideForm({ ...emptyOverrideForm(), reason: 'x', aiBudgetUsd: '-1', picturesPerDay: '2.5' }, NOW).errors
        expect(bad.aiBudgetUsd).toBe('Enter a number, 0 or more.')
        expect(bad.picturesPerDay).toBe('Enter a whole number.')
    })
    it('builds the PUT body: empty fields are null (keep plan), expiry is the end of that day in Malaysia time', () => {
        const { body } = validateOverrideForm({ ...emptyOverrideForm(), reason: ' Pilot ', aiBudgetUsd: '0.5', aiBudgetUsdMonthly: '12', expiresOn: '2026-11-01' }, NOW)
        expect(body).toEqual({ mode: 'custom', aiBudgetUsd: 0.5, picturesPerDay: null, aiBudgetUsdMonthly: 12, siteBudgetUsd: null, reason: 'Pilot', expiresAt: '2026-11-01T23:59:59+08:00' })
    })
    it('unlimited and blocked send no numbers, and need no limit', () => {
        const unlimited = validateOverrideForm({ ...emptyOverrideForm(), mode: 'unlimited', aiBudgetUsd: '5', reason: 'VIP' }, NOW)
        expect(unlimited.body).toEqual({ mode: 'unlimited', reason: 'VIP', expiresAt: null })
        expect(validateOverrideForm({ ...emptyOverrideForm(), mode: 'blocked', reason: 'abuse' }, NOW).body).toMatchObject({ mode: 'blocked' })
    })
    it('rejects an end day in the past', () => {
        expect(validateOverrideForm({ ...emptyOverrideForm(), reason: 'x', aiBudgetUsd: '1', expiresOn: '2026-10-28' }, NOW).errors.expiresOn).toBe('Pick today or a later day.')
        expect(validateOverrideForm({ ...emptyOverrideForm(), reason: 'x', aiBudgetUsd: '1', expiresOn: '2026-10-29' }, NOW).body).not.toBeNull()
    })
    it('round-trips a saved override and maps server sentences onto fields', () => {
        const form = formFromOverride(customOverride({ expiresAt: '2026-11-01T15:59:59.000Z' }))
        expect(form).toMatchObject({ mode: 'custom', aiBudgetUsd: '0.5', picturesPerDay: '', aiBudgetUsdMonthly: '12', expiresOn: '2026-11-01' })
        expect(mapServerErrors([{ path: ['reason'], message: 'r' }, { path: ['expiresAt'], message: 'e' }, { path: [], message: 'x' }]))
            .toEqual({ reason: 'r', expiresOn: 'e', form: 'x' })
    })
    it('shows the plan values as hints', () => {
        const limits = { budget: { STARTER_TM_USER: '0.15' }, pictures: { STARTER_TM_USER: 'UNLIMITED' }, monthly: { STARTER_TM_USER: '12' }, site: { STARTER_TM_USER: 'UNLIMITED' }, enabled: {} } as never
        expect(hintsFromStored(limits, 'STARTER_TM_USER')).toEqual({ aiBudgetUsd: '$0.15', picturesPerDay: 'Unlimited', aiBudgetUsdMonthly: '$12', siteBudgetUsd: 'Unlimited' })
    })
})

describe('TC-AIS-CAP-UI-004 shop card rows say where each value comes from', () => {
    it('all from the plan without an override', () => {
        const rows = limitRows(aiLimits(), aiLimits(), null)
        expect(rows.every((row) => row.from === 'plan' && row.override === null)).toBe(true)
        expect(rows.find((row) => row.key === 'aiBudgetUsd')?.applied).toBe('$0.15 / day')
    })
    it('a custom override only takes the rows it sets', () => {
        const effective = aiLimits({ aiBudgetUsd: 0.5, aiBudgetUsdMonthly: 12, source: 'shop' })
        const rows = limitRows(aiLimits(), effective, { ...customOverride() })
        const by = Object.fromEntries(rows.map((row) => [row.key, row]))
        expect(by.aiBudgetUsd).toMatchObject({ plan: '$0.15 / day', override: '$0.5 / day', applied: '$0.5 / day', from: 'override' })
        expect(by.aiBudgetUsdMonthly).toMatchObject({ override: '$12 / month', from: 'override' })
        expect(by.picturesPerDay).toMatchObject({ override: null, from: 'plan', applied: '3 / day' })
        expect(by.enabled.from).toBe('plan')
    })
    it('blocked turns AI off from the override; an expired override changes nothing', () => {
        const blocked = limitRows(aiLimits(), aiLimits({ enabled: false, source: 'shop' }), customOverride({ mode: 'blocked' }))
        expect(blocked.find((row) => row.key === 'enabled')).toMatchObject({ plan: 'On', override: 'Off', applied: 'Off', from: 'override' })
        const expired = limitRows(aiLimits(), aiLimits(), customOverride({ expired: true }))
        expect(expired.every((row) => row.from === 'plan' && row.override === null)).toBe(true)
    })
})

describe('TC-AIS-CAP-UI-005 plan switches and plan table', () => {
    it('groups plan codes: on, off, or mixed', () => {
        const switches = planSwitches(['FREEMIUM', 'STARTER_TM_USER'])
        expect(switches.find((s) => s.id === 'free')).toMatchObject({ on: false, mixed: false })
        expect(switches.find((s) => s.id === 'starter')).toMatchObject({ on: false, mixed: true })
        expect(switches.find((s) => s.id === 'standard')).toMatchObject({ on: true, mixed: false })
    })
    it('writes the enabled row of every code of the group', () => {
        const starter = planSwitches([]).find((s) => s.id === 'starter')!
        expect(enabledChanges(starter, false)).toEqual([
            { planCode: 'STARTER_TM_USER', kind: 'enabled', value: 'NO' }, { planCode: 'STARTER_NON_TM_USER', kind: 'enabled', value: 'NO' },
        ])
    })
    it('reads ai_enabled = NO as off for the plan table, and a half-off group as varying', () => {
        const rows = [
            { planCode: 'FREEMIUM', featureCode: 'ai_enabled', value: 'NO' },
            { planCode: 'STARTER_TM_USER', featureCode: 'ai_enabled', value: 'NO' },
        ]
        expect(groupLimits(rows, 'free')).toMatchObject({ off: true })
        expect(groupLimits(rows, 'starter')).toMatchObject({ off: false, varies: true })
        expect(groupLimits(rows, 'standard')).toMatchObject({ off: false, varies: false })
    })
})

describe('TC-AIS-CAP-UI-006 small amounts next to a cap', () => {
    it('keeps 4 decimals under one cent so a real spend never reads $0.00', () => {
        // Arrange + Act + Assert
        expect(fmtSpendUsd(0.0028)).toBe('$0.0028')
        expect(fmtSpendUsd(0)).toBe('$0.00')
        expect(fmtSpendUsd(12.5)).toBe('$12.50')
        expect(fmtCapUsd(0.0031)).toBe('$0.0031')
        expect(fmtCapUsd(20)).toBe('$20')
    })
})
