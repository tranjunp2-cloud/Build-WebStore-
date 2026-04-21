/**
 * PATCH /api/admin/templates/[id]/block-prompts
 * Upserts a per-block AI prompt override into templates.blockPromptOverrides JSON.
 * Body: { blockSlug: string, prompt: string | null }
 *   - prompt: null → removes the override for this blockSlug
 *   - prompt: string → upserts override with updatedAt timestamp
 *
 * Guard: withSuperAdmin. Validates blockSlug ∈ block registry.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withSuperAdmin } from '@/lib/admin/api-utils'
import { getRegistrySlugs } from '@/lib/admin/block-registry-reader'
import { getPayload } from 'payload'
import config from '@payload-config'

// ── Validation ────────────────────────────────────────────────────────────────

const PatchSchema = z.object({
    blockSlug: z.string().min(1).max(80),
    /** null = remove override */
    prompt: z.string().max(4000).nullable(),
})

export type BlockPromptOverride = {
    prompt: string
    updatedAt: string
    updatedBy?: string
}

export type BlockPromptOverridesMap = Record<string, BlockPromptOverride>

// ── Route ─────────────────────────────────────────────────────────────────────

type RouteContext = { params: Promise<{ id: string }> }

export const PATCH = async (req: NextRequest, ctx: RouteContext) => {
    const { id } = await ctx.params
    return withSuperAdmin(async (_req, { user }) => {
        // id resolved above from Next.js route context before entering the guard

        let body: unknown
        try {
            body = await req.json()
        } catch {
            return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
        }

        const parsed = PatchSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'validation failed', details: parsed.error.flatten() },
                { status: 422 },
            )
        }

        const { blockSlug, prompt } = parsed.data

        // Registry whitelist — reject unknown slugs
        if (!getRegistrySlugs().has(blockSlug)) {
            return NextResponse.json({ error: 'unknown block slug' }, { status: 400 })
        }

        const payload = await getPayload({ config })

        // Fetch current overrides map
        let template: Record<string, unknown>
        try {
            template = await payload.findByID({
                collection: 'templates',
                id,
                depth: 0,
            }) as Record<string, unknown>
        } catch {
            return NextResponse.json({ error: 'template not found' }, { status: 404 })
        }

        const current = (template.blockPromptOverrides ?? {}) as BlockPromptOverridesMap

        let updated: BlockPromptOverridesMap
        if (prompt === null) {
            // Remove override for this blockSlug
            const { [blockSlug]: _removed, ...rest } = current
            updated = rest
        } else {
            // Upsert override with timestamp + author
            updated = {
                ...current,
                [blockSlug]: {
                    prompt,
                    updatedAt: new Date().toISOString(),
                    updatedBy: user.email,
                },
            }
        }

        await payload.update({
            collection: 'templates',
            id,
            data: { blockPromptOverrides: updated },
        })

        return NextResponse.json({ data: updated })
    })(req)
}
