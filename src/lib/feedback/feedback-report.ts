import { createHash } from 'node:crypto'
import { z } from 'zod'
import { LARK_CLIENT_TOKEN_CONFLICT, LarkApiError, createBaseRecord } from '@/lib/lark/lark-base-client'

const AREA_KEYS = [
    'products', 'orders', 'customers', 'discounts', 'design', 'payments', 'shipping', 'domains', 'account', 'other',
] as const

/** Body accepted by POST /api/feedback (mirrors the client FeedbackInput minus screenshots). */
export const feedbackSchema = z.object({
    type: z.enum(['problem', 'mismatch', 'suggestion']),
    areas: z.array(z.enum(AREA_KEYS)).min(1).max(AREA_KEYS.length).refine((a) => new Set(a).size === a.length),
    details: z.string().trim().min(10).max(2000),
    // Lark attachment tokens from /api/feedback/screenshots (Lark rejects tokens from another Base).
    // Context the client reports about where the form was opened.
    pageUrl: z.string().max(500).optional(),
    locale: z.enum(['en', 'ms']).optional(),
    screenshotTokens: z.array(z.string().min(1).max(100)).max(9).optional(),
})
export type FeedbackBody = z.infer<typeof feedbackSchema>

/** Lark requires client_token to be a UUID v4. */
export const uuidV4Schema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)

/** Column names of the Lark Base table; must match the table created in Lark. */
export const LARK_FEEDBACK_FIELDS = {
    feedbackId: 'Feedback ID',
    type: 'Type',
    areas: 'Feature',
    details: 'Details',
    screenshots: 'Screenshots',
    store: 'Store',
    storeId: 'Store ID',
    reporter: 'Reporter',
    role: 'Role',
    status: 'Status',
    migrated: 'Migrated store',
    pageUrl: 'Page URL',
    locale: 'Language',
    appVersion: 'App version',
    userAgent: 'User agent',
} as const

const TYPE_LABEL = { problem: 'Report a problem', mismatch: 'Data mismatch', suggestion: 'Suggestion' } as const
/** Option names of the Lark "Feature" multi-select; must match the Base exactly. */
const AREA_LABEL = {
    products: 'Products & stock', orders: 'Orders', customers: 'Customers', discounts: 'Discounts',
    design: 'Design & pages', payments: 'Payments', shipping: 'Shipping', domains: 'Domains',
    account: 'Account & staff', other: 'Other',
} as const

/**
 * `FB-YY-NNNNNN`, derived from the idempotency key so a retried submit returns the same code.
 * Display code only (not a sequence): 6 digits can collide, Lark's record id stays the true key.
 */
export function buildFeedbackId(idempotencyKey: string, now = new Date()): string {
    const hash = createHash('sha256').update(idempotencyKey.toLowerCase()).digest()
    const num = String(hash.readUInt32BE(0) % 1_000_000).padStart(6, '0')
    return `FB-${String(now.getUTCFullYear()).slice(-2)}-${num}`
}

type Meta = {
    feedbackId: string
    tenantId: string | null
    storeName: string | null
    isMigratedStore: boolean
    appVersion: string | null
    userAgent: string | null
    reporterName: string | null
    reporterRole: string | null
}

/** Reporter name + store role from the session user (never from the client body). Role is the one of tenants[0], the same tenant extractTenantId picks. */
export function extractReporter(user: unknown): Pick<Meta, 'reporterName' | 'reporterRole'> {
    const u = user as { firstName?: string | null; lastName?: string | null; tenants?: Array<{ role?: string | null }> }
    const name = [u.firstName, u.lastName].map((p) => p?.trim()).filter(Boolean).join(' ')
    return { reporterName: name || null, reporterRole: u.tenants?.[0]?.role ?? null }
}

export function toLarkFields(body: FeedbackBody, meta: Meta): Record<string, unknown> {
    const f = LARK_FEEDBACK_FIELDS
    const fields: Record<string, unknown> = {
        [f.feedbackId]: meta.feedbackId,
        [f.type]: TYPE_LABEL[body.type],
        [f.areas]: body.areas.map((a) => AREA_LABEL[a]),
        [f.details]: body.details,
        [f.status]: 'New',
    }
    // A store is a tenant, so the session's tenant id is the store id.
    if (meta.tenantId) fields[f.storeId] = meta.tenantId
    if (meta.reporterName) fields[f.reporter] = meta.reporterName
    if (meta.reporterRole) fields[f.role] = meta.reporterRole
    if (body.screenshotTokens?.length) fields[f.screenshots] = body.screenshotTokens.map((file_token) => ({ file_token }))
    if (meta.storeName) fields[f.store] = meta.storeName
    fields[f.migrated] = meta.isMigratedStore ? 'Yes' : 'No'
    if (body.pageUrl) fields[f.pageUrl] = body.pageUrl
    if (body.locale) fields[f.locale] = body.locale === 'ms' ? 'Bahasa Melayu' : 'English'
    if (meta.appVersion) fields[f.appVersion] = meta.appVersion
    if (meta.userAgent) fields[f.userAgent] = meta.userAgent
    return fields
}

export type SubmitConfig = { appToken: string; tableId: string }

/**
 * Pushes one feedback into the Lark Base table. Idempotent per key: a conflict on the
 * client_token means the first attempt already landed (`replayed`), so the same feedback id is returned.
 */
export async function submitFeedbackToLarkBase(
    body: FeedbackBody,
    idempotencyKey: string,
    meta: Omit<Meta, 'feedbackId'>,
    config: SubmitConfig,
): Promise<{ feedbackId: string; replayed: boolean }> {
    const feedbackId = buildFeedbackId(idempotencyKey)
    try {
        await createBaseRecord({
            appToken: config.appToken,
            tableId: config.tableId,
            clientToken: idempotencyKey,
            fields: toLarkFields(body, { ...meta, feedbackId }),
        })
    } catch (err) {
        if (err instanceof LarkApiError && err.code === LARK_CLIENT_TOKEN_CONFLICT) return { feedbackId, replayed: true }
        throw err
    }
    return { feedbackId, replayed: false }
}
