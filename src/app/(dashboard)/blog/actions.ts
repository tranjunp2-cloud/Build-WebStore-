'use server'

import { getPayload, type Where, type PayloadRequest } from 'payload'
import configPromise from '@payload-config'
import { getCurrentUser } from '@/lib/auth'

// ─── Types & Helpers ──────────────────────────────────────────────────────
type TenantEntry = { tenant: { id: string } | string; role?: string; status?: string }
type UserWithTenants = { id: string; email: string; tenants?: TenantEntry[] }

/** Payload expects its internal User type — our auth user is compatible at runtime */
type PayloadUser = PayloadRequest['user']

function getTenantId(user: UserWithTenants): string | undefined {
    const entry = user.tenants?.[0]
    if (!entry?.tenant) return undefined
    return typeof entry.tenant === 'object' ? entry.tenant?.id : entry.tenant
}

// ─── Blog Categories ───────────────────────────────────────────────────────
export async function getBlogCategoriesAction() {
    const user = await getCurrentUser()
    if (!user) return []

    const payload = await getPayload({ config: configPromise })

    // Get the first tenant from user's tenants array
    const tenantId = getTenantId(user as UserWithTenants)

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

    const slug = data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')

    // Check duplicate name within same tenant
    const existing = await payload.find({
        collection: 'blog_categories',
        where: {
            and: [
                { name: { equals: data.name.trim() } },
                { tenant: { equals: tenantId } },
                { status: { not_equals: 'deleted' } },
            ],
        },
        limit: 1,
    })
    if (existing.docs.length > 0) {
        return { error: 'A category with this name already exists' }
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
        const catTenantId = typeof existing.tenant === 'object' ? existing.tenant?.id : existing.tenant

        if (tenantId && catTenantId && String(tenantId) !== String(catTenantId)) {
            return { error: 'Unauthorized access' }
        }

        const slug = data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')

        const result = await payload.update({
            collection: 'blog_categories',
            id,
            data: { name: data.name.trim(), slug: slug } as Record<string, unknown>,
            user: user as PayloadUser,
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
    const tenantId = getTenantId(user as UserWithTenants)

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
        const catTenantId = typeof existing.tenant === 'object' ? existing.tenant?.id : existing.tenant

        if (tenantId && catTenantId && String(tenantId) !== String(catTenantId)) {
            return { error: 'ERR_UNAUTHORIZED' }
        }

        // Unset category from all posts referencing this category
        const affected = await payload.find({
            collection: 'blogs',
            where: { category: { equals: id } },
            limit: 500,
            depth: 0,
        })

        if (affected.docs.length > 0) {
            await Promise.all(
                affected.docs.map(blog =>
                    payload.update({
                        collection: 'blogs',
                        id: blog.id,
                        data: { category: null },
                    })
                )
            )
        }

        // Hard delete the category
        await payload.delete({
            collection: 'blog_categories',
            id,
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
    return JSON.parse(JSON.stringify(user))
}

// ─── Save Blog (Create / Update) ──────────────────────────────────────────
export async function saveBlogAction(data: {
    id?: string
    title: string
    slug: string
    content: string
    status: string
    category?: string | null
    thumbnail?: string | null
    publishedAt?: string | null
    scheduledPublishDate?: string | null
    seo?: {
        metaTitle?: string
        metaDescription?: string
    }
}) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const payload = await getPayload({ config: configPromise })
    const isNew = !data.id || data.id === 'new'

    // Get the first tenant from user's tenants array (similar to how Products does)
    const tenantId = getTenantId(user as UserWithTenants)

    // Fetch the site associated with this tenant
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

    const body: Record<string, unknown> = {
        title: data.title,
        slug: data.slug,
        content: data.content,
        status: data.status,
        category: data.category ? (isNaN(Number(data.category)) ? data.category : Number(data.category)) : null,
        thumbnail: data.thumbnail ? (isNaN(Number(data.thumbnail)) ? data.thumbnail : Number(data.thumbnail)) : null,
        publishedAt: data.publishedAt || null,
        scheduledPublishDate: data.scheduledPublishDate || null,
        seo: data.seo || {},
        author: (user as UserWithTenants).id,
    }

    if (isNew) {
        // Only set tenant and site on creation
        body.tenant = tenantId
        body.site = siteId

        // Auto-suffix slug if duplicate exists within same site
        let slug = body.slug
        let suffix = 0
        while (true) {
            const existing = await payload.find({
                collection: 'blogs',
                where: { slug: { equals: slug }, site: { equals: siteId } },
                limit: 1,
            })
            if (existing.docs.length === 0) break
            suffix++
            slug = `${body.slug}-${suffix}`
        }
        body.slug = slug

        const result = await payload.create({
            collection: 'blogs',
            data: body as Record<string, unknown>,
            user: user as PayloadUser,
        })
        return JSON.parse(JSON.stringify(result))
    } else {
        const result = await payload.update({
            collection: 'blogs',
            id: data.id!,
            data: body as Record<string, unknown>,
            user: user as PayloadUser,
        })
        return JSON.parse(JSON.stringify(result))
    }
}

// ─── List Blogs ────────────────────────────────────────────────────────────
export async function listBlogsAction(params: {
    search?: string
    status?: string
    category?: string
    page?: number
    sort?: string
}) {
    const user = await getCurrentUser()
    if (!user) return { data: [], meta: null }

    const payload = await getPayload({ config: configPromise })
    const tenantId = getTenantId(user as UserWithTenants)

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
    const result = await payload.find({
        collection: 'blogs',
        where,
        sort: sortField,
        page: params.page || 1,
        limit: 10,
    })

    return JSON.parse(JSON.stringify({
        data: result.docs,
        meta: {
            totalDocs: result.totalDocs,
            totalPages: result.totalPages,
            page: result.page,
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

    const existing = await payload.findByID({ collection: 'blogs', id })
    const tenantId = getTenantId(user as UserWithTenants)
    const blogTenantId = typeof existing.tenant === 'object' ? existing.tenant?.id : existing.tenant

    if (tenantId && blogTenantId && String(tenantId) !== String(blogTenantId)) {
        throw new Error('Unauthorized delete access')
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

    const existing = await payload.findByID({ collection: 'blogs', id })
    const tenantId = getTenantId(user as UserWithTenants)
    const blogTenantId = typeof existing.tenant === 'object' ? existing.tenant?.id : existing.tenant

    if (tenantId && blogTenantId && String(tenantId) !== String(blogTenantId)) {
        throw new Error('Unauthorized update access')
    }

    const result = await payload.update({
        collection: 'blogs',
        id,
        data: { status } as Record<string, unknown>,
        user: user as PayloadUser,
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
    })

    const tenantId = getTenantId(user as UserWithTenants)
    const blogTenantId = typeof result.tenant === 'object' ? result.tenant?.id : result.tenant

    if (tenantId && blogTenantId && String(tenantId) !== String(blogTenantId)) {
        throw new Error('Unauthorized access')
    }

    return JSON.parse(JSON.stringify(result))
}
