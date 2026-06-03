/**
 * Discount formatting helpers — pure, no 'use client' (safe to import from RSC or client).
 */

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
