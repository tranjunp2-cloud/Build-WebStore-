import 'server-only'

import { getPayload, type User } from 'payload'
import { z } from 'zod'
import configPromise from '@payload-config'
import { tenantIdForQuery } from '@/lib/auth'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import {
    CATEGORY_LOCK_BUSY_ERROR,
    isCategoryLockTimeoutError,
    withCategoryMutationGate,
} from '@/lib/payload/category-row-lock'

/**
 * The Product Store categories' write rules, shared by the Categories page (its server actions) and
 * the copilot's category changes (applied as the approver): one name per parent, three levels,
 * a slug per tenant, delete refused while products are in it.
 */

// Explicit allowlist (GH-1587 M1) — replaces the former `.passthrough()`, which let a client
// smuggle arbitrary extra keys (`dna`, `tenant`, `site`, `deletedAt`, ...) into `rawData`. Zod's
// default object mode already strips unrecognized keys, so listing exactly the 5 real
// user-editable fields here is sufficient; no `.strict()` needed (that would throw instead of
// stripping, which risks breaking a legitimate caller that sends a harmless extra field).
export const CategoryServerSchema = z.object({
    // .trim() before .min() — otherwise a whitespace-only name (length >= 1 untrimmed) passes
    // validation here and only becomes empty after the `data.name.trim()` call below, reaching
    // payload.create/update as a blank name with no friendly error translated for it.
    name: z.string().trim().min(1, 'Name is required'),
    slug: z.string().optional(),
    parent: z.union([z.number(), z.string(), z.object({ id: z.union([z.number(), z.string()]) })]).nullable().optional(),
    depth: z.number().optional(),
    description: z.string().optional(),
});

const POSTGRES_INT4_MAX = 2_147_483_647

export function normalizeCategoryParentId(
    parent: string | number | { id: string | number } | null | undefined,
): number | null | undefined {
    if (parent == null) return parent

    const rawId = typeof parent === 'object' ? parent.id : parent
    if (typeof rawId === 'string' && !/^[1-9]\d*$/.test(rawId)) {
        throw new Error('CATEGORY_PARENT_ID_INVALID')
    }

    const parentId = typeof rawId === 'string' ? Number(rawId) : rawId
    if (
        !Number.isSafeInteger(parentId) ||
        parentId <= 0 ||
        parentId > POSTGRES_INT4_MAX
    ) {
        throw new Error('CATEGORY_PARENT_ID_INVALID')
    }

    return parentId
}

// Name dedup pre-check: case-insensitive + trimmed, scoped to (parent, tenant). Backend source
// of truth for CATEGORY_NAME_DUPLICATE — the client's debounced check is UX-only and races are
// expected/acceptable since this same query runs again here on submit.
export async function findDuplicateCategoryName(
    payload: Awaited<ReturnType<typeof getPayload>>,
    params: { name: string; parentId: string | number | null; tenantId: string | number; excludeId?: string | number }
): Promise<boolean> {
    const { sql } = await import('drizzle-orm')
    const { name, parentId, tenantId, excludeId } = params
    const parts = [
        sql`lower(trim(name)) = lower(trim(${name}))`,
        sql`tenant_id = ${tenantId}`,
        parentId ? sql`parent_id = ${parentId}` : sql`parent_id IS NULL`,
        sql`deleted_at IS NULL`,
        ...(excludeId ? [sql`id <> ${excludeId}`] : []),
    ]
    const result = await (payload.db as any).drizzle.execute(
        sql`SELECT id FROM categories WHERE ${sql.join(parts, sql` AND `)} LIMIT 1`
    )
    return result.rows.length > 0
}

