'use server'

import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCurrentUser, tenantIdForQuery } from '@/lib/auth'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import {
    CATEGORY_LOCK_BUSY_ERROR,
    isCategoryLockTimeoutError,
    withCategoryMutationGate,
} from '@/lib/payload/category-row-lock'

export async function getCategoriesAction() {
    const user = await getCurrentUser()
    if (!user) {
        throw new Error('Unauthorized')
    }

    const payload = await getPayload({ config: configPromise })

    // Security: Payload's Local API defaults `overrideAccess` to `true` when omitted — this call
    // was missing the explicit `false`, so Categories.ts's `read` access control (tenant-scoped
    // `{tenant:{in:tenantIds}}` Where-filter) was silently bypassed entirely. Any logged-in user
    // saw every tenant's categories + aggregated cross-tenant product counts on this dashboard
    // page. Pre-existing bug, unrelated to GH-1587's own changes — found via manual QA on this PR.
    const res = await payload.find({
        collection: 'categories',
        user,
        overrideAccess: false,
        where: { deletedAt: { exists: false } },
        depth: 1,
        limit: 1000,
    })

    const getDescendantIds = (parentId: string | number, allCats: Array<{ id: string | number; parent?: string | number | { id: string | number } | null }>, visited = new Set<string>()): (string | number)[] => {
        if (visited.has(String(parentId))) return [];
        visited.add(String(parentId));
        const children = allCats.filter(c => {
            const pId = typeof c.parent === 'object' && c.parent !== null ? c.parent.id : c.parent;
            return pId === parentId;
        });
        const childIds = children.map(c => c.id);
        const descendantIds = childIds.flatMap(id => getDescendantIds(id, allCats, visited));
        return [...childIds, ...descendantIds];
    };

    // Solve N+1 & Compute Efficiently: Group by in Database to prevent loading all Product records to RAM
    const { sql } = await import('drizzle-orm')
    // Payload DB adapter types do not expose the drizzle instance directly
    const tId = tenantIdForQuery(user)
    const tenantFilter = tId ? sql`AND c.tenant_id = ${tId}` : sql``

    const countResult = await (payload.db as any).drizzle.execute(
        sql`SELECT r.categories_id as category_id, COUNT(DISTINCT r.parent_id)::int as count
            FROM products_rels r
            JOIN products p ON p.id = r.parent_id
            JOIN categories c ON c.id = r.categories_id
            WHERE r.path = 'category' AND p.deleted_at IS NULL ${tenantFilter}
            GROUP BY r.categories_id`
    )

    const categoryCountMap: Record<string | number, number> = {}
    for (const row of countResult.rows as Array<{ category_id?: number | string | null; count: number }>) {
        if (row.category_id) {
            categoryCountMap[row.category_id] = row.count;
        }
    }

    const categoriesWithCount = res.docs.map((cat) => {
        const allIds = [cat.id, ...getDescendantIds(cat.id, res.docs)]
        let productCount = 0;
        for (const id of allIds) {
            productCount += categoryCountMap[id] || 0;
        }
        
        return {
            ...cat,
            productCount,
        }
    })

    return JSON.parse(JSON.stringify(categoriesWithCount));
}

import { z } from 'zod';

const CategoryIdSchema = z.union([
    z.number().int().positive().max(2_147_483_647),
    z.string()
        .trim()
        .regex(/^[1-9]\d*$/)
        .transform(Number)
        .refine(
            id => Number.isSafeInteger(id) && id <= 2_147_483_647,
            'Category ID must be a positive PostgreSQL integer',
        ),
])

const MAX_CATEGORY_IDS_PER_REQUEST = 200

const CategoryIdListSchema = z.array(CategoryIdSchema)
    .transform(ids => [...new Set(ids)])
    .pipe(z.array(z.number()).max(MAX_CATEGORY_IDS_PER_REQUEST))

