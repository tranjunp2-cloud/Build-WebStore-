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
        const requestedLimit = Number.parseInt(searchParams.get('limit') ?? '', 10)
        const limit = Number.isFinite(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), 100)
            : 100
        const sort = searchParams.get('sort') || '-createdAt'

        const payload = await getPayload({ config })
        const result = await payload.find({
            collection: 'templates',
            limit,
            sort,
            where: { status: { equals: 'live' } },
        })

        return NextResponse.json(result)
    } catch (error: unknown) {
        console.error('Templates list error:', error)
        return NextResponse.json({ docs: [], totalDocs: 0 }, { status: 500 })
    }
}
