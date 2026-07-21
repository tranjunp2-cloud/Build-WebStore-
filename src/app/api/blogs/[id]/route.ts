import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'
import { parseRequest } from '@/lib/validations/helpers'
import { updateBlogSchema } from '@/lib/validations/blog'

type RouteContext = { params: Promise<{ id: string }> }

function isBlogCategoryTenantMismatch(error: unknown): boolean {
    return error instanceof Error && error.message.includes('BLOG_CATEGORY_TENANT_MISMATCH')
}

/**
 * GET /api/blogs/[id] — Get a single blog post
 */
export const GET = withAuth<RouteContext>(async (user, _req, ctx) => {
    try {
        const { id } = await ctx.params
        const payload = await getPayload({ config })

        const blog = await payload.findByID({ collection: 'blogs', id, depth: 1 })

        // Verify ownership (tenant-scoped)
        const tenantId = user.tenants?.[0]?.tenant
        const resolvedTenantId = typeof tenantId === 'object' ? tenantId.id : tenantId
        const blogTenantId = typeof blog.tenant === 'object' ? blog.tenant.id : blog.tenant

        if (blogTenantId !== resolvedTenantId) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', details: 'Not your blog post' } },
                { status: 403 }
            )
        }

        return NextResponse.json({ success: true, data: blog })
    } catch (error: any) {
        if (error?.message?.includes('not found') || error?.status === 404) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', details: 'Blog post not found' } },
                { status: 404 }
            )
        }
        console.error('GET /api/blogs/[id] error:', error)
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', details: 'Failed to fetch blog post' } },
            { status: 500 }
        )
    }
})

/**
 * PATCH /api/blogs/[id] — Update a blog post
 */
export const PATCH = withFeatureGuard('content_management')(withAuth<RouteContext>(async (user, req, ctx) => {
    try {
        const { id } = await ctx.params
        const { data, errorResponse } = await parseRequest(req, updateBlogSchema)
        if (errorResponse) return errorResponse

        const payload = await getPayload({ config })

        // Verify ownership
        const existing = await payload.findByID({ collection: 'blogs', id })
        const tenantId = user.tenants?.[0]?.tenant
        const resolvedTenantId = typeof tenantId === 'object' ? tenantId.id : tenantId
        const existingTenantId = typeof existing.tenant === 'object' ? existing.tenant.id : existing.tenant

        if (existingTenantId !== resolvedTenantId) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', details: 'Not your blog post' } },
                { status: 403 }
            )
        }

        // Convert relationship IDs from string to number (Payload PostgreSQL uses integer IDs)
        const updateData: Record<string, any> = { ...data }
        if (updateData.category !== undefined) {
            updateData.category = updateData.category ? Number(updateData.category) : null
        }
        if (updateData.thumbnail !== undefined) {
            updateData.thumbnail = updateData.thumbnail ? Number(updateData.thumbnail) : null
        }

        const updated = await payload.update({
            collection: 'blogs',
            id,
            data: updateData,
            user,
            overrideAccess: false,
        })

        return NextResponse.json({ success: true, data: updated })
    } catch (error: any) {
        if (error?.message?.includes('not found') || error?.status === 404) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', details: 'Blog post not found' } },
                { status: 404 }
            )
        }
        if (isBlogCategoryTenantMismatch(error)) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', details: 'Invalid category selection' } },
                { status: 400 }
            )
        }
        console.error('PATCH /api/blogs/[id] error:', error)
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', details: 'Failed to update blog post' } },
            { status: 500 }
        )
    }
}))

/**
 * DELETE /api/blogs/[id] — Hard delete a blog post (AC F17-04 AC-3: "permanently removed")
 * NOTE: PM may prefer soft delete for safety — revisit if needed
 */
export const DELETE = withFeatureGuard('content_management')(withAuth<RouteContext>(async (user, _req, ctx) => {
    try {
        const { id } = await ctx.params
        const payload = await getPayload({ config })

        // Verify ownership
        const existing = await payload.findByID({ collection: 'blogs', id })
        const tenantId = user.tenants?.[0]?.tenant
        const resolvedTenantId = typeof tenantId === 'object' ? tenantId.id : tenantId
        const existingTenantId = typeof existing.tenant === 'object' ? existing.tenant.id : existing.tenant

        if (existingTenantId !== resolvedTenantId) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', details: 'Not your blog post' } },
                { status: 403 }
            )
        }

        // Hard delete per AC F17-04 AC-3: "the post is permanently removed from the system"
        await payload.delete({
            collection: 'blogs',
            id,
            user,
            overrideAccess: false,
        })

        return NextResponse.json({ success: true, data: { deleted: id } })
    } catch (error: any) {
        if (error?.message?.includes('not found') || error?.status === 404) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', details: 'Blog post not found' } },
                { status: 404 }
            )
        }
        console.error('DELETE /api/blogs/[id] error:', error)
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', details: 'Failed to delete blog post' } },
            { status: 500 }
        )
    }
}))
