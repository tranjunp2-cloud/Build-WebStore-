'use client'

/**
 * variant-zoom-modal.tsx
 * Dialog showing full variant preview image + field config JSON.
 * Closes on Esc (native Dialog behaviour) and backdrop click.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

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

export function VariantZoomModal({
    open,
    onClose,
    blockName,
    variantName,
    previewUrl,
    editableFields,
    variantOverride,
}: Props) {
    const effectivePreviewUrl = variantOverride?.previewUrlOverride ?? previewUrl

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-3xl bg-zinc-900 border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold">
                        {blockName}
                        <span className="ml-2 text-white/50 font-normal text-sm">/ {variantName}</span>
                    </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                    {/* Preview */}
                    <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium text-white/50 uppercase tracking-wide">Preview</p>
                        {effectivePreviewUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                                src={effectivePreviewUrl}
                                alt={`${blockName} — ${variantName} preview`}
                                className="rounded-lg border border-white/10 w-full object-cover"
                                loading="lazy"
                            />
                        ) : (
                            <div className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 h-48 text-white/30 text-sm">
                                No preview image
                            </div>
                        )}
                        {variantOverride?.notes && (
                            <p className="text-xs text-white/40 italic">{variantOverride.notes}</p>
                        )}
                    </div>

                    {/* Field config JSON */}
                    <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium text-white/50 uppercase tracking-wide">
                            Editable Fields
                        </p>
                        <pre className="rounded-lg bg-black/40 border border-white/10 p-3 text-xs text-emerald-300 overflow-auto max-h-64 font-mono leading-relaxed">
                            {JSON.stringify({ variant: variantName, editableFields }, null, 2)}
                        </pre>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
