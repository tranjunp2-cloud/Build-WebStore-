/**
 * GET  /api/admin/packs  — list content packs (paginated)
 * POST /api/admin/packs  — create content pack
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { withSuperAdmin } from '@/lib/admin/api-utils'

const CreatePackSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    category: z.string().optional(),
    personality: z.string().optional(),
    tags: z.array(z.object({ tag: z.string() })).optional(),
    includedTemplates: z.array(z.union([z.string(), z.number()])).optional(),
})

export const GET = withSuperAdmin(async (req: NextRequest) => {
    const sp = req.nextUrl.searchParams
    const page = Math.max(1, Number(sp.get('page') ?? 1))
    const limit = Math.min(100, Math.max(10, Number(sp.get('limit') ?? 50)))

    const payload = await getPayload({ config })
    const result = await payload.find({
        collection: 'content-packs',
        page,
        limit,
        sort: '-createdAt',
        depth: 1,
    })

    return NextResponse.json({
        data: result.docs,
        meta: {
            totalDocs: result.totalDocs,
            totalPages: result.totalPages,
            page: result.page ?? 1,
            limit: result.limit,
        },
    })
})

export const POST = withSuperAdmin(async (req: NextRequest) => {
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = CreatePackSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
    }

    const payload = await getPayload({ config })
    try {
        const pack = await payload.create({
            collection: 'content-packs',
            data: parsed.data,
        })
        return NextResponse.json({ data: pack }, { status: 201 })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Create failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
})
