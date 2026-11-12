'use server'

import { getPayload, type Where } from 'payload'
import configPromise from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'
import type { PlanCode } from '@/collections/PlanSubscriptions'

// ─── Types & Helpers (shared with the AI copilot via @/lib/blog/save-blog) ──
import {
    BLOG_POPULATE,
    getTenantId,
    isSuperAdmin,
    saveBlogForUser,
    unwrapRelationId,
    validateBlogCategoryForTenant,
    type PayloadClient,
    type PayloadUser,
    type SaveBlogInput,
    type UserWithTenants,
} from '@/lib/blog/save-blog'
import { BLOG_CATEGORY_DUPLICATE_CODE, blogCategoryNameTaken, toBlogCategorySlug } from '@/lib/blog/blog-category-name'

// ─── Blog Categories ───────────────────────────────────────────────────────
export async function getBlogCategoriesAction() {
    const user = await getCurrentUser()
    if (!user) return []

    const payload = await getPayload({ config: configPromise })

    // Get the first tenant from user's tenants array
    const typedUser = user as UserWithTenants
    const tenantId = getTenantId(typedUser)
    if (!isSuperAdmin(typedUser) && !tenantId) return []

    // Apply tenant filtering + exclude soft-deleted
    const conditions: Where[] = [
        { status: { not_equals: 'deleted' } },
    ]
    if (tenantId) conditions.push({ tenant: { equals: tenantId } })
    const where: Where = { and: conditions }

    const result = await payload.find({
        collection: 'blog_categories',
        where,
        limit: 100,
        sort: '-createdAt',
        pagination: false,
        depth: 1,
        populate: BLOG_POPULATE,
    })

    return JSON.parse(JSON.stringify(result.docs))
}

export async function createBlogCategoryAction(data: { name: string }) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0 || data.name.length > 80) {
        return { error: 'Validation Error: Name must be between 1 and 80 characters' }
    }

    const payload = await getPayload({ config: configPromise })
    const tenantId = getTenantId(user as UserWithTenants)

    if (tenantId != null) {
        const sub = await getActivePlanSubscription(payload, tenantId)
        if (!sub || !await canUse(payload, sub.plan as PlanCode, 'content_management')) {
            return { error: 'Content management is not available on your current plan.' }
        }
    }

    let siteId = null
    if (tenantId) {
        const siteRes = await payload.find({
            collection: 'sites',
            where: { tenant: { equals: tenantId } },
            limit: 1
        })
        if (siteRes.docs.length > 0) {
            siteId = siteRes.docs[0].id
        }
    }

    // Same rule as POST /api/blog-categories, so both screens give one URL per name (GH-2317)
    const slug = toBlogCategorySlug(data.name)

    // Case-insensitive, like the (tenant, slug) index: "recent news" used to slip past an exact-name
    // check and fail on the index with a generic error (GH-2265).
    if (tenantId != null && await blogCategoryNameTaken(payload, { tenantId, name: data.name })) {
        return { error: 'A category with this name already exists', code: BLOG_CATEGORY_DUPLICATE_CODE }
    }

    try {
        const result = await payload.create({
            collection: 'blog_categories',
            data: {
                name: data.name.trim(),
                slug: slug,
                tenant: tenantId,
                site: siteId,
            } as Record<string, unknown>,
            user: user as PayloadUser,
            depth: 1,
            populate: BLOG_POPULATE, // writes answer like the reads: no whole tenant / user rows (TC-PERF-130)
        })
        return JSON.parse(JSON.stringify(result))
    } catch (e: unknown) {
        console.error('Failed to create category:', e)
        return { error: 'Failed to create category' }
    }
}

export async function updateBlogCategoryAction(id: string, data: { name: string }) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0 || data.name.length > 80) {
        return { error: 'Validation Error: Name must be between 1 and 80 characters' }
    }

    const payload = await getPayload({ config: configPromise })

    try {
        // Check Tenant Isolation
        const existing = await payload.findByID({ collection: 'blog_categories', id })
        const tenantId = getTenantId(user as UserWithTenants)

        if (tenantId != null) {
            const sub = await getActivePlanSubscription(payload, tenantId)
            if (!sub || !await canUse(payload, sub.plan as PlanCode, 'content_management')) {
                return { error: 'Content management is not available on your current plan.' }
            }
        }

        const catTenantId = typeof existing.tenant === 'object' ? existing.tenant?.id : existing.tenant

        if (!isSuperAdmin(user as UserWithTenants)) {
            if (!tenantId || !catTenantId || String(tenantId) !== String(catTenantId)) {
                return { error: 'Unauthorized access' }
            }
        }

        if (catTenantId != null && await blogCategoryNameTaken(payload, { tenantId: catTenantId, name: data.name, excludeId: id })) {
            return { error: 'A category with this name already exists', code: BLOG_CATEGORY_DUPLICATE_CODE }
        }

        // Same rule as POST /api/blog-categories (GH-2317)
        const slug = toBlogCategorySlug(data.name)

        const result = await payload.update({
            collection: 'blog_categories',
            id,
            data: { name: data.name.trim(), slug: slug } as Record<string, unknown>,
            user: user as PayloadUser,
            depth: 1,
            populate: BLOG_POPULATE,
        })
        return JSON.parse(JSON.stringify(result))
    } catch (e: unknown) {
        console.error('Failed to update category:', e)
        return { error: 'Failed to update category' }
    }
}

