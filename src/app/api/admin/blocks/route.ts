/**
 * GET /api/admin/blocks
 * Returns all registry blocks merged with admin overrides and usage counts.
 * Super-admin only.
 */
import { NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/admin/api-utils'
import { listAllBlocks } from '@/lib/admin/block-registry-reader'
import { getBlockUsageCounts } from '@/lib/admin/block-usage-counter'
import { getPayload } from 'payload'
import config from '@payload-config'

export const GET = withSuperAdmin(async () => {
    const [blocks, usageCounts, payload] = await Promise.all([
        Promise.resolve(listAllBlocks()),
        getBlockUsageCounts(),
        getPayload({ config }),
    ])

    // Fetch all admin overrides in one query
    const overridesResult = await payload.find({
        collection: 'block-catalog-entries',
        limit: 500,
        depth: 0,
    })

    const overrideMap = new Map(
        overridesResult.docs.map((doc) => [doc.slug as string, doc])
    )

    const merged = blocks.map((block) => {
        const override = overrideMap.get(block.slug)
        return {
            ...block,
            usageCount: usageCounts[block.slug] ?? 0,
            // Admin overrides (if present)
            descriptionOverride: override?.descriptionOverride ?? null,
            descriptionOverrideVi: override?.descriptionOverrideVi ?? null,
            displayOrder: override?.displayOrder ?? 0,
            curatedPreviewUrl: override?.curatedPreviewUrl ?? null,
            hiddenFromCatalog: override?.hiddenFromCatalog ?? false,
            overrideId: override?.id ?? null,
        }
    })

    return NextResponse.json({ data: merged })
})
