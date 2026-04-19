/**
 * POST /api/admin/templates/[id]/save-sections
 * Updates templatePages[0].layout + creates a TemplateVersion row.
 * Super-admin only. Rate-limited to 30/min/user.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { withSuperAdmin, checkRateLimit } from '@/lib/admin/api-utils'
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

export async function POST(req: NextRequest, ctx: RouteContext) {
    return withSuperAdmin(async (_req, adminCtx) => {
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

        // Update templatePages[0].layout — preserve pageId + metadata, replace layout array
        const existingPages: unknown[] = Array.isArray(template.templatePages)
            ? template.templatePages
            : []

        const updatedPages = existingPages.length > 0
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
