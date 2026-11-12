/** Number / money / time formatting shared by the AI usage screens (server and client safe). */

export const num = (value: unknown): number => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

/** `null` stays null (no data), numeric strings from pg become numbers. */
export const numOrNull = (value: unknown): number | null => (value === null || value === undefined ? null : num(value))

export function fmtUsd(value: number | null | undefined, digits?: number): string {
    if (value === null || value === undefined) return '—'
    const d = digits ?? (Math.abs(value) < 1 && value !== 0 ? 4 : 2)
    return `$${value.toFixed(d)}`
}

/** Money on the overview: 2 decimals from $1, 3–4 below, so small per-day numbers stay readable. */
export function fmtUsdShort(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—'
    if (Math.abs(value) >= 1) return `$${value.toFixed(2)}`
    if (Math.abs(value) >= 0.01) return `$${value.toFixed(3)}`
    return `$${value.toFixed(4)}`
}

export const fmtInt = (value: number): string => Math.round(value).toLocaleString('en-US')

export function fmtCompact(value: number): string {
    const abs = Math.abs(value)
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`
    if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`
    return String(Math.round(value))
}

export function fmtPercent(value: number | null | undefined, digits = 1): string {
    return value === null || value === undefined ? '—' : `${value.toFixed(digits)}`
}

export function fmtDuration(ms: number | null | undefined): string {
    if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—'
    if (ms < 1000) return `${Math.round(ms)} ms`
    const seconds = ms / 1000
    if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ${String(Math.round(seconds % 60)).padStart(2, '0')}s`
}

/** Percent change from previous to current (one decimal); null when there is nothing to compare with. */
export function pctChange(current: number, previous: number): number | null {
    if (!previous) return null
    return Math.round(((current - previous) / previous) * 1000) / 10
}

const TZ = 'Asia/Kuala_Lumpur'
const dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' })
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
const ymdFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const fullFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

/** "Today 14:12", else "28 Oct 22:40" (Malaysia time). */
export function fmtWhen(value: string | Date | null | undefined, now: Date = new Date()): string {
    if (!value) return '—'
    const date = typeof value === 'string' ? new Date(value) : value
    if (Number.isNaN(date.getTime())) return '—'
    const time = timeFmt.format(date)
    return ymdFmt.format(date) === ymdFmt.format(now) ? `Today ${time}` : `${dayFmt.format(date)} ${time}`
}

export function fmtFull(value: string | Date | null | undefined): string {
    if (!value) return '—'
    const date = typeof value === 'string' ? new Date(value) : value
    return Number.isNaN(date.getTime()) ? '—' : `${fullFmt.format(date)} (UTC+8)`
}
