'use client'

/**
 * variant-gallery.tsx
 * Grid of variant thumbnails for a block. Click → VariantZoomModal.
 */
import { useState } from 'react'
import { VariantZoomModal } from './variant-zoom-modal'

type VariantOverride = {
    variantName: string
    previewUrlOverride?: string | null
    notes?: string | null
}

type Props = {
    blockSlug: string
    blockName: string
    variants: string[]
    editableFields: string[]
    curatedPreviewUrl: string | null
    variantOverrides: VariantOverride[]
}

export function VariantGallery({
    blockSlug,
    blockName,
    variants,
    editableFields,
    curatedPreviewUrl,
    variantOverrides,
}: Props) {
    const [activeVariant, setActiveVariant] = useState<string | null>(null)

    const overrideMap = new Map(variantOverrides.map((v) => [v.variantName, v]))

    return (
        <>
            {variants.length === 0 ? (
                <p className="text-sm text-white/40">No variants defined for this block.</p>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {variants.map((variant) => {
                        const override = overrideMap.get(variant)
                        const previewUrl = override?.previewUrlOverride ?? curatedPreviewUrl

                        return (
                            <button
                                key={variant}
                                onClick={() => setActiveVariant(variant)}
                                className="group flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-left transition-colors hover:bg-white/10 hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            >
                                {/* Thumbnail */}
                                <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black/30 border border-white/10">
                                    {previewUrl ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img
                                            src={previewUrl}
                                            alt={`${variant} preview`}
                                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-white/20 text-xs">
                                            No preview
                                        </div>
                                    )}
                                    {/* Zoom hint overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-white text-xs font-medium">View</span>
                                    </div>
                                </div>

                                <span className="text-xs font-medium text-white/80 truncate">{variant}</span>
                            </button>
                        )
                    })}
                </div>
            )}

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
