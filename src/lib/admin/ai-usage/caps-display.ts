/** Wording and thresholds for the AI caps screens (Overview block, Settings, Shop card). Pure + client-safe. */
import { groupOfPlan } from '@/lib/admin/ai-settings/plan-groups'

export type MeterTone = 'ok' | 'warn' | 'full'

/** Green below the first alert threshold, amber from it, red from 100 %. No cap (null) is always green. */
export function meterTone(percent: number | null, alertPercents: readonly number[]): MeterTone {
    if (percent === null || !Number.isFinite(percent)) return 'ok'
    if (percent >= 100) return 'full'
    const first = alertPercents.length ? Math.min(...alertPercents) : null
    return first !== null && percent >= first ? 'warn' : 'ok'
}

export const PLATFORM_STATE_LABEL = { ok: 'OK', 'free-paused': 'Free paused', 'all-paused': 'All paused' } as const
/** badge tone classes (defined in ai-limits.css) */
export const PLATFORM_STATE_TONE = { ok: 'acl-tone-ok', 'free-paused': 'acl-tone-warn', 'all-paused': 'acl-tone-danger' } as const

export const BLOCK_REASON_LABEL = {
    'shop-blocked': 'Blocked by an override',
    'plan-off': 'AI is off for its plan',
    'daily-budget': 'Daily budget used up',
    'monthly-budget': 'Monthly budget used up',
} as const

export const ALERT_SCOPE_LABEL: Record<string, string> = {
    'platform-daily': 'Platform, daily',
    'platform-monthly': 'Platform, monthly',
    'shop-daily': 'Shop, daily',
}

/** $20 / $0.15 / $1,250: whole amounts without decimals. */
export function fmtCapUsd(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return 'Off'
    const whole = Number.isInteger(value)
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: value < 0.01 ? 4 : value < 1 ? 3 : 2 })}`
}

/** Spend next to a cap: cents, but tiny amounts keep 4 decimals so $0.0028 is not shown as $0.00. */
export function fmtSpendUsd(value: number): string {
    if (!Number.isFinite(value)) return '—'
    const digits = value > 0 && value < 0.01 ? 4 : 2
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

export const fmtPct = (value: number | null | undefined): string =>
    value === null || value === undefined || !Number.isFinite(value) ? '—' : `${Math.round(value * 10) / 10}%`

/** Plan group label for a plan code (STARTER_TM_USER → Starter); the code itself when it is in no group. */
export const planLabelOfCode = (code: string): string => groupOfPlan(code)?.label ?? code