function parseCategoryIds(rawIds: unknown): number[] {
    // Reject before Zod walks/transforms every entry. The Server Action body limit is 50 MB,
    // so applying the ceiling only after dedupe would still allow expensive duplicate floods.
    if (!Array.isArray(rawIds) || rawIds.length > MAX_CATEGORY_IDS_PER_REQUEST) {
        throw new Error(`Category ID list must contain at most ${MAX_CATEGORY_IDS_PER_REQUEST} items`)
    }
    return CategoryIdListSchema.parse(rawIds)
}

export type AiCategoryOption = {
    id: string | number
    name: string
    breadcrumbs?: string
    parent?: string | number | { id: string | number } | null
}

/** Lightweight category contract for the AI review modal. */
export async function getAiCategoriesAction(): Promise<AiCategoryOption[]> {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const tenantId = tenantIdForQuery(user)
    if (tenantId == null) throw new Error('Unauthorized')

    const payload = await getPayload({ config: configPromise })
    const result = await payload.find({
        collection: 'categories',
        user,
        overrideAccess: false,
        where: {
            and: [
                { tenant: { equals: tenantId } },
                { deletedAt: { exists: false } },
            ],
        },
        depth: 0,
        limit: 1000,
        sort: ['breadcrumbs', 'id'],
        select: {
            name: true,
            parent: true,
            breadcrumbs: true,
        },
    })

    const options: AiCategoryOption[] = []
    for (const category of result.docs) {
        if (typeof category.name !== 'string') continue

        const rawParent: unknown = category.parent
        let parent: AiCategoryOption['parent'] = null
        if (typeof rawParent === 'string' || typeof rawParent === 'number') {
            parent = rawParent
        } else if (typeof rawParent === 'object' && rawParent !== null && 'id' in rawParent) {
            const parentId = rawParent.id
            if (typeof parentId === 'string' || typeof parentId === 'number') {
                parent = { id: parentId }
            }
        }

        options.push({
            id: category.id,
            name: category.name,
            ...(typeof category.breadcrumbs === 'string'
                ? { breadcrumbs: category.breadcrumbs }
                : {}),
            parent,
        })
    }

    return options
}

/** Revalidate selected categories against the current tenant before any AI save side effect. */
export async function getCategoriesByIdsAction(rawIds: unknown): Promise<Array<{ id: string | number }>> {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const tenantId = tenantIdForQuery(user)
    if (tenantId == null) throw new Error('Unauthorized')

    const categoryIds = parseCategoryIds(rawIds)
    if (categoryIds.length === 0) return []

    const payload = await getPayload({ config: configPromise })
    const result = await payload.find({
        collection: 'categories',
        user,
        overrideAccess: false,
        where: {
            and: [
                { id: { in: categoryIds } },
                { tenant: { equals: tenantId } },
                { deletedAt: { exists: false } },
            ],
        },
        depth: 0,
        limit: categoryIds.length,
        sort: 'id',
        select: { id: true },
    })

    return result.docs.map(category => ({ id: category.id }))
}

// Explicit allowlist (GH-1587 M1) — replaces the former `.passthrough()`, which let a client
// smuggle arbitrary extra keys (`dna`, `tenant`, `site`, `deletedAt`, ...) into `rawData`. Zod's
// default object mode already strips unrecognized keys, so listing exactly the 5 real
// user-editable fields here is sufficient; no `.strict()` needed (that would throw instead of
// stripping, which risks breaking a legitimate caller that sends a harmless extra field).
const CategoryServerSchema = z.object({
    // .trim() before .min() — otherwise a whitespace-only name (length >= 1 untrimmed) passes
    // validation here and only becomes empty after the `data.name.trim()` call below, reaching
    // payload.create/update as a blank name with no friendly error translated for it.
    name: z.string().trim().min(1, 'Name is required'),
    slug: z.string().optional(),
    parent: z.union([z.number(), z.string(), z.object({ id: z.union([z.number(), z.string()]) })]).nullable().optional(),
    depth: z.number().optional(),
    description: z.string().optional(),
});

