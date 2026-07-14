'use server'

import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCurrentUser, tenantIdForQuery } from '@/lib/auth'

export async function getCategoriesAction() {
    const user = await getCurrentUser()
    if (!user) {
        throw new Error('Unauthorized')
    }

    const payload = await getPayload({ config: configPromise })
    
    const res = await payload.find({
        collection: 'categories',
        user,
        where: { deletedAt: { exists: false } },
        depth: 1,
        limit: 1000,
    })

    const getDescendantIds = (parentId: string | number, allCats: Array<{ id: string | number; parent?: string | number | { id: string | number } | null }>): (string | number)[] => {
        const children = allCats.filter(c => {
            const pId = typeof c.parent === 'object' && c.parent !== null ? c.parent.id : c.parent;
            return pId === parentId;
        });
        const childIds = children.map(c => c.id);
        const descendantIds = childIds.flatMap(id => getDescendantIds(id, allCats));
        return [...childIds, ...descendantIds];
    };

    // Solve N+1 & Compute Efficiently: Group by in Database to prevent loading all Product records to RAM
    const { sql } = await import('drizzle-orm')
    const countResult = await (payload.db as any).drizzle.execute(
        sql`SELECT r.categories_id as category_id, COUNT(DISTINCT r.parent_id)::int as count
            FROM products_rels r
            JOIN products p ON p.id = r.parent_id
            JOIN categories c ON c.id = r.categories_id
            WHERE r.path = 'category' AND p.deleted_at IS NULL AND c.tenant_id = p.tenant_id
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

// Explicit allowlist (GH-1587 M1) — replaces the former `.passthrough()`, which let a client
// smuggle arbitrary extra keys (`dna`, `tenant`, `site`, `deletedAt`, ...) into `rawData`. Zod's
// default object mode already strips unrecognized keys, so listing exactly the 5 real
// user-editable fields here is sufficient; no `.strict()` needed (that would throw instead of
// stripping, which risks breaking a legitimate caller that sends a harmless extra field).
const CategoryServerSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    slug: z.string().optional(),
    parent: z.union([z.number(), z.string(), z.record(z.unknown())]).nullable().optional(),
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

    // Access check FIRST: the count query below is raw SQL with no tenant scoping, so we must
    // confirm the caller can actually access this category (Payload's tenant-scoped access
    // rules) before running it — otherwise directCount would leak another tenant's product
    // count via the thrown error message. Throws if not found / not authorized for this tenant.
    await payload.findByID({
        collection: 'categories',
        id,
        user,
        overrideAccess: false,
    })

    // Hard-block: count products assigned DIRECTLY to this category only (not descendants —
    // direct children are re-parented to top-level below, so descendant products no longer
    // sit under this node once the delete completes). [Decision: direct-only, confirmed 2026-07-10]
    const { sql } = await import('drizzle-orm')
    const countResult = await (payload.db as any).drizzle.execute(
        sql`SELECT COUNT(DISTINCT r.parent_id)::int as count
            FROM products_rels r
            JOIN products p ON p.id = r.parent_id
            WHERE r.path = 'category' AND r.categories_id = ${id} AND p.deleted_at IS NULL`
    )
    const directCount = (countResult.rows[0] as { count?: number } | undefined)?.count || 0
    if (directCount > 0) {
        throw new Error(`CATEGORY_HAS_PRODUCTS:${directCount}`)
    }

    // Re-parent direct children to top-level before soft-deleting self. Uses payload.update
    // (not raw SQL) so the beforeChange breadcrumb-regen hook fires for each child.
    // Known limitation: this bypasses saveCategoryAction's name-dedup pre-check, so a re-parented
    // child could end up sharing a name with an existing top-level category. Same risk class as
    // the accepted "no DB backstop for name dedup" limitation already documented in Phase 04 —
    // low blast radius (no crash, name isn't DB-unique), not fixed here to avoid scope creep
    // beyond GH-1587's stated requirements.
    const children = await payload.find({
        collection: 'categories',
        where: { parent: { equals: id }, deletedAt: { exists: false } },
        limit: 1000,
        user,
        overrideAccess: false,
    })
    for (const child of children.docs) {
        // overrideAccess:true — access already gated by the findByID check above; skips the
        // (async, subscription-plan-checking) collection-level access.update re-evaluation per
        // child since this is an internal system write, not a client-driven one. (GH-1587 H1)
        await payload.update({
            collection: 'categories',
            id: child.id,
            data: { parent: null },
            user,
            overrideAccess: true,
        })
    }

    // overrideAccess:true — `deletedAt` now carries `access: { update: () => false }` (GH-1587
    // H1), which would silently strip this write under overrideAccess:false. Access to this
    // category was already verified by the findByID check at the top of this function.
    const res = await payload.update({
        collection: 'categories',
        id,
        data: {
            deletedAt: new Date().toISOString(),
        },
        user,
        overrideAccess: true,
    })
    return JSON.parse(JSON.stringify(res));
}
