import { CLOSED_STATUSES, EVENT_TIME_ZONE, md, recordUrl } from './feedback-card-config'

/** Row of the Base as the card draws it. */
export type FeedbackCardData = {
    recordId: string
    appToken: string
    tableId: string
    environment: 'Staging' | 'Production'
    feedbackId: string
    type: string
    features: string[]
    details: string
    store: string
    reporter: string
    role: string
    priority: string
    status: string
    ownerOpenId: string
    submittedAt?: number
    firstResponseAt?: number
}

export type CardAction = 'claim' | 'replied' | 'resolve' | 'wont_fix' | 'reopen'
export const CARD_ACTIONS: readonly CardAction[] = ['claim', 'replied', 'resolve', 'wont_fix', 'reopen']

// Header colour carries the triage signal while open; once closed it says so instead.
const PRIORITY_TEMPLATE: Record<string, string> = { High: 'red', Medium: 'orange', Low: 'blue' }
const CLOSED_TEMPLATE: Record<string, string> = { Resolved: 'green', "Won't Fix": 'grey' }

/** Only the next sensible steps are offered per status. */
const ACTIONS_BY_STATUS: Record<string, CardAction[]> = {
    New: ['claim', 'replied', 'wont_fix'],
    Triaging: ['replied', 'resolve', 'wont_fix'],
    'In Progress': ['replied', 'resolve'],
    'Waiting on Reporter': ['resolve'],
    Resolved: ['reopen'],
    "Won't Fix": ['reopen'],
}

const BUTTONS: Record<CardAction, { label: string; type: string }> = {
    claim: { label: 'Take it', type: 'primary' },
    replied: { label: 'Mark replied', type: 'default' },
    resolve: { label: 'Resolve', type: 'primary' },
    wont_fix: { label: "Won't fix", type: 'danger' },
    reopen: { label: 'Reopen', type: 'default' },
}

export const isClosed = (status: string): boolean => (CLOSED_STATUSES as readonly string[]).includes(status)

/** Readable local time for the team (Malaysia). */
export function localTime(date: Date): string {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: EVENT_TIME_ZONE, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(date)
}

const hoursBetween = (start: number, end: number): number => Math.round(((end - start) / 3_600_000) * 10) / 10

function statusLine(d: FeedbackCardData, submittedAt: number): string {
    const parts = [`**Status:** ${md(d.status)}`]
    parts.push(d.ownerOpenId ? `**Owner:** <at id=${d.ownerOpenId}></at>` : '**Owner:** unassigned')
    if (d.firstResponseAt) parts.push(`**First reply:** ${hoursBetween(submittedAt, d.firstResponseAt)}h`)
    return parts.join('  ·  ')
}

function buttons(d: FeedbackCardData) {
    const workflow = (ACTIONS_BY_STATUS[d.status] ?? []).map((action) => ({
        tag: 'button',
        text: { tag: 'plain_text', content: BUTTONS[action].label },
        type: BUTTONS[action].type,
        // The callback trusts nothing but these values; all are re-validated server-side.
        value: { action, record_id: d.recordId, table_id: d.tableId },
    }))
    return [
        ...workflow,
        { tag: 'button', text: { tag: 'plain_text', content: 'Open in Base' }, url: recordUrl(d.appToken, d.tableId, d.recordId), type: 'default' },
    ]
}

/** The card the group works from. Always drawn from the row's state so card and Base cannot drift. */
export function buildFeedbackCard(d: FeedbackCardData) {
    const submittedAt = d.submittedAt ?? Date.now()
    const closed = isClosed(d.status)
    const preview = d.details.length > 400 ? `${d.details.slice(0, 400)}…` : d.details
    const facts = [
        ['Type', d.type], ['Feature', d.features.join(', ')], ['Priority', d.priority || 'Not set'],
        d.store ? ['Store', d.store] : null,
        d.reporter ? ['Reporter', d.role ? `${d.reporter} (${d.role})` : d.reporter] : null,
    ].filter((p): p is string[] => Boolean(p))

    return {
        // update_multi: a button press redraws the card for the whole group, not only the presser.
        config: { wide_screen_mode: true, update_multi: true },
        header: {
            template: (closed ? CLOSED_TEMPLATE[d.status] : PRIORITY_TEMPLATE[d.priority] ?? 'orange') ?? 'blue',
            title: { tag: 'plain_text', content: `[${d.environment}] ${closed ? `[${d.status}] ` : ''}${d.feedbackId} · ${d.type}` },
        },
        elements: [
            { tag: 'div', fields: facts.map(([label, value]) => ({ is_short: true, text: { tag: 'lark_md', content: `**${label}**\n${md(value)}` } })) },
            { tag: 'hr' },
            { tag: 'div', text: { tag: 'lark_md', content: md(preview) } },
            { tag: 'hr' },
            { tag: 'div', text: { tag: 'lark_md', content: statusLine(d, submittedAt) } },
            { tag: 'action', actions: buttons(d) },
            { tag: 'note', elements: [{ tag: 'plain_text', content: `Submitted ${localTime(new Date(submittedAt))}` }] },
        ],
    }
}
