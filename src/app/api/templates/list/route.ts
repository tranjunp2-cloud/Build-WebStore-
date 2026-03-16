import { getPayload } from 'payload'
import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

/**
 * GET /api/templates/list
 * Custom endpoint to list templates (workaround for Payload REST API undici bug).
 */
export async function GET(req: Request) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

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
            error: error.message,
        }, { status: 500 })
    }
}
