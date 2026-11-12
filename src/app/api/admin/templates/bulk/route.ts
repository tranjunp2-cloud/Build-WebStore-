/**
 * POST /api/admin/templates/bulk
 * Bulk actions: publish | archive | schedule | delete | re-score
 *
 * re-score: max 20 templates per call (Vercel 60s timeout constraint).
 * Rate-limited: 10 req/min per user, so one person's refused calls do not use up the office's shared IP.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { studioForbidden, withStudioSeat, BulkActionSchema, checkRateLimit } from '@/lib/admin/api-utils'
import { canSetTemplateStatus, hasStudioPermission } from '@/lib/admin/studio-permissions'
import { scoreFixture, loadRubric, DEFAULT_RUBRIC_VERSION } from '@/lib/ai-quality/scorer'
import type { RubricVersion } from '@/lib/ai-quality/scorer'
import type { HarnessBlock } from '../../../../../../scripts/test-harness/types'

const BULK_RESCORE_MAX = 20

/** Inline block extractor (mirrors score/route.ts — avoids circular import). */
function toHarnessBlock(raw: Record<string, unknown>): HarnessBlock {
    const { blockType, variant, ...rest } = raw
    const STRIP = new Set(['adminNotes', 'hiddenConfig', 'id', '_uuid', '_order', 'createdAt', 'updatedAt', 'blockName'])
    const data: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(rest)) {
        if (!STRIP.has(k)) data[k] = v
    }
    return {
        blockType: (blockType as string) ?? 'unknown',
        ...(variant ? { variant: variant as string } : {}),
        data,
    }
}

function extractTemplateBlocks(template: Record<string, unknown>): HarnessBlock[] {
    const templatePages = template.templatePages as Array<{ layout?: unknown }> | null | undefined
    if (Array.isArray(templatePages) && templatePages.length > 0) {
        return templatePages.flatMap(p =>
            Array.isArray(p.layout)
                ? (p.layout as Record<string, unknown>[]).filter(Boolean).map(toHarnessBlock)
                : [],
        )
    }
    const defaultBlocks = template.defaultBlocks
    return Array.isArray(defaultBlocks)
        ? (defaultBlocks as Record<string, unknown>[]).filter(Boolean).map(toHarnessBlock)
        : []
}

export const POST = withStudioSeat(async (req: NextRequest, { user }) => {
    if (!checkRateLimit(`bulk:${user.id}`)) {
        return NextResponse.json({ error: 'Rate limit exceeded. Try again in a minute.' }, { status: 429 })
    }

    const body = await req.json().catch(() => null)
    if (!body) {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = BulkActionSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Validation failed', details: parsed.error.flatten() },
            { status: 422 },
        )
    }

    const { ids, action, scheduledFor, rubricVersion } = parsed.data

    // Each action has its own owner. Archive is checked per template below because it depends on the status.
    const requiredPermission = action === 're-score' ? 'template.score' : action === 'publish' || action === 'schedule' ? 'template.review' : null
    if (requiredPermission && !hasStudioPermission(user.roles, requiredPermission)) return studioForbidden()

    if (action === 'schedule' && !scheduledFor) {
        return NextResponse.json({ error: 'scheduledFor is required for schedule action' }, { status: 422 })
    }

    if (action === 're-score' && ids.length > BULK_RESCORE_MAX) {
        return NextResponse.json(
            { error: `Bulk re-score is limited to ${BULK_RESCORE_MAX} templates per call to stay within Vercel timeout.` },
            { status: 400 },
        )
    }

    const payload = await getPayload({ config })
    const results: Array<{ id: string | number; ok: boolean; error?: string }> = []

    // ── re-score branch ────────────────────────────────────────────────────────
    if (action === 're-score') {
        const version: RubricVersion = (rubricVersion as RubricVersion | undefined) ?? DEFAULT_RUBRIC_VERSION
        const rubric = loadRubric(version)

        for (const id of ids) {
            try {
                const doc = await payload.findByID({ collection: 'templates', id: id as string, depth: 0 })
                if (!doc) throw new Error('Not found')

                const template = doc as unknown as Record<string, unknown>
                const allBlocks = extractTemplateBlocks(template)
                const homepageBlocks = allBlocks // same blocks for homepage scoring

                const rawCategory = template.category
                const category: string = Array.isArray(rawCategory)
                    ? ((rawCategory[0] as string) ?? 'unknown')
                    : ((rawCategory as string) ?? 'unknown')

                const fixtureScore = scoreFixture({
                    fixtureId: String(id),
                    category,
                    blocks: homepageBlocks,
                    theme: (template.defaultTheme ?? {}) as Record<string, unknown>,
                    allBlocks,
                    rubric,
                })

                const dimensions = fixtureScore.dimensions.map(d => ({
                    name: d.name,
                    score: d.score,
                    weight: d.weight,
                    criteriaMet: d.criteria.filter(c => c.status === 'pass').length,
                    criteriaTotal: d.criteria.length,
                }))

                await payload.create({
                    collection: 'template-quality-scores',
                    data: {
                        template: Number(id),
                        rubricVersion: version,
                        avgScore: fixtureScore.weighted,
                        passRubric: fixtureScore.status === 'pass',
                        dimensions,
                        scorer: 'bulk',
                        scoredAt: new Date().toISOString(),
                    },
                })

                results.push({ id, ok: true })
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error'
                results.push({ id, ok: false, error: message })
            }
        }

        const succeeded = results.filter(r => r.ok).length
        const failed = results.filter(r => !r.ok).length
        return NextResponse.json({ data: { succeeded, failed, results } })
    }

    // ── status-change branch (publish | archive | schedule | delete) ───────────
    const statusMap: Record<string, string> = {
        publish: 'live',
        archive: 'archived',
        delete: 'archived',
        schedule: 'scheduled',
    }

    const newStatus = statusMap[action]

    for (const id of ids) {
        try {
            const current = await payload.findByID({ collection: 'templates', id: id as string, depth: 0 })
            if (!canSetTemplateStatus(user.roles, current.status, newStatus)) {
                results.push({ id, ok: false, error: 'Forbidden' })
                continue
            }
            const updateData: Record<string, unknown> = { status: newStatus }
            if (action === 'schedule' && scheduledFor) {
                updateData.scheduledFor = scheduledFor
            }
            await payload.update({ collection: 'templates', id: id as string, data: updateData })
            results.push({ id, ok: true })
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error'
            results.push({ id, ok: false, error: message })
        }
    }

    const succeeded = results.filter(r => r.ok).length
    const failed = results.filter(r => !r.ok).length
    return NextResponse.json({ data: { succeeded, failed, results } })
})
