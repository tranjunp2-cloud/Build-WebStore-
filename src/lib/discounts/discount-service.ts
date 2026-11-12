import 'server-only'

import config from '@payload-config'
import { getPayload, type User } from 'payload'
import { assertFreshVersion } from '@/lib/save-version/save-version'

/**
 * The Discounts write rules, shared by the dashboard's `/api/v1/discounts` routes and the copilot's
 * discount changes (applied as the approver): the tenant is forced from the caller, `usageCount`
 * and `tenant` are never client-writable, a code is unique per tenant. Callers validate the body
 * (`lib/validations/discounts`) first; this is the write itself.
 */

export interface DiscountActor {
    user: User
    tenantId: string | number
    /**
     * The discount (and a site it names) must belong to `tenantId`. The copilot sets it; the routes keep
     * Payload's own access rules (a super-admin may edit any tenant's discount from the dashboard).
     */
    strictTenant?: boolean
}

export type DiscountServiceErrorCode = 'DUPLICATE_CODE' | 'NOT_FOUND' | 'SITE_NOT_FOUND'

export class DiscountServiceError extends Error {
    constructor(
        readonly code: DiscountServiceErrorCode,
        message: string,
    ) {
        super(message)
        this.name = 'DiscountServiceError'
    }
}

/** What a create / update may carry (already validated by the caller). Dates are date-only or ISO; the collection pins them to KL day boundaries. */
export interface DiscountWriteData {
    code?: string
    description?: string | null
    type?: 'percentage' | 'fixed'
    value?: number
    usageLimit?: number | null
    startsAt?: string | null
    expiresAt?: string | null
    status?: 'active' | 'inactive'
    site?: string | number | null
}

const PG_UNIQUE_VIOLATION = '23505'
const DISCOUNT_CODE_INDEX = 'discounts_tenant_code_uq'
const MAX_CAUSE_DEPTH = 5

interface DbErrorLike {
    message?: unknown
    code?: unknown
    constraint?: unknown
    cause?: unknown
    data?: { errors?: Array<{ message?: unknown }> }
}

const mentions = (value: unknown, ...needles: string[]) => typeof value === 'string' && needles.some((n) => value.includes(n))

/**
 * The unique index on (tenant_id, upper(code)). It surfaces as a Payload ValidationError (generic message,
 * "Value must be unique" only inside data.errors[]), a Postgres 23505 / the index name, or a driver error whose
 * 23505 sits several `cause`s deep — so walk the cause chain (bounded) and check every shape.
 * Message text is only trusted on the outermost error; deeper `cause`s are matched by `code` / `constraint` alone.
 * NOTE: the `data.errors[]` check depends on Payload's English "Value must be unique" text — re-verify it
 * (TC-F33-01-06) when upgrading Payload or changing its server i18n, or duplicates fall back to a 500.
 */
export function isDuplicateDiscountCode(err: unknown): boolean {
    let current: unknown = err
    for (let depth = 0; depth <= MAX_CAUSE_DEPTH && current && typeof current === 'object'; depth++) {
        const e = current as DbErrorLike
        if ((depth === 0 && mentions(e.message, 'duplicate', 'unique')) || e.code === PG_UNIQUE_VIOLATION || e.constraint === DISCOUNT_CODE_INDEX) return true
        if (Array.isArray(e.data?.errors) && e.data.errors.some((item) => mentions(item?.message, 'unique'))) return true
        current = e.cause
    }
    return false
}

/** Payload relationship fields on numeric-id collections expect numbers; ids often arrive as digit strings (anything else is left as is). */
const toRelationId = (value: string | number): string | number => (typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value)

const duplicate = () =>
    new DiscountServiceError('DUPLICATE_CODE', 'This code is already in use for your tenant. Try a different code or append a number.')

const idOf = (relation: unknown): string | null => {
    const raw = relation && typeof relation === 'object' ? (relation as { id?: unknown }).id : relation
    return raw == null ? null : String(raw)
}

