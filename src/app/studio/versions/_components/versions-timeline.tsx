'use client'
/**
 * versions-timeline.tsx
 * Renders a list of TemplateVersion entries as a vertical timeline.
 * Rollback button is disabled (deferred to F07).
 */
import { RotateCcw } from 'lucide-react'

export interface VersionEntry {
    id: number | string
    versionNumber: number
    changelog?: string | null
    createdAt: string
    templateName?: string
}

interface Props {
    versions: VersionEntry[]
    showTemplateName?: boolean
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    })
}

export function VersionsTimeline({ versions, showTemplateName = false }: Props) {
    if (versions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                <p className="text-sm text-muted-foreground">No versions yet.</p>
                <p className="text-xs text-muted-foreground">Save a template in the builder to create the first version.</p>
            </div>
        )
    }

    return (
        <ol className="relative border-l border-border ml-3 space-y-0">
            {versions.map((v, idx) => (
                <li key={v.id} className="ml-4 pb-6 relative">
                    {/* Timeline dot */}
                    <span
                        className={[
                            'absolute -left-[21px] top-1 flex items-center justify-center w-3.5 h-3.5 rounded-full border-2',
                            idx === 0
                                ? 'bg-primary border-primary'
                                : 'bg-background border-border',
                        ].join(' ')}
                        aria-hidden
                    />

                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold">v{v.versionNumber}</span>
                                {idx === 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                        Latest
                                    </span>
                                )}
                                {showTemplateName && v.templateName && (
                                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                                        {v.templateName}
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(v.createdAt)}</p>
                            {v.changelog && (
                                <p className="text-xs mt-1 text-foreground/80 line-clamp-2">{v.changelog}</p>
                            )}
                        </div>

                        {/* Rollback — disabled, F07 */}
                        <div className="relative group flex-shrink-0">
                            <button
                                type="button"
                                disabled
                                aria-label="Rollback (coming in F07)"
                                className="flex items-center gap-1 px-2 py-1 text-[10px] rounded border border-border text-muted-foreground opacity-50 cursor-not-allowed"
                            >
                                <RotateCcw size={10} />
                                Rollback
                            </button>
                            <span className="pointer-events-none absolute bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-0.5 text-[10px] text-background opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                Coming in F07
                            </span>
                        </div>
                    </div>
                </li>
            ))}
        </ol>
    )
}
