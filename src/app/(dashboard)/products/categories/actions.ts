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
import { CATEGORY_POPULATE, deleteCategoryAs, findDuplicateCategoryName, normalizeCategoryParentId, saveCategoryAs } from '@/lib/products/category-service'

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
    const { sql } = await import('drizzle-orm')
    // The categories and their product counts are independent reads: run together. One categories statement
    // (no COUNT), tenant / site relations trimmed to names (TC-PERF-077).
    const categoriesPromise = payload.find({
        collection: 'categories',
        user,
        overrideAccess: false,
        where: { deletedAt: { exists: false } },
        depth: 1,
        limit: 1000,
        pagination: false,
        populate: CATEGORY_POPULATE,
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
    // Payload DB adapter types do not expose the drizzle instance directly
    const tId = tenantIdForQuery(user)
    const tenantFilter = tId ? sql`AND c.tenant_id = ${tId}` : sql``

    const [res, countResult] = await Promise.all([categoriesPromise, (payload.db as any).drizzle.execute(
        sql`SELECT r.categories_id as category_id, COUNT(DISTINCT r.parent_id)::int as count
            FROM products_rels r
            JOIN products p ON p.id = r.parent_id
            JOIN categories c ON c.id = r.categories_id
            WHERE r.path = 'category' AND p.deleted_at IS NULL ${tenantFilter}
            GROUP BY r.categories_id`
    )])

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

const MAX_AI_REVIEW_CATEGORIES = 1000

export type AiCategoryLoadResult =
    | { status: 'ready'; categories: AiCategoryOption[] }
    | { status: 'overflow'; maxCategories: number }

/** Complete-or-overflow category contract for the AI review modal. */
export async function getAiCategoriesAction(): Promise<AiCategoryLoadResult> {
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
        // Fetch one sentinel row so the modal never receives a truncated hierarchy.
        limit: MAX_AI_REVIEW_CATEGORIES + 1,
        sort: ['breadcrumbs', 'id'],
        select: {
            name: true,
            parent: true,
            breadcrumbs: true,
        },
    })

    if (
        result.docs.length > MAX_AI_REVIEW_CATEGORIES
        || result.hasNextPage === true
        || (
            typeof result.totalDocs === 'number'
            && result.totalDocs > MAX_AI_REVIEW_CATEGORIES
        )
    ) {
        return {
            status: 'overflow',
            maxCategories: MAX_AI_REVIEW_CATEGORIES,
        }
    }

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

    return { status: 'ready', categories: options }
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

export async function checkCategoryNameAvailable(name: string, parentId: string | number | null, excludeId?: string | number): Promise<boolean> {
    const user = await getCurrentUser()
    if (!user) return false
    const tenantId = tenantIdForQuery(user)
    if (!tenantId || !name.trim()) return true

    let normalizedParentId: number | null = null
    let normalizedExcludeId: number | undefined
    try {
        normalizedParentId = normalizeCategoryParentId(parentId) ?? null
        normalizedExcludeId = excludeId == null ? undefined : (normalizeCategoryParentId(excludeId) ?? undefined)
    } catch {
        return false
    }
    const payload = await getPayload({ config: configPromise })
    const isDuplicate = await findDuplicateCategoryName(payload, { name, parentId: normalizedParentId, tenantId, excludeId: normalizedExcludeId })
    return !isDuplicate
}

export async function saveCategoryAction(rawData: unknown, id?: string | number) {
    const user = await getCurrentUser()
    if (!user) {
        throw new Error('Unauthorized')
    }
    return saveCategoryAs(user as never, rawData, id)
}

export async function deleteCategoryAction(id: string | number) {
    const user = await getCurrentUser()
    if (!user) {
        throw new Error('Unauthorized')
    }
    return deleteCategoryAs(user as never, id)
}
