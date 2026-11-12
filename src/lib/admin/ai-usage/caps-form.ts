/**
 * Editor state of the platform caps (strings, so half-typed numbers survive) and its conversions to the saved
 * `AiCaps` block, the validation sentences and the lines the confirm dialog lists. Pure + client-safe.
 */
import type { AiCaps } from '@/lib/ai-platform/ai-config-schema'
import type { CapsView } from '@/lib/admin/ai-settings/types'
import { fmtCapUsd } from './caps-display'

export interface CapsDraft {
    /** inherit: no daily cap saved, the environment default applies */
    daily: { mode: 'inherit' | 'off' | 'on'; value: string }
    monthly: { on: boolean; value: string }
    /** ascending, unique, whole numbers 1..100 */
    alerts: number[]
    pause: { on: boolean; value: string }
}

export type CapsProblems = Partial<Record<'daily' | 'monthly' | 'pause' | 'alerts', string>>
export type CapsEffective = CapsView['effective']

export const MAX_ALERTS = 10

const text = (value: number | null) => (value === null ? '' : String(value))

export function capsDraftFromView(view: CapsView): CapsDraft {
    const { effective, saved } = view
    return {
        daily: saved?.dailyUsd === undefined ? { mode: 'inherit', value: '' } : { mode: effective.dailyUsd === null ? 'off' : 'on', value: text(effective.dailyUsd) },
        monthly: { on: effective.monthlyUsd !== null, value: text(effective.monthlyUsd) },
        alerts: [...effective.alertPercents],
        pause: { on: effective.pauseFreeAtPercent !== null, value: text(effective.pauseFreeAtPercent) },
    }
}

/** Is the daily cap on in this draft? (inherit follows the environment default.) */
export const dailyIsOn = (draft: CapsDraft, view: CapsView): boolean =>
    draft.daily.mode === 'inherit' ? view.envDailyUsd !== null : draft.daily.mode === 'on'

const amount = (raw: string): number => (raw.trim() === '' ? NaN : Number(raw))
const validUsd = (raw: string) => Number.isFinite(amount(raw)) && amount(raw) > 0

export function capsProblems(draft: CapsDraft): CapsProblems {
    const problems: CapsProblems = {}
    const usdMessage = 'Enter an amount above $0, or switch the cap off.'
    if (draft.daily.mode === 'on' && !validUsd(draft.daily.value)) problems.daily = usdMessage
    if (draft.monthly.on && !validUsd(draft.monthly.value)) problems.monthly = usdMessage
    if (draft.pause.on) {
        const value = amount(draft.pause.value)
        if (!Number.isInteger(value) || value < 1 || value > 100) problems.pause = 'Enter a whole number from 1 to 100.'
    }
    if (draft.alerts.length > MAX_ALERTS) problems.alerts = `At most ${MAX_ALERTS} thresholds.`
    return problems
}

/** Adds a threshold keeping the list ascending and unique; returns the new list or a sentence. */
export function addAlertPercent(list: readonly number[], raw: string): { list: number[] } | { error: string } {
    const value = amount(raw)
    if (!Number.isInteger(value) || value < 1 || value > 100) return { error: 'Use a whole number from 1 to 100.' }
    if (list.includes(value)) return { error: `${value} % is already there.` }
    if (list.length >= MAX_ALERTS) return { error: `At most ${MAX_ALERTS} thresholds.` }
    return { list: [...list, value].sort((a, b) => a - b) }
}

/** The caps block to PUT (replaces the saved block). Call only when `capsProblems` is empty. */
export function capsBody(draft: CapsDraft): AiCaps {
    const caps: AiCaps = {
        monthlyUsd: draft.monthly.on ? Number(draft.monthly.value) : null,
        alertPercents: [...draft.alerts],
        pauseFreeAtPercent: draft.pause.on ? Number(draft.pause.value) : null,
    }
    if (draft.daily.mode === 'off') caps.dailyUsd = null
    if (draft.daily.mode === 'on') caps.dailyUsd = Number(draft.daily.value)
    return caps
}

/** What the draft would apply, in the shape of `CapsView.effective` (invalid numbers come out as NaN). */
export function capsEffective(draft: CapsDraft, view: CapsView): CapsEffective {
    return {
        dailyUsd: draft.daily.mode === 'inherit' ? view.envDailyUsd : draft.daily.mode === 'off' ? null : amount(draft.daily.value),
        monthlyUsd: draft.monthly.on ? amount(draft.monthly.value) : null,
        alertPercents: [...draft.alerts],
        pauseFreeAtPercent: draft.pause.on ? amount(draft.pause.value) : null,
    }
}

const alertsText = (list: readonly number[]) => (list.length ? list.map((value) => `${value} %`).join(' · ') : 'none')
const pauseText = (value: number | null) => (value === null ? 'Off (everyone pauses at 100 %)' : `${value} %`)

/** Human lines for the unsaved-changes bar and confirm dialog. */
export function describeCapsChanges(draft: CapsDraft, view: CapsView): string[] {
    const was = view.effective
    const now = capsEffective(draft, view)
    const lines: string[] = []
    const differs = (a: number | null, b: number | null) => !Object.is(a, b)
    if (differs(was.dailyUsd, now.dailyUsd)) lines.push(`Platform daily cap: ${fmtCapUsd(was.dailyUsd)} → ${fmtCapUsd(now.dailyUsd)}`)
    if (differs(was.monthlyUsd, now.monthlyUsd)) lines.push(`Platform monthly cap: ${fmtCapUsd(was.monthlyUsd)} → ${fmtCapUsd(now.monthlyUsd)}`)
    if (alertsText(was.alertPercents) !== alertsText(now.alertPercents)) lines.push(`Alert thresholds: ${alertsText(was.alertPercents)} → ${alertsText(now.alertPercents)}`)
    if (differs(was.pauseFreeAtPercent, now.pauseFreeAtPercent)) lines.push(`Pause Free first at: ${pauseText(was.pauseFreeAtPercent)} → ${pauseText(now.pauseFreeAtPercent)}`)
    return lines
}