// Name dedup pre-check: case-insensitive + trimmed, scoped to (parent, tenant). Backend source
// of truth for CATEGORY_NAME_DUPLICATE — the client's debounced check is UX-only and races are
// expected/acceptable since this same query runs again here on submit.
async function findDuplicateCategoryName(
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

export async function checkCategoryNameAvailable(name: string, parentId: string | number | null, excludeId?: string | number): Promise<boolean> {
    const user = await getCurrentUser()
    if (!user) return false
    const tenantId = tenantIdForQuery(user)
    if (!tenantId || !name.trim()) return true

    const payload = await getPayload({ config: configPromise })
    const isDuplicate = await findDuplicateCategoryName(payload, { name, parentId, tenantId, excludeId })
    return !isDuplicate
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

export async function saveCategoryAction(rawData: unknown, id?: string | number) {
    const user = await getCurrentUser()
    if (!user) {
        throw new Error('Unauthorized')
    }

    const data = CategoryServerSchema.parse(rawData);
    data.name = data.name.trim();

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
        const rawParent = data.parent
        const parentId: string | number | null = rawParent && typeof rawParent === 'object'
            ? (rawParent as { id: string | number }).id
            : (rawParent as string | number | null | undefined) ?? null
        const isDuplicate = await findDuplicateCategoryName(payload, {
            name: data.name,
            parentId,
            tenantId,
            excludeId: id,
        })
        if (isDuplicate) {
            throw new Error('CATEGORY_NAME_DUPLICATE')
        }
    }

    if (id) {
        try {
            const res = await payload.update({
                collection: 'categories',
                id,
                data,
                user,
                overrideAccess: false,
            })
            return JSON.parse(JSON.stringify(res));
        } catch (updateErr) {
            throw translateDbCategorySlugConflict(updateErr)
        }
    } else {
        try {
            const res = await payload.create({
                collection: 'categories',
                data,
                user,
                overrideAccess: false,
            })
            return JSON.parse(JSON.stringify(res));
        } catch (createErr) {
            throw translateDbCategorySlugConflict(createErr)
        }
    }
}

export async function deleteCategoryAction(id: string | number) {
    const user = await getCurrentUser()
    if (!user) {
        throw new Error('Unauthorized')
    }

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

    const rawCategoryTenant: unknown = (authorizedCategory as Record<string, unknown>).tenant
    const tenantId = typeof rawCategoryTenant === 'object' && rawCategoryTenant !== null && 'id' in rawCategoryTenant
        ? rawCategoryTenant.id
        : rawCategoryTenant
    if (typeof tenantId !== 'string' && typeof tenantId !== 'number') {
        throw new Error('Category tenant is unavailable')
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
    // sees the relation. Keeping FOR UPDATE inside the count CTE would retain the pre-wait snapshot.
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

                return transaction.execute(sql`WITH target AS (
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
                SET parent_id = NULL,
                    breadcrumbs = c.name,
                    updated_at = NOW()
                FROM target t, direct_products dp, conflicts cf
                WHERE c.parent_id = t.id
                  AND c.deleted_at IS NULL
                  AND c.tenant_id = t.tenant_id
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
        throw new Error(`CATEGORY_HAS_PRODUCTS:${directCount}`)
    }

    const nameConflictCount = deleteRow.name_conflict_count || 0
    if (nameConflictCount > 0) {
        throw new Error(`CATEGORY_REPARENT_NAME_CONFLICT:${nameConflictCount}`)
    }

    if (!deleteRow.deleted || !deleteRow.deleted_doc) {
        throw new Error('Category delete failed. Please retry.')
    }

    const deletedDoc = deleteRow.deleted_doc as Record<string, unknown>
    const deletedAt = typeof deletedDoc.deletedAt === 'string'
        ? deletedDoc.deletedAt
        : (typeof deletedDoc.deleted_at === 'string' ? deletedDoc.deleted_at : new Date().toISOString())

    return JSON.parse(JSON.stringify({
        ...(authorizedCategory as Record<string, unknown>),
        deletedAt,
    }));
}
