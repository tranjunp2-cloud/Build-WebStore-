/**
 * Pickup/collection-date scheduling — US-F36-07.
 *
 * Pure, client-safe module (NO 'server-only'): AC-3b mandates ONE shared helper
 * (`earliestPickupDate`) used by both the Ready-to-Ship date picker (client) and the
 * create-label server clamp, so the two can never disagree on the earliest date.
 * All calendar math is done in MYT (UTC+8).
 */

// Courier cut-off times (MYT). Keys are legacy courier slugs; EP-CR* codes fall back
// to DEFAULT_CUTOFF. Source: researcher-260617-1426-courier-cutoff-verify.md.
const COURIER_CUTOFF_HH_MM: Record<string, { hh: number; mm: number }> = {
    jnt: { hh: 13, mm: 50 },
    flash: { hh: 14, mm: 0 },
    poslaju: { hh: 12, mm: 50 },
}
const DEFAULT_CUTOFF = { hh: 12, mm: 0 }

/** Cut-off for a courier as a display label, e.g. "13:50" (for the same-day hint). */
export function courierCutoffLabel(courier: string): string {
    const c = COURIER_CUTOFF_HH_MM[courier.toLowerCase()] ?? DEFAULT_CUTOFF
    return `${String(c.hh).padStart(2, '0')}:${String(c.mm).padStart(2, '0')}`
}

function isMytBusinessDay(date: Date): boolean {
    // Shift UTC date to MYT (UTC+8) to get correct local day-of-week
    const mytDay = new Date(date.getTime() + 8 * 3600 * 1000).getUTCDay()
    return mytDay !== 0 && mytDay !== 6  // 0=Sun, 6=Sat
}

function nextBusinessDay(date: Date): Date {
    const next = new Date(date.getTime() + 24 * 3600 * 1000)
    while (!isMytBusinessDay(next)) {
        next.setTime(next.getTime() + 24 * 3600 * 1000)
    }
    return next
}

function toMytDateString(date: Date): string {
    const myt = new Date(date.getTime() + 8 * 3600 * 1000)
    const yyyy = myt.getUTCFullYear()
    const mm = String(myt.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(myt.getUTCDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
}

/** True when the "YYYY-MM-DD" date falls on a MYT business day (Mon–Fri). */
export function isBusinessDateString(dateStr: string): boolean {
    return isMytBusinessDay(new Date(`${dateStr}T00:00:00+08:00`))
}

/**
 * Return earliest pickup date for a courier as "YYYY-MM-DD" (MYT).
 * If current MYT time is past cut-off, advances to next business day.
 * @param courier - courier id (e.g. 'jnt', 'flash', 'poslaju')
 * @param nowUtc - current UTC time (defaults to Date.now())
 */
export function earliestPickupDate(courier: string, nowUtc: Date = new Date()): string {
    const cutoff = COURIER_CUTOFF_HH_MM[courier.toLowerCase()] ?? DEFAULT_CUTOFF

    // Derive MYT hours/minutes from UTC
    const mytMs = nowUtc.getTime() + 8 * 3600 * 1000
    const myt = new Date(mytMs)
    const mytHH = myt.getUTCHours()
    const mytMM = myt.getUTCMinutes()

    const pastCutoff = mytHH > cutoff.hh || (mytHH === cutoff.hh && mytMM >= cutoff.mm)
    const candidate = pastCutoff ? nextBusinessDay(nowUtc) : nowUtc

    // Ensure candidate itself is a business day (handles weekend today + before cutoff)
    let pickup = new Date(candidate)
    while (!isMytBusinessDay(pickup)) {
        pickup = new Date(pickup.getTime() + 24 * 3600 * 1000)
    }

    return toMytDateString(pickup)
}

export interface ClampedCollectionDate {
    /** The date actually usable for submit_orders ("YYYY-MM-DD"). */
    date: string
    /** True when the requested date was moved (past/cut-off/weekend) — UI shows "moved to DD/MM". */
    shifted: boolean
}

/**
 * Server-side clamp (AC-3b): re-compute the earliest date AT REQUEST TIME and never
 * trust the client's date — a picker opened before cut-off can be submitted after it.
 * Rules: requested < earliest → earliest; weekend → next business day; no requested
 * date → earliest (default). "YYYY-MM-DD" strings compare correctly lexicographically.
 */
export function clampCollectionDate(
    courier: string,
    requested: string | undefined,
    nowUtc: Date = new Date(),
): ClampedCollectionDate {
    const earliest = earliestPickupDate(courier, nowUtc)
    let date = requested && requested > earliest ? requested : earliest
    if (!isBusinessDateString(date)) {
        date = toMytDateString(nextBusinessDay(new Date(`${date}T00:00:00+08:00`)))
    }
    return { date, shifted: requested != null && date !== requested }
}
