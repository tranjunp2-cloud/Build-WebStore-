/**
 * /studio/blocks — Block Catalog page (server component).
 * Fetches registry + overrides + usage counts, passes to client grid.
 */
import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { listAllBlocks } from '@/lib/admin/block-registry-reader'
import { getBlockUsageCounts } from '@/lib/admin/block-usage-counter'
import { BlockCatalogGrid } from './_components/block-catalog-grid'
import type { BlockCardData } from './_components/block-card'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Block Catalog' }

export default async function BlocksPage() {
    const [blocks, usageCounts, payload] = await Promise.all([
        Promise.resolve(listAllBlocks()),
        getBlockUsageCounts(),
        getPayload({ config }),
    ])

    const overridesResult = await payload.find({
        collection: 'block-catalog-entries',
        limit: 500,
        depth: 0,
    })

    const overrideMap = new Map(
        overridesResult.docs.map((doc) => [doc.slug as string, doc])
    )

    const cardData: BlockCardData[] = blocks.map((block) => {
        const override = overrideMap.get(block.slug)
        return {
            slug: block.slug,
            name: block.name,
            nameVi: block.nameVi,
            description: (override?.descriptionOverride as string | undefined) ?? block.description,
            icon: block.icon,
            category: block.category,
            variants: block.variants,
            usageCount: usageCounts[block.slug] ?? 0,
            hiddenFromCatalog: (override?.hiddenFromCatalog as boolean) ?? false,
            curatedPreviewUrl: (override?.curatedPreviewUrl as string | undefined) ?? null,
        }
    })

    return (
        <div className="flex flex-col gap-6 p-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-bold text-white">Block Catalog</h1>
                    <p className="text-sm text-white/50 mt-1">
                        {blocks.length} blocks registered &middot; {cardData.filter((b) => b.usageCount > 0).length} in use
                    </p>
                </div>
            </div>

            <BlockCatalogGrid blocks={cardData} />
        </div>
    )
}
