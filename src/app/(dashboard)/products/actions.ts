'use server'

import { getPayload, type Where } from 'payload'
import configPromise from '@payload-config'
import { getCurrentUser, tenantIdForQuery } from '@/lib/auth'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'
import type { PlanCode } from '@/collections/PlanSubscriptions'

// Upper bound for SKU conflict query results. If totalDocs exceeds this, the save is aborted
// with a user-facing error. In practice a single SKU or small batch rarely matches > 100 products.
// NOTE: This check is best-effort UX — two limitations apply:
//   1. NOT concurrent-safe: two parallel saves with the same SKU can both pass this check.
//   2. Case-sensitive match only: the `in:` query generates SQL IN (...) which is case-sensitive
//      on Postgres. "ABC-001" and "abc-001" are treated as distinct SKUs here. For true
//      case-insensitive enforcement, add a DB-level UNIQUE index on lower(sku) per tenant.
// A DB-level constraint (ideally case-insensitive) is the authoritative integrity guarantee.
const SKU_CONFLICT_QUERY_LIMIT = 100

async function findConflictingSkus(
    payload: Awaited<ReturnType<typeof getPayload>>,
    skus: string[],
    tenantId: string | number | null,
    excludeId?: number
): Promise<string[]> {
    if (skus.length === 0) return []
    // When tenantId is null (super-admin or single-tenant setup) no tenant filter is applied —
    // the query spans all tenants. This is intentional: null-tenant users should not be able
    // to create SKUs that conflict with any tenant's products.
    const where: Where = {
        and: [
            { deletedAt: { exists: false } },
            ...(tenantId ? [{ tenant: { equals: tenantId } }] : []),
            ...(excludeId ? [{ id: { not_equals: excludeId } }] : []),
            // Payload 3 dotted-path on array sub-fields (variants.sku → JOIN products_variants).
            // WHERE shape locked by TC-F08-SKU-GLOBAL-10.
            { or: [
                { sku: { in: skus } },
                { 'variants.sku': { in: skus } },
            ]},
        ],
    }
    const result = await payload.find({ collection: 'products', where, limit: SKU_CONFLICT_QUERY_LIMIT, depth: 0 })
    if (result.docs.length === 0) return []
    if (result.totalDocs > result.docs.length) {
        throw new Error(
            'Cannot verify SKU uniqueness: your account has too many matching products. Please contact support.'
        )
    }
    // Case-fold both sides so the application-layer check is case-insensitive.
    // The SQL IN query above is case-sensitive, so this only catches exact-case matches
    // returned by the DB — it does NOT detect cross-case conflicts (e.g. "ABC" vs "abc").
    const skusLower = new Set(skus.map(s => s.toLowerCase()))
    const matched = new Set<string>()
    for (const doc of result.docs) {
        if (typeof doc.sku === 'string' && skusLower.has(doc.sku.toLowerCase())) matched.add(doc.sku)
        if (Array.isArray(doc.variants)) {
            for (const v of doc.variants as Array<{ sku?: string }>) {
                if (v?.sku && typeof v.sku === 'string' && skusLower.has(v.sku.toLowerCase())) matched.add(v.sku)
            }
        }
    }
    return Array.from(matched)
}

export async function getProductsAction() {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    // Fix B: coerce to number so payload WHERE matches Neon integer FK (tenant_id integer)
    const tenantId = tenantIdForQuery(user)
    const payload = await getPayload({ config: configPromise })
    const res = await payload.find({
        collection: 'products',
        user,
        where: {
            and: [
                { deletedAt: { exists: false } },
                ...(tenantId != null ? [{ tenant: { equals: tenantId } }] : []),
            ],
        },
        limit: 100,
        depth: 1
    })
    return JSON.parse(JSON.stringify(res.docs))
}

export async function getProductAction(id: string | number) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const payload = await getPayload({ config: configPromise })
    const res = await payload.findByID({
        collection: 'products',
        id,
        user,
        depth: 1
    })
    return JSON.parse(JSON.stringify(res))
}

import { z } from 'zod'

