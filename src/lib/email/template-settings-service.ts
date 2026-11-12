/**
 * Email-template settings write core, shared by Settings → Email templates (server actions) and the
 * copilot's applier. The caller names the workspace; the plan gate (`email_template_configuration`), the
 * "security templates can't be switched off" rule and the field limits are enforced here for both.
 * Expected refusals come back as `{ success: false, error }`; anything unexpected throws.
 */
import config from '@payload-config'
import { getPayload, type User } from 'payload'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import { canUse, getActivePlanSubscription } from '@/lib/subscriptions/plan-subscription'
import { validateContentFields } from '@/app/(dashboard)/settings/email-templates/validate-content-fields'
import { isStaleVersion, VersionConflictError, versionOf, type VersionConflict } from '@/lib/save-version/save-version'
import type { EmailRecipient, EmailTemplateType } from './types'

export interface ContentFields {
    subject?: string
    greeting?: string
    ctaLabel?: string
    closing?: string
}

export type TemplateActor = { tenantId: string; user?: User | null }

export interface SaveTemplateInput {
    templateType: EmailTemplateType
    recipient: EmailRecipient
    enabled: boolean
    contentEn: ContentFields
    contentMs?: ContentFields
    /**
     * The row's `updatedAt` the editor loaded; `null`: it started from the built-in default (expects no row yet).
     * A row changed, created or reset since is refused (`code: 'VERSION_CONFLICT'`, `current` = the row's version now,
     * null while there is no row) and nothing is written. Read-then-write in this request, except that two first
     * saves of a missing row meet at the unique index. Not given: no check (the copilot's applier).
     */
    expectedUpdatedAt?: string | null
}

/** What a saved row holds (what undo puts back). */
export interface TemplateRowSnapshot {
    id: number | string
    enabled: boolean
    contentEn: ContentFields
    contentMs: ContentFields
    updatedAt: string
}

export type TemplateWriteResult = { success: boolean; error?: string; before?: TemplateRowSnapshot | null; after?: TemplateRowSnapshot | null } & Partial<VersionConflict>

const conflictResult = (current: unknown): TemplateWriteResult => ({ success: false, ...new VersionConflictError(versionOf(current)).toResult() })

// These templates cannot be disabled — security-critical flows
export const CRITICAL_TEMPLATE_TYPES: readonly EmailTemplateType[] = ['otp-verification', 'forgot-password', 'password-changed']

export const PLAN_REFUSAL = 'Email template configuration is not available on your current plan.'

type Cms = Awaited<ReturnType<typeof getPayload>>

const fieldsOf = (raw: unknown): ContentFields => {
    const g = (raw ?? {}) as Record<string, unknown>
    const out: ContentFields = {}
    for (const key of ['subject', 'greeting', 'ctaLabel', 'closing'] as const) if (typeof g[key] === 'string' && g[key]) out[key] = g[key] as string
    return out
}

export const toSnapshot = (doc: Record<string, unknown>): TemplateRowSnapshot => ({
    id: doc.id as number | string,
    enabled: (doc.enabled as boolean | undefined) ?? true,
    contentEn: fieldsOf(doc.contentEn),
    contentMs: fieldsOf(doc.contentMs),
    updatedAt: String(doc.updatedAt ?? ''),
})

/** The workspace's saved row for one template, or null while it is on the built-in default. */
export async function findTemplateRow(payload: Cms, tenantId: string, templateType: EmailTemplateType, recipient: EmailRecipient) {
    const existing = await payload.find({
        collection: 'email-template-settings',
        where: {
            and: [
                { tenant: { equals: tenantId } },
                { templateType: { equals: templateType } },
                { recipient: { equals: recipient } },
            ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
    })
    return (existing.docs[0] as unknown as Record<string, unknown> | undefined) ?? null
}

/** Whether the workspace's plan includes email template configuration. */
export async function planAllowsTemplates(payload: Cms, tenantId: string): Promise<boolean> {
    const sub = await getActivePlanSubscription(payload, tenantId)
    return Boolean(sub && (await canUse(payload, sub.plan as PlanCode, 'email_template_configuration')))
}

/** Settings → Email templates "Save": upsert the row for (workspace, template, recipient). */
export async function saveEmailTemplateConfigAs(actor: TemplateActor, input: SaveTemplateInput): Promise<TemplateWriteResult> {
    const payload = await getPayload({ config })
    const tenantId = actor.tenantId

    if (!(await planAllowsTemplates(payload, tenantId))) return { success: false, error: PLAN_REFUSAL }

    // Server-side guard: critical templates cannot be disabled
    if (CRITICAL_TEMPLATE_TYPES.includes(input.templateType) && !input.enabled) {
        return { success: false, error: 'Cannot disable critical template' }
    }

    // Validate field lengths
    const enError = validateContentFields(input.contentEn, 'English')
    if (enError) return { success: false, error: enError }

    if (input.contentMs) {
        const msError = validateContentFields(input.contentMs, 'Malay')
        if (msError) return { success: false, error: msError }
    }

    // Upsert: find existing row for (tenant, templateType, recipient)
    const existing = await findTemplateRow(payload, tenantId, input.templateType, input.recipient)
    const before = existing ? toSnapshot(existing) : null
    if (isStaleVersion(input.expectedUpdatedAt, existing?.updatedAt)) return conflictResult(existing?.updatedAt)

    const data = {
        tenant: Number(tenantId),
        templateType: input.templateType,
        recipient: input.recipient,
        enabled: input.enabled,
        contentEn: input.contentEn,
        contentMs: input.contentMs ?? {},
    }
    const user = actor.user ? { user: actor.user } : {}

    let saved: Record<string, unknown>
    if (existing) {
        saved = (await payload.update({ collection: 'email-template-settings', id: existing.id as number, data, overrideAccess: true, ...user })) as unknown as Record<string, unknown>
    } else {
        try {
            saved = (await payload.create({ collection: 'email-template-settings', data, overrideAccess: true, ...user })) as unknown as Record<string, unknown>
        } catch (createErr: unknown) {
            // Concurrent save: unique constraint violation — re-fetch and update instead
            const isConstraintViolation = createErr instanceof Error && (
                createErr.message.includes('unique') || createErr.message.includes('duplicate')
            )
            const retry = isConstraintViolation ? await findTemplateRow(payload, tenantId, input.templateType, input.recipient) : null
            if (!retry) throw createErr
            // the editor expected no row, and someone saved one first
            if (input.expectedUpdatedAt !== undefined) return conflictResult(retry.updatedAt)
            saved = (await payload.update({ collection: 'email-template-settings', id: retry.id as number, data, overrideAccess: true, ...user })) as unknown as Record<string, unknown>
        }
    }
    return { success: true, before, after: toSnapshot(saved) }
}

/** Settings → Email templates "Reset": delete the workspace's row so the built-in default applies again. */
export async function resetEmailTemplateConfigAs(actor: TemplateActor, templateType: EmailTemplateType, recipient: EmailRecipient): Promise<TemplateWriteResult> {
    const payload = await getPayload({ config })
    const existing = await findTemplateRow(payload, actor.tenantId, templateType, recipient)
    if (existing) {
        await payload.delete({ collection: 'email-template-settings', id: existing.id as number, overrideAccess: true, ...(actor.user ? { user: actor.user } : {}) })
    }
    // If the row doesn't exist, it's already at the built-in default — no-op
    return { success: true, before: existing ? toSnapshot(existing) : null, after: null }
}
