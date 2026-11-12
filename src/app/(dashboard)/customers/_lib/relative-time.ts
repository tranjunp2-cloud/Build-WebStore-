/**
 * Locale-aware relative time for the customers dashboard (GH-2280).
 * Pure helpers: labels come from i18n (`{n}` placeholder), never hardcoded English.
 */

export type RelativeDateLabels = {
    today: string
    yesterday: string
    relDays: string
    relMonths: string
    relYears: string
}

export type RelativeTimeLabels = {
    relJustNow: string
    relMinutes: string
    relHours: string
    relDays: string
    relMonths: string
    relYears: string
}

const fill = (tpl: string, n: number): string => tpl.replace('{n}', String(n))

/** Day-granularity label for the "last order" column (today / yesterday / Nd / Nmo / Ny). */
export function formatRelativeDate(iso: string, labels: RelativeDateLabels, now: number = Date.now()): string {
    const d = Math.floor((now - new Date(iso).getTime()) / 86400000)
    if (d === 0) return labels.today
    if (d === 1) return labels.yesterday
    if (d < 30) return fill(labels.relDays, d)
    if (d < 365) return fill(labels.relMonths, Math.floor(d / 30))
    return fill(labels.relYears, Math.floor(d / 365))
}

/** Minute-granularity label for the customer detail "Updated" line. */
export function formatRelativeTime(iso: string, labels: RelativeTimeLabels, now: number = Date.now()): string {
    const m = Math.floor((now - new Date(iso).getTime()) / 60000)
    if (m < 1) return labels.relJustNow
    if (m < 60) return fill(labels.relMinutes, m)
    const h = Math.floor(m / 60)
    if (h < 24) return fill(labels.relHours, h)
    const days = Math.floor(h / 24)
    if (days < 30) return fill(labels.relDays, days)
    const months = Math.floor(days / 30)
    if (months < 12) return fill(labels.relMonths, months)
    return fill(labels.relYears, Math.floor(months / 12))
}
