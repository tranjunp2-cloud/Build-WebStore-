/**
 * POST /api/admin/generations/[id]/rerun
 *
 * Re-invokes the same AI endpoint with the same stored prompt.
 * Creates a NEW ai-generation-records row (does not mutate the original).
 * Rate-limited to 5 reruns/min per admin user.
 *
 * Only supports rerunning 'site-generator' endpoint in MVP.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withSuperAdmin, checkRateLimit } from '@/lib/admin/api-utils'
import { generateSiteWithAI, resolveSiteGenerationMode } from '@/lib/ai/openai-generator'
import { finishCapture, startCapture } from '@/lib/ai/capture-generation'
import { resolveGenerationRecordActor } from '@/lib/ai/generation-actor'
import { runWithAiActor } from '@/lib/ai-platform/actor-scope'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: RouteContext) {
    return withSuperAdmin(async (_req, adminCtx) => {
        const { id } = await ctx.params

        if (!id || isNaN(Number(id))) {
            return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
        }

        // Rate limit: 5 reruns/min per admin user
        const rateLimitKey = `rerun:${adminCtx.user.id}`
        if (!checkRateLimit(rateLimitKey, 5)) {
            return NextResponse.json({ error: 'Rate limit exceeded (5 reruns/min)' }, { status: 429 })
        }

        const payload = await getPayload({ config })

        // Load original record
        let record: Awaited<ReturnType<typeof payload.findByID>>
        try {
            record = await payload.findByID({
                collection: 'ai-generation-records',
                id: Number(id),
                depth: 0,
            })
        } catch {
            return NextResponse.json({ error: 'Record not found' }, { status: 404 })
        }

        const endpoint = record.endpoint as string
        const promptText = (record.promptText as string | undefined) ?? ''

        // Only site-generator supports rerun in MVP
        if (endpoint !== 'site-generator') {
            return NextResponse.json(
                { error: `Rerun not supported for endpoint: ${endpoint}` },
                { status: 422 },
            )
        }

        if (!promptText) {
            return NextResponse.json(
                { error: 'No prompt stored for this record (hashed-only mode)' },
                { status: 422 },
            )
        }

        // Reconstruct minimal BusinessInfoInput from stored prompt.
        // Stored format: "businessName | industry | shortDescription | products"
        const parts = promptText.split(' | ')
        const businessInfo = {
            businessName: parts[0] ?? 'Business',
            industry: parts[1] ?? '',
            shortDescription: parts[2] ?? '',
            products: parts[3] ?? '',
        }

        const capture = await startCapture({
            endpoint: 'site-generator-rerun-composition',
            prompt: promptText,
            category: businessInfo.industry || undefined,
            userId: adminCtx.user.id,
            payload,
        })
        try {
            // Runs as the merchant who made the request, billed to their workspace.
            // No actor → rule-based, with the reason recorded (not a plain success).
            const { actor, skipReason } = await resolveGenerationRecordActor(payload, { user: record.user, tenant: record.tenant })
            const { result, modeReason, aiSkipReason } = actor
                ? await runWithAiActor(actor, () => generateSiteWithAI(businessInfo))
                : await generateSiteWithAI(businessInfo, undefined, 'auto', undefined, undefined, undefined, {
                    modeDecision: await resolveSiteGenerationMode(skipReason),
                })
            await finishCapture(capture, {
                status: 'success',
                selectedBlocks: result.blocks.map((block) => String((block as { blockType?: unknown }).blockType ?? '')),
                outputSnapshot: {
                    path: 'admin-rerun-composition',
                    siteName: result.siteName,
                    ...(modeReason ? { modeReason } : {}),
                    ...(aiSkipReason ? { aiSkipReason } : {}),
                },
            })

            return NextResponse.json({
                data: {
                    message: 'Rerun completed',
                    siteName: result.siteName,
                    blockCount: result.blocks.length,
                    ...(modeReason ? { modeReason } : {}),
                    ...(aiSkipReason ? { aiSkipReason } : {}),
                },
            })
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            await finishCapture(capture, { status: 'failed', error: message })
            return NextResponse.json({ error: 'Rerun failed. Please try again later.' }, { status: 500 })
        }
    })(req)
}