async function assertSiteInTenant(payload: Awaited<ReturnType<typeof getPayload>>, actor: DiscountActor, site: string | number) {
    const found = await payload.findByID({ collection: 'sites', id: site, depth: 0, user: actor.user, overrideAccess: false, disableErrors: true } as never)
    if (!found || idOf((found as unknown as { tenant?: unknown }).tenant) !== String(actor.tenantId)) {
        throw new DiscountServiceError('SITE_NOT_FOUND', 'That site is not in this workspace.')
    }
}

/** An existing discount the caller may change (Payload access; with `strictTenant` also this tenant's). */
async function accessibleDiscount(payload: Awaited<ReturnType<typeof getPayload>>, actor: DiscountActor, id: string | number) {
    const existing = await payload.findByID({ collection: 'discounts', id, user: actor.user, overrideAccess: false })
    if (!existing || (actor.strictTenant && idOf((existing as unknown as { tenant?: unknown }).tenant) !== String(actor.tenantId))) {
        throw new DiscountServiceError('NOT_FOUND', 'Discount not found')
    }
    return existing
}

/** Create a discount in the caller's tenant. `usageCount` starts at 0 (only an undo of a delete sets it back). */
export async function createDiscountAs(actor: DiscountActor, data: DiscountWriteData & { code: string; type: 'percentage' | 'fixed'; value: number; usageCount?: number }) {
    const tenantId = actor.tenantId
    // Payload postgres adapter uses integer IDs — coerce string → number
    const tenantIdForPayload: string | number = /^\d+$/.test(String(tenantId)) ? parseInt(String(tenantId), 10) : tenantId
    const payload = await getPayload({ config })
    if (actor.strictTenant && data.site != null) await assertSiteInTenant(payload, actor, data.site)
    try {
        return await payload.create({
            collection: 'discounts',
            data: {
                ...data,
                tenant: toRelationId(tenantIdForPayload),
                site: data.site != null ? toRelationId(data.site) : null,
                status: data.status ?? 'active',
                usageCount: data.usageCount ?? 0,
            } as never,
            // overrideAccess: true — tenant comes from the caller (session / verified agent context), never from the
            // request body. false would trip Payload's relationship read-check on the restricted tenants collection.
            overrideAccess: true,
            // relations stay ids: a populated tenant / site row carries the shop's payment secrets (TC-PERF-136)
            depth: 0,
        })
    } catch (err) {
        if (isDuplicateDiscountCode(err)) throw duplicate()
        throw err
    }
}

/**
 * Change a discount as `user`. `usageCount` and `tenant` are stripped: never client-writable.
 * `expectedUpdatedAt`: the version the form loaded; a discount changed since throws VersionConflictError and nothing
 * is written (read-then-write in this request: a save landing between the check and the update still wins).
 */
export async function updateDiscountAs(actor: DiscountActor, id: string | number, patch: DiscountWriteData, expectedUpdatedAt?: string | null) {
    const payload = await getPayload({ config })
    const existing = await accessibleDiscount(payload, actor, id)
    assertFreshVersion(expectedUpdatedAt, existing.updatedAt)
    if (actor.strictTenant && patch.site != null) await assertSiteInTenant(payload, actor, patch.site)
    // usageCount has access.update:false on the collection, but defence-in-depth: strip explicitly here too
    const { usageCount: _usageCount, tenant: _tenant, ...safeData } = patch as Record<string, unknown>
    try {
        return await payload.update({ collection: 'discounts', id, data: safeData as never, user: actor.user, overrideAccess: false })
    } catch (err) {
        if (isDuplicateDiscountCode(err)) throw duplicate()
        throw err
    }
}

/** Switch a discount on or off (the status toggle of the form). */
export function setDiscountStatusAs(actor: DiscountActor, id: string | number, status: 'active' | 'inactive') {
    return updateDiscountAs(actor, id, { status })
}

/** Delete a discount as `user` (a hard delete: past orders keep what they paid). */
export async function deleteDiscountAs(actor: DiscountActor, id: string | number): Promise<void> {
    const payload = await getPayload({ config })
    await accessibleDiscount(payload, actor, id)
    await payload.delete({ collection: 'discounts', id, user: actor.user, overrideAccess: false })
}
