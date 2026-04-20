'use client'

/**
 * variant-zoom-modal.tsx
 * Fullscreen variant preview modal with Desktop/Tablet/Mobile device switcher.
 * Uses shadcn Dialog. Preview = curated image or stripe placeholder.
 * Closes on Esc (native Dialog) and backdrop click.
 */
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Monitor, Tablet, Smartphone } from 'lucide-react'

type Viewport = 'desktop' | 'tablet' | 'mobile'

type VariantOverride = {
    variantName: string
    previewUrlOverride?: string | null
    notes?: string | null
}

type Props = {
    open: boolean
    onClose: () => void
    blockSlug: string
    blockName: string
    variantName: string
    previewUrl: string | null
    editableFields: string[]
    variantOverride: VariantOverride | null
}

const VIEWPORT_MAX_W: Record<Viewport, number> = {
    desktop: 1120,
    tablet: 768,
    mobile: 390,
}

const VIEWPORT_TABS: { id: Viewport; label: string; Icon: React.FC<{ size?: number }> }[] = [
    { id: 'desktop', label: 'Desktop', Icon: Monitor },
    { id: 'tablet',  label: 'Tablet',  Icon: Tablet },
    { id: 'mobile',  label: 'Mobile',  Icon: Smartphone },
]

export function VariantZoomModal({
    open,
    onClose,
    blockName,
    variantName,
    previewUrl,
    editableFields,
    variantOverride,
}: Props) {
    const [vp, setVp] = useState<Viewport>('desktop')

    const effectivePreviewUrl = variantOverride?.previewUrlOverride ?? previewUrl
    const maxW = VIEWPORT_MAX_W[vp]

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent
                className="max-w-5xl"
                style={{
                    background: 'var(--bg-elev)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '90vh',
                    overflow: 'hidden',
                }}
            >
                {/* Header */}
                <DialogHeader style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <DialogTitle style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                            {blockName}
                            <span style={{ marginLeft: 8, color: 'var(--text-3)', fontWeight: 400, fontFamily: 'var(--mono)', fontSize: 13 }}>
                                / {variantName}
                            </span>
                        </DialogTitle>

                        <span style={{ flex: 1 }} />

                        {/* Device switcher */}
                        <div className="b-zoom-vp-seg">
                            {VIEWPORT_TABS.map(({ id, label, Icon }) => (
                                <button
                                    key={id}
                                    className={`b-zoom-vp-btn${vp === id ? ' active' : ''}`}
                                    onClick={() => setVp(id)}
                                    title={label}
                                >
                                    <Icon size={13} />
                                    <span style={{ marginLeft: 4 }}>{label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </DialogHeader>

                {/* Preview body — scrollable */}
                <div
                    style={{
                        flex: 1,
                        overflow: 'auto',
                        padding: '20px',
                        display: 'flex',
                        justifyContent: 'center',
                        background: 'var(--bg-sunk)',
                    }}
                >
                    <div
                        style={{
                            width: '100%',
                            maxWidth: maxW,
                            transition: 'max-width 250ms ease',
                        }}
                    >
                        {effectivePreviewUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                                src={effectivePreviewUrl}
                                alt={`${blockName} — ${variantName} preview`}
                                style={{
                                    width: '100%',
                                    borderRadius: 8,
                                    border: '1px solid var(--border)',
                                    display: 'block',
                                    objectFit: 'cover',
                                }}
                                loading="lazy"
                            />
                        ) : (
                            <div
                                className="ph"
                                style={{
                                    aspectRatio: '16/9',
                                    borderRadius: 8,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                }}
                            >
                                <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                                    {blockName} · {variantName}
                                </span>
                                <span style={{ fontSize: 10, color: 'var(--text-4)' }}>
                                    {vp} — {maxW}px
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div
                    style={{
                        padding: '12px 20px',
                        borderTop: '1px solid var(--border)',
                        background: 'var(--bg-sunk)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        fontSize: 12,
                        color: 'var(--text-3)',
                        flexShrink: 0,
                        flexWrap: 'wrap',
                    }}
                >
                    <span>
                        Variant{' '}
                        <strong style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{variantName}</strong>
                        {' '}· {vp} ({maxW}px)
                        {variantOverride?.notes && (
                            <span style={{ marginLeft: 8, fontStyle: 'italic' }}>{variantOverride.notes}</span>
                        )}
                    </span>
                    {editableFields.length > 0 && (
                        <span className="chip" style={{ fontSize: 10 }}>
                            {editableFields.length} editable field{editableFields.length !== 1 ? 's' : ''}
                        </span>
                    )}
                    <span style={{ flex: 1 }} />
                    <button className="b-btn ghost" onClick={onClose}>
                        Close
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
