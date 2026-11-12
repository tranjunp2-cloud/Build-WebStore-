import { getPayload } from 'payload'
import config from '@payload-config'
import { NextResponse } from 'next/server'

/**
 * GET /api/templates/list
 * Public endpoint to list templates (no auth required — templates collection has read: () => true).
 * Workaround for Payload REST API undici bug.
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const templateId = searchParams.get('templateId')
        if (templateId !== null && (
            !/^\d+$/.test(templateId)
            || !Number.isSafeInteger(Number(templateId))
            || Number(templateId) < 1
        )) {
            return NextResponse.json({ error: 'Invalid templateId' }, { status: 400 })
        }
        const requestedLimit = Number.parseInt(searchParams.get('limit') ?? '', 10)
        const limit = Number.isFinite(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), 100)
            : 100
        const sort = searchParams.get('sort') || '-createdAt'

        const payload = await getPayload({ config })
        const result = await payload.find({
            collection: 'templates',
            limit: templateId === null ? limit : 1,
            sort,
            where: templateId === null
                ? { status: { equals: 'live' } }
                : { and: [{ status: { equals: 'live' } }, { id: { equals: Number(templateId) } }] },
        })

        return NextResponse.json(result)
    } catch (error: unknown) {
        console.error('Templates list error:', error)
        return NextResponse.json({ docs: [], totalDocs: 0 }, { status: 500 })
    }
}
