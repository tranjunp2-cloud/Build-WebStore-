'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Eye, EyeOff, FileText, House, Loader2, Pencil, Plus, Settings2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useEditorStore, getDisplayPageTitle } from '@/store/editorStore'
import { useI18n } from '@/i18n'
import { toast } from 'sonner'
import type { PageData } from '@/store/editorStore'
import { buildSlugCanonicalMap, resolveInternalUrlPath } from '@/lib/navigation-url'
import { resolveApiError } from '@/lib/ui/resolve-api-error'

interface PageManagerPanelProps {
    siteId: string
    currentPageId: string | null
    siteStatus?: string
    onPageSelected: (pageId: string) => void
    onPageCreated?: (pageId: string) => void
    onPagesChanged?: () => void
    onEditPage?: (pageId: string) => void
}

function slugifyPageTitle(title: string) {
    return title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '')
}

const SYSTEM_PAGE_SLUGS = new Set(['404', '/404'])

function getPagePath(page: PageData) {
    if (page.isHomepage || page.slug === 'home' || page.slug === '') return '/'
    return page.slug.startsWith('/') ? page.slug : `/${page.slug}`
}

/** Collect slugs (normalized to /slug) from a nav links tree (recursive). */
function collectNavSlugs(links: unknown, slugCanonical: Map<string, string>): Set<string> {
    const slugs = new Set<string>()
    if (!Array.isArray(links)) return slugs
    for (const link of links) {
        if (!link || typeof link !== 'object') continue
        const l = link as { url?: string; children?: unknown }
        const resolvedPath = resolveInternalUrlPath(l.url, slugCanonical)
        if (resolvedPath) slugs.add(resolvedPath)
        if (l.children) for (const s of collectNavSlugs(l.children, slugCanonical)) slugs.add(s)
    }
    return slugs
}

/** Return IDs of pages whose slug appears in the nav links tree. */
function collectMenuPageIds(links: unknown, pages: PageData[]): Set<string> {
    const slugCanonical = buildSlugCanonicalMap(pages)
    const navSlugs = collectNavSlugs(links, slugCanonical)
    const ids = new Set<string>()
    for (const page of pages) {
        const pagePath =
            page.isHomepage || page.slug === 'home' || page.slug === ''
                ? '/'
                : page.slug.startsWith('/') ? page.slug : `/${page.slug}`
        if (navSlugs.has(pagePath)) ids.add(page.id)
    }
    return ids
}

function getStatusBadge(
    page: PageData,
    labels: { live: string; draft: string; tooltipLive: string; tooltipLiveHidden: string; tooltipLiveNoLink: string; tooltipDraft: string; tooltipDraftSite: string },
    siteStatus?: string,
    menuPageIds?: Set<string>,
) {
    const isPageLive = page.status === 'published' && siteStatus === 'published'
    const liveCls = 'border border-[hsl(var(--success)/0.3)] bg-[hsl(var(--success)/0.2)] text-[hsl(var(--primary))]'
    const liveDot = 'bg-[hsl(var(--success))]'

    if (isPageLive) {
        if (page.isVisible === false) {
            return { label: labels.live, sublabel: 'Hidden' as const, className: liveCls, dotClassName: liveDot, tooltip: labels.tooltipLiveHidden }
        }
        if (menuPageIds && !menuPageIds.has(page.id)) {
            return { label: labels.live, sublabel: 'No Link' as const, className: liveCls, dotClassName: liveDot, tooltip: labels.tooltipLiveNoLink }
        }
        return { label: labels.live, sublabel: null, className: liveCls, dotClassName: liveDot, tooltip: labels.tooltipLive }
    }

    // Draft: distinguish page-level draft vs site unpublished
    const draftBecauseSite = page.status === 'published' && siteStatus !== 'published'
    return {
        label: labels.draft,
        sublabel: null,
        className: 'border border-[var(--editor-border)] bg-[var(--editor-surface-elevated)] text-[var(--editor-text-muted)]',
        dotClassName: '',
        tooltip: draftBecauseSite ? labels.tooltipDraftSite : labels.tooltipDraft,
    }
}

