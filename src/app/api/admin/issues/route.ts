/**
 * GET  /api/admin/issues — paginated list with filters
 * POST /api/admin/issues — create new issue
 *
 * Super-admin only. Polymorphic relatedId validated on create.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { withSuperAdmin } from '@/lib/admin/api-utils'

const LIMIT = 50

const CreateIssueSchema = z.object({
    title: z.string().min(1).max(300),
    description: z.string().max(10000).optional(),
    severity: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
    category: z.enum(['accessibility', 'performance', 'content', 'ui', 'ai-quality', 'other']),
    relatedType: z.enum(['template', 'generation', 'block']),
    relatedId: z.string().min(1),
    assignedTo: z.union([z.string(), z.number()]).optional(),
    reportedBy: z.union([z.string(), z.number()]).optional(),
})

async function validateRelatedId(
    payload: Awaited<ReturnType<typeof getPayload>>,
    relatedType: string,
    relatedId: string,
): Promise<boolean> {
    try {
        if (relatedType === 'template') {
            const res = await payload.find({ collection: 'templates', where: { id: { equals: relatedId } }, limit: 1 })
            return res.totalDocs > 0
        }
        if (relatedType === 'generation') {
            const res = await payload.find({ collection: 'ai-generation-records', where: { id: { equals: relatedId } }, limit: 1 })
            return res.totalDocs > 0
        }
        if (relatedType === 'block') {
            const res = await payload.find({ collection: 'block-catalog-entries', where: { slug: { equals: relatedId } }, limit: 1 })
            return res.totalDocs > 0
        }
        return false
    } catch {
        // Soft-validate: don't block if collection lookup fails
        return true
    }
}

export const GET = withSuperAdmin(async (req) => {
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const severity = searchParams.get('severity')
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const assignee = searchParams.get('assignee')
    const relatedType = searchParams.get('relatedType')
    const relatedId = searchParams.get('relatedId')
    const search = searchParams.get('search')

    // Build where clause using Payload's Where type
    const where: Where = {}
    if (severity) where.severity = { equals: severity }
    if (status) where.status = { equals: status }
    if (category) where.category = { equals: category }
    if (assignee) where['assignedTo.id'] = { equals: assignee }
    if (relatedType) where.relatedType = { equals: relatedType }
    if (relatedId) where.relatedId = { equals: relatedId }
    if (search) where.title = { contains: search }

    const payload = await getPayload({ config })
    const result = await payload.find({
        collection: 'template-issues',
        where,
        page,
        limit: LIMIT,
        sort: '-createdAt',
        depth: 1,
    })

    return NextResponse.json({ data: result.docs, meta: { total: result.totalDocs, page, limit: LIMIT, pages: result.totalPages } })
})

export const POST = withSuperAdmin(async (req) => {
    const body = await req.json().catch(() => null)
    const parsed = CreateIssueSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })
    }

    const payload = await getPayload({ config })

    // Soft-validate relatedId exists
    const valid = await validateRelatedId(payload, parsed.data.relatedType, parsed.data.relatedId)
    if (!valid) {
        return NextResponse.json(
            { error: `relatedId "${parsed.data.relatedId}" not found for type "${parsed.data.relatedType}"` },
            { status: 422 },
        )
    }

    const doc = await payload.create({
        collection: 'template-issues',
        data: {
            title: parsed.data.title,
            description: parsed.data.description,
            severity: parsed.data.severity,
            category: parsed.data.category,
            status: 'open',
            relatedType: parsed.data.relatedType,
            relatedId: parsed.data.relatedId,
            ...(parsed.data.assignedTo ? { assignedTo: parsed.data.assignedTo } : {}),
            ...(parsed.data.reportedBy ? { reportedBy: parsed.data.reportedBy } : {}),
        },
    })

    return NextResponse.json({ data: doc }, { status: 201 })
})
