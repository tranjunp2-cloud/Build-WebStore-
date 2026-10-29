/**
 * Daily digest for the team group: production feedback nobody replied to within 24h, plus (Mondays) open items
 * that have sat in In Progress / Waiting on Reporter for over 7 days. One card, not one per item.
 */
import { CLOSED_STATUSES, EVENT_TIME_ZONE, md, recordUrl } from './feedback-card-config'
import { ownerOf, plain } from './feedback-card-actions'
import { LARK_FEEDBACK_FIELDS as F } from './feedback-report'

export const REPLY_DEADLINE_HOURS = 24
export const STALE_DAYS = 7
const STALE_STATUSES = ['In Progress', 'Waiting on Reporter']

/** Columns the digest reads. */
export const DIGEST_FIELD_NAMES = [F.feedbackId, F.type, F.areas, F.store, F.priority, F.status, F.owner, F.submittedAt, F.firstResponseAt]

/** Lark filter: every row not yet closed. Age and reply checks happen in code (Open Age is a formula column). */
export const OPEN_FILTER = {
    conjunction: 'and',
    conditions: CLOSED_STATUSES.map((s) => ({ field_name: F.status, operator: 'isNot', value: [s] })),
}

export type DigestItem = {
    recordId: string
    feedbackId: string
    type: string
    priority: string
    store: string
    status: string
    hasOwner: boolean
    ageHours: number
}

export type DigestRow = { recordId: string; fields: Record<string, unknown> }

const toItem = (row: DigestRow, now: number): DigestItem => ({
    recordId: row.recordId,
    feedbackId: plain(row.fields[F.feedbackId]) || '(no id)',
    type: plain(row.fields[F.type]),
    priority: plain(row.fields[F.priority]) || 'Not set',
    store: plain(row.fields[F.store]),
    status: plain(row.fields[F.status]) || 'New',
    hasOwner: Boolean(ownerOf(row.fields)),
    ageHours: (now - Number(row.fields[F.submittedAt] ?? now)) / 3_600_000,
})

/** Open rows with no first response after the deadline, oldest first. */
export function selectOverdue(rows: DigestRow[], now = Date.now(), deadlineHours = REPLY_DEADLINE_HOURS): DigestItem[] {
    return rows
        .filter((r) => !r.fields[F.firstResponseAt] && !CLOSED_STATUSES.includes(plain(r.fields[F.status]) as never))
        .map((r) => toItem(r, now))
        .filter((i) => i.ageHours >= deadlineHours)
        .sort((a, b) => b.ageHours - a.ageHours)
}

/** Open rows in In Progress / Waiting on Reporter for over 7 days, oldest first. */
export function selectStale(rows: DigestRow[], now = Date.now(), staleDays = STALE_DAYS): DigestItem[] {
    return rows
        .filter((r) => STALE_STATUSES.includes(plain(r.fields[F.status])))
        .map((r) => toItem(r, now))
        .filter((i) => i.ageHours >= staleDays * 24)
        .sort((a, b) => b.ageHours - a.ageHours)
}

/** True on Monday in Malaysia time (the cron fires 09:00 MYT). */
export function isMondayInMalaysia(now = Date.now()): boolean {
    return new Intl.DateTimeFormat('en-US', { timeZone: EVENT_TIME_ZONE, weekday: 'long' }).format(now) === 'Monday'
}

/** "1 day 6h" reads faster than "30.4 hours" in a list. */
export function humaniseHours(hours: number): string {
    const whole = Math.floor(hours)
    if (whole < 48) return `${whole}h`
    const days = Math.floor(whole / 24)
    const rest = whole % 24
    return rest ? `${days} days ${rest}h` : `${days} days`
}

export function buildOverdueCard(
    appToken: string,
    tableId: string,
    overdue: DigestItem[],
    stale: DigestItem[],
) {
    const line = (i: DigestItem, label: string) =>
        `[${md(i.feedbackId)}](${recordUrl(appToken, tableId, i.recordId)}) · ${md(i.type)} · ${md(i.priority)}${i.store ? ` · ${md(i.store)}` : ''}`
        + ` · ${md(i.status)}${i.hasOwner ? '' : ' · unassigned'} — ${label} **${humaniseHours(i.ageHours)}**`

    const elements: unknown[] = []
    if (overdue.length) {
        elements.push({ tag: 'div', text: { tag: 'lark_md', content: `**No reply in over ${REPLY_DEADLINE_HOURS}h**\n${overdue.map((i) => line(i, 'waiting')).join('\n')}` } })
    }
    if (stale.length) {
        if (elements.length) elements.push({ tag: 'hr' })
        elements.push({ tag: 'div', text: { tag: 'lark_md', content: `**Open for over ${STALE_DAYS} days (In Progress / Waiting on Reporter)**\n${stale.map((i) => line(i, 'open')).join('\n')}` } })
    }
    elements.push(
        { tag: 'note', elements: [{ tag: 'plain_text', content: 'Press Mark replied on the card (or set First Response At in the Base) and this clears.' }] },
        { tag: 'action', actions: [{ tag: 'button', text: { tag: 'plain_text', content: 'Open the Base' }, url: recordUrl(appToken, tableId), type: 'primary' }] },
    )

    const headline = overdue.length
        ? `[Production] ${overdue.length} feedback ${overdue.length === 1 ? 'item has' : 'items have'} had no reply in over ${REPLY_DEADLINE_HOURS}h`
        : `[Production] ${stale.length} feedback ${stale.length === 1 ? 'item has' : 'items have'} been open over ${STALE_DAYS} days`
    return {
        config: { wide_screen_mode: true },
        header: { template: 'carmine', title: { tag: 'plain_text', content: headline } },
        elements,
    }
}
