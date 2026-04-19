/**
 * /studio/blocks/[slug] — Block detail page (server component).
 * Fetches single block registry entry + admin overrides + variant overrides
 * + used-by templates, then renders BlockDetailTabs client component.
 */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getBlockBySlug } from '@/lib/admin/block-registry-reader'
import { getBlockUsageCounts } from '@/lib/admin/block-usage-counter'
import { BlockDetailTabs, type BlockDetailData } from '../_components/block-detail-tabs'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const block = getBlockBySlug(slug)
    return { title: block ? `${block.name} — Block Detail` : 'Block Not Found' }
}

export default async function BlockDetailPage({ params }: Props) {
    const { slug } = await params
    const block = getBlockBySlug(slug)

    if (!block) notFound()

    const [usageCounts, payload] = await Promise.all([
        getBlockUsageCounts(),
        getPayload({ config }),
    ])

    // Fetch admin overrides + variant overrides in parallel
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

    // Find templates that use this block (scan templatePages.layout JSON)
    // Limited to first 500 templates — sufficient at current scale
    // Payload's SelectType generic is overly restrictive for partial select — cast to bypass
    const templatesResult = await (payload.find as (...a: unknown[]) => Promise<{ docs: unknown[] }>)({
        collection: 'templates',
        limit: 500,
        depth: 0,
        select: { id: true, name: true, category: true, templatePages: true },
    })

    type TemplateDoc = {
        id: number | string
        name: string
        category?: string[]
        templatePages?: Array<{ layout?: unknown }>
    }

    const usedByTemplates = (templatesResult.docs as TemplateDoc[])
        .filter((doc) => {
            if (!Array.isArray(doc.templatePages)) return false
            return doc.templatePages.some((page) => {
                if (!Array.isArray(page.layout)) return false
                return (page.layout as Array<Record<string, unknown>>).some(
                    (b) => b.blockType === slug
                )
            })
        })
        .map((doc) => ({
            id: doc.id,
            name: doc.name ?? String(doc.id),
            category: Array.isArray(doc.category) ? doc.category : [],
        }))

    const blockData: BlockDetailData = {
        slug: block.slug,
        name: block.name,
        nameVi: block.nameVi,
        description: block.description,
        icon: block.icon,
        category: block.category,
        variants: block.variants,
        defaultVariant: block.defaultVariant,
        editableFields: block.editableFields,
        aiVisible: block.aiVisible,
        usageCount: usageCounts[slug] ?? 0,
        descriptionOverride: (override?.descriptionOverride as string) ?? null,
        descriptionOverrideVi: (override?.descriptionOverrideVi as string) ?? null,
        curatedPreviewUrl: (override?.curatedPreviewUrl as string) ?? null,
        hiddenFromCatalog: (override?.hiddenFromCatalog as boolean) ?? false,
        variantOverrides: variantsResult.docs.map((v) => ({
            variantName: v.variantName as string,
            previewUrlOverride: (v.previewUrlOverride as string) ?? null,
            notes: (v.notes as string) ?? null,
        })),
        usedByTemplates,
    }

    return (
        <div className="flex flex-col gap-6 p-6 max-w-5xl">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-xs text-white/40">
                <Link href="/studio/blocks" className="hover:text-white/70 transition-colors">
                    Block Catalog
                </Link>
                <span>/</span>
                <span className="text-white/70">{block.name}</span>
            </nav>

            {/* Page header */}
            <div className="flex items-center gap-4">
                <span className="text-4xl leading-none" aria-hidden>{block.icon}</span>
                <div>
                    <h1 className="text-xl font-bold text-white">{block.nameVi}</h1>
                    <p className="text-sm text-white/50">{block.name} &middot; <code className="font-mono text-xs text-white/40">{slug}</code></p>
                </div>
            </div>

            {/* Detail tabs */}
            <BlockDetailTabs block={blockData} />
        </div>
    )
}