/**
 * Returns count of PUBLISHED posts assigned to a category.
 * Used by delete-category UI to decide whether to show a warning.
 */
export async function getCategoryPublishedPostCountAction(categoryId: string): Promise<number> {
    const user = await getCurrentUser()
    if (!user) return 0

    const payload = await getPayload({ config: configPromise })
    const typedUser = user as UserWithTenants
    const tenantId = getTenantId(typedUser)
    if (!isSuperAdmin(typedUser) && !tenantId) return 0

    const conditions: Where[] = [
        { category: { equals: categoryId } },
        { status: { equals: 'published' } },
    ]
    if (tenantId) conditions.push({ tenant: { equals: tenantId } })

    const result = await payload.find({
        collection: 'blogs',
        where: { and: conditions },
        limit: 1,
        depth: 0,
    })
    return result.totalDocs
}

export async function deleteBlogCategoryAction(id: string) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const payload = await getPayload({ config: configPromise })

    try {
        // Check Tenant Isolation
        const existing = await payload.findByID({ collection: 'blog_categories', id })
        const tenantId = getTenantId(user as UserWithTenants)

        if (tenantId != null) {
            const sub = await getActivePlanSubscription(payload, tenantId)
            if (!sub || !await canUse(payload, sub.plan as PlanCode, 'content_management')) {
                return { error: 'Content management is not available on your current plan.' }
            }
        }

        const catTenantId = typeof existing.tenant === 'object' ? existing.tenant?.id : existing.tenant

        if (!isSuperAdmin(user as UserWithTenants)) {
            if (!tenantId || !catTenantId || String(tenantId) !== String(catTenantId)) {
                return { error: 'ERR_UNAUTHORIZED' }
            }
        }

        // Unset category only on blogs that belong to the same tenant as the category being deleted.
        const affected = await payload.find({
            collection: 'blogs',
            where: {
                and: [
                    { category: { equals: id } },
                    { tenant: { equals: catTenantId } },
                ],
            },
            limit: 500,
            depth: 0,
            user: user as PayloadUser,
            overrideAccess: false,
        })

        if (affected.docs.length > 0) {
            await Promise.all(
                affected.docs.map(blog =>
                    payload.update({
                        collection: 'blogs',
                        id: blog.id,
                        data: { category: null },
                        user: user as PayloadUser,
                        overrideAccess: false,
                    })
                )
            )
        }

        // Hard delete the category
        await payload.delete({
            collection: 'blog_categories',
            id,
            user: user as PayloadUser,
            overrideAccess: false,
        })
        return { success: true }
    } catch (e: unknown) {
        console.error('Failed to delete category:', e)
        return { error: 'ERR_DELETE_CATEGORY' }
    }
}

// ─── Current User ──────────────────────────────────────────────────────────
export async function getCurrentUserAction() {
    const user = await getCurrentUser()
    if (!user) return null
    // The editor shows the author name only. The session user also holds its session list and the tenant's
    // raw SSO metaData (owner name / email / phone) — not for every member's browser (TC-PERF-130).
    const { id, email, firstName, lastName } = user as { id: string | number; email?: string; firstName?: string; lastName?: string }
    return { id, email: email ?? null, firstName: firstName ?? null, lastName: lastName ?? null }
}

// ─── Save Blog (Create / Update) ──────────────────────────────────────────
export async function saveBlogAction(data: SaveBlogInput) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')
    // the copilot's replay key is set by its own approval step only, never from the editor
    const { aiChangeSetId: _serverOnly, ...input } = data
    return saveBlogForUser(user as UserWithTenants, input)
}

// ─── List Blogs ────────────────────────────────────────────────────────────
export async function listBlogsAction(params: {
    search?: string
    status?: string
    category?: string
    page?: number
    limit?: number
    sort?: string
}) {
    const user = await getCurrentUser()
    if (!user) return { data: [], meta: null }

    const payload = await getPayload({ config: configPromise })
    const typedUser = user as UserWithTenants
    const tenantId = getTenantId(typedUser)
    if (!isSuperAdmin(typedUser) && !tenantId) return { data: [], meta: null }

    const conditions: Where[] = []
    if (tenantId) conditions.push({ tenant: { equals: tenantId } })
    if (params.status && params.status !== 'all') conditions.push({ status: { equals: params.status } })
    if (params.category && params.category !== 'all') conditions.push({ category: { equals: params.category } })
    const trimmedSearch = params.search?.trim()
    if (trimmedSearch) {
        conditions.push({
            or: [
                { title: { contains: trimmedSearch } },
                { slug: { contains: trimmedSearch } },
            ],
        })
    }
    const where: Where = conditions.length > 0 ? { and: conditions } : {}

    const sortField = params.sort || '-createdAt'
    // depth 1: author names, category name, thumbnail url — what the list shows. Depth 2 sent each author's
    // whole user (otpHash, keyString, sessions) and their workspace's payment secrets to the browser (TC-PERF-073).
    const result = await payload.find({
        collection: 'blogs',
        where,
        sort: sortField,
        page: params.page || 1,
        limit: params.limit || 10,
        depth: 1,
        populate: BLOG_POPULATE,
    })

    return JSON.parse(JSON.stringify({
        data: result.docs,
        meta: {
            totalDocs: result.totalDocs,
            totalPages: result.totalPages,
            page: result.page,
            limit: result.limit,
            hasNextPage: result.hasNextPage,
            hasPrevPage: result.hasPrevPage,
        },
    }))
}

