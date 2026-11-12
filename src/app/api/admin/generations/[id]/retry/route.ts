import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { withStudioPermission } from '@/lib/admin/api-utils'
import { queueGenerationRecovery } from '@/lib/ai/generation-recovery'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const Body = z.object({ reason: z.literal('ops_manual_retry') })
const UUID = z.string().uuid()

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: RouteContext) {
    return withStudioPermission('generation.retry', async (_req, adminCtx) => {
        const { id } = await ctx.params
        const generationId = Number(id)
        const parsedBody = Body.safeParse(await req.json().catch(() => null))
        const idempotencyKey = UUID.safeParse(req.headers.get('idempotency-key'))
        if (!Number.isSafeInteger(generationId) || generationId < 1 || !parsedBody.success || !idempotencyKey.success) {
            return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Yêu cầu gen lại không hợp lệ.' } }, { status: 400 })
        }

        const payload = await getPayload({ config })
        const result = await queueGenerationRecovery(payload, { parentGenerationId: generationId, requestedBy: adminCtx.user.id, idempotencyKey: idempotencyKey.data })
        if (result.kind === 'accepted') return NextResponse.json({ jobId: result.jobId, parentGenerationId: result.parentGenerationId, childGenerationId: result.childGenerationId, recoveryStatus: 'retrying', userSafeMessage: 'Đã xếp hàng gen lại website thành bản nháp mới.', idempotent: result.idempotent }, { status: 202 })
        if (result.kind === 'conflict') return NextResponse.json({ error: { code: 'RETRY_IN_PROGRESS', message: 'Website đang được gen lại.' }, childGenerationId: result.childGenerationId }, { status: 409 })
        const status = result.code === 'NOT_FOUND' ? 404 : result.code === 'NOT_RETRYABLE' || result.code === 'INVALID_SNAPSHOT' ? 422 : 409
        return NextResponse.json({ error: { code: result.code, message: result.message } }, { status })
    })(req, ctx)
}
