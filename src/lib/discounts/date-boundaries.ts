/**
 * Day-boundary helpers in the store timezone (Asia/Kuala_Lumpur, fixed UTC+8, no DST).
 *
 * Discount `startsAt`/`expiresAt` are calendar dates the seller picks in KL local time. The server
 * (Vercel) runs in UTC, so a naive `new Date('2026-08-31')` lands at 00:00 UTC = 08:00 KL, making a
 * code that should be valid "through Aug 31" expire ~8h into the day. These helpers pin the value to
 * the true KL day boundary so `expiresAt` covers the whole day and `startsAt` starts at 00:00 KL.
 */

const KL_TZ = 'Asia/Kuala_Lumpur'
const KL_OFFSET_MS = 8 * 60 * 60 * 1000 // UTC+8, no DST

/** Extract the KL calendar Y/M/D of an arbitrary instant (handles date-only strings + ISO + Date). */
function klDateParts(input: Date | string): { y: number; m: number; day: number } {
    const d = input instanceof Date ? input : new Date(input)
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: KL_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(d)
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
    return { y: get('year'), m: get('month'), day: get('day') }
}

/** Start of the KL calendar day → 00:00:00.000 +08:00, returned as the equivalent UTC instant. */
export function startOfDayKL(input: Date | string): Date {
    const { y, m, day } = klDateParts(input)
    return new Date(Date.UTC(y, m - 1, day, 0, 0, 0, 0) - KL_OFFSET_MS)
}

/** End of the KL calendar day → 23:59:59.999 +08:00, returned as the equivalent UTC instant. */
export function endOfDayKL(input: Date | string): Date {
    const { y, m, day } = klDateParts(input)
    return new Date(Date.UTC(y, m - 1, day, 23, 59, 59, 999) - KL_OFFSET_MS)
}
