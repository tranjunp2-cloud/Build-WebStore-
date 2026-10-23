import { useState } from 'react'
import { ChevronDown, Pencil, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Custom404FooterProps {
    title: string
    editLabel: string
    editingLabel: string
    isEditing: boolean
    onEdit: () => void
}

/** Collapsible "Custom 404 page" box pinned to the bottom of the panel. */
export function Custom404Footer({ title, editLabel, editingLabel, isEditing, onEdit }: Custom404FooterProps) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div className="shrink-0 border-t border-[var(--editor-border-subtle)] px-3 pb-3 pt-2.5 pl-4">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-[var(--editor-border-subtle)] dark:bg-[var(--editor-bg)]">
                <button
                    type="button"
                    onClick={() => setIsOpen(open => !open)}
                    aria-expanded={isOpen}
                    className="flex h-12 w-full items-center gap-3 pl-4 pr-3.5 text-left text-sm font-medium text-[var(--editor-text)]"
                >
                    <Settings2 className="h-[15px] w-[15px] text-[var(--editor-text-muted)]" />
                    <span className="flex-1">{title}</span>
                    <ChevronDown className={cn('h-[15px] w-[15px] text-[var(--editor-text-muted)] transition-transform', isOpen && 'rotate-180')} />
                </button>
                {isOpen ? (
                    <div className="px-2.5 pb-2.5">
                        <div className={cn('rounded-[10px] bg-white px-3 pb-2 pt-2.5 dark:bg-[var(--editor-surface-elevated)]', isEditing && 'shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.35)]')}>
                            <p className="text-[11px] leading-4 text-[var(--editor-text-muted)]">{title}</p>
                            <button
                                type="button"
                                onClick={onEdit}
                                className="mt-1.5 flex h-[34px] w-full items-center justify-center gap-2 rounded-lg text-sm font-medium text-[var(--editor-text)] transition-colors hover:bg-[var(--editor-overlay-hover)]"
                            >
                                <Pencil className="h-[15px] w-[15px]" aria-hidden />
                                {isEditing ? editingLabel : editLabel}
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    )
}
