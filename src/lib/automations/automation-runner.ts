/**
 * Runs the automations of ONE workspace: finds what needs attention (`computeShopTodos`), creates at most one
 * in-app notification per automation per shop day for each owner / admin, and sends the digest email when the
 * workspace switched it on. `previewAutomations` shows what a run would say, without sending anything.
 *
 * Never throws for one recipient's failure: a notification that already exists (same dedupe key) or an email that
 * does not go out is counted, not fatal. Everything is scoped by `tenantId`.
 */
import type { Payload } from 'payload'
import { sendEmail } from '@/lib/email/send'
import { computeShopTodos, type TodoLocale } from '@/lib/insights/shop-todo'
import { tenantParam } from '@/lib/reports/report-db'
import {
    type AutomationId,
    type AutomationSettings,
    AUTOMATION_IDS,
    automationsDue,
    digestDue,
    runsToday,
    shopDay,
} from './automation-config'
import { buildDigestEmail } from './automation-digest-email'
import { claimDigestDay, releaseDigestDay } from './automation-store'
import { type AutomationReminder, buildReminders } from './automation-reminders'
import { shouldPushReminder } from './automation-push'

/** Roles that get reminders: they can open every part of the shop (see `area-access.ts`). */
const RECIPIENT_ROLES = new Set(['owner', 'admin'])
const RECIPIENT_LIMIT = 200
const NOTIFICATION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export interface AutomationRecipient {
    id: number | string
    email: string | null
    name: string | null
    locale: TodoLocale
}

const refId = (ref: unknown): string | null => {
    const value = ref && typeof ref === 'object' ? (ref as { id?: unknown }).id : ref
    return value == null ? null : String(value)
}

export async function findAutomationRecipients(payload: Payload, tenantId: number): Promise<AutomationRecipient[]> {
    const result = await payload.find({
        collection: 'users',
        where: { 'tenants.tenant': { equals: tenantId }, 'tenants.role': { in: [...RECIPIENT_ROLES] }, 'tenants.status': { equals: 'active' } },
        limit: RECIPIENT_LIMIT,
        depth: 0,
        overrideAccess: true,
    })
    return result.docs
        .filter((user) => {
            const memberships = ((user as { tenants?: Array<{ tenant?: unknown; role?: string; status?: string }> }).tenants ?? [])
            // the query matches columns independently: confirm one membership of THIS workspace is owner / admin and active
            return memberships.some((m) => refId(m.tenant) === String(tenantId) && RECIPIENT_ROLES.has(m.role ?? '') && m.status === 'active')
        })
        .map((user) => {
            const record = user as { id: number | string; email?: string | null; firstName?: string | null; prefer_lang?: string | null }
            return { id: record.id, email: record.email ?? null, name: record.firstName?.trim() || null, locale: record.prefer_lang === 'ms' ? 'ms' : 'en' }
        })
}

export interface TenantRunContext {
    now: Date
    /** Shared across tenants: how many digest emails this cron run may still send */
    emailBudget: { left: number }
    baseUrl: string
}

export interface TenantRunResult {
    tenantId: number
    /**
     * done: finished, mark the day. nothing_due: nothing switched on / scheduled. no_recipients: nobody to tell.
     * retry_later: an email failed or the budget ran out, so the next pass tries again (notifications dedupe).
     */
    status: 'done' | 'nothing_due' | 'no_recipients' | 'retry_later'
    reminders: number
    notifications: number
    digests: number
    digestFailures: number
    /** a digest went out for this tenant now */
    digestSent: boolean
}

const EMPTY = (tenantId: number, status: TenantRunResult['status']): TenantRunResult => ({ tenantId, status, reminders: 0, notifications: 0, digests: 0, digestFailures: 0, digestSent: false })

async function createNotifications(payload: Payload, tenantId: number, byRecipient: Map<AutomationRecipient, AutomationReminder[]>, now: Date): Promise<number> {
    const keys = [...new Set([...byRecipient.values()].flatMap((list) => list.map((r) => r.dedupeKey)))]
    if (keys.length === 0) return 0
    const recipientIds = [...byRecipient.keys()].map((r) => r.id)
    const existing = await payload.find({
        collection: 'notifications',
        where: { and: [{ tenant: { equals: tenantId } }, { dedupeKey: { in: keys } }, { user: { in: recipientIds } }] },
        limit: keys.length * recipientIds.length,
        depth: 0,
        overrideAccess: true,
    })
    const seen = new Set(existing.docs.map((doc) => `${refId(doc.user)}|${doc.dedupeKey}`))
    const expiresAt = new Date(now.getTime() + NOTIFICATION_TTL_MS).toISOString()

    const creates: Array<Promise<unknown>> = []
    for (const [recipient, reminders] of byRecipient) {
        for (const reminder of reminders) {
            if (seen.has(`${recipient.id}|${reminder.dedupeKey}`)) continue
            creates.push(
                payload.create({
                    collection: 'notifications',
                    overrideAccess: true,
                    data: {
                        tenant: tenantId,
                        user: Number(recipient.id),
                        type: 'AUTOMATION_REMINDER',
                        title: reminder.title,
                        message: reminder.message,
                        actionUrl: reminder.actionUrl,
                        metadata: { automation: reminder.automation, kind: reminder.kind, count: String(reminder.count), push: shouldPushReminder(reminder.automation) ? 'yes' : 'no' },
                        dedupeKey: reminder.dedupeKey,
                        isRead: false,
                        expiresAt,
                    },
                }),
            )
        }
    }
    // a concurrent run that wins the unique (tenant, user, dedupe key) index rejects this row: the reminder exists, fine
    const settled = await Promise.allSettled(creates)
    return settled.filter((s) => s.status === 'fulfilled').length
}

