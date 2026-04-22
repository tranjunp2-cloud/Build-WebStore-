/**
 * GET /api/admin/blocks/[slug]/prompt-overrides
 * Returns all templates that have a prompt override for this block slug.
 * Used by Block Detail AI tab to show "Overridden in N templates" list.
 * Super-admin only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/admin/api-utils'
import { getRegistrySlugs } from '@/lib/admin/block-registry-reader'
import { getPayload } from 'payload'
import config from '@payload-config'

export type PromptOverrideEntry = {
    templateId: number | string
    templateName: string
    /** First 80 chars of the override prompt */
    promptSnippet: string
    updatedAt: string
    updatedBy?: string
}

type RouteContext = { params: Promise<{ slug: string }> }

export const GET = async (req: NextRequest, ctx: RouteContext) => {
    return withSuperAdmin(async () => {
        const { slug } = await ctx.params

        if (!getRegistrySlugs().has(slug)) {
            return NextResponse.json({ error: 'unknown block slug' }, { status: 400 })
        }

        const payload = await getPayload({ config })

        // Query templates where blockPromptOverrides contains this slug key
        // Postgres JSONB operator: ? checks for key existence
        const result = await (payload.find as (...a: unknown[]) => Promise<{ docs: unknown[] }>)({
            collection: 'templates',
            limit: 200,
            depth: 0,
            // Payload doesn't support raw JSONB queries — fetch all and filter in JS
            // Performance: ~200 templates, small JSON, well within budget
        })

        type TemplateDoc = {
            id: number | string
            name: string
            blockPromptOverrides?: Record<string, { prompt: string; updatedAt: string; updatedBy?: string }>
        }

        const overrides: PromptOverrideEntry[] = []
        for (const doc of result.docs as TemplateDoc[]) {
            const map = doc.blockPromptOverrides
            if (!map || typeof map !== 'object') continue
            const entry = map[slug]
            if (!entry) continue
            overrides.push({
                templateId: doc.id,
                templateName: doc.name ?? String(doc.id),
                promptSnippet: entry.prompt.slice(0, 80),
                updatedAt: entry.updatedAt,
                updatedBy: entry.updatedBy,
            })
        }

        return NextResponse.json({ data: overrides, meta: { count: overrides.length } })
    })(req)
}
