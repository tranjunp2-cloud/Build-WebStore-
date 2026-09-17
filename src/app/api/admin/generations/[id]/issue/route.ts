import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withSuperAdmin } from '@/lib/admin/api-utils'
import { buildGenerationIssueDraft } from '@/lib/ai/generation-issue-escalation'
import { buildGenerationTicketIncidentSnapshot, serializeAdminGenerationDetail, type GenerationDetailSource, type GenerationRecoveryJobDetailSource } from '@/lib/ai/generation-recovery-policy'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type RouteContext = { params: Promise<{ id: string }> }

function isNotFoundError(error: unknown) {
    if (!error || typeof error !== 'object') return false
    const candidate = error as { status?: unknown; statusCode?: unknown }
    return candidate.status === 404 || candidate.statusCode === 404
}

function relationId(value: GenerationDetailSource['retryRootGeneration']) {
    return value ? String(typeof value === 'object' ? value.id : value) : null
}

function isUniqueViolation(error: unknown) {
    let current = error
    for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
        const record = current as { code?: unknown; cause?: unknown }
        if (record.code === '23505') return true
        current = record.cause
    }
    return false
}

export async function POST(req: NextRequest, ctx: RouteContext) {
    return withSuperAdmin(async (_req) => {
        const { id } = await ctx.params
        const generationId = Number(id)
        if (!/^\d+$/.test(id) || !Number.isSafeInteger(generationId) || generationId < 1) {
            return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Generation không hợp lệ.' } }, { status: 400 })
        }

        const payload = await getPayload({ config })
        let record: GenerationDetailSource
        try {
            record = await payload.findByID({ collection: 'ai-generation-records', id: generationId, depth: 1, overrideAccess: true }) as unknown as GenerationDetailSource
        } catch (error) {
            if (isNotFoundError(error)) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy generation.' } }, { status: 404 })
            console.error('[generation-issue] failed to load generation', { generationId, error: error instanceof Error ? error.name : 'unknown' })
            return NextResponse.json({ error: { code: 'LOAD_FAILED', message: 'Chưa thể tải dữ liệu generation.' } }, { status: 500 })
        }

        try {
            const retryRootId = relationId(record.retryRootGeneration) ?? String(record.id)
            const [history, jobs] = await Promise.all([
                payload.find({ collection: 'ai-generation-records', where: { or: [{ id: { equals: retryRootId } }, { retryRootGeneration: { equals: retryRootId } }] }, depth: 0, limit: 10, sort: '-createdAt', overrideAccess: true }),
                payload.find({ collection: 'generation_recovery_jobs', where: { sourceGeneration: { in: [String(record.id), retryRootId] } }, depth: 0, limit: 10, sort: '-queuedAt', overrideAccess: true }),
            ])
            const detail = serializeAdminGenerationDetail(record, history.docs as unknown as GenerationDetailSource[], jobs.docs as unknown as GenerationRecoveryJobDetailSource[])
            const draft = buildGenerationIssueDraft(detail, buildGenerationTicketIncidentSnapshot(detail))
            if (typeof draft === 'string') return NextResponse.json({ error: { code: draft, message: 'Generation này không cần tạo ticket Dev.' } }, { status: 409 })

            const existing = await payload.find({ collection: 'template-issues', where: { dedupeKey: { equals: draft.dedupeKey } }, depth: 0, limit: 1, overrideAccess: true })
            let issue = existing.docs[0]
            let created = false
            if (!issue) {
                try {
                    issue = await payload.create({ collection: 'template-issues', overrideAccess: true, data: { ...draft, category: 'ai-quality', status: 'backlog', relatedType: 'generation' } })
                    created = true
                } catch (error) {
                    if (!isUniqueViolation(error)) throw error
                    const concurrent = await payload.find({ collection: 'template-issues', where: { dedupeKey: { equals: draft.dedupeKey } }, depth: 0, limit: 1, overrideAccess: true })
                    issue = concurrent.docs[0]
                    if (!issue) throw error
                }
            }
            // The dedupe signature is lineage-scoped. Mark every failed,
            // ticket-eligible attempt in that lineage so a sibling does not
            // misleadingly offer another "Tạo ticket Dev" after reload.
            await payload.update({
                collection: 'ai-generation-records',
                where: {
                    and: [
                        { or: [{ id: { equals: retryRootId } }, { retryRootGeneration: { equals: retryRootId } }] },
                        { or: [{ recoveryStatus: { equals: 'ticket_required' } }, { recoveryStatus: { equals: 'exhausted' } }] },
                    ],
                },
                overrideAccess: true,
                data: { recoveryStatus: 'ticket_created' },
            })
            const issueRelatedId = typeof issue.relatedId === 'string' ? issue.relatedId : draft.relatedId
            return NextResponse.json({ data: { id: String(issue.id), created, href: `/studio/issues?relatedType=generation&relatedId=${encodeURIComponent(issueRelatedId)}` } }, { status: created ? 201 : 200 })
        } catch (error) {
            console.error('[generation-issue] failed to create issue', { generationId, error: error instanceof Error ? error.name : 'unknown' })
            return NextResponse.json({ error: { code: 'CREATE_FAILED', message: 'Chưa thể tạo ticket Dev. Vui lòng thử lại.' } }, { status: 500 })
        }
    })(req, ctx)
}
