/**
 * Discount formatting helpers — pure, no 'use client' (safe to import from RSC or client).
 */

// Upper bound for a fixed-amount discount (in RM). Beyond this a fixed discount is meaningless
// (it always clamps to the subtotal anyway) and the formatted preview would overflow into
// scientific notation (toFixed switches to 1e+ at ~1e19). Stored value is in sen → ×100.
export const MAX_FIXED_DISCOUNT_RM = 1_000_000
export const MAX_FIXED_DISCOUNT_SEN = MAX_FIXED_DISCOUNT_RM * 100

export const fmtRM = (sen: number) => `RM ${(sen / 100).toFixed(2)}`

export const fmtValue = (type: string, value: number) =>
    type === 'percentage' ? `${value}%` : fmtRM(value)

export const fmtDate = (iso?: string | null) => {
    if (!iso) return '—'
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('en-MY', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'Asia/Kuala_Lumpur',
    })
}
