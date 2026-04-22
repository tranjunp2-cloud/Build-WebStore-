/**
 * GET /api/admin/blocks/[slug]/presets
 * Returns content presets for a block slug from BlockCatalogEntries.
 * MVP: read-only listing. Full preset editor deferred to F07.
 * Super-admin only, zod-validated slug.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withSuperAdmin } from '@/lib/admin/api-utils'
import { getBlockBySlug } from '@/lib/admin/block-registry-reader'
import { getPayload } from 'payload'
import config from '@payload-config'

// Stub shape — full preset schema lives in F07
export type BlockPresetStub = {
    id: string
    label: string
    description: string | null
    source: 'catalog' | 'seed'
}

const SlugSchema = z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Invalid block slug')

type RouteContext = { params: Promise<{ slug: string }> }

export const GET = async (req: NextRequest, ctx: RouteContext) => {
    return withSuperAdmin(async () => {
        const rawSlug = (await ctx.params).slug
        const slugParsed = SlugSchema.safeParse(rawSlug)
        if (!slugParsed.success) {
            return NextResponse.json({ error: 'Invalid slug', details: slugParsed.error.flatten() }, { status: 400 })
        }
        const slug = slugParsed.data

        // Registry whitelist check
        const block = getBlockBySlug(slug)
        if (!block) {
            return NextResponse.json({ error: 'Block not found' }, { status: 404 })
        }

        // Read from BlockCatalogEntries — presetsConfig JSON field (if it exists)
        // MVP: catalog entries don't yet have a presets sub-table; return empty list with meta.
        try {
            const payload = await getPayload({ config })
            const result = await payload.find({
                collection: 'block-catalog-entries',
                where: { slug: { equals: slug } },
                limit: 1,
                depth: 0,
            })

            const entry = result.docs[0] ?? null
            // presetsConfig is not yet a field in BlockCatalogEntries (F07 adds it)
            // For now: return empty array with a clear meta message
            const presets: BlockPresetStub[] = []

            // If the catalog entry has a description override, surface it as a seed preset stub
            const descOverride = (entry?.descriptionOverride as string | null) ?? null
            if (descOverride && descOverride.trim().length > 0) {
                presets.push({
                    id: `${slug}-default`,
                    label: 'Default preset',
                    description: descOverride,
                    source: 'catalog',
                })
            }

            return NextResponse.json({
                data: presets,
                meta: {
                    total: presets.length,
                    blockSlug: slug,
                    note: presets.length === 0
                        ? 'No presets configured for this block type yet'
                        : null,
                },
                error: null,
            })
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Internal error'
            return NextResponse.json({ error: msg }, { status: 500 })
        }
    })(req)
}
