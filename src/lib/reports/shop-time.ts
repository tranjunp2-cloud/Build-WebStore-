/**
 * Report periods in the shop's own time.
 *
 * Merchants are in Malaysia, so "today", "this week" and "this month" are calendar days in
 * Asia/Kuala_Lumpur (fixed UTC+8, no DST) — the same convention as the Discounts dates
 * (`@/lib/discounts/date-boundaries`). The dashboard's At-a-glance cards still use UTC day
 * boundaries (`lib/dashboard/timezone.ts`); report numbers can therefore differ from the glance
 * card by the orders placed between 00:00 and 08:00 KL. Reports say which timezone they used.
 *
 * Pure functions, no I/O: `now` is always passed in.
 */
import { klDateKey, startOfDayKL } from '@/lib/discounts/date-boundaries'

export const SHOP_TIME_ZONE = 'Asia/Kuala_Lumpur' as const
export const SHOP_CURRENCY = 'MYR' as const

export const REPORT_PERIODS = ['today', 'yesterday', 'last_7_days', 'last_30_days', 'this_month', 'last_month', 'custom'] as const
export type ReportPeriodKey = (typeof REPORT_PERIODS)[number]

/** A custom range is capped so one question can not scan years of orders. */
export const MAX_CUSTOM_DAYS = 366

export interface ReportRange {
    key: ReportPeriodKey | 'previous'
    /** First shop day, YYYY-MM-DD (inclusive) */
    fromKey: string
    /** Last shop day, YYYY-MM-DD (inclusive) */
    toKey: string
    /** Start instant of the first day (inclusive) */
    start: Date
    /** Start instant of the day after the last one (exclusive) */
    end: Date
    days: number
}

export interface ReportPeriods {
    current: ReportRange
    /** The period it is compared with: same length, right before (see `resolveReportPeriods`) */
    previous: ReportRange
}

export class ReportPeriodError extends Error {
    readonly code = 'invalid_period'
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

function parseKey(key: string): { y: number; m: number; d: number } {
    if (!DAY_KEY.test(key)) throw new ReportPeriodError(`"${key}" is not a date (use YYYY-MM-DD).`)
    const [y, m, d] = key.split('-').map(Number)
    const probe = new Date(Date.UTC(y, m - 1, d))
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
        throw new ReportPeriodError(`"${key}" is not a real calendar date.`)
    }
    return { y, m, d }
}

const keyOf = (date: Date) => date.toISOString().slice(0, 10)

/** `key` shifted by whole days (calendar arithmetic, no timezone involved). */
export function addDaysToKey(key: string, days: number): string {
    const { y, m, d } = parseKey(key)
    return keyOf(new Date(Date.UTC(y, m - 1, d + days)))
}

/** Whole days from `fromKey` to `toKey`, both inclusive. */
export function daysBetweenKeys(fromKey: string, toKey: string): number {
    const a = parseKey(fromKey)
    const b = parseKey(toKey)
    return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000) + 1
}

/** The shop day a stored instant falls in. */
export const shopDayKey = (instant: Date | string): string => klDateKey(instant)

export function rangeOf(key: ReportRange['key'], fromKey: string, toKey: string): ReportRange {
    const days = daysBetweenKeys(fromKey, toKey)
    if (days < 1) throw new ReportPeriodError('The end date is before the start date.')
    return {
        key,
        fromKey,
        toKey,
        start: startOfDayKL(`${fromKey}T12:00:00Z`),
        end: startOfDayKL(`${addDaysToKey(toKey, 1)}T12:00:00Z`),
        days,
    }
}

const monthStart = (key: string) => `${key.slice(0, 7)}-01`
const monthEnd = (key: string) => addDaysToKey(monthStart(addDaysToKey(monthStart(key), 31)), -1)

/** The same number of days directly before `range`. */
function precedingRange(range: ReportRange): ReportRange {
    const toKey = addDaysToKey(range.fromKey, -1)
    return rangeOf('previous', addDaysToKey(toKey, 1 - range.days), toKey)
}

/**
 * The period and what it is compared with.
 *  - today / yesterday / last_7_days / last_30_days / custom: the same number of days right before.
 *  - this_month (1st to today): the same number of days from the 1st of last month (month-to-date vs
 *    month-to-date; capped at the length of last month).
 *  - last_month: the month before it, in full.
 * `from` / `to` are shop days (YYYY-MM-DD, inclusive) and only read for `custom`.
 */
export function resolveReportPeriods(
    input: { period: ReportPeriodKey; from?: string | null; to?: string | null },
    now: Date,
): ReportPeriods {
    const today = shopDayKey(now)
    let current: ReportRange
    switch (input.period) {
        case 'today':
            current = rangeOf('today', today, today)
            break
        case 'yesterday': {
            const day = addDaysToKey(today, -1)
            current = rangeOf('yesterday', day, day)
            break
        }
        case 'last_7_days':
            current = rangeOf('last_7_days', addDaysToKey(today, -6), today)
            break
        case 'last_30_days':
            current = rangeOf('last_30_days', addDaysToKey(today, -29), today)
            break
        case 'this_month':
            current = rangeOf('this_month', monthStart(today), today)
            break
        case 'last_month': {
            const lastDay = addDaysToKey(monthStart(today), -1)
            current = rangeOf('last_month', monthStart(lastDay), lastDay)
            break
        }
        case 'custom': {
            if (!input.from || !input.to) throw new ReportPeriodError('A custom period needs both from and to (YYYY-MM-DD).')
            current = rangeOf('custom', input.from, input.to)
            if (current.days > MAX_CUSTOM_DAYS) throw new ReportPeriodError(`A custom period can be at most ${MAX_CUSTOM_DAYS} days.`)
            break
        }
    }

    if (input.period === 'this_month') {
        const lastMonthFirst = monthStart(addDaysToKey(current.fromKey, -1))
        const lastMonthLast = monthEnd(lastMonthFirst)
        const toKey = addDaysToKey(lastMonthFirst, current.days - 1)
        return { current, previous: rangeOf('previous', lastMonthFirst, toKey > lastMonthLast ? lastMonthLast : toKey) }
    }
    if (input.period === 'last_month') {
        const lastDay = addDaysToKey(current.fromKey, -1)
        return { current, previous: rangeOf('previous', monthStart(lastDay), lastDay) }
    }
    return { current, previous: precedingRange(current) }
}

/** Every shop day of a range, oldest first. */
export function dayKeysOf(range: Pick<ReportRange, 'fromKey' | 'days'>): string[] {
    return Array.from({ length: range.days }, (_, index) => addDaysToKey(range.fromKey, index))
}
