/** Malaysia time is UTC+8 all year: the shop's "day" and "month" for every AI cap. Pure. */
const OFFSET_MS = 8 * 60 * 60 * 1000
export const DAY_MS = 24 * 60 * 60 * 1000

const shifted = (now: Date | number) => new Date((typeof now === 'number' ? now : now.getTime()) + OFFSET_MS)
const pad = (value: number) => String(value).padStart(2, '0')

/** "2026-10-29" */
export function malaysiaDayKey(now: Date | number): string {
  const d = shifted(now)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** "2026-10" */
export function malaysiaMonthKey(now: Date | number): string {
  return malaysiaDayKey(now).slice(0, 7)
}

/** The instant the Malaysia day containing `now` began. */
export function malaysiaDayStart(now: Date | number): Date {
  const d = shifted(now)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - OFFSET_MS)
}

/** The instant the Malaysia month containing `now` began. */
export function malaysiaMonthStart(now: Date | number): Date {
  const d = shifted(now)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - OFFSET_MS)
}

export function daysInMalaysiaMonth(now: Date | number): number {
  const d = shifted(now)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
}
