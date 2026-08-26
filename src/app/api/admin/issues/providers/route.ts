import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withSuperAdmin } from '@/lib/admin/api-utils'
import {
    LiveErrorProviderError,
    type LiveErrorSource,
} from '@/lib/admin/live-errors/contracts'
import { fetchProviderEvidence } from '@/lib/admin/live-errors/fetch-provider-evidence'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

const QuerySchema = z.object({
    source: z.enum(['sentry', 'vercel']),
    id: z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9._:-]+$/).optional(),
})

export const GET = withSuperAdmin(async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const parsed = QuerySchema.safeParse({
        source: searchParams.get('source') ?? undefined,
        id: searchParams.get('id') ?? undefined,
    })
    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Invalid provider query' },
            { status: 400, headers: { 'Cache-Control': 'no-store' } },
        )
    }

    try {
        const result = await fetchProviderEvidence(
            parsed.data.source as LiveErrorSource,
            parsed.data.id,
        )
        return NextResponse.json(result, {
            headers: { 'Cache-Control': 'no-store' },
        })
    } catch (error) {
        if (error instanceof LiveErrorProviderError) {
            return NextResponse.json(
                {
                    error: 'Provider unavailable',
                    source: error.source,
                    code: error.code,
                },
                {
                    status: error.status,
                    headers: { 'Cache-Control': 'no-store' },
                },
            )
        }

        return NextResponse.json(
            {
                error: 'Provider unavailable',
                source: parsed.data.source,
                code: 'unavailable',
            },
            { status: 502, headers: { 'Cache-Control': 'no-store' } },
        )
    }
})
