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

/** The unique index on (tenant_id, upper(code)) — Payload surfaces it as a "duplicate" / "unique" message or Postgres 23505. */
export function isDuplicateDiscountCode(err: unknown): boolean {
    const e = err as { message?: string; code?: string; cause?: { code?: string } } | null
    return Boolean(e?.message?.includes('duplicate') || e?.message?.includes('unique') || e?.code === '23505' || e?.cause?.code === '23505')
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
