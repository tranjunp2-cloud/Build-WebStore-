import type { DashboardPeriodKey } from './dashboard-types'
import { DASHBOARD_TIME_ZONE } from './timezone'

const PERIOD_DAYS: Record<DashboardPeriodKey, number> = {
    today: 1,
    '7d': 7,
    '30d': 30,
}

const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: DASHBOARD_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
})

const dateLabelFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: DASHBOARD_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
})

const monthLabelFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: DASHBOARD_TIME_ZONE,
    month: 'short',
})

export interface DashboardPeriodRange {
    rangeLabel: string
    currentStart: Date
    currentEnd: Date
    previousStart: Date
    dayKeys: string[]
}

function addUtcDays(date: Date, days: number): Date {
    return new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() + days,
    ))
}

function startOfUtcDay(date: Date): Date {
    return new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
    ))
}

/** Format a Date as the dashboard's canonical YYYY-MM-DD key in UTC. */
export function dashboardDayKey(date: Date): string {
    const parts = dayKeyFormatter.formatToParts(date)
    const part = (type: 'year' | 'month' | 'day') =>
        parts.find(candidate => candidate.type === type)?.value ?? ''

    return `${part('year')}-${part('month')}-${part('day')}`
}

function buildRangeLabel(currentStart: Date, currentEnd: Date, days: number): string {
    if (days === 1) return dateLabelFormatter.format(currentStart)

    const currentLastDay = addUtcDays(currentEnd, -1)
    const sameMonthYear =
        currentStart.getUTCMonth() === currentLastDay.getUTCMonth()
        && currentStart.getUTCFullYear() === currentLastDay.getUTCFullYear()
    const startLabel = sameMonthYear
        ? String(currentStart.getUTCDate())
        : `${currentStart.getUTCDate()} ${monthLabelFormatter.format(currentStart)}`

    return `${startLabel} – ${dateLabelFormatter.format(currentLastDay)}`
}

/** Build equal, non-overlapping UTC windows and current-period day keys. */
export function getDashboardPeriodRange(
    period: DashboardPeriodKey,
    now = new Date(),
): DashboardPeriodRange {
    const days = PERIOD_DAYS[period]
    const todayStart = startOfUtcDay(now)
    const currentStart = addUtcDays(todayStart, -(days - 1))
    const currentEnd = addUtcDays(todayStart, 1)
    const previousStart = addUtcDays(currentStart, -days)
    const dayKeys = Array.from(
        { length: days },
        (_, index) => dashboardDayKey(addUtcDays(currentStart, index)),
    )

    return {
        rangeLabel: buildRangeLabel(currentStart, currentEnd, days),
        currentStart,
        currentEnd,
        previousStart,
        dayKeys,
    }
}
