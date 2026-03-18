import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { parseRequest } from '@/lib/validations/helpers'
import { updateBlogSchema } from '@/lib/validations/blog'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/blogs/[id] — Update a blog post
 */
export const PATCH = withAuth<RouteContext>(async (user, req, ctx) => {
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

        const updated = await payload.update({
            collection: 'blogs',
            id,
            data: data!,
        })

        return NextResponse.json({ success: true, data: updated })
    } catch (error: any) {
        if (error?.message?.includes('not found') || error?.status === 404) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', details: 'Blog post not found' } },
                { status: 404 }
            )
        }
        console.error('PATCH /api/blogs/[id] error:', error)
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', details: 'Failed to update blog post' } },
            { status: 500 }
        )
    }
})

/**
 * DELETE /api/blogs/[id] — Hard delete a blog post
 */
export const DELETE = withAuth<RouteContext>(async (user, _req, ctx) => {
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

        await payload.delete({ collection: 'blogs', id })

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
})
