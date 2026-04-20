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

    // Stats for strip
    const totalBlocks = cardData.length
    const activeInTemplates = cardData.filter((b) => b.usageCount > 0).length
    const aiVisible = cardData.filter((b) => b.aiVisible).length
    const categories = new Set(cardData.map((b) => b.category)).size
    const totalVariants = cardData.reduce((sum, b) => sum + b.variants.length, 0)

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

            {/* 5-stat strip */}
            <div className="b-stats">
                <div className="b-stat">
                    <div className="b-stat-label">Total blocks</div>
                    <div className="b-stat-val">{totalBlocks}</div>
                    <div className="b-stat-sub">types</div>
                </div>
                <div className="b-stat">
                    <div className="b-stat-label">Active in templates</div>
                    <div className="b-stat-val">{activeInTemplates}</div>
                    <div className="b-stat-sub">/ {totalBlocks} used</div>
                </div>
                <div className="b-stat">
                    <div className="b-stat-label">AI-visible</div>
                    <div className="b-stat-val">{aiVisible}</div>
                    <div className="b-stat-sub">/ {totalBlocks}</div>
                </div>
                <div className="b-stat">
                    <div className="b-stat-label">Categories</div>
                    <div className="b-stat-val">{categories}</div>
                    <div className="b-stat-sub">groups</div>
                </div>
                <div className="b-stat">
                    <div className="b-stat-label">Total variants</div>
                    <div className="b-stat-val">{totalVariants}</div>
                    <div className="b-stat-sub">across all blocks</div>
                </div>
            </div>

            {/* Block catalog grid (handles mode toggle internally) */}
            <BlockCatalogGrid blocks={cardData} />
        </div>
    )
}