const ProductServerSchema = z.object({
    name: z.string().min(3, "Name must be at least 3 characters"),
    images: z.array(z.object({
        image: z.union([z.string(), z.number(), z.record(z.unknown())]).optional(),
        alt: z.string().optional()
    })).optional(),
}).passthrough();

export async function saveProductAction(rawData: unknown, id?: string | number) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const data = ProductServerSchema.parse(rawData);

    const payload = await getPayload({ config: configPromise })

    const candidateSkus = [
        ...(typeof data.sku === 'string' && data.sku.trim() ? [data.sku.trim()] : []),
        ...((data.variants as Array<{ sku?: string }> | undefined) || [])
            .map(v => typeof v.sku === 'string' ? v.sku.trim() : '')
            .filter(Boolean),
    ]
    // Fix B: coerce to number so SKU scope and tenant filter match Neon integer FK
    const tenantId = tenantIdForQuery(user)
    const numId = id ? (typeof id === 'string' ? parseInt(id, 10) : id) : undefined
    if (numId !== undefined && Number.isNaN(numId)) throw new Error('Invalid product ID')
    const conflicts = await findConflictingSkus(payload, candidateSkus, tenantId, numId)

    if (conflicts.length > 0) {
        const conflictsLower = new Set(conflicts.map(s => s.toLowerCase()))
        const fieldErrors: Record<string, { code: string; values: string[] }> = {}

        if (typeof data.sku === 'string' && data.sku.trim() && conflictsLower.has(data.sku.trim().toLowerCase())) {
            fieldErrors['baseSku'] = { code: 'SKU_ALREADY_IN_USE', values: [data.sku.trim()] }
        }
        const variants = (data.variants as Array<{ sku?: string }> | undefined) || []
        variants.forEach((v, i) => {
            if (typeof v?.sku === 'string' && v.sku.trim() && conflictsLower.has(v.sku.trim().toLowerCase())) {
                fieldErrors[`variants.${i}.skuCode`] = { code: 'SKU_ALREADY_IN_USE', values: [v.sku.trim()] }
            }
        })

        throw new Error(JSON.stringify({
            code: 'FIELD_ERRORS',
            fieldErrors,
            message: `SKU already in use: ${conflicts.join(', ')}`,
        }))
    }

    // Automatically attach default placeholder image if none provided
    if (!data.images || data.images.length === 0) {
        try {
            const { getOrCreateCrateCartonIdAction } = await import('@/app/(dashboard)/actions/media')
            const cartonId = await getOrCreateCrateCartonIdAction()
            if (cartonId) {
                data.images = [{ image: cartonId, alt: data.name || 'Placeholder Image' }]
            }
        } catch (err) {
            console.error('Failed to attach placeholder image', err)
        }
    }
    
    if (id) {
        const res = await payload.update({
            collection: 'products',
            id,
            data,
            user,
            overrideAccess: false,
        })
        return JSON.parse(JSON.stringify(res))
    } else {
        // Fix A: explicitly set tenant so the product is always scoped to the user's tenant.
        // beforeChangeHook injects it too, but only if req.user.tenants is populated — this
        // guarantees the write even when tenants aren't deeply populated in the server action ctx.
        if (tenantId != null) (data as Record<string, unknown>).tenant = tenantId

        try {
            const res = await payload.create({
                collection: 'products',
                data,
                user,
                overrideAccess: false,
                // Bypass Payload/Drizzle transaction: commitTransaction silently swallows COMMIT
                // errors (done.catch(()=>{}) in beginTransaction absorbs PostgreSQL commit failures),
                // so products appear created but are rolled back. Without a transaction each INSERT
                // auto-commits, avoiding the silent-commit-failure bug. Tradeoff: if variants INSERT
                // fails after the products row commits, the product row stays with no variants;
                // that failure still propagates to the user via handleUpsertError → throw.
                disableTransaction: true,
            })
            // Verify the product actually exists in DB — detects silent Payload/Drizzle commit failures
            // where commitTransaction swallows COMMIT errors and returns the doc as if it succeeded.
            try {
                const verify = await payload.findByID({ collection: 'products', id: res.id, overrideAccess: true, depth: 0 })
                if (!verify?.id) {
                    console.error('[products.create] VERIFY FAILED — product not in DB after create!', { id: res?.id })
                    throw new Error('Product was not saved. Please try again.')
                }
            } catch (verifyErr) {
                if ((verifyErr as Error)?.message === 'Product was not saved. Please try again.') throw verifyErr
                console.error('[products.create] VERIFY ERROR', { id: res?.id, verifyErr })
                throw new Error('Product was not saved. Please try again.')
            }
            return JSON.parse(JSON.stringify(res))
        } catch (createErr) {
            console.error('[products.create] failed', {
                tenant: tenantId,
                name: (data as Record<string, unknown>).name,
                err: createErr,
            })
            throw createErr
        }
    }
}

