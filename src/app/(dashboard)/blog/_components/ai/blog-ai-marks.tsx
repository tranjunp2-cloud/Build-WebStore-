'use client'

import type { ReactNode } from 'react'
import { Check, Loader2, MessageSquare, Sparkles, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { BlogAiField } from './blog-ai-draft'

/** Where an AI change stands in the editor: waiting for a decision, or written (each part can still be undone). */
export type BlogAiPhase = 'pending' | 'applied' | 'saved'

export interface BlogAiLabels {
    tag: string
    undoPart: string
    keepPart: string
    draftTitle: string
    editTitle: string
    pendingNote: string
    appliedTitle: string
    appliedNote: string
    savedTitle: string
    savedNote: string
    keepAll: string
    discard: string
    askChanges: string
    undoAll: string
    done: string
    parts: Record<BlogAiField, string>
}

/**
 * One part of the post an AI change filled: a teal rule along its edge and a
 * small tag. While the change waits the tag only says "AI"; once written the
 * tag offers Keep (drop the mark) and Undo (put this part back as it was).
 */
export function AiMark({
    phase,
    labels,
    onKeep,
    onUndo,
    className,
    children,
}: {
    phase: BlogAiPhase | null
    labels: BlogAiLabels
    onKeep?: () => void
    onUndo?: () => void
    className?: string
    children: ReactNode
}) {
    if (!phase) return <>{children}</>
    return (
        <div className={cn('group/ai relative rounded-[16px] shadow-[inset_3px_0_0_hsl(var(--primary)),0_0_0_1px_hsl(var(--primary)/0.35)] animate-in fade-in-0 slide-in-from-bottom-1 duration-500 motion-reduce:animate-none', className)}>
            {children}
            <span
                className={cn(
                    'absolute -top-3 right-4 z-[2] inline-flex h-6 items-center gap-1 rounded-full [border:1px_solid_hsl(var(--border))] bg-[hsl(var(--card))] pl-2 pr-1 text-[11px] font-semibold text-muted-foreground transition-opacity',
                    phase === 'pending' ? 'opacity-100' : 'opacity-0 group-hover/ai:opacity-100 group-focus-within/ai:opacity-100 max-md:opacity-100',
                )}
            >
                <Sparkles className="h-3 w-3 text-[hsl(var(--primary))]" />
                {labels.tag}
                {phase !== 'pending' && onKeep && (
                    <button type="button" onClick={onKeep} aria-label={labels.keepPart} title={labels.keepPart} className="grid size-5 place-items-center rounded-full text-foreground/70 hover:bg-[hsl(var(--muted))] hover:text-foreground max-md:size-7">
                        <Check className="h-3 w-3" />
                    </button>
                )}
                {phase !== 'pending' && onUndo && (
                    <button type="button" onClick={onUndo} aria-label={labels.undoPart} title={labels.undoPart} className="grid size-5 place-items-center rounded-full text-foreground/70 hover:bg-[hsl(var(--muted))] hover:text-foreground max-md:size-7">
                        <Undo2 className="h-3 w-3" />
                    </button>
                )}
            </span>
        </div>
    )
}

/**
 * The bar over the editor while AI has touched the post: Keep all / Discard /
 * Ask for changes while it waits; Undo all / Done once written.
 */
export function BlogAiBar({
    phase,
    kind,
    fields,
    labels,
    busy,
    onKeepAll,
    onDiscard,
    onAskChanges,
    onUndoAll,
    onDone,
}: {
    phase: BlogAiPhase
    kind: 'create' | 'update'
    fields: BlogAiField[]
    labels: BlogAiLabels
    busy: boolean
    onKeepAll?: () => void
    onDiscard?: () => void
    onAskChanges?: () => void
    onUndoAll?: () => void
    onDone?: () => void
}) {
    const parts = fields.map((f) => labels.parts[f]).join(' · ')
    const title = phase === 'pending' ? (kind === 'create' ? labels.draftTitle : labels.editTitle) : phase === 'saved' ? labels.savedTitle : labels.appliedTitle
    const note = phase === 'pending' ? labels.pendingNote : phase === 'saved' ? labels.savedNote : labels.appliedNote
    return (
        <div
            role="status"
            className="sticky top-2 z-[6] flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl [border:1px_solid_hsl(var(--primary)/0.5)] bg-[color-mix(in_srgb,hsl(var(--card))_88%,hsl(var(--primary)))] px-4 py-2.5 text-[13px] shadow-sm animate-in fade-in-0 slide-in-from-top-1 duration-300 motion-reduce:animate-none"
        >
            <Sparkles className="h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
            <p className="m-0 min-w-[200px] flex-1 text-foreground">
                <b className="font-semibold">{title}</b>
                {parts && <span> · {parts}</span>}
                <span className="text-muted-foreground"> — {note}</span>
            </p>
            <div className="flex items-center gap-1.5">
                {phase === 'pending' ? (
                    <>
                        {onAskChanges && (
                            <Button type="button" variant="dashSecondary" size="dash" className="!h-8 !px-2.5" onClick={onAskChanges} disabled={busy}>
                                <MessageSquare className="h-3.5 w-3.5" />
                                {labels.askChanges}
                            </Button>
                        )}
                        <Button type="button" variant="dashSecondary" size="dash" className="!h-8 !px-2.5" onClick={onDiscard} disabled={busy}>
                            {labels.discard}
                        </Button>
                        <Button type="button" variant="dashPrimary" size="dash" className="!h-8 !px-3" onClick={onKeepAll} disabled={busy}>
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            {labels.keepAll}
                        </Button>
                    </>
                ) : (
                    <>
                        {onUndoAll && (
                            <Button type="button" variant="dashSecondary" size="dash" className="!h-8 !px-2.5" onClick={onUndoAll} disabled={busy}>
                                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                                {labels.undoAll}
                            </Button>
                        )}
                        <Button type="button" variant="dashPrimary" size="dash" className="!h-8 !px-3" onClick={onDone}>
                            <Check className="h-3.5 w-3.5" />
                            {labels.done}
                        </Button>
                    </>
                )}
            </div>
        </div>
    )
}
