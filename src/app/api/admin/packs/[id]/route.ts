/**
 * GET    /api/admin/packs/[id]
 * PATCH  /api/admin/packs/[id]
 * DELETE /api/admin/packs/[id]
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { withStudioPermission, withSuperAdmin } from '@/lib/admin/api-utils'

const UpdatePackSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    category: z.string().optional(),
    personality: z.string().optional(),
    tags: z.array(z.object({ tag: z.string() })).optional(),
    includedTemplates: z.array(z.union([z.string(), z.number()])).optional(),
})

function extractId(req: NextRequest): string {
    const segments = req.nextUrl.pathname.split('/')
    return segments[segments.length - 1] ?? ''
}

export const GET = withSuperAdmin(async (req: NextRequest) => {
    const id = extractId(req)
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const payload = await getPayload({ config })
    try {
        const pack = await payload.findByID({ collection: 'content-packs', id, depth: 1 })
        return NextResponse.json({ data: pack })
    } catch {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
})

export const PATCH = withStudioPermission('pack.edit', async (req: NextRequest) => {
    const id = extractId(req)
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = UpdatePackSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
    }

    const payload = await getPayload({ config })
    try {
        const updated = await payload.update({ collection: 'content-packs', id, data: parsed.data })
        return NextResponse.json({ data: updated })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Update failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
})

export const DELETE = withStudioPermission('pack.delete', async (req: NextRequest) => {
    const id = extractId(req)
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const payload = await getPayload({ config })
    try {
        await payload.delete({ collection: 'content-packs', id })
        return NextResponse.json({ success: true })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Delete failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
})
