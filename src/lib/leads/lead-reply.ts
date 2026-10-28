/**
 * Replying to a contact-form lead by email, for the dashboard assistant (the dashboard itself has no reply
 * feature). The email is built from the shared email parts, sent with the shop's contact address as the
 * reply-to (nodemailer passes `replyTo` through Payload's `sendEmail`), limited to 20 replies per workspace
 * per hour and 50 per day (the platform's sender address is used, and anyone can fill the public contact form with
 * any address, so the volume stays small), and only then recorded on the lead (`replies`, status "replied" for every message of that person).
 * A reply that could not be sent changes nothing and is reported as `SEND_FAILED`.
 */
import config from '@payload-config'
import { sql, type SQL } from 'drizzle-orm'
import { getPayload, type Payload, type User } from 'payload'
import { sendEmail } from '@/lib/email/send'
import { escapeHtml } from '@/lib/email/templates/shared/email-utils'
import { buildEmailDocumentClose, buildEmailDocumentOpen, buildEmailHeader } from '@/lib/email/templates/shared/email-html-parts'
import { checkRateLimit } from '@/lib/rateLimit'
import { getLeadAs, type LeadActor, LeadServiceError, type LeadStatusWrite, setLeadStatusAs } from './lead-service'
import { leadReplyBodyProblem } from './lead-reply-guard'

export const MAX_REPLIES_PER_HOUR = 20
export const MAX_REPLIES_PER_DAY = 50
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000
/**
 * One plain `local@domain` address and nothing else: the local part is dot-atom characters only and the domain is
 * dot-separated labels. No quotes, comments `( )`, brackets `[ ]`, backslashes, spaces or a second `@`, which a mail
 * library may read as a different recipient than the one the merchant saw.
 */
export const EMAIL_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/

export type LeadReplyActor = LeadActor & { user: Pick<User, 'email'> }

/** Header-safe single line. */
export const cleanSubject = (subject: string) => subject.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim()