// The `categories_tenant_slug_uniq` composite index (GH-1587 Phase 01) is raw-SQL, not a
// Payload-native `unique:true` field. UNLIKE `products_sku_tenant_uniq` (an expression index,
// `(tenant_id, lower(sku))`, whose nested `)` desyncs Payload's `Key (col)=(val)` detail-parsing
// regex — see products/actions.ts translateDbSkuConflict), this is a plain-column composite index
// `(tenant_id, slug)`, so Payload's regex DOES parse it successfully and resolves a path (verified
// empirically: `path: "tenant_id, slug"`, not `null`). Categories has no other Payload-native
// `unique:true` field since Phase 04 removed it from `slug` — this composite index is the ONLY
// possible source of a "Value must be unique" ValidationError on this collection, so match on the
// message alone (collection-scoped) rather than assuming an unresolved path.
function translateDbCategorySlugConflict(err: unknown): Error {
    const anyErr = err as { name?: string; data?: { collection?: string; errors?: Array<{ message?: string; path?: string | null }> } } | null | undefined
    const errors = anyErr?.data?.errors ?? []
    const isUnresolvedUniqueViolation =
        anyErr?.name === 'ValidationError' &&
        anyErr?.data?.collection === 'categories' &&
        errors.some(e => e?.message === 'Value must be unique')
    if (!isUnresolvedUniqueViolation) return err instanceof Error ? err : new Error(String(err))
    return new Error('CATEGORY_SLUG_DUPLICATE')
}

/** Create / rename / move / describe a category as `user` (Payload access + this tenant), the Categories page's rules. */
export async function saveCategoryAs(user: User, rawData: unknown, id?: string | number) {

    const data = CategoryServerSchema.parse(rawData);
    data.name = data.name.trim();
    try {
        data.parent = normalizeCategoryParentId(data.parent)
    } catch (error) {
        if (error instanceof Error && error.message === 'CATEGORY_PARENT_ID_INVALID') return { success: false, error: 'CATEGORY_PARENT_ID_INVALID' }
        throw error
    }

    const tenantId = tenantIdForQuery(user)
    const payload = await getPayload({ config: configPromise })

    // Security (GH-1587 H2/M1): `CategoryServerSchema` no longer accepts `tenant`/`site` at all
    // (allowlist above strips them), and both fields also carry `access: { update: () => false }`
    // on the collection now — so this is defense-in-depth, not the primary guard. Always force
    // the server-derived tenant, ignoring anything the client supplied. `site` is stripped
    // outright — it's never user-facing in this form; create's existing beforeChange hook
    // auto-derives it from `data.tenant`, and update never needs to change it.
    const writeData = data as Record<string, unknown>
    delete writeData.site
    if (tenantId) {
        writeData.tenant = tenantId
    } else {
        delete writeData.tenant
    }

    if (tenantId) {
        const isDuplicate = await findDuplicateCategoryName(payload, {
            name: data.name,
            parentId: data.parent ?? null,
            tenantId,
            excludeId: id,
        })
        if (isDuplicate) {
            return { success: false, error: 'CATEGORY_NAME_DUPLICATE' }
        }
    }

    if (id) {
        try {
            const res = await payload.update({
                collection: 'categories',
                id,
                data: data as never,
                user,
                overrideAccess: false,
            })
            return JSON.parse(JSON.stringify(res));
        } catch (updateErr) {
            const translated = translateDbCategorySlugConflict(updateErr)
            if (translated.message === 'CATEGORY_SLUG_DUPLICATE') return { success: false, error: 'CATEGORY_SLUG_DUPLICATE' }
            throw translated
        }
    } else {
        try {
            const res = await payload.create({
                collection: 'categories',
                data: data as never,
                user,
                overrideAccess: false,
            })
            return JSON.parse(JSON.stringify(res));
        } catch (createErr) {
            const translated = translateDbCategorySlugConflict(createErr)
            if (translated.message === 'CATEGORY_SLUG_DUPLICATE') return { success: false, error: 'CATEGORY_SLUG_DUPLICATE' }
            throw translated
        }
    }
}

