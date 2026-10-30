const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })

/** "29 Oct, 16:04" in the viewer's zone; an unreadable date is shown as is. */
export function fmtWhen(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : DATE.format(date).replace(' at ', ', ')
}

export const fmtSeconds = (ms: number): string => `${Math.round((ms / 1000) * 10) / 10} s`
