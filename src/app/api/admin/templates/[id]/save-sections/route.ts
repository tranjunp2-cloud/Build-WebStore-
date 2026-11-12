/**
 * POST /api/admin/templates/[id]/save-sections
 * Updates templatePages[0].layout + creates a TemplateVersion row.
 * Needs template.edit and a draft or review template. Rate-limited to 30/min/user.
 *
 * Phase 04: After saving, increments fields_edited on any ai_generation_records
 * row linked to a site derived from this template. Best-effort — errors swallowed.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { studioForbidden, withStudioPermission, checkRateLimit } from '@/lib/admin/api-utils'
import { canEditTemplateContent } from '@/lib/admin/studio-permissions'
import { countChangedFields } from '@/lib/admin/section-field-diff'
import type { PlatformUser } from '@/types/user'

type RouteContext = { params: Promise<{ id: string }> }

const SectionSchema = z.object({
    id: z.string().min(1),
    blockType: z.string().min(1),
    config: z.record(z.unknown()),
})

const BodySchema = z.object({
    sections: z.array(SectionSchema).max(200),
    changelog: z.string().max(500).optional(),
})

// ── fieldsEdited increment (Phase 04 — override-rate) ────────────────────────

/**
 * Increment fields_edited on ai_generation_records rows linked to the template's site.
 * Best-effort — never throws or blocks the save response.
 *
 * Join path: templates(id) ← sites(origin_template_id) ← ai_generation_records(site_id)
 * If origin_template_id column is absent the SQL silently returns 0 rows (no-op).
 */
async function incrementFieldsEdited(
    payload: import('payload').Payload,
    templateId: number,
    delta: number,
): Promise<void> {
    if (delta <= 0) return

    try {
        const db = payload.db as unknown as {
            drizzle: { execute: (sql: unknown) => Promise<unknown> }
        }
        if (!db?.drizzle?.execute) return

        const { sql } = await import('drizzle-orm')

        // COALESCE guarantees idempotent increment even on concurrent saves.
        await db.drizzle.execute(
            sql`UPDATE ai_generation_records
                SET fields_edited = COALESCE(fields_edited, 0) + ${delta}
                WHERE site_id IN (
                    SELECT id FROM sites
                    WHERE origin_template_id = ${templateId}
                )`,
        )
    } catch (err) {
        // Swallow silently — monitoring must not block the save
        console.debug(
            '[save-sections] fieldsEdited increment skipped:',
            err instanceof Error ? err.message : String(err),
        )
    }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, ctx: RouteContext) {
    return withStudioPermission('template.edit', async (_req, adminCtx) => {
        const user = adminCtx.user as PlatformUser
        const userId = user.id

        // Rate-limit: 30/min per user
        if (!checkRateLimit(`save-sections:${userId}`, 30)) {
            return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
        }

        const { id } = await ctx.params
        const templateId = Number(id)
        if (isNaN(templateId)) {
            return NextResponse.json({ error: 'Invalid template id' }, { status: 400 })
        }

        const body = await req.json().catch(() => null)
        if (!body) {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const parsed = BodySchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parsed.error.flatten() },
                { status: 422 },
            )
        }

        const { sections, changelog } = parsed.data
        const payload = await getPayload({ config })

        // Fetch existing template to preserve templatePages metadata
        const template = await payload.findByID({
            collection: 'templates',
            id: String(templateId),
            depth: 0,
        })

        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 })
        }
        if (!canEditTemplateContent(adminCtx.user.roles, template.status)) return studioForbidden()

        // Update templatePages[0].layout — preserve pageId + metadata, replace layout array
        const existingPages: unknown[] = Array.isArray(template.templatePages)
            ? template.templatePages
            : []

        // Phase 04: capture old layout before overwrite for field-diff
        const oldLayout: Array<Record<string, unknown>> =
            existingPages.length > 0
                ? ((existingPages[0] as Record<string, unknown>)?.layout as Array<Record<string, unknown>> ?? [])
                : []

        const updatedPages =
            existingPages.length > 0
                ? existingPages.map((page: unknown, idx: number) => {
                      if (idx === 0) {
                          const p = page as Record<string, unknown>
                          return { ...p, layout: sections }
                      }
                      return page
                  })
                : [{ title: 'Home', slug: 'home', isHomepage: true, layout: sections }]

        await payload.update({
            collection: 'templates',
            id: String(templateId),
            data: { templatePages: updatedPages as never[] },
            context: { skipComplianceHook: true },
        })

        // Phase 04: count changed fields + increment fieldsEdited (fire-and-forget)
        const editedDelta = countChangedFields(oldLayout, sections)
        void incrementFieldsEdited(payload, templateId, editedDelta)

        // Determine next version number
        const latestVersions = await payload.find({
            collection: 'template-versions',
            where: { template: { equals: templateId } },
            sort: '-versionNumber',
            limit: 1,
            depth: 0,
        })

        const latestDoc = latestVersions.docs[0] as unknown as { versionNumber?: number } | undefined
        const nextVersion = latestDoc?.versionNumber != null ? latestDoc.versionNumber + 1 : 1

        // Create version snapshot
        const version = await payload.create({
            collection: 'template-versions',
            data: {
                template: templateId,
                versionNumber: nextVersion,
                sectionsSnapshot: sections,
                changelog: changelog ?? null,
                createdBy: Number(userId),
            },
        })

        return NextResponse.json({ version, savedAt: new Date().toISOString() })
    })(req)
}
