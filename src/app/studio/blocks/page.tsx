/**
 * /studio/blocks — Block Catalog page (server component).
 * Fetches registry + overrides + usage counts, passes to client grid.
 * Layout: 3-mode toggle (matrix / blocks / impact) + 5-stat strip.
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
            aiVisible: block.aiVisible,
        }
    })

    return (
        <div className="page">
            {/* Header */}
            <div className="page-head">
                <div>
                    <h1 className="page-title">Block Catalog</h1>
                    <p className="page-sub">
                        Blocks nào dùng ở templates nào · Impact analysis khi update block
                    </p>
                </div>
            </div>

            {/* Block catalog grid — renders interactive 5-stat strip + mode toggle + grid */}
            <BlockCatalogGrid blocks={cardData} />
        </div>
    )
}
