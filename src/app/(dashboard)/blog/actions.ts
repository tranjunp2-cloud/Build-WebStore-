'use server'

import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCurrentUser } from '@/lib/auth'

// ─── Types & Helpers ──────────────────────────────────────────────────────
type TenantEntry = { tenant: { id: string } | string; role?: string; status?: string }
type UserWithTenants = { id: string; email: string; tenants?: TenantEntry[] }

function getTenantId(user: UserWithTenants): string | undefined {
    const entry = user.tenants?.[0]
    if (!entry) return undefined
    return typeof entry.tenant === 'object' ? entry.tenant.id : entry.tenant
}

// ─── Blog Categories ───────────────────────────────────────────────────────
export async function getBlogCategoriesAction() {
    const user = await getCurrentUser()
    if (!user) return []

    const payload = await getPayload({ config: configPromise })

    // Get the first tenant from user's tenants array
    const tenantId = getTenantId(user as UserWithTenants)

    // Apply tenant filtering
    const where: any = {}
    if (tenantId) where.tenant = { equals: tenantId }

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

    try {
        const result = await payload.create({
            collection: 'blog_categories',
            data: {
                name: data.name.trim(),
                slug: slug,
                tenant: tenantId,
                site: siteId,
            } as any,
            user: user as any,
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
            data: { name: data.name.trim(), slug: slug } as any,
            user: user as any,
        })
        return JSON.parse(JSON.stringify(result))
    } catch (e: unknown) {
        console.error('Failed to update category:', e)
        return { error: 'Failed to update category' }
    }
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
            return { error: 'Unauthorized delete access' }
        }

        await payload.delete({
            collection: 'blog_categories',
            id,
            user: user as any,
        })
        return { success: true }
    } catch (e: unknown) {
        console.error('Failed to delete category:', e)
        return { error: 'Failed to delete category. It might be in use.' }
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

    const body: Record<string, any> = {
        title: data.title,
        slug: data.slug,
        content: data.content,
        status: data.status,
        category: data.category ? (isNaN(Number(data.category)) ? data.category : Number(data.category)) : null,
        thumbnail: data.thumbnail ? (isNaN(Number(data.thumbnail)) ? data.thumbnail : Number(data.thumbnail)) : null,
        seo: data.seo || {},
        author: (user as UserWithTenants).id,
    }

    if (isNew) {
        // Only set tenant and site on creation
        body.tenant = tenantId
        body.site = siteId

        const result = await payload.create({
            collection: 'blogs',
            data: body as any,
            user: user as any,
        })
        return JSON.parse(JSON.stringify(result))
    } else {
        const result = await payload.update({
            collection: 'blogs',
            id: data.id!,
            data: body as any,
            user: user as any,
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

    const where: Record<string, any> = {}
    if (tenantId) where.tenant = { equals: tenantId }
    if (params.status && params.status !== 'all') where.status = { equals: params.status }
    if (params.category && params.category !== 'all') where.category = { equals: params.category }
    if (params.search) {
        where.or = [
            { title: { contains: params.search } },
            { slug: { contains: params.search } },
        ]
    }

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
        user: user as any,
    })

    return { success: true }
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
        data: { status } as any,
        user: user as any,
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
    })

    const tenantId = getTenantId(user as UserWithTenants)
    const blogTenantId = typeof result.tenant === 'object' ? result.tenant?.id : result.tenant

    if (tenantId && blogTenantId && String(tenantId) !== String(blogTenantId)) {
        throw new Error('Unauthorized access')
    }

    return JSON.parse(JSON.stringify(result))
}
