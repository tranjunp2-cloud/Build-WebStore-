'use client'
/**
 * builder-block-detail-overlay.tsx
 * Inline Block Detail overlay rendered inside /studio/templates/[id]/edit.
 * Composes existing <BlockDetailTabs> from /studio/blocks; no logic duplication.
 *
 * Adapter note: GET /api/admin/blocks/[slug] returns raw variantOverrides docs
 * and omits usedByTemplates — we normalise before passing to BlockDetailTabs.
 *
 * Phase C: builder-inline-overlays-deep plan.
 */
import { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import { BlockDetailTabs } from '@/app/studio/blocks/_components/block-detail-tabs'
import type { BlockDetailData } from '@/app/studio/blocks/_components/block-detail-tabs'
import { getBlockBySlug } from '@/lib/admin/block-registry-reader'

interface Props {
    slug: string
    onAddToTemplate: (blockType: string) => void
    onBack: () => void
}

// Shape returned by GET /api/admin/blocks/[slug]
interface BlockApiResponse {
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
    // raw Payload docs — shape not strongly typed
    variantOverrides: Array<{
        variantName?: string
        previewUrlOverride?: string | null
        notes?: string | null
        [key: string]: unknown
    }>
}

/** Normalise API response to BlockDetailData expected by BlockDetailTabs */
function toBlockDetailData(api: BlockApiResponse): BlockDetailData {
    return {
        slug: api.slug,
        name: api.name,
        nameVi: api.nameVi,
        description: api.description,
        icon: api.icon,
        category: api.category,
        variants: api.variants,
        defaultVariant: api.defaultVariant,
        editableFields: api.editableFields,
        aiVisible: api.aiVisible,
        usageCount: api.usageCount,
        descriptionOverride: api.descriptionOverride,
        descriptionOverrideVi: api.descriptionOverrideVi,
        curatedPreviewUrl: api.curatedPreviewUrl,
        hiddenFromCatalog: api.hiddenFromCatalog,
        variantOverrides: (api.variantOverrides ?? []).map((v) => ({
            variantName: v.variantName ?? '',
            previewUrlOverride: v.previewUrlOverride ?? null,
            notes: v.notes ?? null,
        })),
        // usedByTemplates not returned by this route — pass empty for MVP
        usedByTemplates: [],
    }
}

export function BuilderBlockDetailOverlay({ slug, onAddToTemplate, onBack }: Props) {
    // Registry lookup is synchronous — use for static block metadata
    const registryBlock = useMemo(() => getBlockBySlug(slug), [slug])
    const [blockData, setBlockData] = useState<BlockDetailData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [adding, setAdding] = useState(false)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError(null)
        fetch(`/api/admin/blocks/${encodeURIComponent(slug)}`)
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`)
                return r.json()
            })
            .then((d: { data: BlockApiResponse }) => {
                if (cancelled) return
                setBlockData(toBlockDetailData(d.data))
                setLoading(false)
            })
            .catch((err: unknown) => {
                if (cancelled) return
                setError(err instanceof Error ? err.message : 'Failed to load block')
                setLoading(false)
            })
        return () => { cancelled = true }
    }, [slug])

    // Fallback to registry data while API loads (avoids blank header)
    const displayBlock = blockData ?? (registryBlock ? {
        ...registryBlock,
        usageCount: 0,
        descriptionOverride: null,
        descriptionOverrideVi: null,
        curatedPreviewUrl: null,
        hiddenFromCatalog: false,
        variantOverrides: [],
        usedByTemplates: [],
    } satisfies BlockDetailData : null)

    if (!displayBlock) {
        return (
            <div className="b-detail-overlay">
                <div className="empty-state">
                    <p style={{ margin: 0, color: 'var(--danger)' }}>
                        Block &quot;{slug}&quot; not found in registry.
                    </p>
                    <button type="button" className="b-btn ghost" onClick={onBack} style={{ marginTop: 12 }}>
                        <ArrowLeft size={14} /> Back to Catalog
                    </button>
                </div>
            </div>
        )
    }

    function handleAdd() {
        if (adding) return
        setAdding(true)
        onAddToTemplate(slug)
        // Parent sets mode back to builder; no need to reset adding state
    }

    return (
        <div className="b-detail-overlay">
            {/* Header */}
            <div className="b-detail-overlay-head">
                <button type="button" className="b-btn ghost" onClick={onBack}>
                    <ArrowLeft size={14} />
                    Back to Catalog
                </button>

                <span className="bd-icon" aria-hidden>{displayBlock.icon}</span>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 className="bd-name" style={{ margin: 0 }}>
                        {displayBlock.name}
                        <code className="bd-type-code">{displayBlock.slug}</code>
                        {displayBlock.aiVisible
                            ? <span className="bd-ai-pill">✨ AI</span>
                            : <span className="bd-manual-pill">Manual</span>}
                    </h2>
                    {displayBlock.descriptionOverride
                        ? <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
                            {displayBlock.descriptionOverride}
                        </p>
                        : displayBlock.description
                            ? <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
                                {displayBlock.description}
                            </p>
                            : null}
                </div>

                {/* Stat pills */}
                <div className="b-detail-overlay-stats">
                    <div className="bd-stat">
                        <span className="bd-stat-val">{displayBlock.variants.length}</span>
                        <span className="bd-stat-label">variants</span>
                    </div>
                    <div className="bd-stat">
                        <span className="bd-stat-val">{displayBlock.editableFields.length}</span>
                        <span className="bd-stat-label">fields</span>
                    </div>
                    <div className="bd-stat">
                        <span className="bd-stat-val">{displayBlock.usageCount}</span>
                        <span className="bd-stat-label">templates</span>
                    </div>
                </div>

                {/* Add to template CTA */}
                <button
                    type="button"
                    className="b-btn primary"
                    onClick={handleAdd}
                    disabled={adding}
                    aria-label={`Add ${displayBlock.name} block to template`}
                >
                    <Plus size={12} />
                    {adding ? 'Adding…' : 'Add to template'}
                </button>
            </div>

            {/* 6-tab body — reuse existing component */}
            <div className="b-detail-overlay-body">
                {loading && !blockData ? (
                    <div className="empty-state">
                        <p style={{ margin: 0, color: 'var(--text-3)' }}>Loading block details…</p>
                    </div>
                ) : error ? (
                    <div className="empty-state">
                        <p style={{ margin: 0, color: 'var(--danger)' }}>{error}</p>
                    </div>
                ) : (
                    <BlockDetailTabs block={displayBlock} />
                )}
            </div>
        </div>
    )
}
