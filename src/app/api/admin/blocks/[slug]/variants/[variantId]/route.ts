/**
 * PATCH /api/admin/blocks/[slug]/variants/[variantId]
 * Upsert override metadata for a specific block variant.
 * [variantId] is the variant name string (e.g. "centered"), not a numeric DB id.
 * Needs block.edit. Validates slug against registry whitelist.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withStudioPermission } from '@/lib/admin/api-utils'
import { getBlockBySlug, getRegistrySlugs } from '@/lib/admin/block-registry-reader'
import { getPayload } from 'payload'
import config from '@payload-config'

const PatchVariantSchema = z.object({
    previewUrlOverride: z.string().url().max(2048).optional().nullable().or(z.literal('')),
    notes: z.string().max(2000).optional().nullable(),
    enabled: z.boolean().optional(),
    displayName: z.string().max(100).optional().nullable(),
})

type RouteContext = { params: Promise<{ slug: string; variantId: string }> }

export const PATCH = async (req: NextRequest, ctx: RouteContext) => {
    return withStudioPermission('block.edit', async () => {
        const { slug, variantId } = await ctx.params

        // Registry whitelist check
        if (!getRegistrySlugs().has(slug)) {
            return NextResponse.json({ error: 'Unknown block slug' }, { status: 400 })
        }

        // Variant whitelist check — variantId must be a known variant for this block
        const block = getBlockBySlug(slug)
        if (!block) {
            return NextResponse.json({ error: 'Block not found' }, { status: 404 })
        }
        if (!block.variants.includes(variantId)) {
            return NextResponse.json({ error: 'Unknown variant' }, { status: 400 })
        }

        let body: unknown
        try {
            body = await req.json()
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const parsed = PatchVariantSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parsed.error.flatten() },
                { status: 422 }
            )
        }

        const payload = await getPayload({ config })

        // Find existing row for this (blockSlug, variantName) pair
        const existing = await payload.find({
            collection: 'block-variants',
            where: {
                and: [
                    { blockSlug: { equals: slug } },
                    { variantName: { equals: variantId } },
                ],
            },
            limit: 1,
            depth: 0,
        })

        let result
        if (existing.docs.length > 0) {
            result = await payload.update({
                collection: 'block-variants',
                id: existing.docs[0].id,
                data: parsed.data,
            })
        } else {
            result = await payload.create({
                collection: 'block-variants',
                data: {
                    blockSlug: slug,
                    variantName: variantId,
                    ...parsed.data,
                },
            })
        }

        return NextResponse.json({ data: result })
    })(req)
}