// ─── Delete Blog ───────────────────────────────────────────────────────────
export async function deleteBlogAction(id: string) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const payload = await getPayload({ config: configPromise })

    const tenantId = getTenantId(user as UserWithTenants)

    if (tenantId != null) {
        const sub = await getActivePlanSubscription(payload, tenantId)
        if (!sub || !await canUse(payload, sub.plan as PlanCode, 'content_management')) {
            return { success: false, error: 'Content management is not available on your current plan.' }
        }
    }

    const existing = await payload.findByID({ collection: 'blogs', id })
    const blogTenantId = typeof existing.tenant === 'object' ? existing.tenant?.id : existing.tenant

    if (!isSuperAdmin(user as UserWithTenants)) {
        if (!tenantId || !blogTenantId || String(tenantId) !== String(blogTenantId)) {
            throw new Error('Unauthorized delete access')
        }
    }

    await payload.delete({
        collection: 'blogs',
        id,
        user: user as PayloadUser,
    })

    return { success: true }
}

// ─── Bulk Delete Blogs (TC-F17-01-14: no N+1) ────────────────────────────
export async function bulkDeleteBlogsAction(ids: string[]) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    if (!ids || ids.length === 0) return { deleted: 0 }

    const payload = await getPayload({ config: configPromise })
    const tenantId = getTenantId(user as UserWithTenants)

    if (tenantId != null) {
        const sub = await getActivePlanSubscription(payload, tenantId)
        if (!sub || !await canUse(payload, sub.plan as PlanCode, 'content_management')) {
            return { deleted: 0, error: 'Content management is not available on your current plan.' }
        }
    }

    // GH-1587: previously only added the tenant filter `if (tenantId)` — when falsy (non-admin
    // with an unresolvable tenant), the delete ran with NO tenant scope at all: a mass delete by
    // ID list across every tenant. Refuse outright rather than fail open; super-admin keeps the
    // existing unscoped-by-design behavior (bulk ops across tenants are a legitimate admin need).
    if (!isSuperAdmin(user as UserWithTenants) && !tenantId) {
        return { deleted: 0, error: 'Unauthorized delete access' }
    }

    // Single query: delete all matching IDs scoped to tenant
    const where: Where = {
        id: { in: ids },
    }
    if (tenantId) where.tenant = { equals: tenantId }

    const result = await payload.delete({
        collection: 'blogs',
        where,
    })

    const deletedCount = Array.isArray(result.docs) ? result.docs.length : 0
    return { deleted: deletedCount }
}

// ─── Update Blog Status ────────────────────────────────────────────────────
export async function updateBlogStatusAction(id: string, status: string) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const payload = await getPayload({ config: configPromise })

    const tenantId = getTenantId(user as UserWithTenants)

    if (tenantId != null) {
        const sub = await getActivePlanSubscription(payload, tenantId)
        if (!sub || !await canUse(payload, sub.plan as PlanCode, 'content_management')) {
            return { error: 'Content management is not available on your current plan.' }
        }
    }

    const existing = await payload.findByID({ collection: 'blogs', id })
    const blogTenantId = typeof existing.tenant === 'object' ? existing.tenant?.id : existing.tenant

    if (!isSuperAdmin(user as UserWithTenants)) {
        if (!tenantId || !blogTenantId || String(tenantId) !== String(blogTenantId)) {
            throw new Error('Unauthorized update access')
        }
    }

    const result = await payload.update({
        collection: 'blogs',
        id,
        data: { status } as Record<string, unknown>,
        user: user as PayloadUser,
        depth: 1,
        populate: BLOG_POPULATE, // the author may be another member: never their whole user row (TC-PERF-130)
    })

    return JSON.parse(JSON.stringify(result))
}

// ─── Get Blog By ID ────────────────────────────────────────────────────────
export async function getBlogByIdAction(id: string) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const payload = await getPayload({ config: configPromise })
    const result = await payload.findByID({
        collection: 'blogs',
        id,
        depth: 2,
        populate: BLOG_POPULATE,
    })

    const tenantId = getTenantId(user as UserWithTenants)
    const blogTenantId = typeof result.tenant === 'object' ? result.tenant?.id : result.tenant

    if (!isSuperAdmin(user as UserWithTenants)) {
        if (!tenantId || !blogTenantId || String(tenantId) !== String(blogTenantId)) {
            throw new Error('Unauthorized access')
        }
    }

    return JSON.parse(JSON.stringify(result))
}
