'use client'

/**
 * variant-gallery.tsx
 * Grid of variant cards with 1/2/3 col toggle.
 * Default variant highlighted with accent border + star.
 * Each card: placeholder preview (stripe pattern or image) + action buttons.
 * Click preview → VariantZoomModal with device switcher.
 */
import { useState } from 'react'
import { Star, Eye, Pencil, Copy, Trash2 } from 'lucide-react'
import { VariantZoomModal } from './variant-zoom-modal'

type VariantOverride = {
    variantName: string
    previewUrlOverride?: string | null
    notes?: string | null
}

type Cols = '1' | '2' | '3'

type Props = {
    blockSlug: string
    blockName: string
    variants: string[]
    defaultVariant: string
    editableFields: string[]
    curatedPreviewUrl: string | null
    variantOverrides: VariantOverride[]
}

export function VariantGallery({
    blockSlug,
    blockName,
    variants,
    defaultVariant,
    editableFields,
    curatedPreviewUrl,
    variantOverrides,
}: Props) {
    const [cols, setCols] = useState<Cols>('2')
    const [activeVariant, setActiveVariant] = useState<string | null>(null)
    // local default override (client-only, does not persist — save button would call API in F07)
    const [localDefault, setLocalDefault] = useState<string>(defaultVariant)
    // disabled map (client-only toggle state)
    const [disabled, setDisabled] = useState<Record<string, boolean>>({})

    const overrideMap = new Map(variantOverrides.map((v) => [v.variantName, v]))

    if (variants.length === 0) {
        return (
            <p className="muted" style={{ fontSize: 13, padding: '24px 0' }}>
                No variants defined for this block.
            </p>
        )
    }

    return (
        <>
            {/* Toolbar row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                    <strong style={{ color: 'var(--text)' }}>{variants.length} variants</strong>
                    {' · '}click vào preview để zoom · sao để set default
                </div>
                <span style={{ flex: 1 }} />
                {/* Col toggle */}
                <div className="b-seg">
                    {(['1', '2', '3'] as Cols[]).map((c) => (
                        <button
                            key={c}
                            className={cols === c ? 'active' : ''}
                            onClick={() => setCols(c)}
                        >
                            {c} col
                        </button>
                    ))}
                </div>
                <button className="b-btn" style={{ gap: 5 }}>
                    <span style={{ fontSize: 14 }}>+</span> Add variant
                </button>
            </div>

            {/* Gallery grid */}
            <div className={`b-variant-gallery cols-${cols}`}>
                {variants.map((variant) => {
                    const isDefault = variant === localDefault
                    const isDisabled = !!disabled[variant]
                    const override = overrideMap.get(variant)
                    const previewUrl = override?.previewUrlOverride ?? curatedPreviewUrl

                    return (
                        <div
                            key={variant}
                            className={[
                                'b-var-card',
                                isDefault ? 'is-default' : '',
                                isDisabled ? 'is-disabled' : '',
                            ].filter(Boolean).join(' ')}
                        >
                            {/* Card head: name + actions */}
                            <div className="b-var-card-head">
                                <span className="name">{variant}</span>
                                {isDefault && <span className="default-pill">Default</span>}
                                <div className="actions">
                                    <button
                                        title={isDefault ? 'Already default' : 'Set as default'}
                                        onClick={() => setLocalDefault(variant)}
                                        style={isDefault ? { color: 'var(--accent)' } : {}}
                                    >
                                        <Star
                                            size={13}
                                            fill={isDefault ? 'currentColor' : 'none'}
                                        />
                                    </button>
                                    <button
                                        title="Fullscreen preview"
                                        onClick={() => setActiveVariant(variant)}
                                    >
                                        <Eye size={13} />
                                    </button>
                                    <button title="Edit variant code">
                                        <Pencil size={13} />
                                    </button>
                                    <button title="Duplicate variant">
                                        <Copy size={13} />
                                    </button>
                                    <button
                                        title="Delete variant"
                                        style={{ color: 'var(--danger)' }}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>

                            {/* Preview area — click to zoom */}
                            <div
                                className="b-var-preview"
                                onClick={() => setActiveVariant(variant)}
                            >
                                {previewUrl ? (
                                    /* Curated screenshot override — kept for backward compat */
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={previewUrl} alt={`${variant} preview`} />
                                ) : (
                                    /* SSR iframe — renders block at desktop width, scaled to fit card */
                                    <iframe
                                        src={`/preview/block/${blockSlug}/${encodeURIComponent(variant)}`}
                                        title={`${blockSlug}/${variant} preview`}
                                        className="b-var-iframe"
                                        loading="lazy"
                                        sandbox="allow-same-origin allow-scripts"
                                        aria-hidden="true"
                                    />
                                )}
                            </div>

                            {/* Card footer: usage + enable toggle */}
                            <div className="b-var-foot">
                                <span className="usage" style={{ fontSize: 11 }}>
                                    {/* real usage count would come from variant-level query — stub */}
                                    {isDefault ? 'Default variant' : 'Variant'}
                                </span>
                                <span className="sp" />
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                                    <span>Enabled</span>
                                    <div
                                        className={`b-switch${!isDisabled ? ' on' : ''}`}
                                        onClick={() =>
                                            setDisabled((d) => ({ ...d, [variant]: !d[variant] }))
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    )
                })}

                {/* Add new variant card */}
                <div className="b-var-add">
                    <div style={{ textAlign: 'center' }}>
                        <div className="plus">＋</div>
                        <div className="t">Add new variant</div>
                        <div className="s">Register a new layout for this block</div>
                    </div>
                </div>
            </div>

            {/* Zoom modal */}
            {activeVariant && (
                <VariantZoomModal
                    open={true}
                    onClose={() => setActiveVariant(null)}
                    blockSlug={blockSlug}
                    blockName={blockName}
                    variantName={activeVariant}
                    previewUrl={curatedPreviewUrl}
                    editableFields={editableFields}
                    variantOverride={overrideMap.get(activeVariant) ?? null}
                />
            )}
        </>
    )
}
