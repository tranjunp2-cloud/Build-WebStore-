'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useEditorStore, getDisplayPageTitle } from '@/store/editorStore'
import { useI18n } from '@/i18n'
import { AddPageForm } from './page-manager/add-page-form'
import { Custom404Footer } from './page-manager/custom-404-footer'
import { PageCard } from './page-manager/page-card'
import { SYSTEM_PAGE_SLUGS, collectMenuPageIds, getPageStatus } from './page-manager/page-manager-helpers'
import { withPageName } from './page-manager/page-toast'
import { usePageManagerActions } from './page-manager/use-page-manager-actions'

interface PageManagerPanelProps {
    siteId: string
    currentPageId: string | null
    siteStatus?: string
    onPageSelected: (pageId: string) => void
    onPageCreated?: (pageId: string) => void
    onPagesChanged?: () => void
    onEditPage?: (pageId: string) => void
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
    const pmp = t.editor.pageManagerPanel
    const pages = useEditorStore(state => state.pages)
    const activeLocale = useEditorStore(state => state.activeLocale)
    const headerBlock = useEditorStore(state => state.headerBlock)

    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

    const menuPageIds = useMemo(
        () => collectMenuPageIds((headerBlock as { links?: unknown } | null)?.links, pages),
        [headerBlock, pages],
    )

    const { regularPages, page404 } = useMemo(() => {
        const livePages = pages.filter(page => !page.deletedAt)
        return {
            regularPages: livePages.filter(page => !SYSTEM_PAGE_SLUGS.has(page.slug)),
            page404: livePages.find(page => SYSTEM_PAGE_SLUGS.has(page.slug)) ?? null,
        }
    }, [pages])

    const { createPage, toggleVisibility, deletePage, isSubmitting, pendingPageId } = usePageManagerActions({
        siteId, currentPageId, regularPages, onPageSelected, onPageCreated, onPagesChanged,
    })

    // Auto-scroll the page being edited into view (#1221 bug 2). rAF waits for the list to paint
    // (tab switch / mount / data load); `block: 'nearest'` only scrolls when the card is hidden.
    const listScrollRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (!currentPageId) return
        const raf = requestAnimationFrame(() => {
            const el = listScrollRef.current?.querySelector<HTMLElement>(`[data-page-id="${currentPageId}"]`)
            // Optional-call: jsdom (test env) doesn't implement scrollIntoView.
            el?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
        })
        return () => cancelAnimationFrame(raf)
    }, [currentPageId])

    const scrollListToBottom = () => {
        requestAnimationFrame(() => {
            const list = listScrollRef.current
            if (list) list.scrollTop = list.scrollHeight
        })
    }

    const statusLabels = {
        tooltipLive: pmp.tooltipLive,
        tooltipLiveHidden: pmp.tooltipLiveHidden,
        tooltipLiveNoLink: pmp.tooltipLiveNoLink,
        tooltipDraft: pmp.tooltipDraft,
        tooltipDraftSite: pmp.tooltipDraftSite,
    }
    const cardLabels = {
        home: pm.home,
        editing: pm.editing,
        editWithAI: pm.editWithAI,
        hidePage: pm.hidePage,
        showPage: pm.showPage,
        deletePage: pm.deletePage,
        homeHideProtected: pm.homeHideProtected,
        homeProtected: pm.homeProtected,
        cancel: pm.cancel,
        confirmDelete: pm.confirmDelete,
        status: { live: pm.statusLive, draft: pm.statusDraft, hidden: pm.hiddenBadge, noLink: pm.noLinkBadge },
    }
    const addLabels = {
        addNewPage: pm.addNewPage,
        pageNameLabel: pm.pageNameLabel,
        placeholder: pm.pageNamePlaceholder,
        urlPreview: pm.urlPreview,
        cancel: pm.cancel,
        createPage: pm.createPage,
        duplicatePage: pm.duplicatePage,
        invalidPageName: pm.invalidPageName,
    }

    const addForm = (
        <AddPageForm
            labels={addLabels}
            pages={pages}
            locale={activeLocale}
            isSubmitting={isSubmitting}
            onCreate={createPage}
            onOpen={() => { setConfirmDeleteId(null); scrollListToBottom() }}
        />
    )

    return (
        <TooltipProvider delayDuration={150}>
            <div data-coach="page-library" className="flex h-full min-h-0 flex-col">
                <div className="shrink-0 px-4 pb-3 pt-[18px]">
                    <p className="text-[15px] font-semibold leading-[22px] text-[var(--editor-text)]">{pmp.title}</p>
                    <p className="mt-0.5 text-xs leading-[17px] text-[var(--editor-text-muted)]">{pmp.description}</p>
                </div>

                <div ref={listScrollRef} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overflow-x-hidden pb-3 pl-4 pr-3">
                    {regularPages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--editor-border)] px-6 py-8 text-center">
                            <FileText className="h-8 w-8 text-[var(--editor-text-subtle)]" />
                            <p className="mt-4 text-sm font-medium text-[var(--editor-text)]">{pmp.noPagesFound}</p>
                            <p className="mt-2 max-w-xs text-xs text-[var(--editor-text-muted)]">{pmp.noPagesSuggestion}</p>
                        </div>
                    ) : null}

                    {regularPages.map(page => {
                        const isProtected = Boolean(page.isHomepage)
                        return (
                            <PageCard
                                key={page.id}
                                page={page}
                                locale={activeLocale}
                                status={getPageStatus(page, statusLabels, siteStatus, menuPageIds)}
                                labels={{ ...cardLabels, deleteMessage: withPageName(pm.deleteInlineConfirm, getDisplayPageTitle(page, activeLocale)) }}
                                isCurrent={page.id === currentPageId}
                                isProtected={isProtected}
                                isPending={pendingPageId === page.id}
                                isConfirmingDelete={confirmDeleteId === page.id}
                                onSelect={() => { setConfirmDeleteId(null); onPageSelected(page.id) }}
                                onEditWithAI={() => onEditPage?.(page.id)}
                                onToggleVisibility={() => { setConfirmDeleteId(null); void toggleVisibility(page) }}
                                onRequestDelete={() => setConfirmDeleteId(page.id)}
                                onCancelDelete={() => setConfirmDeleteId(null)}
                                onConfirmDelete={() => { setConfirmDeleteId(null); void deletePage(page) }}
                            />
                        )
                    })}

                    {addForm}
                </div>

                {page404 ? (
                    <Custom404Footer
                        title={pm.customPage}
                        editLabel={pm.edit404Page}
                        editingLabel={pm.editing404Page}
                        isEditing={page404.id === currentPageId}
                        onEdit={() => { setConfirmDeleteId(null); onPageSelected(page404.id) }}
                    />
                ) : null}
            </div>
        </TooltipProvider>
    )
}