const ProductFieldUpdateSchema = z.union([
    z.object({ status: z.enum(['draft', 'active', 'archived']) }),
    z.object({ deletedAt: z.string().datetime({ offset: true }).nullable() }),
])

export async function updateProductFieldAction(id: string | number, data: unknown) {
    if (!id && id !== 0) throw new Error('Invalid product ID')

    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const validated = ProductFieldUpdateSchema.parse(data)
    const payload = await getPayload({ config: configPromise })

    // Subscription gate — checked here because the update below uses overrideAccess: true
    // (required to work around a Payload 3.79 bug with variant array 'id' fields).
    // Fix B: coerce to number so getActivePlanSubscription WHERE matches Neon integer FK
    const tenantId = tenantIdForQuery(user)
    if (tenantId != null) {
        const sub = await getActivePlanSubscription(payload, tenantId)
        if (!sub || !(await canUse(payload, sub.plan as PlanCode, 'product_management'))) {
            throw new Error('Product management is not available on your current plan.')
        }
    }

    // Tenant-scoped existence check — rejects updates on products not belonging to this tenant.
    // depth:0 returns raw IDs (no populated objects) so variants/variantConfigs come back
    // as plain objects ready to be re-passed to update.
    const existing = await payload.findByID({
        collection: 'products', id, user, depth: 0, overrideAccess: false, disableErrors: true,
    })
    if (!existing) throw new Error('Product not found or access denied')

    // Payload 3.79 Drizzle updateOne internally fetches the existing doc, merges it with the
    // incoming data, then runs traverseFields on the merged result. Variant array rows have an
    // auto-managed UUID 'id' that is NOT in user-defined field definitions, so traverseFields
    // throws "The following field is invalid: id" for every product that has variants.
    // Providing the arrays explicitly (stripped of the auto-managed 'id') prevents the internal
    // fetch+merge and bypasses this Payload bug.
    // KNOWN LIMITATION: reads then re-writes variants — a concurrent variant edit between the
    // findByID and update calls will lose the concurrent change. Acceptable in practice: status/
    // deletedAt toggles are fast operations; variant edits are slow UI-driven flows.
    const stripIds = (arr: unknown): unknown[] => {
        if (!Array.isArray(arr)) return []
        return arr.map((item) => {
            if (!item || typeof item !== 'object') return item
            const { id: _, ...rest } = item as Record<string, unknown>
            if (!Array.isArray(rest.options)) return rest
            return {
                ...rest,
                options: (rest.options as Record<string, unknown>[]).map((opt) => {
                    if (!opt || typeof opt !== 'object') return opt
                    const { id: _2, ...o } = opt as Record<string, unknown>
                    return o
                }),
            }
        })
    }

    // Coerce id to integer — Neon strict-mode requires INTEGER for _parent_id JOIN columns.
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id
    if (Number.isNaN(numericId)) throw new Error('Invalid product ID')

    const res = await payload.update({
        collection: 'products',
        id: numericId,
        data: {
            ...validated,
            variants: stripIds(existing.variants),
            variantConfigs: stripIds(existing.variantConfigs),
        },
        overrideAccess: true,
    })
    return JSON.parse(JSON.stringify(res))
}

export async function deleteProductAction(id: string | number) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const payload = await getPayload({ config: configPromise })
    const res = await payload.update({
        collection: 'products',
        id,
        data: {
            deletedAt: new Date().toISOString(),
        },
        user,
        overrideAccess: false,
    })
    return JSON.parse(JSON.stringify(res))
}
