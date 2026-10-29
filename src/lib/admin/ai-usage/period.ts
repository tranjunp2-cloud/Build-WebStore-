/**
 * Period handling for the AI usage screens. Day buckets are Malaysia time (Asia/Kuala_Lumpur, UTC+8, no DST),
 * so "today" and every bar boundary match what the team sees on the clock.
 */

export const TIME_ZONE = 'Asia/Kuala_Lumpur'
const KL_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
export const MAX_CUSTOM_DAYS = 92

export const PERIOD_KEYS = ['24h', '7d', '30d', '90d'] as const
export type PresetKey = (typeof PERIOD_KEYS)[number]
export type PeriodKey = PresetKey | 'custom'
export const DEFAULT_PERIOD: PresetKey = '7d'

export interface Period {
    key: PeriodKey
    /** Inclusive start / exclusive end (UTC instants). */
    start: Date
    end: Date
    /** The window of the same length right before `start`. */
    prevStart: Date
    prevEnd: Date
    bucket: 'hour' | 'day'
    /** Malaysia-time bucket keys, oldest first: `YYYY-MM-DD` (day) or `YYYY-MM-DD HH:00` (hour). */
    buckets: string[]
    /** YYYY-MM-DD of the first and last Malaysia day covered (inclusive). */
    fromDay: string
    toDay: string
}

type Params = Record<string, string | string[] | undefined>

export const first = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** Malaysia wall clock of an instant as an ISO-like string (shifted to UTC fields). */
const klIso = (date: Date): string => new Date(date.getTime() + KL_OFFSET_MS).toISOString()
export const klDay = (date: Date): string => klIso(date).slice(0, 10)

/** Instant of 00:00 Malaysia time on a `YYYY-MM-DD` day. */
export function startOfKlDay(day: string): Date {
    return new Date(Date.parse(`${day}T00:00:00.000Z`) - KL_OFFSET_MS)
}

function isRealDay(value: string | undefined): value is string {
    if (!value || !DAY_RE.test(value)) return false
    const parsed = Date.parse(`${value}T00:00:00.000Z`)
    return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value
}

function bucketKeys(start: Date, end: Date, bucket: 'hour' | 'day'): string[] {
    const keys: string[] = []
    const step = bucket === 'hour' ? HOUR_MS : DAY_MS
    // align to the bucket start in Malaysia time
    const startKey = bucket === 'hour' ? klIso(start).slice(0, 13) + ':00:00.000Z' : klDay(start) + 'T00:00:00.000Z'
    for (let t = Date.parse(startKey); t < end.getTime() + KL_OFFSET_MS; t += step) {
        const iso = new Date(t).toISOString()
        keys.push(bucket === 'hour' ? `${iso.slice(0, 10)} ${iso.slice(11, 13)}:00` : iso.slice(0, 10))
    }
    return keys
}

function build(key: PeriodKey, start: Date, end: Date, bucket: 'hour' | 'day'): Period {
    const length = end.getTime() - start.getTime()
    return {
        key,
        start,
        end,
        prevStart: new Date(start.getTime() - length),
        prevEnd: start,
        bucket,
        buckets: bucketKeys(start, end, bucket),
        fromDay: klDay(start),
        toDay: klDay(new Date(end.getTime() - 1)),
    }
}

/**
 * `?period=24h|7d|30d|90d` or a custom `?from=YYYY-MM-DD&to=YYYY-MM-DD` (both Malaysia days, inclusive, at most
 * 92 days, never after today). Anything unreadable falls back to the default preset instead of failing.
 */
export function resolvePeriod(params: Params, now: Date = new Date()): Period {
    const from = first(params.from)
    const to = first(params.to)
    if (isRealDay(from) && isRealDay(to)) {
        const today = klDay(now)
        const lastDay = to > today ? today : to
        const startMs = startOfKlDay(from).getTime()
        const endMs = startOfKlDay(lastDay).getTime() + DAY_MS
        const days = (endMs - startMs) / DAY_MS
        if (days >= 1 && days <= MAX_CUSTOM_DAYS) return build('custom', new Date(startMs), new Date(endMs), 'day')
    }
    const requested = first(params.period)
    const key: PresetKey = (PERIOD_KEYS as readonly string[]).includes(requested ?? '') ? (requested as PresetKey) : DEFAULT_PERIOD
    if (key === '24h') return build(key, new Date(now.getTime() - DAY_MS), now, 'hour')
    const days = key === '7d' ? 7 : key === '30d' ? 30 : 90
    const endMs = startOfKlDay(klDay(now)).getTime() + DAY_MS
    return build(key, new Date(endMs - days * DAY_MS), new Date(endMs), 'day')
}

/** Query string that reproduces a period (used by links between the three screens and the export). */
export function periodQuery(period: Period): URLSearchParams {
    const q = new URLSearchParams()
    if (period.key === 'custom') {
        q.set('from', period.fromDay)
        q.set('to', period.toDay)
    } else if (period.key !== DEFAULT_PERIOD) q.set('period', period.key)
    return q
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function shortDay(day: string, withYear = false): string {
    const [y, m, d] = day.split('-').map(Number)
    return `${d} ${SHORT_MONTHS[(m ?? 1) - 1]}${withYear ? ` ${y}` : ''}`
}

/** "23 – 29 Oct 2026" style label. */
export function rangeLabel(period: Period): string {
    if (period.key === '24h') return 'Last 24 hours'
    const [fy, fm] = period.fromDay.split('-')
    const [ty, tm, td] = period.toDay.split('-')
    const left = period.fromDay === period.toDay ? '' : fy === ty && fm === tm ? `${Number(period.fromDay.slice(8))}` : fy === ty ? shortDay(period.fromDay) : shortDay(period.fromDay, true)
    return left ? `${left} – ${Number(td)} ${SHORT_MONTHS[Number(tm) - 1]} ${ty}` : `${Number(td)} ${SHORT_MONTHS[Number(tm) - 1]} ${ty}`
}

export function previousRangeLabel(period: Period): string {
    const prevFirst = klDay(period.prevStart)
    const prevLast = klDay(new Date(period.prevEnd.getTime() - 1))
    if (period.key === '24h') return 'the 24 hours before'
    return `${shortDay(prevFirst)} – ${shortDay(prevLast, true)}`
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
/** Axis label of a bucket key: "Fri 23", "Today" (current Malaysia day) or "14:00". */
export function bucketLabel(key: string, bucket: Period['bucket'], today: string): string {
    if (bucket === 'hour') return key.slice(11)
    if (key === today) return 'Today'
    const date = new Date(`${key}T00:00:00.000Z`)
    return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()}`
}
