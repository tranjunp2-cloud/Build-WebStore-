'use client'

/**
 * block-card.tsx
 * Single block card in the catalog grid.
 * Styled to match design bundle .b-card pattern.
 * Shows icon, EN/VI name, variant count, usage stat, AI pill, hidden badge.
 */
import Link from 'next/link'

export type BlockCardData = {
    slug: string
    name: string
    nameVi: string
    description: string
    icon: string
    category: string
    variants: string[]
    usageCount: number
    hiddenFromCatalog: boolean
    curatedPreviewUrl: string | null
    aiVisible: boolean
}

type Props = {
    block: BlockCardData
}

export function BlockCard({ block }: Props) {
    return (
        <Link href={`/studio/blocks/${block.slug}`} className="b-card" style={{ padding: 14 }}>
            {/* Icon + name row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <div className="b-card-icon">{block.icon}</div>
                <div className="b-card-meta">
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>
                        {block.nameVi}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{block.name}</div>
                </div>
            </div>

            {/* Stats row */}
            <div className="b-card-stats">
                <span>
                    {block.variants.length} variant{block.variants.length !== 1 ? 's' : ''}
                </span>
                {block.usageCount > 0 && (
                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                        {block.usageCount} tpl
                    </span>
                )}
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    {block.aiVisible ? (
                        <span className="b-type-pill ai">AI</span>
                    ) : (
                        <span className="b-type-pill">manual</span>
                    )}
                    {block.hiddenFromCatalog && (
                        <span className="b-type-pill" style={{ color: 'var(--warn)', borderColor: 'rgba(217,119,6,0.3)', background: 'rgba(217,119,6,0.08)' }}>
                            hidden
                        </span>
                    )}
                </span>
            </div>
        </Link>
    )
}
