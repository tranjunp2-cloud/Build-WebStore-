'use client'

/**
 * block-schema-inspector.tsx
 * Renders the editable field tree from registry metadata.
 * Reads live from registry data passed as props — no cache, auto-updates on deploy.
 */

type Props = {
    editableFields: string[]
    blockSlug: string
    defaultVariant: string
    variants: string[]
}

export function BlockSchemaInspector({ editableFields, blockSlug, defaultVariant, variants }: Props) {
    return (
        <div className="flex flex-col gap-6">
            {/* Field list */}
            <div className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40">
                    Editable Fields
                </h3>
                {editableFields.length === 0 ? (
                    <p className="text-sm text-white/40">No editable fields defined.</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {editableFields.map((field) => (
                            <div
                                key={field}
                                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                            >
                                <span className="text-emerald-400 text-xs font-mono">●</span>
                                <span className="text-sm text-white/80 font-mono">{field}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Variants list */}
            <div className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40">
                    Variants
                </h3>
                <div className="flex flex-wrap gap-2">
                    {variants.map((v) => (
                        <span
                            key={v}
                            className={[
                                'rounded-full px-3 py-1 text-xs font-medium border',
                                v === defaultVariant
                                    ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                                    : 'bg-white/5 border-white/10 text-white/60',
                            ].join(' ')}
                        >
                            {v}
                            {v === defaultVariant && (
                                <span className="ml-1 text-indigo-400 text-[10px]">default</span>
                            )}
                        </span>
                    ))}
                </div>
            </div>

            {/* Raw registry info */}
            <div className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40">
                    Registry Snapshot
                </h3>
                <pre className="rounded-lg bg-black/40 border border-white/10 p-3 text-xs text-white/60 overflow-auto max-h-48 font-mono leading-relaxed">
                    {JSON.stringify({ blockSlug, defaultVariant, variants, editableFields }, null, 2)}
                </pre>
            </div>
        </div>
    )
}
