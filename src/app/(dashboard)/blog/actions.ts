'use server'

import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCurrentUser } from '@/lib/auth'

// ─── Blog Categories ───────────────────────────────────────────────────────
export async function getBlogCategoriesAction() {
    const user = await getCurrentUser()
    if (!user) return []

    const payload = await getPayload({ config: configPromise })

    // Get the first tenant from user's tenants array
    const tenantId = (user as any).tenants?.[0]?.tenant?.id || (user as any).tenants?.[0]?.tenant

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

    const payload = await getPayload({ config: configPromise })
    const tenantId = (user as any).tenants?.[0]?.tenant?.id || (user as any).tenants?.[0]?.tenant

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

    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')

    try {
        const result = await payload.create({
            collection: 'blog_categories',
            data: {
                name: data.name,
                slug: slug,
                tenant: tenantId,
                site: siteId,
            } as any,
            user: user as any,
        })
        return JSON.parse(JSON.stringify(result))
    } catch (e: any) {
        return { error: e?.message || 'Failed to create category' }
    }
}

export async function updateBlogCategoryAction(id: string, data: { name: string }) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const payload = await getPayload({ config: configPromise })
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')

    try {
        const result = await payload.update({
            collection: 'blog_categories',
            id,
            data: { name: data.name, slug: slug } as any,
            user: user as any,
        })
        return JSON.parse(JSON.stringify(result))
    } catch (e: any) {
        return { error: e?.message || 'Failed to update category' }
    }
}

export async function deleteBlogCategoryAction(id: string) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const payload = await getPayload({ config: configPromise })

    try {
        await payload.delete({
            collection: 'blog_categories',
            id,
            user: user as any,
        })
        return { success: true }
    } catch (e: any) {
        return { error: e?.message || 'Failed to delete category. It might be in use.' }
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
    const tenantId = (user as any).tenants?.[0]?.tenant?.id || (user as any).tenants?.[0]?.tenant

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
        author: (user as any).id,
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
    const tenantId = (user as any).tenant?.id || (user as any).tenant

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

    return JSON.parse(JSON.stringify(result))
}
