'use client'

/**
 * block-detail-tabs.tsx
 * 4-tab client component for block detail page:
 * Overview / Variants / Schema / Used By
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { VariantGallery } from './variant-gallery'
import { BlockSchemaInspector } from './block-schema-inspector'
import { DnaHeatmapStub } from './dna-heatmap-stub'

type VariantOverride = {
    variantName: string
    previewUrlOverride?: string | null
    notes?: string | null
}

type UsedByTemplate = {
    id: number | string
    name: string
    slug?: string
    category?: string[]
}

export type BlockDetailData = {
    slug: string
    name: string
    nameVi: string
    description: string
    icon: string
    category: string
    variants: string[]
    defaultVariant: string
    editableFields: string[]
    aiVisible: boolean
    usageCount: number
    descriptionOverride: string | null
    descriptionOverrideVi: string | null
    curatedPreviewUrl: string | null
    hiddenFromCatalog: boolean
    variantOverrides: VariantOverride[]
    usedByTemplates: UsedByTemplate[]
}

type Props = {
    block: BlockDetailData
}

export function BlockDetailTabs({ block }: Props) {
    const displayDescription = block.descriptionOverride ?? block.description
    const displayDescriptionVi = block.descriptionOverrideVi ?? null

    return (
        <Tabs defaultValue="overview" className="flex flex-col gap-0">
            <TabsList className="bg-white/5 border border-white/10 rounded-xl h-auto p-1 mb-6 self-start">
                <TabsTrigger value="overview" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-lg text-sm">
                    Overview
                </TabsTrigger>
                <TabsTrigger value="variants" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-lg text-sm">
                    Variants
                    <Badge className="ml-1.5 text-[10px] py-0 px-1.5 bg-white/10 text-white/60 border-0">
                        {block.variants.length}
                    </Badge>
                </TabsTrigger>
                <TabsTrigger value="schema" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-lg text-sm">
                    Schema
                </TabsTrigger>
                <TabsTrigger value="used-by" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-lg text-sm">
                    Used By
                    {block.usageCount > 0 && (
                        <Badge className="ml-1.5 text-[10px] py-0 px-1.5 bg-emerald-500/20 text-emerald-400 border-0">
                            {block.usageCount}
                        </Badge>
                    )}
                </TabsTrigger>
            </TabsList>

            {/* ── Overview ─────────────────────────────────────────────────── */}
            <TabsContent value="overview" className="mt-0 flex flex-col gap-6">
                {/* Description */}
                <div className="flex flex-col gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40">Description</h3>
                    <p className="text-sm text-white/80 leading-relaxed">{displayDescription}</p>
                    {displayDescriptionVi && (
                        <p className="text-sm text-white/50 leading-relaxed italic">{displayDescriptionVi}</p>
                    )}
                </div>

                {/* Meta grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <MetaStat label="Category" value={block.category} />
                    <MetaStat label="Variants" value={String(block.variants.length)} />
                    <MetaStat label="Used In" value={`${block.usageCount} template${block.usageCount !== 1 ? 's' : ''}`} />
                    <MetaStat label="AI Visible" value={block.aiVisible ? 'Yes' : 'No'} />
                </div>

                {/* Flags */}
                <div className="flex flex-wrap gap-2">
                    {block.hiddenFromCatalog && (
                        <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 text-xs">
                            Hidden from catalog
                        </Badge>
                    )}
                    {!block.aiVisible && (
                        <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-xs">
                            AI hidden
                        </Badge>
                    )}
                </div>

                {/* DNA Heatmap stub */}
                <DnaHeatmapStub blockSlug={block.slug} />
            </TabsContent>

            {/* ── Variants ─────────────────────────────────────────────────── */}
            <TabsContent value="variants" className="mt-0">
                <VariantGallery
                    blockSlug={block.slug}
                    blockName={block.name}
                    variants={block.variants}
                    editableFields={block.editableFields}
                    curatedPreviewUrl={block.curatedPreviewUrl}
                    variantOverrides={block.variantOverrides}
                />
            </TabsContent>

            {/* ── Schema ───────────────────────────────────────────────────── */}
            <TabsContent value="schema" className="mt-0">
                <BlockSchemaInspector
                    blockSlug={block.slug}
                    editableFields={block.editableFields}
                    defaultVariant={block.defaultVariant}
                    variants={block.variants}
                />
            </TabsContent>

            {/* ── Used By ──────────────────────────────────────────────────── */}
            <TabsContent value="used-by" className="mt-0">
                {block.usedByTemplates.length === 0 ? (
                    <p className="text-sm text-white/40 py-8 text-center">
                        This block is not used in any templates yet.
                    </p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {block.usedByTemplates.map((t) => (
                            <div
                                key={t.id}
                                className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3"
                            >
                                <span className="text-sm text-white/80 font-medium">{t.name}</span>
                                {t.category && t.category.length > 0 && (
                                    <span className="ml-auto text-xs text-white/40">
                                        {t.category.join(', ')}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </TabsContent>
        </Tabs>
    )
}

// ── Internal ─────────────────────────────────────────────────────────────────

function MetaStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
            <span className="text-xs text-white/40">{label}</span>
            <span className="text-sm font-semibold text-white">{value}</span>
        </div>
    )
}