/** Soft-delete a category as `user`: refused while it holds products; its children move up a level. */
export async function deleteCategoryAs(user: User, id: string | number) {

    const payload = await getPayload({ config: configPromise })

    // Access check FIRST: the delete SQL below runs with raw DB access, so we must confirm the
    // caller can actually access this category (Payload's tenant-scoped access rules) before any
    // lower-level operation happens. Throws if not found / not authorized for this tenant.
    const authorizedCategory = await payload.findByID({
        collection: 'categories',
        id,
        user,
        overrideAccess: false,
    })

    // All raw SQL, including super-admin operations, is scoped to the tenant of the category
    // that passed Payload access control. Relationships may be populated documents or raw IDs.
    const categoryTenant: unknown = (authorizedCategory as unknown as Record<string, unknown>).tenant
    const tenantId = typeof categoryTenant === 'object' && categoryTenant !== null && 'id' in categoryTenant
        ? categoryTenant.id
        : categoryTenant
    if (typeof tenantId !== 'string' && typeof tenantId !== 'number') {
        throw new Error('Product management is not available on your current plan.')
    }

    const isSuperAdmin = Boolean((user as { roles?: string[] }).roles?.includes('super-admin'))
    if (!isSuperAdmin) {
        const subscription = await getActivePlanSubscription(payload, tenantId)
        if (!subscription || !(await canUse(payload, subscription.plan as PlanCode, 'product_management'))) {
            throw new Error('Product management is not available on your current plan.')
        }
    }

    // The shared per-pool FIFO gate prevents same-process AI saves and deletes from consuming the
    // connections each other needs. Across instances, this FOR UPDATE conflicts with the AI
    // action's FOR KEY SHARE lock: either delete commits first and the AI lock finds no active row,
    // or Product creation commits first and the second statement's fresh READ COMMITTED snapshot
    // sees the relation. The recursive CTE from staging then reparents the complete descendant
    // subtree and rebuilds breadcrumbs in the same transaction.
    const { sql } = await import('drizzle-orm')
    type DeleteTransaction = { execute: (query: unknown) => Promise<unknown> }
    type DeleteDatabase = {
        drizzle: {
            transaction: <T>(
                operation: (transaction: DeleteTransaction) => Promise<T>,
                options?: unknown,
            ) => Promise<T>
        }
        transactionOptions?: unknown
    }
    const database = payload.db as unknown as DeleteDatabase
    let deleteResult: { rows: unknown[] }
    try {
        deleteResult = await withCategoryMutationGate(payload, () =>
            database.drizzle.transaction(async transaction => {
                // Bound cross-instance waiters so blocked delete transactions cannot pin every
                // database connection while the AI save holding FOR KEY SHARE needs one to commit.
                await transaction.execute(sql`SET LOCAL lock_timeout = '2s'`)
                await transaction.execute(sql`
                SELECT id
                FROM categories
                WHERE id = ${id}
                  AND tenant_id = ${tenantId}
                  AND deleted_at IS NULL
                FOR UPDATE
            `)

                return transaction.execute(sql`WITH RECURSIVE target AS (
                SELECT c.id, c.tenant_id
                FROM categories c
                WHERE c.id = ${id}
                  AND c.tenant_id = ${tenantId}
                  AND c.deleted_at IS NULL
            ),
            direct_products AS (
                SELECT COUNT(DISTINCT p.id)::int AS count
                FROM target t
                LEFT JOIN products_rels r
                    ON r.categories_id = t.id
                   AND r.path = 'category'
                LEFT JOIN products p
                    ON p.id = r.parent_id
                   AND p.deleted_at IS NULL
            ),
            children AS (
                SELECT c.id, c.name, c.tenant_id
                FROM categories c
                JOIN target t
                  ON c.parent_id = t.id
                 AND c.deleted_at IS NULL
                 AND c.tenant_id = t.tenant_id
                FOR UPDATE
            ),
            subtree AS (
                SELECT c.id, c.parent_id, c.name, c.tenant_id,
                       c.name::text AS new_breadcrumbs
                FROM categories c
                JOIN target t
                  ON c.parent_id = t.id
                 AND c.deleted_at IS NULL
                 AND c.tenant_id = t.tenant_id
                UNION ALL
                SELECT c.id, c.parent_id, c.name, c.tenant_id,
                       (s.new_breadcrumbs || ' > ' || c.name)::text
                FROM categories c
                JOIN subtree s ON c.parent_id = s.id
                WHERE c.deleted_at IS NULL
                  AND c.tenant_id = s.tenant_id
            ),
            root_conflicts AS (
                SELECT COUNT(*)::int AS count
                FROM children ch
                JOIN target t ON TRUE
                JOIN categories root
                  ON root.tenant_id = ch.tenant_id
                 AND root.parent_id IS NULL
                 AND root.deleted_at IS NULL
                 AND root.id <> ch.id
                 AND root.id <> t.id
                 AND lower(trim(root.name)) = lower(trim(ch.name))
            ),
            sibling_conflicts AS (
                SELECT COUNT(*)::int AS count
                FROM (
                    SELECT lower(trim(name)) AS normalized_name
                    FROM children
                    GROUP BY lower(trim(name))
                    HAVING COUNT(*) > 1
                ) dup
            ),
            conflicts AS (
                SELECT COALESCE((SELECT count FROM root_conflicts), 0) +
                       COALESCE((SELECT count FROM sibling_conflicts), 0) AS count
            ),
            reparent AS (
                UPDATE categories c
                SET parent_id = CASE WHEN c.parent_id = t.id THEN NULL ELSE c.parent_id END,
                    breadcrumbs = s.new_breadcrumbs,
                    updated_at = NOW()
                FROM target t, subtree s, direct_products dp, conflicts cf
                WHERE s.id = c.id
                  AND dp.count = 0
                  AND cf.count = 0
                RETURNING c.id
            ),
            soft_delete AS (
                UPDATE categories c
                SET deleted_at = NOW(),
                    updated_at = NOW()
                FROM target t, direct_products dp, conflicts cf
                WHERE c.id = t.id
                  AND dp.count = 0
                  AND cf.count = 0
                RETURNING c.*
            )
                SELECT
                    COALESCE((SELECT count FROM direct_products), 0) AS direct_count,
                    COALESCE((SELECT count FROM conflicts), 0) AS name_conflict_count,
                    COALESCE((SELECT COUNT(*)::int FROM reparent), 0) AS reparented_count,
                    EXISTS(SELECT 1 FROM soft_delete) AS deleted,
                    (SELECT row_to_json(sd) FROM soft_delete sd) AS deleted_doc`)
            }, database.transactionOptions),
        ) as { rows: unknown[] }
    } catch (error) {
        if (isCategoryLockTimeoutError(error)) throw new Error(CATEGORY_LOCK_BUSY_ERROR)
        throw error
    }

    const deleteRow = (deleteResult.rows[0] as {
        direct_count?: number
        name_conflict_count?: number
        deleted?: boolean
        deleted_doc?: Record<string, unknown> | null
    } | undefined) ?? {}

    const directCount = deleteRow.direct_count || 0
    if (directCount > 0) {
        return { success: false, error: 'CATEGORY_HAS_PRODUCTS', count: directCount }
    }

    const nameConflictCount = deleteRow.name_conflict_count || 0
    if (nameConflictCount > 0) {
        return { success: false, error: 'CATEGORY_REPARENT_NAME_CONFLICT', count: nameConflictCount }
    }

    if (!deleteRow.deleted || !deleteRow.deleted_doc) {
        throw new Error('Category delete failed. Please retry.')
    }

    const deletedDoc = deleteRow.deleted_doc as unknown as Record<string, unknown>
    const deletedAt = typeof deletedDoc.deletedAt === 'string'
        ? deletedDoc.deletedAt
        : (typeof deletedDoc.deleted_at === 'string' ? deletedDoc.deleted_at : new Date().toISOString())

    return JSON.parse(JSON.stringify({
        ...(authorizedCategory as unknown as Record<string, unknown>),
        deletedAt,
    }));
}
