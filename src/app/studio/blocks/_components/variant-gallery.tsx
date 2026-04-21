'use client'

/**
 * variant-gallery.tsx
 * Grid of variant cards with 1/2/3 col toggle.
 * Default variant highlighted with accent border + star.
 * Each card: placeholder preview (stripe pattern or image) + action buttons.
 * Click preview → VariantZoomModal with device switcher.
 * Phase G: disable toggle persisted via PATCH API (optimistic UI + revert on error).
 * Phase H: pencil icon opens VariantEditModal for metadata edits.
 */
import { useState } from 'react'
import { Star, Eye, Pencil, Copy, Trash2 } from 'lucide-react'
import { VariantZoomModal } from './variant-zoom-modal'
import { VariantEditModal } from './variant-edit-modal'

type VariantOverride = {
    variantName: string
    previewUrlOverride?: string | null
    notes?: string | null
    enabled?: boolean
    displayName?: string | null
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

    // Phase G: disabled state seeded from variantOverrides, persisted via PATCH API
    const initialDisabled: Record<string, boolean> = {}
    variantOverrides.forEach((v) => {
        if (v.enabled === false) initialDisabled[v.variantName] = true
    })
    const [disabled, setDisabled] = useState<Record<string, boolean>>(initialDisabled)
    const [pendingToggle, setPendingToggle] = useState<Set<string>>(new Set())

    // Phase H: overrides map for mutable displayName + metadata after save
    const [overridesMap, setOverridesMap] = useState(
        () => new Map(variantOverrides.map((v) => [v.variantName, v]))
    )
    const [editVariant, setEditVariant] = useState<string | null>(null)

    async function toggleVariantEnabled(variantName: string) {
        // Prevent double-fire on rapid clicks
        if (pendingToggle.has(variantName)) return

        const currentlyDisabled = !!disabled[variantName]
        const nextEnabled = currentlyDisabled // true = re-enable, false = disable

        // Optimistic update
        setDisabled((d) => ({ ...d, [variantName]: !nextEnabled }))
        setPendingToggle((p) => new Set(p).add(variantName))

        try {
            const res = await fetch(
                `/api/admin/blocks/${blockSlug}/variants/${variantName}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabled: nextEnabled }),
                }
            )
            if (!res.ok) throw new Error(`${res.status}`)
        } catch (err) {
            // Revert on failure
            setDisabled((d) => ({ ...d, [variantName]: currentlyDisabled }))
            console.error('[variant-toggle] failed', err)
        } finally {
            setPendingToggle((p) => {
                const n = new Set(p)
                n.delete(variantName)
                return n
            })
        }
    }

    function handleSaved(variantName: string, patch: Partial<VariantOverride>) {
        setOverridesMap((m) => {
            const next = new Map(m)
            const existing = next.get(variantName) ?? { variantName }
            next.set(variantName, { ...existing, ...patch })
            return next
        })
    }

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
                    const override = overridesMap.get(variant)
                    const previewUrl = override?.previewUrlOverride ?? curatedPreviewUrl
                    const displayName = override?.displayName || variant

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
                                <span className="name">{displayName}</span>
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
                                    <button
                                        title="Edit variant metadata"
                                        onClick={() => setEditVariant(variant)}
                                    >
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
                                        className={[
                                            'b-switch',
                                            !isDisabled ? 'on' : '',
                                            pendingToggle.has(variant) ? 'pending' : '',
                                        ].filter(Boolean).join(' ')}
                                        onClick={() => toggleVariantEnabled(variant)}
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
                    variantOverride={overridesMap.get(activeVariant) ?? null}
                />
            )}

            {/* Edit metadata modal */}
            {editVariant && (
                <VariantEditModal
                    open={true}
                    onClose={() => setEditVariant(null)}
                    blockSlug={blockSlug}
                    variantName={editVariant}
                    initial={{
                        displayName: overridesMap.get(editVariant)?.displayName,
                        notes: overridesMap.get(editVariant)?.notes,
                        previewUrlOverride: overridesMap.get(editVariant)?.previewUrlOverride,
                    }}
                    onSaved={(patch) => handleSaved(editVariant, patch)}
                />
            )}
        </>
    )
}