export function PageManagerPanel({
    siteId,
    currentPageId,
    siteStatus,
    onPageSelected,
    onPageCreated,
    onPagesChanged,
    onEditPage,
}: PageManagerPanelProps) {
    const { t } = useI18n()
    const pm = t.editor.pageManager
    const sub = t.common.subscriptionErrors
    const pages = useEditorStore(state => state.pages)
    const activeLocale = useEditorStore(state => state.activeLocale)
    const setPages = useEditorStore(state => state.setPages)
    const addPageToState = useEditorStore(state => state.addPageToState)
    const updatePageInState = useEditorStore(state => state.updatePageInState)
    const headerBlock = useEditorStore(state => state.headerBlock)

    const menuPageIds = useMemo(
        () => collectMenuPageIds((headerBlock as { links?: unknown } | null)?.links, pages),
        [headerBlock, pages],
    )

    const [isAdding, setIsAdding] = useState(false)
    const [newPageTitle, setNewPageTitle] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [pendingPageId, setPendingPageId] = useState<string | null>(null)

    // Auto-scroll the page being edited into view (#1221 bug 2). rAF waits for the list to paint
    // (tab switch / mount / data load) before measuring; scrollIntoView cuộn scroll-container nội
    // bộ (overflow-y-auto), không phải window. `block: 'nearest'` chỉ cuộn khi item bị khuất.
    const listScrollRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (!currentPageId) return
        const raf = requestAnimationFrame(() => {
            const el = listScrollRef.current?.querySelector<HTMLElement>(
                `[data-page-id="${currentPageId}"]`,
            )
            // Optional-call the method too: jsdom (test env) doesn't implement scrollIntoView.
            el?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
        })
        return () => cancelAnimationFrame(raf)
    }, [currentPageId])
    const [deleteTarget, setDeleteTarget] = useState<PageData | null>(null)
    const [is404SectionOpen, setIs404SectionOpen] = useState(false)

    const { regularPages, page404 } = useMemo(() => {
        const visiblePages = pages.filter(page => !page.deletedAt)
        return {
            regularPages: visiblePages.filter(page => !SYSTEM_PAGE_SLUGS.has(page.slug)),
            page404: visiblePages.find(page => page.slug === '404' || page.slug === '/404') ?? null,
        }
    }, [pages])

    const handleCreatePage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newPageTitle.trim() || isSubmitting) return

        setIsSubmitting(true)

        try {
            const slug = slugifyPageTitle(newPageTitle)
            const res = await fetch(`/api/sites/${siteId}/pages`, {
                method: 'POST',
                headers: { 'Content-type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ title: newPageTitle, slug }),
            })

            if (!res.ok) {
                if (res.status === 409) {
                    toast.error(t.editor.pageManagerPanel.slugConflict)
                    return
                }
                const data = await res.json().catch(() => null)
                throw new Error(resolveApiError(data, `HTTP ${res.status}`, sub))
            }

            const data = await res.json()

            addPageToState(data.page)
            setNewPageTitle('')
            setIsAdding(false)
            toast.success(pm.pageCreated)

            const pageId = data.page?.id
            if (pageId) {
                onPageSelected(pageId)
                onPageCreated?.(pageId)
            }

            onPagesChanged?.()
        } catch (err) {
            console.error('[PageManagerPanel] Create page failed:', err)
            toast.error(err instanceof Error ? err.message : t.editor.pageManagerPanel.createError)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleToggleVisibility = async (page: PageData) => {
        if (SYSTEM_PAGE_SLUGS.has(page.slug) || page.isHomepage) return

        const newVisible = !page.isVisible
        updatePageInState(page.id, { isVisible: newVisible })

        try {
            const res = await fetch(`/api/sites/${siteId}/pages/${page.id}`, {
                method: 'PATCH',
                headers: { 'Content-type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ isVisible: newVisible }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => null)
                throw new Error(resolveApiError(data, pm.visibilityFailed, sub))
            }

            onPagesChanged?.()

            if (!newVisible) {
                toast(pm.pageHidden)
            }
        } catch (err) {
            updatePageInState(page.id, { isVisible: page.isVisible })
            toast.error(err instanceof Error ? err.message : pm.visibilityFailed)
        }
    }

    const handleDelete = async (page: PageData) => {
        if (SYSTEM_PAGE_SLUGS.has(page.slug) || page.isHomepage) return

        // A site must keep at least one regular page (#1226 AC).
        if (regularPages.length <= 1) {
            toast.error(pm.cannotDeleteLastPage)
            return
        }

        const now = new Date().toISOString()
        updatePageInState(page.id, { deletedAt: now })
        setPendingPageId(page.id)
        setDeleteTarget(null)

        try {
            const res = await fetch(`/api/sites/${siteId}/pages/${page.id}`, {
                method: 'PATCH',
                headers: { 'Content-type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ deletedAt: now }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => null)
                throw new Error(resolveApiError(data, pm.deleteFailed, sub))
            }

            // Switch to homepage if deleted page is currently being viewed
            if (String(page.id) === String(currentPageId)) {
                const homepage = pages.find(p => p.isHomepage && !p.deletedAt)
                if (homepage) onPageSelected(String(homepage.id))
            }
            onPagesChanged?.()
        } catch (err) {
            updatePageInState(page.id, { deletedAt: null })
            setPendingPageId(null)
            toast.error(err instanceof Error ? err.message : pm.deleteFailed)
            return
        }

        // Clear the pending spinner on the happy path too (catch already clears it).
        setPendingPageId(null)

        toast(pm.deleteSuccess, {
            action: {
                label: pm.undo,
                onClick: async () => {
                    try {
                        const res = await fetch(`/api/sites/${siteId}/pages/${page.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ deletedAt: null }),
                        })
                        if (!res.ok) {
                            const data = await res.json().catch(() => null)
                            throw new Error(resolveApiError(data, pm.restoreFailed, sub))
                        }

                        // Refetch pages from server to restore the page in state
                        const pagesRes = await fetch(`/api/sites/${siteId}/pages`, { credentials: 'include' })
                        if (pagesRes.ok) {
                            const pagesData = await pagesRes.json()
                            setPages(pagesData.pages || [])
                        }

                        setPendingPageId(null)
                        onPagesChanged?.()
                        toast.success(pm.restored)
                    } catch (err) {
                        toast.error(err instanceof Error ? err.message : pm.restoreFailed)
                    }
                },
            },
            duration: 5000,
        })
    }

    const isEmptyState = regularPages.length === 0 && !page404

    return (
        <TooltipProvider delayDuration={150}>
        <div data-coach="page-library" className="relative flex h-full flex-col">
            <div className="border-b border-white/10 px-4 pt-4 pb-2">
                <div>
                    <p className="text-sm font-semibold text-white">{t.editor.pageManagerPanel.title}</p>
                    <p className="mt-1 text-xs text-gray-500">
                        {t.editor.pageManagerPanel.description}
                    </p>
                </div>
            </div>

            <div className="border-b border-white/10 px-4 py-2">
                {!isAdding ? (
                    <button
                        type="button"
                        onClick={() => setIsAdding(true)}
                        className="flex h-9 w-full items-center justify-center gap-2 rounded-[10px] bg-[linear-gradient(90deg,hsl(var(--info))_0%,hsl(var(--primary))_100%)] px-4 text-[14px] font-medium text-white shadow-[0_10px_20px_rgba(45,212,191,0.12)] transition-opacity hover:opacity-95"
                    >
                        <Plus className="h-4 w-4" />
                        {pm.addNewPage}
                    </button>
                ) : (
                    <form onSubmit={handleCreatePage} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <Input
                            autoFocus
                            required
                            value={newPageTitle}
                            onChange={e => setNewPageTitle(e.target.value)}
                            placeholder={pm.pageNamePlaceholder}
                            variant="editor"
                        />
                        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                            <span>Slug: /{slugifyPageTitle(newPageTitle || 'new-page')}</span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsAdding(false)
                                        setNewPageTitle('')
                                    }}
                                    className="text-gray-400 transition-colors hover:text-white"
                                >
                                    {pm.cancel}
                                </button>
                                <Button type="submit" size="sm" disabled={isSubmitting || !newPageTitle.trim()}>
                                    {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                    {pm.create}
                                </Button>
                            </div>
                        </div>
                    </form>
                )}

            </div>

            <div className="min-h-0 flex-1 px-4 pt-2 pb-4">
                {isEmptyState ? (
                    <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/5 px-6 text-center">
                        <FileText className="h-8 w-8 text-gray-600" />
                        <p className="mt-4 text-sm font-medium text-white">{t.editor.pageManagerPanel.noPagesFound}</p>
                        <p className="mt-2 max-w-xs text-xs text-gray-500">
                            {t.editor.pageManagerPanel.noPagesSuggestion}
                        </p>
                    </div>
                ) : (
                    <div className="flex h-full min-h-0 flex-col">
                        <div ref={listScrollRef} className="min-h-0 flex-1 overflow-y-auto pr-1">
                        <div className="space-y-3">
                        {regularPages.map(page => {
                            const isCurrent = page.id === currentPageId
                            const isProtectedPage = Boolean(page.isHomepage) || SYSTEM_PAGE_SLUGS.has(page.slug)
                            const statusBadge = getStatusBadge(
                                    page,
                                    {
                                        live: pm.statusLive,
                                        draft: pm.statusDraft,
                                        tooltipLive: t.editor.pageManagerPanel.tooltipLive,
                                        tooltipLiveHidden: t.editor.pageManagerPanel.tooltipLiveHidden,
                                        tooltipLiveNoLink: t.editor.pageManagerPanel.tooltipLiveNoLink,
                                        tooltipDraft: t.editor.pageManagerPanel.tooltipDraft,
                                        tooltipDraftSite: t.editor.pageManagerPanel.tooltipDraftSite,
                                    },
                                    siteStatus,
                                    menuPageIds,
                                )

                            return (
                                <div
                                    key={page.id}
                                    data-page-id={page.id}
                                    className={cn(
                                        'relative rounded-xl border px-[13px] pb-3 pt-[13px] transition-all',
                                        isCurrent
                                            ? 'border-cyan-400/50 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.15),0_4px_12px_rgba(34,211,238,0.08)]'
                                            : 'border-white/[0.06] bg-[var(--editor-surface-elevated)] hover:border-white/[0.12]',
                                    )}
                                >
                                    {isCurrent && (
                                        <div className="absolute -left-px top-3 bottom-3 w-[3px] rounded-r-full bg-gradient-to-b from-[hsl(var(--info))] to-[hsl(var(--primary))]" />
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => onPageSelected(page.id)}
                                        className="w-full text-left"
                                    >
                                        <div className="flex min-h-[42px] items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="truncate text-sm font-medium text-[var(--editor-text)]">
                                                        {getDisplayPageTitle(page, activeLocale)}
                                                    </div>
                                                    {page.isHomepage ? (
                                                        <span className="inline-flex items-center gap-1 rounded-[4px] border border-[hsl(var(--success)/0.3)] bg-[hsl(var(--success)/0.2)] px-2 py-[3px] text-[12px] font-semibold leading-4 text-[hsl(var(--primary))]">
                                                            <House className="h-3 w-3" />
                                                            {pm.home}
                                                        </span>
                                                    ) : null}
                                                    {isCurrent ? (
                                                        <span className="inline-flex items-center gap-1 rounded-[4px] border border-cyan-400/30 bg-cyan-500/15 px-2 py-[3px] text-[11px] font-semibold leading-4 text-cyan-300">
                                                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
                                                            {pm.editing}
                                                        </span>
                                                    ) : (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span className="inline-flex cursor-default items-center gap-1">
                                                                    <span className={cn('inline-flex items-center gap-1 rounded-[4px] px-2 py-[3px] text-[12px] font-semibold leading-4', statusBadge.className)}>
                                                                        {statusBadge.dotClassName ? (
                                                                            <span className={cn('h-1.5 w-1.5 rounded-full', statusBadge.dotClassName)} />
                                                                        ) : null}
                                                                        {statusBadge.label}
                                                                    </span>
                                                                    {statusBadge.sublabel && (
                                                                        <span className="inline-flex items-center rounded-[4px] border border-amber-500/30 bg-amber-500/15 px-2 py-[3px] text-[11px] font-semibold leading-4 text-amber-300">
                                                                            {statusBadge.sublabel}
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top">{statusBadge.tooltip}</TooltipContent>
                                                        </Tooltip>
                                                    )}
                                                </div>
                                                <div className="mt-1 flex items-center gap-2 text-xs leading-4 text-[var(--editor-text-muted)]">
                                                    <span className="truncate">{getPagePath(page)}</span>
                                                    {page.updatedAt && (
                                                        <>
                                                            <span className="text-[var(--editor-text-muted)]">·</span>
                                                            <span className="shrink-0">{new Date(page.updatedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                        </div>
                                    </button>

                                    {isCurrent && (
                                        <button
                                            type="button"
                                            onClick={() => onEditPage?.(page.id)}
                                            className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--primary))] text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                            {pm.editWithAI}
                                        </button>
                                    )}

                                    <div className="mt-2 flex h-8 items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleToggleVisibility(page)}
                                            disabled={isProtectedPage}
                                            className={cn(
                                                'flex h-8 min-w-0 flex-1 items-center justify-center gap-2 rounded-[4px] border border-[hsl(var(--primary)/0.04)] bg-[var(--editor-overlay-bg)] px-3 text-[12px] font-medium leading-4 text-[var(--editor-text)] transition-colors',
                                                isProtectedPage
                                                    ? 'opacity-60'
                                                    : 'hover:border-cyan-500/20 hover:bg-white/10',
                                            )}
                                            title={isProtectedPage ? pm.homeHideProtected : page.isVisible ? pm.hidePage : pm.showPage}
                                        >
                                            {page.isVisible ? (
                                                <Eye className="h-3.5 w-3.5" />
                                            ) : (
                                                <EyeOff className="h-3.5 w-3.5 text-amber-300" />
                                            )}
                                            {page.isVisible ? pm.visible : pm.hidden}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setDeleteTarget(page)}
                                            disabled={pendingPageId === page.id || isProtectedPage}
                                            className={cn(
                                                'flex h-8 w-[85px] shrink-0 items-center justify-center gap-2 rounded-[4px] border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.1)] px-3 text-[12px] font-medium leading-4 text-[hsl(var(--destructive))] transition-colors',
                                                pendingPageId === page.id
                                                    ? 'opacity-70'
                                                    : isProtectedPage
                                                        ? 'opacity-50'
                                                        : 'hover:bg-[hsl(var(--destructive)/0.16)]',
                                            )}
                                            title={isProtectedPage ? pm.homeProtected : pm.deletePage}
                                        >
                                            {pendingPageId === page.id ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-3.5 w-3.5" />
                                            )}
                                            {pm.delete}
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                        </div>
                        </div>

                        {page404 ? (
                            <div className="shrink-0 pt-3">
                                <div className="rounded-[12px] border border-[hsl(var(--primary)/0.04)] bg-[var(--editor-bg)] p-2">
                                    <button
                                        type="button"
                                        onClick={() => setIs404SectionOpen(open => !open)}
                                        className="flex h-9 w-full items-center justify-between rounded-[10px] px-3 text-left transition-colors hover:bg-white/[0.03]"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Settings2 className="h-3.5 w-3.5 text-[var(--editor-text-muted)]" />
                                            <p className="text-[12px] font-medium leading-4 text-[var(--editor-text)]">{pm.customPage}</p>
                                        </div>
                                        {is404SectionOpen ? (
                                            <ChevronDown className="h-4 w-4 text-[var(--editor-text-muted)]" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4 text-[var(--editor-text-muted)]" />
                                        )}
                                    </button>

                                    {is404SectionOpen ? (
                                        <div className="mt-2 rounded-[8px] bg-[var(--editor-surface-elevated)] px-3 py-3">
                                            <p className="text-[10px] font-normal leading-4 text-[var(--editor-text-muted)]">
                                                {pm.customPage}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => onPageSelected(page404.id)}
                                                className="mt-2 flex h-8 w-full items-center justify-center gap-2 rounded-[4px] border border-[hsl(var(--primary)/0.04)] bg-[var(--editor-surface-elevated)] text-[12px] font-medium text-[var(--editor-text)] transition-colors hover:border-cyan-500/20 hover:bg-[var(--editor-surface-elevated)]"
                                            >
                                                <Pencil className="h-4 w-4" aria-hidden />
                                                {pm.edit404Page}
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>

            {deleteTarget ? (
                <div className="absolute inset-0 z-30 bg-[rgba(11,17,32,0.72)] backdrop-blur-[2px]">{/* intentional dark scrim — modal backdrop stays dim in both themes (like a black overlay) */}
                    <div
                        className="absolute inset-0"
                        onClick={() => setDeleteTarget(null)}
                        aria-hidden="true"
                    />

                    <div className="relative flex h-full items-center justify-center px-4 py-6">
                        <div className="w-full max-w-[347px] rounded-[18px] border border-[hsl(var(--primary)/0.16)] bg-[var(--editor-surface)] px-[25px] pb-[25px] pt-[25px] shadow-[0_24px_48px_rgba(2,6,23,0.45)]">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[hsl(var(--destructive)/0.28)] bg-[hsl(var(--destructive)/0.22)] text-[hsl(var(--destructive))]">
                                <AlertTriangle className="h-8 w-8" />
                            </div>

                            <div className="mt-4 text-center">
                                <p className="text-[28px] font-semibold leading-7 text-white">
                                    {pm.deleteConfirmTitle}
                                </p>
                                <p className="mt-3 text-[14px] leading-6 text-[var(--editor-text-muted)]">
                                    {pm.deleteConfirmMsg}
                                    {' '}
                                    <span className="text-[hsl(var(--primary))]">&quot;{deleteTarget.title}&quot;</span>
                                    ?
                                </p>
                                <p className="text-[14px] leading-5 text-[var(--editor-text-muted)]">
                                    {pm.deleteConfirmDesc}
                                </p>
                            </div>

                            <div className="mt-6 grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setDeleteTarget(null)}
                                    className="flex h-11 items-center justify-center rounded-[10px] border border-[hsl(var(--primary)/0.04)] bg-[var(--editor-overlay-bg)] text-[14px] font-medium text-white transition-colors hover:bg-[var(--editor-overlay-hover)]"
                                >
                                    {pm.cancel}
                                </button>
                                <button
                                    type="button"
                                    disabled={pendingPageId === deleteTarget.id}
                                    onClick={() => void handleDelete(deleteTarget)}
                                    className="flex h-11 items-center justify-center gap-2 rounded-[10px] border border-[hsl(var(--destructive)/0.4)] bg-[hsl(var(--destructive))] text-[14px] font-medium text-white transition-colors hover:bg-[hsl(var(--destructive))] hover:opacity-90 disabled:opacity-70"
                                >
                                    {pendingPageId === deleteTarget.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-4 w-4" />
                                    )}
                                    {pm.confirmDelete}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
        </TooltipProvider>
    )
}
