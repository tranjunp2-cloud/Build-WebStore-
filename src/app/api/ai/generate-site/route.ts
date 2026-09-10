export const dynamic = 'force-dynamic'
// Preserve the existing generation timeout while extracting the shared pipeline.
export const maxDuration = 300
import { NextRequest, NextResponse, after } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { generateSiteSchema } from '@/lib/validations/ai'
import { parseRequest } from '@/lib/validations/helpers'
import { generateSiteService } from '@/lib/ai/generate-site-service'

export { buildGeneratedPages, canonicalizePageSlug } from '@/lib/ai/generate-site-service'

export async function POST(req: NextRequest) {
    try {
        const { data, errorResponse } = await parseRequest(req, generateSiteSchema)
        if (errorResponse) return errorResponse
        const user = await getCurrentUser(req)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        const payload = await getPayload({ config })
        return generateSiteService({
            payload,
            user,
            input: data!,
            requestId: req.headers.get('x-generation-request-id'),
            streaming: req.nextUrl.searchParams.get('stream') === 'true',
            scheduleBackground: task => after(async () => { await task() }),
        })
    } catch (error: unknown) {
        const debugId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
        console.error('[AI Generate Site Preflight Error]', debugId, error)
        return NextResponse.json({
            error: 'Failed to generate website. Please try again in a moment.',
            debugId,
        }, { status: 500 })
    }
}
