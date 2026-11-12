/**
 * POST /api/admin/templates/[id]/score
 * Triggers rubric scoring for one template and persists the result.
 *
 * Body: { rubricVersion?: 'v1'|'v1.1'|'v1.2'|'v1.3', scorer?: string }
 * Returns: { avgScore, passRubric, dimensions, scoredAt, rubricVersion }
 *
 * Template block data lives in:
 *   - template.templatePages[].layout (JSON array of blocks) — preferred
 *   - template.defaultBlocks (JSON fallback for legacy templates)
 *
 * Rate-limited: 30 req/min per IP.
 * Auth: needs template.score.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { withStudioPermission, checkRateLimit } from '@/lib/admin/api-utils'
import { scoreFixture, loadRubric, DEFAULT_RUBRIC_VERSION } from '@/lib/ai-quality/scorer'
import type { RubricVersion } from '@/lib/ai-quality/scorer'
import type { HarnessBlock } from '../../../../../../../scripts/test-harness/types'

const SCORE_RATE_LIMIT = 30

const BodySchema = z.object({
    rubricVersion: z.enum(['v1', 'v1.1', 'v1.2', 'v1.3']).optional(),
    scorer: z.string().max(64).optional(),
})

/** Normalise a raw JSON block from template storage to HarnessBlock. */
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

/** Extract HarnessBlock[] from template.templatePages or defaultBlocks fallback. */
function extractBlocks(template: Record<string, unknown>): {
    homepageBlocks: HarnessBlock[]
    allBlocks: HarnessBlock[]
} {
    const templatePages = template.templatePages as Array<{
        title?: string
        slug?: string
        isHomepage?: boolean
        layout?: unknown
    }> | null | undefined

    if (Array.isArray(templatePages) && templatePages.length > 0) {
        const homepage =
            templatePages.find(p => p.isHomepage) ??
            templatePages.find(p => p.slug === '' || p.slug === 'home') ??
            templatePages[0]

        const toBlocks = (page: { layout?: unknown }): HarnessBlock[] =>
            Array.isArray(page.layout)
                ? (page.layout as Record<string, unknown>[])
                    .filter(b => typeof b === 'object' && b !== null)
                    .map(toHarnessBlock)
                : []

        return {
            homepageBlocks: toBlocks(homepage),
            allBlocks: templatePages.flatMap(toBlocks),
        }
    }

    // Fallback: legacy defaultBlocks JSON
    const defaultBlocks = template.defaultBlocks
    const legacyBlocks: HarnessBlock[] = Array.isArray(defaultBlocks)
        ? (defaultBlocks as Record<string, unknown>[])
            .filter(b => typeof b === 'object' && b !== null)
            .map(toHarnessBlock)
        : []

    return { homepageBlocks: legacyBlocks, allBlocks: legacyBlocks }
}

type RouteContext = { params: Promise<{ id: string }> }

export function POST(req: NextRequest, ctx: RouteContext) {
    return withStudioPermission('template.score', async (request) => {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
        if (!checkRateLimit(`score:${ip}`, SCORE_RATE_LIMIT)) {
            return NextResponse.json({ error: 'Rate limit exceeded. Try again in a minute.' }, { status: 429 })
        }

        const { id } = await ctx.params

        const rawBody = await request.json().catch(() => null)
        const parsed = BodySchema.safeParse(rawBody ?? {})
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parsed.error.flatten() },
                { status: 422 },
            )
        }

        const rubricVersion: RubricVersion = parsed.data.rubricVersion ?? DEFAULT_RUBRIC_VERSION
        const scorer = parsed.data.scorer ?? 'manual'

        const payload = await getPayload({ config })

        // 1. Fetch template (depth=0 — blocks stored as JSON, no relationship traversal needed)
        let template: Record<string, unknown>
        try {
            const doc = await payload.findByID({ collection: 'templates', id, depth: 0 })
            if (!doc) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
            template = doc as unknown as Record<string, unknown>
        } catch {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 })
        }

        // 2. Extract blocks from template storage
        const { homepageBlocks, allBlocks } = extractBlocks(template)

        // 3. Score
        const rubric = loadRubric(rubricVersion)
        const rawCategory = template.category
        const category: string = Array.isArray(rawCategory)
            ? (rawCategory[0] as string ?? 'unknown')
            : ((rawCategory as string) ?? 'unknown')

        const themeConfig = (template.defaultTheme ?? {}) as Record<string, unknown>

        const fixtureScore = scoreFixture({
            fixtureId: String(id),
            category,
            blocks: homepageBlocks,
            theme: themeConfig,
            allBlocks,
            rubric,
        })

        const avgScore = fixtureScore.weighted
        const passRubric = fixtureScore.status === 'pass'
        const scoredAt = new Date().toISOString()

        // 4. Dimension summary for storage
        const dimensions = fixtureScore.dimensions.map(d => ({
            name: d.name,
            score: d.score,
            weight: d.weight,
            criteriaMet: d.criteria.filter(c => c.status === 'pass').length,
            criteriaTotal: d.criteria.length,
        }))

        // 5. Persist score snapshot
        await payload.create({
            collection: 'template-quality-scores',
            data: {
                template: Number(id),
                rubricVersion,
                avgScore,
                passRubric,
                dimensions,
                scorer,
                scoredAt,
            },
        })

        return NextResponse.json({
            data: { avgScore, passRubric, dimensions, scoredAt, rubricVersion },
        })
    })(req)
}