export async function runTenantAutomations(
    payload: Payload,
    tenant: { id: number | string; name?: string | null },
    settings: AutomationSettings,
    ctx: TenantRunContext,
): Promise<TenantRunResult> {
    const tenantId = tenantParam(tenant.id)
    const day = shopDay(ctx.now)
    const due = automationsDue(settings, ctx.now)
    const sendDigest = digestDue(settings, ctx.now)
    if (due.length === 0) return EMPTY(tenantId, 'nothing_due')

    const recipients = await findAutomationRecipients(payload, tenantId)
    if (recipients.length === 0) return EMPTY(tenantId, 'no_recipients')

    // the To do list once per language the recipients read (texts and copilot prompts are in that language)
    const reminderBy = new Map<TodoLocale, AutomationReminder[]>()
    for (const locale of new Set(recipients.map((r) => r.locale))) {
        const items = await computeShopTodos(payload, { tenantId, now: ctx.now, locale })
        reminderBy.set(locale, buildReminders(items, due, day))
    }
    const byRecipient = new Map(recipients.map((r) => [r, reminderBy.get(r.locale) ?? []] as const))
    const reminders = [...reminderBy.values()][0]?.length ?? 0

    const notifications = await createNotifications(payload, tenantId, byRecipient, ctx.now)

    let digests = 0
    let digestFailures = 0
    let outOfBudget = false
    if (sendDigest) {
        const mailable = [...byRecipient].filter(([recipient, list]) => recipient.email && list.length > 0)
        // all or nothing per workspace, so a retry never mails the same owner twice
        if (mailable.length > ctx.emailBudget.left) outOfBudget = true
        // the day is taken BEFORE sending: a run that overlaps this one (cron delivered twice, an operator) mails nobody
        else if (mailable.length > 0 && (await claimDigestDay(payload, tenantId, day))) {
            ctx.emailBudget.left -= mailable.length
            for (const [recipient, list] of mailable) {
                const mail = buildDigestEmail({ shopName: tenant.name || 'Prime Web', recipientName: recipient.name, locale: recipient.locale, reminders: list, baseUrl: ctx.baseUrl })
                if (await sendEmail({ to: recipient.email as string, subject: mail.subject, html: mail.html })) digests += 1
                else digestFailures += 1
            }
            // nobody got it: give the day back so the next pass tries again
            if (digests === 0) await releaseDigestDay(payload, tenantId, day, settings.lastDigestDay)
        }
    }
    // retry only when nothing could be sent (budget, or every email failed); once one owner got it the day is done
    const retry = outOfBudget || (digestFailures > 0 && digests === 0)
    return { tenantId, status: retry ? 'retry_later' : 'done', reminders, notifications, digests, digestFailures, digestSent: digests > 0 }
}

// ── "Run now" preview (no notification, no email) ─────────────────────────────────────────────────────────────

export interface AutomationPreview {
    day: string
    /** What the switched-on automations find right now (weekly ones included, whatever the weekday) */
    reminders: AutomationReminder[]
    /** Switched-on weekly automations that the real run leaves for Monday */
    mondayOnly: AutomationId[]
    /** Switched-off automations */
    off: AutomationId[]
    digest: { enabled: boolean; frequency: AutomationSettings['digest']['frequency'] }
}

export async function previewAutomations(
    payload: Payload,
    args: { tenantId: number | string; settings: AutomationSettings; locale: TodoLocale; now: Date },
): Promise<AutomationPreview> {
    const tenantId = tenantParam(args.tenantId)
    const on = AUTOMATION_IDS.filter((id) => args.settings.enabled[id])
    const items = on.length ? await computeShopTodos(payload, { tenantId, now: args.now, locale: args.locale }) : []
    return {
        day: shopDay(args.now),
        reminders: buildReminders(items, on, shopDay(args.now)),
        mondayOnly: on.filter((id) => !runsToday(id, args.now)),
        off: AUTOMATION_IDS.filter((id) => !args.settings.enabled[id]),
        digest: { ...args.settings.digest },
    }
}
