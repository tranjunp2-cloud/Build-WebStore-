import { useRef } from 'react'
import { Eye, EyeOff, House, Loader2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDisplayPageTitle } from '@/store/editorStore'
import type { PageData } from '@/store/editorStore'
import { getPagePath } from './page-manager-helpers'
import type { PageStatus } from './page-manager-helpers'
import { PageStatusBadge } from './page-status-badge'
import { DeleteConfirmInline } from './delete-confirm-inline'

export interface PageCardLabels {
    home: string
    editing: string
    editWithAI: string
    hidePage: string
    showPage: string
    deletePage: string
    homeHideProtected: string
    homeProtected: string
    deleteMessage: string
    cancel: string
    confirmDelete: string
    status: { live: string; draft: string; hidden: string; noLink: string }
}

interface PageCardProps {
    page: PageData
    locale: string
    status: PageStatus
    labels: PageCardLabels
    isCurrent: boolean
    isProtected: boolean
    isPending: boolean
    isConfirmingDelete: boolean
    onSelect: () => void
    onEditWithAI: () => void
    onToggleVisibility: () => void
    onRequestDelete: () => void
    onCancelDelete: () => void
    onConfirmDelete: () => void
}

const ICON_BTN = 'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[7px] text-[var(--editor-text)] transition-colors disabled:cursor-not-allowed disabled:opacity-35'

/** One row of the Page library: name + badges + quick actions, path/date meta, and the selected-state extras. */
export function PageCard({
    page, locale, status, labels, isCurrent, isProtected, isPending, isConfirmingDelete,
    onSelect, onEditWithAI, onToggleVisibility, onRequestDelete, onCancelDelete, onConfirmDelete,
}: PageCardProps) {
    const isHidden = page.isVisible === false
    const trashRef = useRef<HTMLButtonElement>(null)
    // Keep keyboard focus on the trash icon after the inline confirm closes.
    const cancelDelete = () => { onCancelDelete(); requestAnimationFrame(() => trashRef.current?.focus()) }
    const hideTitle = isProtected ? labels.homeHideProtected : isHidden ? labels.showPage : labels.hidePage
    const deleteTitle = isProtected ? labels.homeProtected : labels.deletePage

    return (
        <div
            data-page-id={page.id}
            aria-current={isCurrent ? 'page' : undefined}
            // Whole card selects the page (like the design); real buttons / the confirm box handle their own clicks.
            onClick={e => {
                if (isCurrent || (e.target as HTMLElement).closest('button, [role="alertdialog"]')) return
                onSelect()
            }}
            className={cn(
                'group relative shrink-0 rounded-xl border py-2.5 pl-3.5 pr-2 pb-3 transition-colors',
                isCurrent
                    ? 'cursor-default border-teal-500/40 bg-teal-50 shadow-[inset_3px_0_0_hsl(var(--primary))] dark:border-[hsl(var(--primary)/0.3)] dark:bg-[hsl(var(--primary)/0.06)]'
                    : 'cursor-pointer border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-[var(--editor-border-subtle)] dark:bg-[var(--editor-surface-elevated)] dark:hover:border-[var(--editor-border)]',
            )}
        >
            <div className="flex items-center gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    <button type="button" onClick={onSelect} className="min-w-0 truncate text-left text-[15px] font-medium leading-[22px] text-[var(--editor-text)]">
                        {getDisplayPageTitle(page, locale)}
                    </button>
                    {/* One badge per row: status. Home is a small icon; the current page is the highlighted row. */}
                    {page.isHomepage ? (
                        <span title={labels.home} className="inline-flex shrink-0 text-[var(--editor-text-muted)]">
                            <House className="h-3.5 w-3.5" aria-hidden />
                            <span className="sr-only">{labels.home}</span>
                        </span>
                    ) : null}
                    {isCurrent ? <span className="sr-only">{labels.editing}</span> : null}
                    <PageStatusBadge status={status} labels={labels.status} />
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-0.5">
                    <button
                        type="button"
                        onClick={onToggleVisibility}
                        disabled={isProtected}
                        title={hideTitle}
                        aria-label={hideTitle}
                        className={cn(ICON_BTN, isHidden ? 'text-[var(--editor-text-subtle)]' : '', 'enabled:hover:bg-slate-200 dark:enabled:hover:bg-[var(--editor-overlay-hover)]')}
                    >
                        {isHidden ? <EyeOff className="h-[15px] w-[15px]" /> : <Eye className="h-[15px] w-[15px]" />}
                    </button>
                    {/* Trash shows on row hover / keyboard focus (always on touch screens and while busy). */}
                    <span
                        className={cn(
                            'flex transition-opacity',
                            isPending || isConfirmingDelete
                                ? 'opacity-100'
                                : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100',
                        )}
                    >
                        <button
                            ref={trashRef}
                            type="button"
                            onClick={onRequestDelete}
                            disabled={isProtected || isPending}
                            title={deleteTitle}
                            aria-label={deleteTitle}
                            className={cn(ICON_BTN, 'text-[var(--editor-text-muted)] enabled:hover:bg-[hsl(var(--destructive)/0.12)] enabled:hover:text-[hsl(var(--destructive))]')}
                        >
                            {isPending ? <Loader2 className="h-[15px] w-[15px] animate-spin" /> : <Trash2 className="h-[15px] w-[15px]" />}
                        </button>
                    </span>
                </div>
            </div>

            <p className="mt-1 text-xs leading-4 text-[var(--editor-text-muted)]">
                {getPagePath(page)}
                {page.updatedAt ? ` · ${new Date(page.updatedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}` : ''}
            </p>

            {isCurrent ? (
                <button
                    type="button"
                    onClick={onEditWithAI}
                    className="mt-2.5 flex h-[26px] items-center rounded-[7px] bg-transparent px-2.5 text-xs font-medium text-[var(--editor-text)] transition-colors [border:1px_solid_var(--editor-border)] hover:bg-[var(--editor-overlay-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                >
                    {labels.editWithAI}
                </button>
            ) : null}

            {isConfirmingDelete ? (
                <DeleteConfirmInline
                    message={labels.deleteMessage}
                    cancelLabel={labels.cancel}
                    confirmLabel={labels.confirmDelete}
                    onCancel={cancelDelete}
                    onConfirm={onConfirmDelete}
                />
            ) : null}
        </div>
    )
}
