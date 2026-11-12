'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useEditorStore, getDisplayPageTitle } from '@/store/editorStore'
import type { PageData } from '@/store/editorStore'
import { useI18n } from '@/i18n'
import { resolveApiError } from '@/lib/ui/resolve-api-error'
import { SYSTEM_PAGE_SLUGS, slugifyPageTitle } from './page-manager-helpers'
import { pageToast, withPageName } from './page-toast'

interface UsePageManagerActionsArgs {
    siteId: string
    currentPageId: string | null
    /** Non-deleted, non-system pages — used for the "keep at least one page" rule. */
    regularPages: PageData[]
    onPageSelected: (pageId: string) => void
    onPageCreated?: (pageId: string) => void
    onPagesChanged?: () => void
}

const JSON_HEADERS = { 'Content-type': 'application/json' }

/**
 * Runs a host callback (navigation / refetch) after the server already accepted a change
 * (delete / hide-show / restore). Its failure — sync throw or async rejection — must not
 * roll the change back or hide the toast.
 */
function runSideEffect(fn: () => void | Promise<void>) {
    try {
        Promise.resolve(fn()).catch(err => console.error('[PageManagerPanel] Host callback failed:', err))
    } catch (err) {
        console.error('[PageManagerPanel] Host callback failed:', err)
    }
}

/** Network + optimistic-state handlers for the Pages panel (create / hide-show / soft-delete with undo). */
export function usePageManagerActions({
    siteId,
    currentPageId,
    regularPages,
    onPageSelected,
    onPageCreated,
    onPagesChanged,
}: UsePageManagerActionsArgs) {
    const { t } = useI18n()
    const pm = t.editor.pageManager
    const sub = t.common.subscriptionErrors
    const pages = useEditorStore(state => state.pages)
    const activeLocale = useEditorStore(state => state.activeLocale)
    const setPages = useEditorStore(state => state.setPages)
    const addPageToState = useEditorStore(state => state.addPageToState)
    const updatePageInState = useEditorStore(state => state.updatePageInState)

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [pendingPageId, setPendingPageId] = useState<string | null>(null)

    /** Resolves true when the page was created (caller can close/reset the form). */
    const createPage = async (title: string): Promise<boolean> => {
        if (!title.trim() || isSubmitting) return false
        setIsSubmitting(true)
        try {
            const res = await fetch(`/api/sites/${siteId}/pages`, {
                method: 'POST',
                headers: JSON_HEADERS,
                credentials: 'include',
                body: JSON.stringify({ title, slug: slugifyPageTitle(title) }),
            })

            if (!res.ok) {
                if (res.status === 409) {
                    toast.error(t.editor.pageManagerPanel.slugConflict)
                    return false
                }
                const data = await res.json().catch(() => null)
                throw new Error(resolveApiError(data, `HTTP ${res.status}`, sub))
            }

            const data = await res.json()
            addPageToState(data.page)
            pageToast(withPageName(pm.pageCreated, data.page?.title ?? title))

            const pageId = data.page?.id
            if (pageId) {
                onPageSelected(pageId)
                onPageCreated?.(pageId)
            }
            onPagesChanged?.()
            return true
        } catch (err) {
            console.error('[PageManagerPanel] Create page failed:', err)
            toast.error(err instanceof Error ? err.message : t.editor.pageManagerPanel.createError)
            return false
        } finally {
            setIsSubmitting(false)
        }
    }

    const toggleVisibility = async (page: PageData) => {
        if (SYSTEM_PAGE_SLUGS.has(page.slug) || page.isHomepage) return

        // isVisible may be undefined on legacy rows — treat that as visible.
        const newVisible = page.isVisible === false
        updatePageInState(page.id, { isVisible: newVisible })

        try {
            const res = await fetch(`/api/sites/${siteId}/pages/${page.id}`, {
                method: 'PATCH',
                headers: JSON_HEADERS,
                credentials: 'include',
                body: JSON.stringify({ isVisible: newVisible }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => null)
                throw new Error(resolveApiError(data, pm.visibilityFailed, sub))
            }
            if (onPagesChanged) runSideEffect(onPagesChanged)
            const name = getDisplayPageTitle(page, activeLocale)
            pageToast(withPageName(newVisible ? pm.pageShown : pm.pageHidden, name))
        } catch (err) {
            updatePageInState(page.id, { isVisible: page.isVisible })
            toast.error(err instanceof Error ? err.message : pm.visibilityFailed)
        }
    }

    const restorePage = async (page: PageData) => {
        try {
            const res = await fetch(`/api/sites/${siteId}/pages/${page.id}`, {
                method: 'PATCH',
                headers: JSON_HEADERS,
                credentials: 'include',
                body: JSON.stringify({ deletedAt: null }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => null)
                throw new Error(resolveApiError(data, pm.restoreFailed, sub))
            }

            // Refetch from the server so the restored page returns to the store.
            const pagesRes = await fetch(`/api/sites/${siteId}/pages`, { credentials: 'include' })
            if (pagesRes.ok) {
                const pagesData = await pagesRes.json()
                setPages(pagesData.pages || [])
            }

            setPendingPageId(null)
            if (onPagesChanged) runSideEffect(onPagesChanged)
            pageToast(withPageName(pm.restored, getDisplayPageTitle(page, activeLocale)))
        } catch (err) {
            toast.error(err instanceof Error ? err.message : pm.restoreFailed)
        }
    }

    const showDeleteToast = (page: PageData) => {
        pageToast(withPageName(pm.deleteSuccess, getDisplayPageTitle(page, activeLocale)), {
            action: { label: pm.undo, onClick: () => void restorePage(page) },
            duration: 5000,
        })
    }

    const deletePage = async (page: PageData) => {
        if (SYSTEM_PAGE_SLUGS.has(page.slug) || page.isHomepage) return

        // A site must keep at least one regular page (#1226 AC).
        if (regularPages.length <= 1) {
            toast.error(pm.cannotDeleteLastPage)
            return
        }

        const now = new Date().toISOString()
        updatePageInState(page.id, { deletedAt: now })
        setPendingPageId(page.id)

        try {
            const res = await fetch(`/api/sites/${siteId}/pages/${page.id}`, {
                method: 'PATCH',
                headers: JSON_HEADERS,
                credentials: 'include',
                body: JSON.stringify({ deletedAt: now }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => null)
                throw new Error(resolveApiError(data, pm.deleteFailed, sub))
            }
        } catch (err) {
            // Only a failed PATCH rolls the optimistic delete back.
            updatePageInState(page.id, { deletedAt: null })
            setPendingPageId(null)
            toast.error(err instanceof Error ? err.message : pm.deleteFailed)
            return
        }

        // The server confirmed the delete: tell the user (with Undo) first, before any
        // navigation / refetch side-effect that could be slow or fail.
        setPendingPageId(null)
        showDeleteToast(page)

        // Switch to the homepage if the deleted page is the one being edited.
        if (String(page.id) === String(currentPageId)) {
            const homepage = pages.find(p => p.isHomepage && !p.deletedAt)
            if (homepage) runSideEffect(() => onPageSelected(String(homepage.id)))
        }
        if (onPagesChanged) runSideEffect(onPagesChanged)
    }

    return { createPage, toggleVisibility, deletePage, isSubmitting, pendingPageId }
}
