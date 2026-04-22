/**
 * GET  /api/admin/templates  — paginated list with filter/sort
 * POST /api/admin/templates  — create new template (draft by default)
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { withSuperAdmin, CreateTemplateSchema } from '@/lib/admin/api-utils'

export const GET = withSuperAdmin(async (req: NextRequest) => {
    const sp = req.nextUrl.searchParams

    const page = Math.max(1, Number(sp.get('page') ?? 1))
    const limit = Math.min(100, Math.max(10, Number(sp.get('limit') ?? 50)))
    const search = sp.get('search') ?? ''
    const status = sp.get('status') ?? ''
    const category = sp.get('category') ?? ''
    const personality = sp.get('personality') ?? ''
    const sort = sp.get('sort') ?? '-updatedAt'

    // Build Payload where clause
    const where: Where = {}

    if (status && status !== 'all') {
        where.status = { equals: status }
    }

    if (category && category !== 'all') {
        where.category = { contains: category }
    }

    if (personality && personality !== 'all') {
        where.personality = { equals: personality }
    }

    if (search) {
        where.or = [
            { name: { like: search } },
            { description: { like: search } },
        ]
    }

    const payload = await getPayload({ config })

    const result = await payload.find({
        collection: 'templates',
        where,
        sort,
        page,
        limit,
        depth: 1,
    })

    return NextResponse.json({
        data: result.docs,
        meta: {
            totalDocs: result.totalDocs,
            totalPages: result.totalPages,
            page: result.page,
            limit: result.limit,
            hasNextPage: result.hasNextPage,
            hasPrevPage: result.hasPrevPage,
        },
    })
})

export const POST = withSuperAdmin(async (req: NextRequest) => {
    const body = await req.json().catch(() => null)

    if (!body) {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = CreateTemplateSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
    }

    const payload = await getPayload({ config })

    const template = await payload.create({
        collection: 'templates',
        data: {
            name: parsed.data.name,
            description: parsed.data.description,
            category: parsed.data.category,
            status: parsed.data.status ?? 'draft',
            personality: parsed.data.personality,
            isPremium: parsed.data.isPremium ?? false,
            isFeatured: parsed.data.isFeatured ?? false,
            previewUrl: parsed.data.previewUrl,
            scheduledFor: parsed.data.scheduledFor,
            tags: parsed.data.tags ?? [],
        },
    })

    return NextResponse.json({ data: template }, { status: 201 })
})
