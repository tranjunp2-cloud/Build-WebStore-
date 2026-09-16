/** GET /api/admin/generations/[id] — bounded, Super Admin-safe debug detail. */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withSuperAdmin } from '@/lib/admin/api-utils'
import { serializeAdminGenerationDetail, type GenerationDetailSource, type GenerationRecoveryJobDetailSource } from '@/lib/ai/generation-recovery-policy'

type RouteContext = { params: Promise<{ id: string }> }

function isNotFoundError(error: unknown) {
    if (!error || typeof error !== 'object') return false
    const candidate = error as { status?: unknown; statusCode?: unknown }
    return candidate.status === 404 || candidate.statusCode === 404
}

function relationId(value: GenerationDetailSource['retryRootGeneration']) {
    if (!value) return null
    return String(typeof value === 'object' ? value.id : value)
}

export async function GET(req: NextRequest, ctx: RouteContext) {
    return withSuperAdmin(async (_request, context) => {
        const { id } = await ctx.params

        const numericId = Number(id)
        if (!/^\d+$/.test(id) || !Number.isSafeInteger(numericId) || numericId <= 0) {
            return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
        }

        let record: GenerationDetailSource
        let payload: Awaited<ReturnType<typeof getPayload>>
        try {
            payload = await getPayload({ config })
            record = await payload.findByID({
                collection: 'ai-generation-records',
                id: numericId,
                depth: 1,
                overrideAccess: true,
            }) as unknown as GenerationDetailSource
        } catch (error) {
            if (isNotFoundError(error)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
            console.error('[generation-detail] failed to load record', { generationId: numericId, error: error instanceof Error ? error.name : 'unknown' })
            return NextResponse.json({ error: 'Unable to load generation detail' }, { status: 500 })
        }

        try {
            // Bounded root-lineage and recovery job queries provide the exact
            // retry timeline without returning raw worker payloads or scans.
            const retryRootId = relationId(record.retryRootGeneration) ?? String(record.id)
            const history = await payload.find({
                collection: 'ai-generation-records',
                where: { or: [{ id: { equals: retryRootId } }, { retryRootGeneration: { equals: retryRootId } }] },
                depth: 0,
                limit: 10,
                sort: '-createdAt',
                overrideAccess: true,
            })
            const generationIds = Array.from(new Set([String(record.id), ...history.docs.map((item) => String(item.id))]))
            const jobs = await payload.find({
                collection: 'generation_recovery_jobs',
                where: { sourceGeneration: { in: generationIds } },
                depth: 0,
                limit: 10,
                sort: '-queuedAt',
                overrideAccess: true,
            })
            return NextResponse.json({ data: serializeAdminGenerationDetail(record, history.docs as unknown as GenerationDetailSource[], jobs.docs as unknown as GenerationRecoveryJobDetailSource[]) })
        } catch (error) {
            console.error('[generation-detail] failed to serialize safe detail', { generationId: numericId, error: error instanceof Error ? error.name : 'unknown' })
            return NextResponse.json({ error: 'Unable to load generation detail' }, { status: 500 })
        }
    })(req, ctx)
}
