/**
 * Runs the automations of ONE workspace: finds what needs attention (the To do list), and creates at most one
 * in-app notification per automation per shop day for each owner / admin. No email (the digest is off, #2176).
 *
 * Never throws for one recipient's failure: a notification that already exists (same dedupe key) is fine; one that
 * failed for any other reason (DB down) asks for a retry so the day is not marked done. Everything is scoped by
 * `tenantId`.
 */
import type { Payload } from 'payload'
import { localizeShopTodos, readShopTodoDrafts, type TodoLocale } from '@/lib/insights/shop-todo'
import { tenantParam } from '@/lib/reports/report-db'
import { type AutomationSettings, automationAreas, automationsDue, shopDay } from './automation-config'
import { type AutomationReminder, buildReminders } from './automation-reminders'
import { shouldPushReminder } from './automation-push'

/** Roles that get reminders: they can open every part of the shop (see `area-access.ts`). */
const RECIPIENT_ROLES = new Set(['owner', 'admin'])
const RECIPIENT_LIMIT = 200
const NOTIFICATION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export interface AutomationRecipient {
    id: number | string
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
            const record = user as { id: number | string; prefer_lang?: string | null }
            return { id: record.id, locale: record.prefer_lang === 'ms' ? 'ms' : 'en' }
        })
}

export interface TenantRunContext {
    now: Date
}

export interface TenantRunResult {
    tenantId: number
    /**
     * done: finished, mark the day. nothing_due: nothing switched on / scheduled. no_recipients: nobody to tell.
     * retry_later: a notification failed, so the next pass tries again (the others dedupe).
     */
    status: 'done' | 'nothing_due' | 'no_recipients' | 'retry_later'
    reminders: number
    notifications: number
}

const EMPTY = (tenantId: number, status: TenantRunResult['status']): TenantRunResult => ({ tenantId, status, reminders: 0, notifications: 0 })

/**
 * The unique (tenant, user, dedupe key) index rejected the row: the reminder already exists. Payload's adapter turns
 * Postgres 23505 into a ValidationError "Value must be unique" (see product-sku-conflicts.ts); a raw driver error
 * may still carry the code itself.
 */
export function isUniqueViolation(error: unknown): boolean {
    const e = error as { name?: string; code?: string; cause?: { code?: string }; data?: { errors?: Array<{ message?: string }> } } | null
    if (!e || typeof e !== 'object') return false
    if (e.code === '23505' || e.cause?.code === '23505') return true
    return e.name === 'ValidationError' && (e.data?.errors ?? []).some((entry) => entry?.message === 'Value must be unique')
}

async function createNotifications(
    payload: Payload,
    tenantId: number,
    byRecipient: Map<AutomationRecipient, AutomationReminder[]>,
    now: Date,
): Promise<{ created: number; failed: number }> {
    const keys = [...new Set([...byRecipient.values()].flatMap((list) => list.map((r) => r.dedupeKey)))]
    if (keys.length === 0) return { created: 0, failed: 0 }
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
    // a concurrent run that wins the unique (tenant, user, dedupe key) index rejects this row: the reminder exists, fine.
    // Anything else (connection lost, ...) did not create it: count it so the run is retried.
    const settled = await Promise.allSettled(creates)
    let failed = 0
    for (const outcome of settled) {
        if (outcome.status === 'fulfilled' || isUniqueViolation(outcome.reason)) continue
        failed += 1
        console.error(`[shop-automations] tenant ${tenantId} notification failed`, outcome.reason instanceof Error ? outcome.reason.message : outcome.reason)
    }
    return { created: settled.filter((s) => s.status === 'fulfilled').length, failed }
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
    if (due.length === 0) return EMPTY(tenantId, 'nothing_due')

    const recipients = await findAutomationRecipients(payload, tenantId)
    if (recipients.length === 0) return EMPTY(tenantId, 'no_recipients')

    // the data is read once, only for the areas of the due automations (the website check only when site_health is
    // due), then worded once per language the recipients read (texts and copilot prompts are in that language)
    const drafts = await readShopTodoDrafts(payload, { tenantId, now: ctx.now, areas: automationAreas(due) })
    const reminderBy = new Map<TodoLocale, AutomationReminder[]>()
    for (const locale of new Set(recipients.map((r) => r.locale))) {
        reminderBy.set(locale, buildReminders(localizeShopTodos(drafts, locale), due, day))
    }
    const byRecipient = new Map(recipients.map((r) => [r, reminderBy.get(r.locale) ?? []] as const))
    const reminders = [...reminderBy.values()][0]?.length ?? 0

    const { created: notifications, failed: notificationFailures } = await createNotifications(payload, tenantId, byRecipient, ctx.now)

    // A notification that failed for a reason other than "already exists" is retried (the rest dedupe).
    return { tenantId, status: notificationFailures > 0 ? 'retry_later' : 'done', reminders, notifications }
}
