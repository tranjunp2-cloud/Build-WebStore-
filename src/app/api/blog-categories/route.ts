import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { parseRequest } from '@/lib/validations/helpers'
import { createCategorySchema } from '@/lib/validations/blog'

function toSlug(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
}

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
export const POST = withAuth(async (user, req) => {
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

        const slug = toSlug(data!.name)

        // Check for duplicate slug
        const existing = await payload.find({
            collection: 'blog_categories',
            where: {
                slug: { equals: slug },
                tenant: { equals: resolvedTenantId },
            },
            limit: 1,
        })
        if (existing.docs.length > 0) {
            return NextResponse.json(
                { success: false, error: { code: 'DUPLICATE_SLUG', details: 'Category with this name already exists' } },
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
        })

        return NextResponse.json({ success: true, data: category }, { status: 201 })
    } catch (error) {
        console.error('POST /api/blog-categories error:', error)
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', details: 'Failed to create category' } },
            { status: 500 }
        )
    }
})
