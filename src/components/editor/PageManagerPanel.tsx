'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Eye, EyeOff, FileText, House, Loader2, Plus, Search, Settings2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useEditorStore } from '@/store/editorStore'
import { useI18n } from '@/i18n'
import { toast } from 'sonner'
import type { PageData } from '@/store/editorStore'

interface PageManagerPanelProps {
    siteId: string
    currentPageId: string | null
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

function getStatusBadge(page: PageData, labels: { live: string; draft: string }) {
    if (page.status === 'published') {
        return {
            label: labels.live,
            className: 'border border-[rgba(0,201,80,0.3)] bg-[rgba(0,201,80,0.2)] text-[#b9f8cf]',
            dotClassName: 'bg-[#00c950]',
        }
    }

    return {
        label: labels.draft,
        className: 'border border-[rgba(106,114,130,0.3)] bg-[rgba(106,114,130,0.2)] text-[#d1d5dc]',
        dotClassName: '',
    }
}

export function PageManagerPanel({
    siteId,
    currentPageId,
    onPageSelected,
    onPageCreated,
    onPagesChanged,
    onEditPage,
}: PageManagerPanelProps) {
    const { t } = useI18n()
    const pm = t.editor.pageManager
    const pages = useEditorStore(state => state.pages)
    const setPages = useEditorStore(state => state.setPages)
    const addPageToState = useEditorStore(state => state.addPageToState)
    const updatePageInState = useEditorStore(state => state.updatePageInState)

    const [searchQuery, setSearchQuery] = useState('')
    const [isAdding, setIsAdding] = useState(false)
    const [newPageTitle, setNewPageTitle] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [pendingPageId, setPendingPageId] = useState<string | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<PageData | null>(null)
    const [is404SectionOpen, setIs404SectionOpen] = useState(false)

    const { regularPages, page404 } = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase()
        const visiblePages = pages.filter(page => !page.deletedAt)
        const matchesQuery = (page: PageData) =>
            !normalizedQuery ||
            page.title.toLowerCase().includes(normalizedQuery) ||
            page.slug.toLowerCase().includes(normalizedQuery)

        return {
            regularPages: visiblePages.filter(
                page => !SYSTEM_PAGE_SLUGS.has(page.slug) && matchesQuery(page),
            ),
            page404:
                visiblePages.find(
                    page =>
                        (page.slug === '404' || page.slug === '/404') &&
                        matchesQuery(page),
                ) ?? null,
        }
    }, [pages, searchQuery])

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
                throw new Error(`HTTP ${res.status}`)
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
            toast.error(t.editor.pageManagerPanel.createError)
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
            if (!res.ok) throw new Error('Failed to update page')

            onPagesChanged?.()

            if (!newVisible) {
                toast(pm.pageHidden)
            }
        } catch {
            updatePageInState(page.id, { isVisible: page.isVisible })
            toast.error(pm.visibilityFailed)
        }
    }

    const handleDelete = async (page: PageData) => {
        if (SYSTEM_PAGE_SLUGS.has(page.slug) || page.isHomepage) return

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
            if (!res.ok) throw new Error('Failed to delete page')

            // Switch to homepage if deleted page is currently being viewed
            if (String(page.id) === String(currentPageId)) {
                const homepage = pages.find(p => p.isHomepage && !p.deletedAt)
                if (homepage) onPageSelected(String(homepage.id))
            }
            onPagesChanged?.()
        } catch {
            updatePageInState(page.id, { deletedAt: null })
            setPendingPageId(null)
            toast.error(pm.deleteFailed)
            return
        }

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
                        if (!res.ok) throw new Error('Failed to undo deletion')

                        // Refetch pages from server to restore the page in state
                        const pagesRes = await fetch(`/api/sites/${siteId}/pages`, { credentials: 'include' })
                        if (pagesRes.ok) {
                            const pagesData = await pagesRes.json()
                            setPages(pagesData.pages || [])
                        }

                        setPendingPageId(null)
                        onPagesChanged?.()
                        toast.success(pm.restored)
                    } catch {
                        toast.error(pm.restoreFailed)
                    }
                },
            },
            duration: 5000,
        })
    }

    const isEmptyState = regularPages.length === 0 && !page404

    return (
        <div className="relative flex h-full flex-col">
            <div className="border-b border-white/10 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold text-white">{t.editor.pageManagerPanel.title}</p>
                        <p className="mt-1 text-xs text-gray-500">
                            {t.editor.pageManagerPanel.description}
                        </p>
                    </div>
                    <FileText className="h-4 w-4 text-blue-400" />
                </div>
            </div>

            <div className="space-y-3 border-b border-white/10 p-4">
                {!isAdding ? (
                    <button
                        type="button"
                        onClick={() => setIsAdding(true)}
                        className="flex h-9 w-full items-center justify-center gap-2 rounded-[10px] bg-[linear-gradient(90deg,#3B82F6_0%,#2DD4BF_100%)] px-4 text-[14px] font-medium text-white shadow-[0_10px_20px_rgba(45,212,191,0.12)] transition-opacity hover:opacity-95"
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

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <Input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder={pm.searchPlaceholder}
                        variant="editor"
                        className="pl-9"
                    />
                </div>
            </div>

            <div className="min-h-0 flex-1 p-4">
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
                        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                        <div className="space-y-3">
                        {regularPages.map(page => {
                            const isCurrent = page.id === currentPageId
                            const isProtectedPage = Boolean(page.isHomepage) || SYSTEM_PAGE_SLUGS.has(page.slug)
                            const statusBadge = getStatusBadge(page, { live: pm.statusLive, draft: pm.statusDraft })

                            return (
                                <div
                                    key={page.id}
                                    className={cn(
                                        'relative rounded-xl border px-[13px] pb-3 pt-[13px] transition-all',
                                        isCurrent
                                            ? 'border-cyan-400/50 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.15),0_4px_12px_rgba(34,211,238,0.08)]'
                                            : 'border-white/[0.06] bg-[#1E293B] hover:border-white/[0.12]',
                                    )}
                                >
                                    {isCurrent && (
                                        <div className="absolute -left-px top-3 bottom-3 w-[3px] rounded-r-full bg-gradient-to-b from-[#3B82F6] to-[#2DD4BF]" />
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => onPageSelected(page.id)}
                                        className="w-full text-left"
                                    >
                                        <div className="flex min-h-[42px] items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="truncate text-sm font-medium text-[#F8FAFC]">
                                                        {page.title}
                                                    </div>
                                                    {page.isHomepage ? (
                                                        <span className="inline-flex items-center gap-1 rounded-[4px] border border-[rgba(0,201,80,0.3)] bg-[rgba(0,201,80,0.2)] px-2 py-[3px] text-[12px] font-semibold leading-4 text-[#b9f8cf]">
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
                                                        <span className={cn('inline-flex items-center gap-1 rounded-[4px] px-2 py-[3px] text-[12px] font-semibold leading-4', statusBadge.className)}>
                                                            {statusBadge.dotClassName ? (
                                                                <span className={cn('h-1.5 w-1.5 rounded-full', statusBadge.dotClassName)} />
                                                            ) : null}
                                                            {statusBadge.label}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-1 flex items-center gap-2 text-xs leading-4 text-[#94A3B8]">
                                                    <span className="truncate">{getPagePath(page)}</span>
                                                    {page.updatedAt && (
                                                        <>
                                                            <span className="text-[#475569]">·</span>
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
                                            className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
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
                                                'flex h-8 min-w-0 flex-1 items-center justify-center gap-2 rounded-[4px] border border-[rgba(59,130,246,0.04)] bg-[rgba(255,255,255,0.05)] px-3 text-[12px] font-medium leading-4 text-[#F8FAFC] transition-colors',
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
                                                'flex h-8 w-[85px] shrink-0 items-center justify-center gap-2 rounded-[4px] border border-[rgba(251,44,54,0.3)] bg-[rgba(251,44,54,0.1)] px-3 text-[12px] font-medium leading-4 text-[#FFC9C9] transition-colors',
                                                pendingPageId === page.id
                                                    ? 'opacity-70'
                                                    : isProtectedPage
                                                        ? 'opacity-50'
                                                        : 'hover:bg-[rgba(251,44,54,0.16)]',
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
                            <div className="shrink-0 pt-6">
                                <div className="rounded-[12px] border border-[rgba(59,130,246,0.04)] bg-[#111A2D] p-2">
                                    <button
                                        type="button"
                                        onClick={() => setIs404SectionOpen(open => !open)}
                                        className="flex h-9 w-full items-center justify-between rounded-[10px] px-3 text-left transition-colors hover:bg-white/[0.03]"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Settings2 className="h-3.5 w-3.5 text-[#94A3B8]" />
                                            <p className="text-[12px] font-medium leading-4 text-[#F8FAFC]">{pm.customPage}</p>
                                        </div>
                                        {is404SectionOpen ? (
                                            <ChevronDown className="h-4 w-4 text-[#94A3B8]" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4 text-[#94A3B8]" />
                                        )}
                                    </button>

                                    {is404SectionOpen ? (
                                        <div className="mt-2 rounded-[8px] bg-[#1E293B] px-3 py-3">
                                            <p className="text-[10px] font-normal leading-4 text-[#64748B]">
                                                {pm.customPage}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => onPageSelected(page404.id)}
                                                className="mt-2 flex h-8 w-full items-center justify-center gap-2 rounded-[4px] border border-[rgba(59,130,246,0.04)] bg-[#253046] text-[12px] font-medium text-[#F8FAFC] transition-colors hover:border-cyan-500/20 hover:bg-[#2A3750]"
                                            >
                                                <span aria-hidden="true">✏️</span>
                                                {pm.editWithAI}
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
                <div className="absolute inset-0 z-30 bg-[rgba(11,17,32,0.72)] backdrop-blur-[2px]">
                    <div
                        className="absolute inset-0"
                        onClick={() => setDeleteTarget(null)}
                        aria-hidden="true"
                    />

                    <div className="relative flex h-full items-center justify-center px-4 py-6">
                        <div className="w-full max-w-[347px] rounded-[18px] border border-[rgba(59,130,246,0.16)] bg-[linear-gradient(180deg,rgba(20,30,48,0.98)_0%,rgba(11,17,32,0.98)_100%)] px-[25px] pb-[25px] pt-[25px] shadow-[0_24px_48px_rgba(2,6,23,0.45)]">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(251,44,54,0.28)] bg-[rgba(127,29,29,0.22)] text-[#FCA5A5]">
                                <AlertTriangle className="h-8 w-8" />
                            </div>

                            <div className="mt-4 text-center">
                                <p className="text-[28px] font-semibold leading-7 text-white">
                                    {pm.deleteConfirmTitle}
                                </p>
                                <p className="mt-3 text-[14px] leading-6 text-[#CBD5E1]">
                                    {pm.deleteConfirmMsg}
                                    {' '}
                                    <span className="text-[#2DD4BF]">&quot;{deleteTarget.title}&quot;</span>
                                    ?
                                </p>
                                <p className="text-[14px] leading-5 text-[#94A3B8]">
                                    {pm.deleteConfirmDesc}
                                </p>
                            </div>

                            <div className="mt-6 grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setDeleteTarget(null)}
                                    className="flex h-11 items-center justify-center rounded-[10px] border border-[rgba(59,130,246,0.04)] bg-[rgba(255,255,255,0.05)] text-[14px] font-medium text-white transition-colors hover:bg-[rgba(255,255,255,0.08)]"
                                >
                                    {pm.cancel}
                                </button>
                                <button
                                    type="button"
                                    disabled={pendingPageId === deleteTarget.id}
                                    onClick={() => void handleDelete(deleteTarget)}
                                    className="flex h-11 items-center justify-center gap-2 rounded-[10px] border border-[rgba(251,44,54,0.4)] bg-[#FF1F3D] text-[14px] font-medium text-white transition-colors hover:bg-[#ff3550] disabled:opacity-70"
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
    )
}
