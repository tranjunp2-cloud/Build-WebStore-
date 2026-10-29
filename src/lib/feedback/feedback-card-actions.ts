/**
 * What each card button does to a feedback row. Pure functions over the row's current fields.
 *
 * - `First Response At` is set once and never moved, so Response Hours measures the real first reply.
 * - Whoever acts on an unowned row becomes its owner; an existing owner is only replaced by "Take it".
 */
import { CLOSED_STATUSES, environmentOf } from './feedback-card-config'
import type { FeedbackCardData } from './feedback-card'
import { LARK_FEEDBACK_FIELDS as F } from './feedback-report'

type Fields = Record<string, unknown>
export type ActionPlan = { patch: Fields; toast: string }

const BEFORE_REPLY = ['New', 'Triaging', 'In Progress']

/** Lark returns text and single-select cells as strings, rich-text arrays or `{ text }`; flatten to a string. */
export function plain(value: unknown): string {
    if (Array.isArray(value)) return value.map((p) => plain(p)).join('')
    if (value && typeof value === 'object' && 'text' in value) return String((value as { text: unknown }).text)
    return typeof value === 'string' ? value : value == null ? '' : String(value)
}

/** Person column -> first owner's open_id, or "". */
export function ownerOf(fields: Fields): string {
    const owners = fields[F.owner]
    return Array.isArray(owners) && owners[0]?.id ? String(owners[0].id) : ''
}

/** Returns null when the action does not apply to the row's current status (a stale card). */
export function planAction(action: string, fields: Fields, operatorOpenId: string, now = Date.now()): ActionPlan | null {
    const status = plain(fields[F.status]) || 'New'
    const closed = (CLOSED_STATUSES as readonly string[]).includes(status)
    const owner = ownerOf(fields)
    const me = [{ id: operatorOpenId }]
    const claimIfUnowned = owner ? {} : { [F.owner]: me }
    const firstReplyIfMissing = fields[F.firstResponseAt] ? {} : { [F.firstResponseAt]: now }

    switch (action) {
        case 'claim':
            if (closed) return null
            return {
                patch: { [F.owner]: me, ...(status === 'New' ? { [F.status]: 'Triaging' } : {}) },
                toast: "It's yours. Reply, then press Mark replied.",
            }
        case 'replied':
            if (closed) return null
            return {
                patch: {
                    ...claimIfUnowned,
                    ...firstReplyIfMissing,
                    ...(BEFORE_REPLY.includes(status) ? { [F.status]: 'Waiting on Reporter' } : {}),
                },
                toast: 'Marked replied. The 24h alert is cleared.',
            }
        case 'resolve':
            if (closed) return null
            return {
                patch: {
                    ...claimIfUnowned,
                    [F.status]: 'Resolved',
                    // Closing is a response too; otherwise a row resolved by phone stays "awaiting first reply".
                    ...firstReplyIfMissing,
                    ...(fields[F.resolvedAt] ? {} : { [F.resolvedAt]: now }),
                },
                toast: 'Resolved.',
            }
        case 'wont_fix':
            if (status !== 'New' && status !== 'Triaging') return null
            return { patch: { [F.status]: "Won't Fix", [F.resolvedAt]: now }, toast: "Marked won't fix." }
        case 'reopen':
            if (!closed) return null
            return { patch: { [F.status]: owner ? 'In Progress' : 'New', [F.resolvedAt]: null }, toast: 'Reopened.' }
        default:
            return null
    }
}

/** Base row -> the shape the card builder draws from. Null when the table is not one of ours. */
export function cardDataFromFields(
    ref: { appToken: string; tableId: string; recordId: string },
    fields: Fields,
): FeedbackCardData | null {
    const environment = environmentOf(ref.tableId)
    if (!environment) return null
    const features = Array.isArray(fields[F.areas]) ? (fields[F.areas] as unknown[]).map(plain) : [plain(fields[F.areas])]
    return {
        ...ref,
        environment,
        feedbackId: plain(fields[F.feedbackId]) || '(no id)',
        type: plain(fields[F.type]),
        features: features.filter(Boolean),
        details: plain(fields[F.details]),
        store: plain(fields[F.store]),
        reporter: plain(fields[F.reporter]),
        role: plain(fields[F.role]),
        priority: plain(fields[F.priority]),
        status: plain(fields[F.status]) || 'New',
        ownerOpenId: ownerOf(fields),
        submittedAt: Number(fields[F.submittedAt]) || undefined,
        firstResponseAt: Number(fields[F.firstResponseAt]) || undefined,
    }
}
