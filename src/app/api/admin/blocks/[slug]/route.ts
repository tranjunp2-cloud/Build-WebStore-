/**
 * GET  /api/admin/blocks/[slug] — single block merged with override + variants
 * PATCH /api/admin/blocks/[slug] — upsert BlockCatalogEntry for this slug
 * Reads for any Studio seat; PATCH needs block.edit and rejects unknown slugs (registry whitelist).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withStudioPermission, withSuperAdmin } from '@/lib/admin/api-utils'
import { getBlockBySlug, getRegistrySlugs } from '@/lib/admin/block-registry-reader'
import { getBlockUsageCounts } from '@/lib/admin/block-usage-counter'
import { getPayload } from 'payload'
import config from '@payload-config'

const PatchBlockSchema = z.object({
    descriptionOverride: z.string().max(2000).optional().nullable(),
    descriptionOverrideVi: z.string().max(2000).optional().nullable(),
    displayOrder: z.number().int().min(0).max(9999).optional(),
    curatedPreviewUrl: z.string().url().max(2048).optional().nullable().or(z.literal('')),
    hiddenFromCatalog: z.boolean().optional(),
})

type RouteContext = { params: Promise<{ slug: string }> }

export const GET = async (req: NextRequest, ctx: RouteContext) => {
    return withSuperAdmin(async () => {
        const { slug } = await ctx.params
        const block = getBlockBySlug(slug)
        if (!block) {
            return NextResponse.json({ error: 'Block not found' }, { status: 404 })
        }

        const [usageCounts, payload] = await Promise.all([
            getBlockUsageCounts(),
            getPayload({ config }),
        ])

        const [overridesResult, variantsResult] = await Promise.all([
            payload.find({
                collection: 'block-catalog-entries',
                where: { slug: { equals: slug } },
                limit: 1,
                depth: 0,
            }),
            payload.find({
                collection: 'block-variants',
                where: { blockSlug: { equals: slug } },
                limit: 100,
                depth: 0,
            }),
        ])

        const override = overridesResult.docs[0] ?? null

        return NextResponse.json({
            data: {
                ...block,
                usageCount: usageCounts[slug] ?? 0,
                descriptionOverride: override?.descriptionOverride ?? null,
                descriptionOverrideVi: override?.descriptionOverrideVi ?? null,
                displayOrder: override?.displayOrder ?? 0,
                curatedPreviewUrl: override?.curatedPreviewUrl ?? null,
                hiddenFromCatalog: override?.hiddenFromCatalog ?? false,
                overrideId: override?.id ?? null,
                variantOverrides: variantsResult.docs,
            },
        })
    })(req)
}

export const PATCH = async (req: NextRequest, ctx: RouteContext) => {
    return withStudioPermission('block.edit', async () => {
        const { slug } = await ctx.params

        // Registry whitelist — reject unknown slugs
        if (!getRegistrySlugs().has(slug)) {
            return NextResponse.json({ error: 'Unknown block slug' }, { status: 400 })
        }

        let body: unknown
        try {
            body = await req.json()
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const parsed = PatchBlockSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parsed.error.flatten() },
                { status: 422 }
            )
        }

        const payload = await getPayload({ config })

        // Check for existing entry to decide create vs update
        const existing = await payload.find({
            collection: 'block-catalog-entries',
            where: { slug: { equals: slug } },
            limit: 1,
            depth: 0,
        })

        let result
        if (existing.docs.length > 0) {
            result = await payload.update({
                collection: 'block-catalog-entries',
                id: existing.docs[0].id,
                data: parsed.data,
            })
        } else {
            result = await payload.create({
                collection: 'block-catalog-entries',
                data: { slug, ...parsed.data },
            })
        }

        return NextResponse.json({ data: result })
    })(req)
}
