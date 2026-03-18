import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { parseRequest } from '@/lib/validations/helpers'
import { updateCategorySchema } from '@/lib/validations/blog'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/blog-categories/[id] — Update a category
 */
export const PATCH = withAuth<RouteContext>(async (user, req, ctx) => {
    try {
        const { id } = await ctx.params
        const { data, errorResponse } = await parseRequest(req, updateCategorySchema)
        if (errorResponse) return errorResponse

        const payload = await getPayload({ config })

        // Verify ownership
        const existing = await payload.findByID({ collection: 'blog_categories', id })
        const tenantId = user.tenants?.[0]?.tenant
        const resolvedTenantId = typeof tenantId === 'object' ? tenantId.id : tenantId
        const existingTenantId = typeof existing.tenant === 'object' ? existing.tenant.id : existing.tenant

        if (existingTenantId !== resolvedTenantId) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', details: 'Not your category' } },
                { status: 403 }
            )
        }

        const updated = await payload.update({
            collection: 'blog_categories',
            id,
            data: data!,
        })

        return NextResponse.json({ success: true, data: updated })
    } catch (error: any) {
        if (error?.message?.includes('not found') || error?.status === 404) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', details: 'Category not found' } },
                { status: 404 }
            )
        }
        console.error('PATCH /api/blog-categories/[id] error:', error)
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', details: 'Failed to update category' } },
            { status: 500 }
        )
    }
})

/**
 * DELETE /api/blog-categories/[id] — Delete a category (unsets from related blogs)
 */
export const DELETE = withAuth<RouteContext>(async (user, _req, ctx) => {
    try {
        const { id } = await ctx.params
        const payload = await getPayload({ config })

        // Verify ownership
        const existing = await payload.findByID({ collection: 'blog_categories', id })
        const tenantId = user.tenants?.[0]?.tenant
        const resolvedTenantId = typeof tenantId === 'object' ? tenantId.id : tenantId
        const existingTenantId = typeof existing.tenant === 'object' ? existing.tenant.id : existing.tenant

        if (existingTenantId !== resolvedTenantId) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', details: 'Not your category' } },
                { status: 403 }
            )
        }

        // Unset category on related blogs before deleting
        await payload.update({
            collection: 'blogs',
            where: { category: { equals: id } },
            data: { category: null as any },
        })

        await payload.delete({ collection: 'blog_categories', id })

        return NextResponse.json({ success: true, data: { deleted: id } })
    } catch (error: any) {
        if (error?.message?.includes('not found') || error?.status === 404) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', details: 'Category not found' } },
                { status: 404 }
            )
        }
        console.error('DELETE /api/blog-categories/[id] error:', error)
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', details: 'Failed to delete category' } },
            { status: 500 }
        )
    }
})
