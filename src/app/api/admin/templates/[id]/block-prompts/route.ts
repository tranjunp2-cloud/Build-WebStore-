/**
 * PATCH /api/admin/templates/[id]/block-prompts
 * Upserts a per-block AI prompt override into templates.blockPromptOverrides JSON.
 * Body: { blockSlug: string, prompt: string | null }
 *   - prompt: null → removes the override for this blockSlug
 *   - prompt: string → upserts override with updatedAt timestamp
 *
 * Guard: withSuperAdmin. Validates blockSlug ∈ block registry.
 *
 * Concurrency: uses atomic PostgreSQL jsonb_set / - operator so concurrent
 * PATCH calls on different slugs never silently overwrite each other.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
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

// ── Drizzle row shape ─────────────────────────────────────────────────────────

type UpdateRow = { block_prompt_overrides: unknown }

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

        // Verify template exists before touching it
        try {
            await payload.findByID({ collection: 'templates', id, depth: 0 })
        } catch {
            return NextResponse.json({ error: 'template not found' }, { status: 404 })
        }

        // Atomic jsonb operation — avoids read-modify-write race when concurrent
        // PATCH calls update different slugs at the same time.
        const db = (payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> } }).drizzle
        let updatedOverrides: BlockPromptOverridesMap

        try {
            let rows: UpdateRow[]
            if (prompt === null) {
                // Remove the key from the jsonb column atomically
                rows = await db.execute(sql`
                    UPDATE templates
                    SET block_prompt_overrides = COALESCE(block_prompt_overrides, '{}'::jsonb) - ${blockSlug}::text
                    WHERE id = ${id}::int
                    RETURNING block_prompt_overrides
                `) as UpdateRow[]
            } else {
                const overrideValue = JSON.stringify({
                    prompt,
                    updatedAt: new Date().toISOString(),
                    updatedBy: user.email ?? null,
                })
                // Merge a single key atomically — other concurrent writes to different
                // keys are safe because || operates on disjoint key sets.
                rows = await db.execute(sql`
                    UPDATE templates
                    SET block_prompt_overrides = COALESCE(block_prompt_overrides, '{}'::jsonb) || jsonb_build_object(${blockSlug}::text, ${overrideValue}::jsonb)
                    WHERE id = ${id}::int
                    RETURNING block_prompt_overrides
                `) as UpdateRow[]
            }

            if (!rows || rows.length === 0) {
                return NextResponse.json({ error: 'template not found' }, { status: 404 })
            }

            updatedOverrides = (rows[0].block_prompt_overrides ?? {}) as BlockPromptOverridesMap
        } catch (err) {
            console.error('[block-prompts] atomic jsonb update failed:', err)
            return NextResponse.json({ error: 'failed to update block prompt override' }, { status: 500 })
        }

        return NextResponse.json({ data: updatedOverrides })
    })(req)
}