/** The reply as an email: the shop's name on top, the merchant-approved text as paragraphs, nothing added. */
export function buildLeadReplyHtml(shopName: string, body: string, year = new Date().getFullYear()): string {
    const paragraphs = body
        .replace(/\r\n?/g, '\n')
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<div style="margin:0 0 14px;">${escapeHtml(p).replace(/\n/g, '<br>')}</div>`)
        .join('')
    return [
        buildEmailDocumentOpen('en', escapeHtml(shopName)),
        buildEmailHeader(shopName),
        `
      <tr><td style="padding:18px 40px 8px;">
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#334155;">${paragraphs}</div>
      </td></tr>
      <tr><td align="center" style="padding:14px 40px 32px;">
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#94A3B8;">&copy; ${year} ${escapeHtml(shopName)}</div>
      </td></tr>`,
        buildEmailDocumentClose(),
    ].join('')
}

export type LeadReplyResult = { to: string; sentAt: string; replyTo: string; recorded: boolean; statusWrites: LeadStatusWrite[] }

/** What the card shows before sending: who it goes to and from which name / reply-to. */
export async function leadReplyContext(actor: LeadReplyActor, leadId: number) {
    const payload = await getPayload({ config })
    const { lead } = await getLeadAs(actor, leadId)
    const siteId = typeof lead.site === 'object' && lead.site ? (lead.site as { id: number }).id : (lead.site as number)
    const site = (await payload.findByID({ collection: 'sites', id: siteId, depth: 0, overrideAccess: true })) as unknown as Record<string, unknown>
    const shopName = String(site.name ?? '').trim() || 'Our shop'
    const info = site.contactInfo as { email?: unknown; phone?: unknown } | undefined
    const contact = info?.email
    const shopContact = typeof contact === 'string' && EMAIL_RE.test(contact.trim()) ? contact.trim() : null
    const shopPhone = typeof info?.phone === 'string' && info.phone.trim() ? info.phone.trim() : null
    // the shop's contact address, else the person who approves the reply
    return { lead, shopName, shopEmail: shopContact, shopPhone, replyTo: shopContact ?? (actor.user.email ?? ''), replyToIs: shopContact ? ('shop' as const) : ('you' as const) }
}

/** The data-leak guard (lead-reply-guard) with this lead's and this shop's own contact details allowed. */
export function leadReplyProblem(body: string, context: Pick<Awaited<ReturnType<typeof leadReplyContext>>, 'lead' | 'shopEmail' | 'shopPhone' | 'replyTo'>): string | null {
    const lead = context.lead as { email?: unknown; phone?: unknown }
    return leadReplyBodyProblem(body, {
        leadEmail: typeof lead.email === 'string' ? lead.email : null,
        leadPhone: typeof lead.phone === 'string' ? lead.phone : null,
        shopEmails: [context.shopEmail, context.replyTo],
        shopPhones: [context.shopPhone],
    })
}

type ReplyRow = { subject: string; body: string; sentAt: string; sentBy: string | null }
type TransactionDb = { drizzle: { transaction: <T>(run: (tx: { execute: (query: SQL) => Promise<unknown> }) => Promise<T>) => Promise<T> } }
const rowCount = (result: unknown) => ((result as { rows?: unknown[] } | null)?.rows ?? []).length

/**
 * Appends one row to the lead's `replies` (Payload array table `contact_submissions_replies`: `_parent_id`,
 * `_order`) in one transaction that first locks the lead row: two replies sent at the same moment both stay, in
 * order (a Payload update of the whole array would let the later write drop the other one). The lead's `updated_at`
 * moves with it, so the copilot's version guard on the lead sees the reply. The field is closed to every request
 * (collection field access): only this code writes it.
 */
export async function appendLeadReply(payload: Payload, leadId: number, reply: ReplyRow): Promise<void> {
    const db = payload.db as unknown as TransactionDb
    await db.drizzle.transaction(async (tx) => {
        const lead = await tx.execute(sql`UPDATE contact_submissions SET updated_at = now() WHERE id = ${leadId} RETURNING id`)
        if (rowCount(lead) === 0) throw new Error(`lead ${leadId} not found`)
        await tx.execute(sql`INSERT INTO contact_submissions_replies (id, _order, _parent_id, subject, body, sent_at, sent_by)
            SELECT gen_random_uuid()::text, COALESCE(MAX(_order), 0) + 1, ${leadId}, ${reply.subject}, ${reply.body}, ${reply.sentAt}::timestamptz, ${reply.sentBy}
            FROM contact_submissions_replies WHERE _parent_id = ${leadId}`)
    })
}

export async function replyToLeadAs(actor: LeadReplyActor, leadId: number, input: { subject: string; body: string }): Promise<LeadReplyResult> {
    const subject = cleanSubject(input.subject)
    const body = input.body.trim()
    if (!subject || !body) throw new LeadServiceError('A reply needs a subject and a text.', 'INVALID')

    const context = await leadReplyContext(actor, leadId)
    const { lead, shopName, replyTo } = context
    const to = String(lead.email ?? '').trim()
    if (!EMAIL_RE.test(to)) throw new LeadServiceError('This lead has no usable email address.', 'INVALID')
    // checked when the card was drafted; again here because this is the last stop before the email leaves
    const problem = leadReplyProblem(body, context)
    if (problem) throw new LeadServiceError(problem, 'INVALID')

    const limit = await checkRateLimit(`lead-reply:${actor.tenantId}`, MAX_REPLIES_PER_HOUR, HOUR_MS)
    if (!limit.allowed) {
        throw new LeadServiceError(`You already sent ${MAX_REPLIES_PER_HOUR} replies in the last hour. Try again later.`, 'RATE_LIMITED')
    }
    const daily = await checkRateLimit(`lead-reply-day:${actor.tenantId}`, MAX_REPLIES_PER_DAY, DAY_MS)
    if (!daily.allowed) {
        throw new LeadServiceError(`You already sent ${MAX_REPLIES_PER_DAY} replies in the last 24 hours. Try again tomorrow, or write to the person from your own mailbox.`, 'RATE_LIMITED')
    }

    const sent = await sendEmail({ to, subject, html: buildLeadReplyHtml(shopName, body), ...(replyTo ? { replyTo } : {}) })
    if (!sent) throw new LeadServiceError('The email could not be sent (the mail server refused it). Nothing was changed; try again.', 'SEND_FAILED')

    // From here the email is out: a failure to write it down is logged, never thrown (a retry would send it twice)
    const sentAt = new Date().toISOString()
    let recorded = true
    let statusWrites: LeadStatusWrite[] = []
    try {
        const payload = await getPayload({ config })
        await appendLeadReply(payload, leadId, { subject, body, sentAt, sentBy: actor.user.email ?? null })
        statusWrites = (await setLeadStatusAs(actor, leadId, 'replied')).written
    } catch (error) {
        recorded = false
        console.error('[lead-reply] email sent but not recorded on the lead:', error instanceof Error ? error.message : error)
    }
    return { to, sentAt, replyTo, recorded, statusWrites }
}
