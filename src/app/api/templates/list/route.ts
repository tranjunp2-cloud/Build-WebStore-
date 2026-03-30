import { getPayload } from 'payload'
import config from '@payload-config'
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'

/**
 * GET /api/templates/list
 * Custom endpoint to list templates (workaround for Payload REST API undici bug).
 */
export const GET = withAuth(async (_user, req) => {
    try {
        const { searchParams } = new URL(req.url)
        const limit = parseInt(searchParams.get('limit') || '50', 10)
        const sort = searchParams.get('sort') || 'sortOrder'

        const payload = await getPayload({ config })
        const result = await payload.find({
            collection: 'templates',
            limit,
            sort,
        })

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Templates list error:', error)
        return NextResponse.json({
            docs: [],
            totalDocs: 0,
            error: 'Failed to load templates',
        }, { status: 500 })
    }
})
