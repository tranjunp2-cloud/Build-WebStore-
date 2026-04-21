/**
 * /studio/blocks/[slug] — Block detail page (server component).
 * Fetches single block registry entry + admin overrides + variant overrides
 * + used-by templates, then renders BlockDetailTabs client component.
 * Header: icon + name + ai-pill + 4 stat cards (matches bundle builder-block-detail.jsx).
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

    const usageCount = usageCounts[slug] ?? 0

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
        usageCount,
        descriptionOverride: (override?.descriptionOverride as string) ?? null,
        descriptionOverrideVi: (override?.descriptionOverrideVi as string) ?? null,
        curatedPreviewUrl: (override?.curatedPreviewUrl as string) ?? null,
        hiddenFromCatalog: (override?.hiddenFromCatalog as boolean) ?? false,
        variantOverrides: variantsResult.docs.map((v) => ({
            variantName: v.variantName as string,
            previewUrlOverride: (v.previewUrlOverride as string) ?? null,
            notes: (v.notes as string) ?? null,
            enabled: (v.enabled as boolean | undefined) ?? true,
            displayName: (v.displayName as string) ?? null,
        })),
        usedByTemplates,
    }

    return (
        <div className="page" style={{ maxWidth: 1200 }}>
            {/* Breadcrumb */}
            <nav style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 12 }}>
                <Link
                    href="/studio/blocks"
                    className="b-btn ghost"
                    style={{ height: 26, padding: '0 8px', fontSize: 12 }}
                >
                    ← Block Catalog
                </Link>
                <span className="b-crumb-sep">/</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {block.category}
                </span>
                <span className="b-crumb-sep">/</span>
                <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
                    {block.name}
                </span>
            </nav>

            {/* Detail header — icon + name + ai-pill + 4 stat cards */}
            <div className="b-detail-head">
                {/* Left: icon + name info */}
                <div className="left">
                    <div className="bd-icon">{block.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h1 className="bd-name">
                            {block.name}
                            <span className="bd-type-code">{slug}</span>
                            {block.aiVisible ? (
                                <span className="bd-ai-pill">✓ AI-visible</span>
                            ) : (
                                <span className="bd-manual-pill">Manual only</span>
                            )}
                        </h1>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)' }}>
                            {blockData.descriptionOverride ?? block.description}
                        </p>
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                            <span className="b-chip" style={{ cursor: 'default' }}>
                                Category: {block.category}
                            </span>
                            {block.defaultVariant && (
                                <span className="b-chip" style={{ cursor: 'default' }}>
                                    Default:{' '}
                                    <span style={{ fontFamily: 'var(--mono)', marginLeft: 4 }}>
                                        {block.defaultVariant}
                                    </span>
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: 4 stat cards */}
                <div className="right">
                    <div className="bd-stat">
                        <div className="bd-stat-val">{block.variants.length}</div>
                        <div className="bd-stat-label">Variants</div>
                    </div>
                    <div className="bd-stat">
                        <div className="bd-stat-val">{block.variants.length}</div>
                        <div className="bd-stat-label">Enabled</div>
                    </div>
                    <div className="bd-stat">
                        <div className="bd-stat-val">{block.editableFields.length}</div>
                        <div className="bd-stat-label">Fields</div>
                    </div>
                    <div className="bd-stat">
                        <div className="bd-stat-val">{usageCount}</div>
                        <div className="bd-stat-label">Templates</div>
                    </div>
                </div>
            </div>

            {/* 6-tab detail component */}
            <BlockDetailTabs block={blockData} />
        </div>
    )
}
