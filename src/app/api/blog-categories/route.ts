import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'
import { parseRequest } from '@/lib/validations/helpers'
import { createCategorySchema } from '@/lib/validations/blog'
import { BLOG_CATEGORY_DUPLICATE_CODE, blogCategoryNameTaken, toBlogCategorySlug } from '@/lib/blog/blog-category-name'

/**
 * GET /api/blog-categories — List categories for current tenant
 */
export const GET = withAuth(async (user) => {
    try {
        const tenantId = user.tenants?.[0]?.tenant
        const resolvedTenantId = typeof tenantId === 'object' ? tenantId.id : tenantId
        if (!resolvedTenantId) {
            return NextResponse.json(
                { success: false, error: { code: 'NO_TENANT', details: 'No tenant found' } },
                { status: 400 }
            )
        }

        const payload = await getPayload({ config })

        const result = await payload.find({
            collection: 'blog_categories',
            where: { tenant: { equals: resolvedTenantId } },
            sort: 'name',
            limit: 100,
            depth: 0, // the tenant stays an id: a populated tenant row carries its secrets (TC-PERF-129)
        })

        return NextResponse.json({ success: true, data: result.docs })
    } catch (error) {
        console.error('GET /api/blog-categories error:', error)
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', details: 'Failed to fetch categories' } },
            { status: 500 }
        )
    }
})

/**
 * POST /api/blog-categories — Create a new category
 */
export const POST = withFeatureGuard('content_management')(withAuth(async (user, req) => {
    try {
        const { data, errorResponse } = await parseRequest(req, createCategorySchema)
        if (errorResponse) return errorResponse

        const tenantId = user.tenants?.[0]?.tenant
        const resolvedTenantId = typeof tenantId === 'object' ? tenantId.id : tenantId
        if (!resolvedTenantId) {
            return NextResponse.json(
                { success: false, error: { code: 'NO_TENANT', details: 'No tenant found' } },
                { status: 400 }
            )
        }

        const payload = await getPayload({ config })

        const slug = toBlogCategorySlug(data!.name)

        if (await blogCategoryNameTaken(payload, { tenantId: resolvedTenantId, name: data!.name })) {
            return NextResponse.json(
                { success: false, error: { code: BLOG_CATEGORY_DUPLICATE_CODE, details: 'Category with this name already exists' } },
                { status: 409 }
            )
        }

        const category = await payload.create({
            collection: 'blog_categories',
            data: {
                tenant: resolvedTenantId,
                name: data!.name,
                slug,
            },
            depth: 0,
        })

        return NextResponse.json({ success: true, data: category }, { status: 201 })
    } catch (error) {
        console.error('POST /api/blog-categories error:', error)
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', details: 'Failed to create category' } },
            { status: 500 }
        )
    }
}))
