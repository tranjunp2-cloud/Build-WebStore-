export const DEFAULT_VIEWER_TIME_ZONE = 'UTC' as const

const MAX_TIME_ZONE_LENGTH = 100
const TIME_ZONE_PATTERN = /^[A-Za-z0-9_+\-]+(?:\/[A-Za-z0-9_+\-]+)*$/
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export interface ViewerDateTimeParts {
    year: number
    month: number
    day: number
    hour: number
    minute: number
    second: number
}

export function normalizeViewerTimeZone(value: string | null | undefined): string {
    if (
        !value
        || value.length > MAX_TIME_ZONE_LENGTH
        || !TIME_ZONE_PATTERN.test(value)
    ) {
        return DEFAULT_VIEWER_TIME_ZONE
    }

    try {
        new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0)
        return value
    } catch {
        return DEFAULT_VIEWER_TIME_ZONE
    }
}

export function getBrowserViewerTimeZone(): string {
    if (typeof window === 'undefined' || typeof Intl === 'undefined') {
        return DEFAULT_VIEWER_TIME_ZONE
    }

    return normalizeViewerTimeZone(
        Intl.DateTimeFormat().resolvedOptions().timeZone,
    )
}

const zonedPartsFormatters = new Map<string, Intl.DateTimeFormat>()

function getZonedPartsFormatter(timeZone: string): Intl.DateTimeFormat {
    const cached = zonedPartsFormatters.get(timeZone)
    if (cached) return cached

    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    })
    zonedPartsFormatters.set(timeZone, formatter)
    return formatter
}

export function getViewerDateTimeParts(
    date: Date,
    requestedTimeZone: string,
): ViewerDateTimeParts {
    const timeZone = normalizeViewerTimeZone(requestedTimeZone)
    const parts = getZonedPartsFormatter(timeZone).formatToParts(date)
    const value = (type: Intl.DateTimeFormatPartTypes): number =>
        Number(parts.find(part => part.type === type)?.value ?? 0)

    return {
        year: value('year'),
        month: value('month'),
        day: value('day'),
        hour: value('hour'),
        minute: value('minute'),
        second: value('second'),
    }
}

export function toViewerDateKey(parts: Pick<ViewerDateTimeParts, 'year' | 'month' | 'day'>): string {
    return [
        String(parts.year).padStart(4, '0'),
        String(parts.month).padStart(2, '0'),
        String(parts.day).padStart(2, '0'),
    ].join('-')
}

function parseDateKey(dateKey: string): Pick<ViewerDateTimeParts, 'year' | 'month' | 'day'> | null {
    const match = DATE_KEY_PATTERN.exec(dateKey)
    if (!match) return null

    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    const normalized = new Date(Date.UTC(year, month - 1, day))

    if (
        normalized.getUTCFullYear() !== year
        || normalized.getUTCMonth() + 1 !== month
        || normalized.getUTCDate() !== day
    ) {
        return null
    }

    return { year, month, day }
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
    const parts = getViewerDateTimeParts(date, timeZone)
    const representedAsUtc = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
    )
    const instantWithoutMilliseconds = Math.floor(date.getTime() / 1000) * 1000
    return representedAsUtc - instantWithoutMilliseconds
}

function viewerWallTimeToUtc(
    parts: Pick<ViewerDateTimeParts, 'year' | 'month' | 'day'>,
    requestedTimeZone: string,
): Date {
    const timeZone = normalizeViewerTimeZone(requestedTimeZone)
    const wallTimeAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day)
    let instant = wallTimeAsUtc

    // Re-evaluate the offset to cover zones whose offset changes near this date.
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const adjusted = wallTimeAsUtc - timeZoneOffsetMs(new Date(instant), timeZone)
        if (adjusted === instant) break
        instant = adjusted
    }

    return new Date(instant)
}

export function shiftViewerDateKey(dateKey: string, days: number): string | null {
    const parts = parseDateKey(dateKey)
    if (!parts) return null

    const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days))
    return toViewerDateKey({
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth() + 1,
        day: shifted.getUTCDate(),
    })
}

export function viewerDateKeyToUtc(
    dateKey: string,
    requestedTimeZone: string,
): Date | null {
    const parts = parseDateKey(dateKey)
    return parts ? viewerWallTimeToUtc(parts, requestedTimeZone) : null
}

export function getViewerDayRange(
    now: Date,
    requestedTimeZone: string,
): { start: Date; end: Date; dayKey: string } {
    const timeZone = normalizeViewerTimeZone(requestedTimeZone)
    const dayKey = toViewerDateKey(getViewerDateTimeParts(now, timeZone))
    const nextDayKey = shiftViewerDateKey(dayKey, 1)
    const start = viewerDateKeyToUtc(dayKey, timeZone)
    const end = nextDayKey ? viewerDateKeyToUtc(nextDayKey, timeZone) : null

    if (!start || !end) {
        throw new Error(`Unable to calculate viewer day range for ${dayKey}`)
    }

    return { start, end, dayKey }
}

export function getViewerPeriodStart(
    now: Date,
    requestedTimeZone: string,
    period: 'today' | 'thisWeek' | 'thisMonth' | 'thisYear',
): Date {
    const timeZone = normalizeViewerTimeZone(requestedTimeZone)
    const current = getViewerDateTimeParts(now, timeZone)
    let dateKey = toViewerDateKey(current)

    if (period === 'thisWeek') {
        const dayOfWeek = new Date(Date.UTC(current.year, current.month - 1, current.day)).getUTCDay()
        dateKey = shiftViewerDateKey(dateKey, -dayOfWeek) ?? dateKey
    } else if (period === 'thisMonth') {
        dateKey = toViewerDateKey({ ...current, day: 1 })
    } else if (period === 'thisYear') {
        dateKey = toViewerDateKey({ ...current, month: 1, day: 1 })
    }

    const start = viewerDateKeyToUtc(dateKey, timeZone)
    if (!start) throw new Error(`Unable to calculate viewer period start for ${dateKey}`)
    return start
}

export function getViewerCustomDateRange(
    fromDateKey: string,
    toDateKey: string,
    requestedTimeZone: string,
): { start: Date; endInclusive: Date } | null {
    const nextDayKey = shiftViewerDateKey(toDateKey, 1)
    const start = viewerDateKeyToUtc(fromDateKey, requestedTimeZone)
    const endExclusive = nextDayKey
        ? viewerDateKeyToUtc(nextDayKey, requestedTimeZone)
        : null

    if (!start || !endExclusive || start >= endExclusive) return null

    return {
        start,
        endInclusive: new Date(endExclusive.getTime() - 1),
    }
}
