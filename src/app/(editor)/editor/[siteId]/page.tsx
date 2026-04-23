'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { normalizeAddSectionBlock } from '@/lib/ai/add-section'
import { AIChatPanel } from '@/components/editor/AIChatPanel'
import { BlockLibraryPanel } from '@/components/editor/BlockLibraryPanel'
import { EditorMenuDrawer } from '@/components/editor/EditorMenuDrawer'
import { EditorSidebar, type EditorSidebarTabId } from '@/components/editor/EditorSidebar'
import { EditorToolbar } from '@/components/editor/EditorToolbar'
import { PageManagerPanel } from '@/components/editor/PageManagerPanel'
import { PreviewFrame } from '@/components/editor/PreviewFrame'
import type { PreviewFrameHandle } from '@/components/editor/PreviewFrame'
import { SettingsPanel, type SettingsTab } from '@/components/editor/SettingsPanel'
import { useEditorStore } from '@/store/editorStore'
import type { AIAction } from '@/types/editor'
import { useI18n } from '@/i18n'
import { PrePublishModal } from '@/components/editor/PrePublishModal'
import { UnpublishModal } from '@/components/editor/UnpublishModal'
import { EditorTemplateModal, type TemplateApplyResult } from '@/components/editor/EditorTemplateModal'
import { cn } from '@/lib/utils'
import { useConnectivity } from '@/hooks/useConnectivity'
import { useTabAuthority } from '@/hooks/useTabAuthority'
import { OfflineBanner } from '@/components/editor/OfflineBanner'
import { TabSuspendedOverlay } from '@/components/editor/TabSuspendedOverlay'

type SiteData = {
    id: string
    name: string
    domain?: string | null
    status: string
    theme: Record<string, unknown>
    siteType: string
    branding?: {
        logo?: string
        favicon?: string
    }
    headerBlock?: Record<string, unknown> | null
    footerBlock?: Record<string, unknown> | null
    locale?: string
    contactInfo?: {
        phone?: string
        email?: string
        address?: string
    }
    socialLinks?: {
        facebook?: string
        instagram?: string
        twitter?: string
        linkedin?: string
        youtube?: string
        tiktok?: string
    }
    seo?: {
        metaTitle?: string
        metaDescription?: string
        ogImage?: string | number | null
    }
    publishedAt?: string | null
    tenantSlug?: string | null
    primaryDomain?: string | null
}

type LoadedPageData = {
    id: string
    title: string
    slug?: string
}

import type { PageData, BlockData } from '@/store/editorStore'

type SaveOptions = {
    showToast?: boolean
    refreshPreview?: boolean
}

export default function EditorPage() {
    const params = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()
    const siteId = params?.siteId as string
    const selectedPageId = searchParams.get('pageId')

    const { t, ti } = useI18n()
    const [selectedBlock, setSelectedBlock] = useState<number | null>(null)
    const [site, setSite] = useState<SiteData | null>(null)
    const [page, setPage] = useState<LoadedPageData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isPublishing, setIsPublishing] = useState(false)
    const [publishSuccess, setPublishSuccess] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [iframeKey, setIframeKey] = useState(0)
    const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop')
    const [activeSidebarTab, setActiveSidebarTab] = useState<EditorSidebarTabId>('chat')
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [userData, setUserData] = useState<{ name: string; initial: string; role: string } | null>(null)
    const [chatActivity, setChatActivity] = useState<{ id: string; content: string } | null>(null)
    const [chatBlockContext, setChatBlockContext] = useState<{ blockIndex: number; blockType: string } | null>(null)
    const [isCompactLayout, setIsCompactLayout] = useState(false)
    const [isPublishModalOpen, setIsPublishModalOpen] = useState(false)
    const [isUnpublishModalOpen, setIsUnpublishModalOpen] = useState(false)
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
    const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false)
    const [settingsRequestedTab, setSettingsRequestedTab] = useState<{ tab: SettingsTab; key: number } | null>(null)
    const [isTransitioning, setIsTransitioning] = useState(false)
    const [templateApplied, setTemplateApplied] = useState(false)
    const [showSaveGuard, setShowSaveGuard] = useState(false)
    const reorderSaveTimerRef = useRef<number | null>(null)
    // Imperative handle to send postMessages to iframe without full reload (Gap B)
    const previewFrameSendRef = useRef<PreviewFrameHandle | null>(null)

    const { isOnline, isSyncing } = useConnectivity()
    const { isMaster, reclaimAuthority } = useTabAuthority(siteId)

    const blocks = useEditorStore(state => state.blocks)
    const theme = useEditorStore(state => state.theme)
    const siteName = useEditorStore(state => state.siteName)
    const pages = useEditorStore(state => state.pages)
    const currentPageId = useEditorStore(state => state.currentPageId)
    const hasUnsavedChanges = useEditorStore(state => state.hasUnsavedChanges)
    const hasUnpublishedChanges = useEditorStore(state => state.hasUnpublishedChanges)
    const lastSavedAt = useEditorStore(state => state.lastSavedAt)
    const isSaving = useEditorStore(state => state.isSaving)
    const init = useEditorStore(state => state.init)
    const setPages = useEditorStore(state => state.setPages)
    const setCurrentPageId = useEditorStore(state => state.setCurrentPageId)
    const updatePageInState = useEditorStore(state => state.updatePageInState)
    const updateBlock = useEditorStore(state => state.updateBlock)
    const addBlock = useEditorStore(state => state.addBlock)
    const deleteBlock = useEditorStore(state => state.deleteBlock)
    const duplicateBlock = useEditorStore(state => state.duplicateBlock)
    const reorderBlocks = useEditorStore(state => state.reorderBlocks)
    const updateTheme = useEditorStore(state => state.updateTheme)
    const updateSiteName = useEditorStore(state => state.updateSiteName)
    const headerBlock = useEditorStore(state => state.headerBlock)
    const footerBlock = useEditorStore(state => state.footerBlock)
    const updateHeaderBlock = useEditorStore(state => state.updateHeaderBlock)
    const updateFooterBlock = useEditorStore(state => state.updateFooterBlock)
    const undo = useEditorStore(state => state.undo)
    const redo = useEditorStore(state => state.redo)
    const canUndo = useEditorStore(state => state.canUndo)
    const canRedo = useEditorStore(state => state.canRedo)
    const markSaved = useEditorStore(state => state.markSaved)
    const markPublished = useEditorStore(state => state.markPublished)
    const setIsSaving = useEditorStore(state => state.setIsSaving)
    const setAutoSaveEnabled = useEditorStore(state => state.setAutoSaveEnabled)

    const currentBlock = useMemo(
        () => (selectedBlock !== null ? blocks[selectedBlock] || null : null),
        [blocks, selectedBlock],
    )
    const isPublished = site?.status === 'published'
    const wasPublished = !isPublished && !!site?.publishedAt
    const siteUrl = useMemo(() => {
        if (site?.primaryDomain) {
            return `https://${site.primaryDomain}`
        }
        const slug = site?.tenantSlug
        if (!slug) return null
        const domain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'primeweb.app'
        return `https://${slug}.${domain}`
    }, [site?.primaryDomain, site?.tenantSlug])

    const lastSavedLabel = useMemo(() => {
        if (!lastSavedAt) return null
        return new Date(lastSavedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        })
    }, [lastSavedAt])

    const currentPageTitle = useMemo(() => {
        if (page?.title) return page.title
        const currentPage = pages.find(item => item.id === currentPageId)
        return currentPage?.title || 'Homepage'
    }, [currentPageId, page?.title, pages])

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 767px)')
        const applyLayoutMode = (matches: boolean) => setIsCompactLayout(matches)

        applyLayoutMode(mediaQuery.matches)

        const handleChange = (event: MediaQueryListEvent) => applyLayoutMode(event.matches)
        mediaQuery.addEventListener('change', handleChange)

        return () => mediaQuery.removeEventListener('change', handleChange)
    }, [])

    // Phase 1: Reset store when siteId changes to prevent stale data flash
    const storeSiteId = useEditorStore(state => state.siteId)
    const resetStore = useEditorStore(state => state.reset)

    useEffect(() => {
        if (storeSiteId && storeSiteId !== siteId) {
            resetStore()
        }
    }, [siteId, storeSiteId, resetStore])

    useEffect(() => {
        if (!siteId) return

        async function loadData() {
            setIsLoading(true)

            try {
                const editorUrl = new URL(`/api/sites/${siteId}/editor-data`, window.location.origin)
                if (selectedPageId) {
                    editorUrl.searchParams.set('pageId', selectedPageId)
                }


                const [editorRes, pagesRes] = await Promise.all([
                    fetch(editorUrl.toString(), { credentials: 'include' }),
                    fetch(`/api/sites/${siteId}/pages`, { credentials: 'include' }),
                ])

                if (!editorRes.ok) {
                    throw new Error(`Failed to load editor data (${editorRes.status})`)
                }

                const data = await editorRes.json()

                if (data.site) {
                    setSite(data.site)
                }

                // Extract user info for menu drawer
                if (data.user) {
                    const name = data.user.firstName || data.user.email?.split('@')[0] || 'User'
                    setUserData({ name, initial: name.charAt(0).toUpperCase(), role: data.user.role || 'viewer' })
                }

                if (data.page) {
                    const loadedPage = { id: data.page.id, title: data.page.title }
                    setPage(loadedPage)
                    setCurrentPageId(data.page.id)
                } else {
                    setPage(null)
                    setCurrentPageId('')
                }

                init(siteId, data.page?.layout || [], data.site?.theme || {}, data.site?.name || '', data.site?.headerBlock || null, data.site?.footerBlock || null)

                if (pagesRes.ok) {
                    const pagesData = await pagesRes.json()
                    const loadedPages = pagesData.pages || []
                    setPages(loadedPages)

                    // Derive hasUnpublishedChanges from data: if site is published
                    // but any page is still draft, user needs to re-publish.
                    // Set directly — don't use handleContentChange which also sets hasUnsavedChanges.
                    const siteIsPublished = data.site?.status === 'published'
                    const hasDraftPages = loadedPages.some((p: { status: string }) => p.status === 'draft')
                    if (siteIsPublished && hasDraftPages) {
                        useEditorStore.setState({ hasUnpublishedChanges: true })
                    }
                }

                setSelectedBlock(null)
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to load site data'
                toast.error('Failed to load site', { description: message })
            } finally {
                setIsLoading(false)
            }
        }

        void loadData()
    }, [init, selectedPageId, setCurrentPageId, setPages, siteId])

    // User data is loaded from editor-data API in loadData useEffect above

    const handleSave = useCallback(async (options: SaveOptions = {}) => {
        if (!siteId) return false

        // Cancel any pending reorder-triggered save to prevent double-fire
        if (reorderSaveTimerRef.current !== null) {
            window.clearTimeout(reorderSaveTimerRef.current)
            reorderSaveTimerRef.current = null
        }

        // Cancel the store's pending auto-save timer — explicit saves subsume it
        const storeTimer = useEditorStore.getState().autoSaveTimer
        if (storeTimer) {
            clearTimeout(storeTimer)
            useEditorStore.setState({ autoSaveTimer: null })
        }

        const snapshot = useEditorStore.getState()
        const currentBlocks = snapshot.blocks
        const currentTheme = snapshot.theme
        // Use pageId from store snapshot (not from closure) to prevent race condition
        // when page switch happens during auto-save
        const savePageId = snapshot.currentPageId

        if (currentBlocks.length === 0 && !page) return false

        setIsSaving(true)

        try {
            const saveUrl = new URL(`/api/sites/${siteId}/save`, window.location.origin)
            if (savePageId) {
                saveUrl.searchParams.set('pageId', savePageId)
            }

            const res = await fetch(saveUrl.toString(), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    blocks: currentBlocks,
                    theme: currentTheme,
                    headerBlock: snapshot.headerBlock,
                    footerBlock: snapshot.footerBlock,
                    isDraft: true,
                }),
            })

            if (!res.ok) {
                const payload = await res.json().catch(() => null)
                const message = typeof payload?.error === 'string'
                    ? payload.error
                    : payload?.error?.details?.formErrors?.[0]
                        || payload?.error?.details?.fieldErrors?.headerBlock?.[0]
                        || payload?.error?.details?.fieldErrors?.blocks?.[0]
                        || `Server returned ${res.status}`
                throw new Error(message)
            }

            markSaved()
            setSaveSuccess(true)

            if (options.refreshPreview ?? true) {
                setIframeKey(key => key + 1)
            }

            if (options.showToast ?? true) {
                toast.success(t.editor.toast.saveSuccess)
            }

            window.setTimeout(() => setSaveSuccess(false), 2000)
            return true
        } catch (err) {
            // BUG-F05-01: log sanitized error code (no internal details in production console)
            console.error('[Editor] Save failed:', { code: 'SAVE_FAILED', env: process.env.NODE_ENV })
            toast.error(t.editor.toast.saveFailed)
            return false
        } finally {
            setIsSaving(false)
        }
    }, [markSaved, page, setIsSaving, siteId])

    // Suspend store auto-save while a template is applied (user must confirm first)
    useEffect(() => {
        setAutoSaveEnabled(!templateApplied)
    }, [templateApplied, setAutoSaveEnabled])

    // Warn user before leaving page with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault()
                e.returnValue = ''
            }
        }
        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [hasUnsavedChanges])

    // Clear pending reorder-save timer on unmount
    useEffect(() => {
        return () => {
            if (reorderSaveTimerRef.current !== null) {
                window.clearTimeout(reorderSaveTimerRef.current)
            }
        }
    }, [])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement
            if (target && target.closest('input, textarea, [contenteditable="true"]')) {
                return
            }

            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault()

                if (e.shiftKey) {
                    if (canRedo()) {
                        redo()
                        setIframeKey(key => key + 1)
                    }
                    return
                }

                if (canUndo()) {
                    undo()
                    setIframeKey(key => key + 1)
                }
            }

            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
                e.preventDefault()
                if (templateApplied) {
                    setShowSaveGuard(true)
                } else {
                    void handleSave()
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [canRedo, canUndo, handleSave, redo, undo])

    const handleThemeChange = useCallback((key: string, value: string) => {
        updateTheme({ [key]: value })
        // Save to DB but don't reload iframe — live CSS update handles preview
        void handleSave({ showToast: false, refreshPreview: false })
    }, [updateTheme, handleSave])

    const handleSiteSettingsChange = useCallback(async (changes: Partial<SiteData>) => {
        if (!siteId) return

        if (changes.name) {
            updateSiteName(changes.name)
        }

        setSite(prev => {
            if (!prev) return prev

            return {
                ...prev,
                ...changes,
                contactInfo: {
                    ...(prev.contactInfo || {}),
                    ...(changes.contactInfo || {}),
                },
                socialLinks: {
                    ...(prev.socialLinks || {}),
                    ...(changes.socialLinks || {}),
                },
                seo: {
                    ...(prev.seo || {}),
                    ...(changes.seo || {}),
                },
                branding: {
                    ...(prev.branding || {}),
                    ...(changes.branding || {}),
                },
            }
        })

        try {
            const saveUrl = new URL(`/api/sites/${siteId}/save`, window.location.origin)
            if (currentPageId) {
                saveUrl.searchParams.set('pageId', currentPageId)
            }

            const response = await fetch(saveUrl.toString(), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    siteName: changes.name,
                    contactInfo: changes.contactInfo,
                    socialLinks: changes.socialLinks,
                    branding: changes.branding,
                    seo: changes.seo,
                    headerBlock: changes.headerBlock,
                    footerBlock: changes.footerBlock,
                }),
            })

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`)
            }

            setSaveSuccess(true)
            // Reload iframe when visually-impacting fields change
            const needsReload = !!(changes.name || changes.branding || changes.headerBlock || changes.footerBlock)
            if (needsReload) setIframeKey(key => key + 1)
            window.setTimeout(() => setSaveSuccess(false), 1800)
        } catch (error) {
            console.error('Failed to update site settings', error)
            toast.error('Failed to update site settings', { description: 'Please try again later.' })
        }
    }, [currentPageId, siteId, updateSiteName])

    const handleDeleteBlock = useCallback((index: number) => {
        deleteBlock(index)
        setSelectedBlock(prev => {
            if (prev === null) return null
            if (index < prev) return prev - 1
            if (index === prev) return null
            return prev
        })
        void handleSave({ showToast: false, refreshPreview: true })
    }, [deleteBlock, handleSave])

    const handleDuplicateBlock = useCallback((index: number) => {
        duplicateBlock(index)
        setSelectedBlock(index + 1)
        void handleSave({ showToast: false, refreshPreview: true })
    }, [duplicateBlock, handleSave])

    // BUG-F05-01: retry save once on failure to handle transient Payload errors
    const saveWithRetry = useCallback(async (options: SaveOptions) => {
        const ok = await handleSave({ ...options, showToast: false })
        if (!ok) {
            console.warn('[Editor] First save failed, retrying in 1s...')
            await new Promise(r => setTimeout(r, 1000))
            await handleSave({ ...options, showToast: true })
        }
    }, [handleSave])

    const handleBlockFieldChange = useCallback((index: number, field: string, value: string) => {
        updateBlock(index, { [field]: value })
        // Partial live update — no iframe reload needed
        const updatedBlock = useEditorStore.getState().blocks[index]
        previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_BLOCK_DATA', blockIndex: index, blockData: updatedBlock })
        void saveWithRetry({ showToast: false, refreshPreview: false })
    }, [updateBlock, saveWithRetry])

    const handleBlockUpdate = useCallback((index: number, changes: Record<string, unknown>) => {
        updateBlock(index, changes)
        const updatedBlock = useEditorStore.getState().blocks[index]
        previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_BLOCK_DATA', blockIndex: index, blockData: updatedBlock })
        void saveWithRetry({ showToast: false, refreshPreview: false })
    }, [updateBlock, saveWithRetry])

    const handleReorderBlocks = useCallback((fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return
        reorderBlocks(fromIndex, toIndex)
        setSelectedBlock(toIndex)
        setChatActivity({
            id: `reorder-${Date.now()}`,
            content: `Moved block #${fromIndex + 1} to position #${toIndex + 1}`,
        })

        // Coalesce consecutive reorders — save once after 500ms idle
        if (reorderSaveTimerRef.current !== null) {
            window.clearTimeout(reorderSaveTimerRef.current)
        }
        reorderSaveTimerRef.current = window.setTimeout(() => {
            reorderSaveTimerRef.current = null
            void handleSave({ showToast: false, refreshPreview: true })
        }, 500)
    }, [reorderBlocks, handleSave])

    const handleBlockDrop = useCallback((index: number, blockData: { blockType: string, variant: string }) => {
        const nextBlock = normalizeAddSectionBlock(
            {
                instruction: `Add ${blockData.blockType} block`,
                siteName: siteName || site?.name || '',
                theme,
                requestedType: blockData.blockType,
            },
            blockData as Record<string, unknown>
        )
        
        const safeBlock: BlockData = nextBlock || { blockType: blockData.blockType || 'hero', variant: blockData.variant || 'default' }

        addBlock(index - 1, safeBlock)
        setSelectedBlock(index)
        setIframeKey(key => key + 1)
        setChatActivity({
            id: `drop-${Date.now()}`,
            content: `Added ${blockData.blockType} block`,
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [addBlock, theme])

    const handleAIAction = useCallback(async (action: AIAction) => {
        // Cancel any pending debounced auto-save to prevent race conditions
        const { autoSaveTimer } = useEditorStore.getState()
        if (autoSaveTimer) clearTimeout(autoSaveTimer)

        switch (action.action) {
            case 'update_block': {
                const blockIndex = action.blockIndex ?? selectedBlock ?? 0
                updateBlock(blockIndex, action.changes || {})
                setSelectedBlock(blockIndex)
                break
            }

            case 'update_theme':
                updateTheme(action.changes || {})
                break

            case 'add_block': {
                const afterIndex = action.afterIndex ?? (blocks.length - 1)
                const nextBlock = normalizeAddSectionBlock(
                    {
                        instruction: action.message || 'Add a new section',
                        requestedType: String(action.block?.blockType || ''),
                        siteName: siteName || site?.name || '',
                        theme,
                    },
                    action.block,
                )

                if (nextBlock) {
                    addBlock(afterIndex, nextBlock)
                    setSelectedBlock(Math.max(0, afterIndex + 1))
                } else {
                    toast.error('Unable to add this section yet')
                }
                break
            }

            case 'delete_block': {
                const blockIndex = action.blockIndex ?? selectedBlock ?? 0
                deleteBlock(blockIndex)
                setSelectedBlock(prev => {
                    if (prev === null) return null
                    if (prev === blockIndex) return null
                    if (prev > blockIndex) return prev - 1
                    return prev
                })
                break
            }

            case 'update_multiple_blocks': {
                if (!action.updates?.length) break

                const { blocks: currentBlocks, theme: currentTheme, pushBatch } = useEditorStore.getState()
                const newBlocks = [...currentBlocks]
                for (const update of action.updates) {
                    const idx = update.blockIndex
                    if (idx >= 0 && idx < newBlocks.length) {
                        newBlocks[idx] = { ...newBlocks[idx], ...update.changes }
                    }
                }
                pushBatch(newBlocks, currentTheme, action.message || 'Updated multiple sections')
                break
            }

            case 'undo': {
                if (canUndo()) {
                    undo()
                    setIframeKey(key => key + 1)
                } else {
                    toast.error('Nothing to undo')
                    return // Nothing changed, skip save
                }
                break
            }
        }

        // Single save + preview refresh after any mutation (including undo).
        // Undo must also save to persist the reverted state to DB,
        // otherwise a page reload would lose the undo.
        // setTimeout lets Zustand state settle before reading snapshot.
        setTimeout(() => {
            void handleSave({ showToast: false, refreshPreview: true })
        }, 300)
    }, [addBlock, blocks.length, deleteBlock, handleSave, selectedBlock, site?.name, siteName, theme, updateBlock, updateTheme, canUndo, undo])

    const handleUndo = useCallback(() => {
        if (!canUndo()) return
        undo()
        setIframeKey(key => key + 1)
        // If user undoes the template apply, clear the save guard
        setTemplateApplied(false)
    }, [canUndo, undo])

    const handleRedo = useCallback(() => {
        if (!canRedo()) return
        redo()
        setIframeKey(key => key + 1)
    }, [canRedo, redo])

    const handlePublish = useCallback(async () => {
        if (!siteId || isPublishing) return

        setIsPublishing(true)
        const currentlyPublished = site?.status === 'published'

        try {
            if (hasUnsavedChanges) {
                const saved = await handleSave({ showToast: false, refreshPreview: true })
                if (!saved) {
                    setIsPublishing(false)
                    return
                }
            }

            const res = await fetch(`/api/sites/${siteId}/publish`, {
                method: currentlyPublished ? 'DELETE' : 'PATCH',
                credentials: 'include',
            })

            if (!res.ok) {
                throw new Error(`Server returned ${res.status}`)
            }

            setPublishSuccess(true)
            setSite(prev => prev ? {
                ...prev,
                status: currentlyPublished ? 'draft' : 'published',
            } : prev)

            setIsPublishModalOpen(false)
            setIsUnpublishModalOpen(false)

            // Clear unpublished changes flag after successful publish
            if (!currentlyPublished) {
                markPublished()

                // Refetch pages so draft→live status is reflected in the sidebar.
                try {
                    const pagesRes = await fetch(`/api/sites/${siteId}/pages`, { credentials: 'include' })
                    if (pagesRes.ok) {
                        const pagesData = await pagesRes.json()
                        if (Array.isArray(pagesData?.pages)) setPages(pagesData.pages)
                    }
                } catch {
                    // Non-fatal.
                }
            }

            if (!currentlyPublished) {
                const data = await res.json()
                const siteUrl = data?.data?.url || data?.data?.domain
                if (siteUrl) {
                    toast.success(`🎉 ${t.editor.toast.publishSuccess}`, {
                        description: ti(t.editor.toast.publishSuccessDomain, { domain: siteUrl.replace(/^https?:\/\//, '') }),
                        action: {
                            label: t.editor.toast.viewAction,
                            onClick: () => window.open(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`, '_blank')
                        }
                    })
                } else {
                    toast.success(`🎉 ${t.editor.toast.publishSuccess}`)
                }
            } else {
                toast.success(t.editor.toast.unpublishSuccess)
            }

            window.setTimeout(() => setPublishSuccess(false), 3000)
        } catch (err) {
            if (process.env.NODE_ENV === 'development') console.error('[Editor] Publish failed:', err)
            toast.error(t.editor.toast.publishFailed, {
                duration: 10000,
                action: {
                    label: 'Retry',
                    onClick: () => void handlePublish(),
                },
            })
        } finally {
            setIsPublishing(false)
        }
    }, [handleSave, hasUnsavedChanges, isPublishing, markPublished, setPages, site?.status, siteId, siteName])

    // Re-publish: always PATCH (never DELETE). Used by "Update" button on published sites.
    const handleRepublish = useCallback(async () => {
        if (!siteId || isPublishing) return

        setIsPublishing(true)
        try {
            if (hasUnsavedChanges) {
                const saved = await handleSave({ showToast: false, refreshPreview: true })
                if (!saved) {
                    setIsPublishing(false)
                    return
                }
            }

            const res = await fetch(`/api/sites/${siteId}/publish`, {
                method: 'PATCH',
                credentials: 'include',
            })

            if (!res.ok) {
                // Try to surface the actual server-side cause (PG column missing,
                // Payload ValidationError on a required field, etc.) instead of
                // a generic "Server returned 500".
                const body = await res.json().catch(() => null) as {
                    error?: {
                        message?: string
                        failures?: Array<{
                            errName?: string
                            errMsg?: string
                            pgColumn?: string
                            pgTable?: string
                            causeMsg?: string
                            validationErrors?: Array<{ path?: string; message?: string }>
                        }>
                    }
                } | null
                const firstFailure = body?.error?.failures?.[0]
                const firstValidation = firstFailure?.validationErrors?.[0]
                let detail: string | undefined
                if (firstValidation?.path) {
                    // Payload validation error — richest signal for the user.
                    detail = `${firstValidation.path}: ${firstValidation.message || 'invalid'}`
                } else if (firstFailure?.pgColumn && firstFailure?.pgTable) {
                    detail = `${firstFailure.pgTable}.${firstFailure.pgColumn} missing — run \`npm run db:migrate\``
                } else {
                    detail = firstFailure?.causeMsg || firstFailure?.errMsg || body?.error?.message
                }
                throw new Error(detail || `Server returned ${res.status}`)
            }

            markPublished()
            setPublishSuccess(true)

            // Refetch pages so freshly-promoted pages show "Live" instead of stale
            // "Draft". markPublished() only clears hasUnpublishedChanges; individual
            // page.status still holds the pre-publish value until we resync.
            try {
                const pagesRes = await fetch(`/api/sites/${siteId}/pages`, { credentials: 'include' })
                if (pagesRes.ok) {
                    const pagesData = await pagesRes.json()
                    if (Array.isArray(pagesData?.pages)) setPages(pagesData.pages)
                }
            } catch {
                // Non-fatal — next page reload will resync.
            }

            const data = await res.json()
            const url = data?.data?.url || data?.data?.domain
            if (url) {
                toast.success(`🎉 ${t.editor.toast.publishSuccess}`, {
                    description: ti(t.editor.toast.publishSuccessDomain, { domain: url.replace(/^https?:\/\//, '') }),
                    action: {
                        label: 'View',
                        onClick: () => window.open(url.startsWith('http') ? url : `https://${url}`, '_blank')
                    }
                })
            } else {
                toast.success(`🎉 ${t.editor.toast.publishSuccess}`)
            }

            window.setTimeout(() => setPublishSuccess(false), 3000)
        } catch (err) {
            if (process.env.NODE_ENV === 'development') console.error('[Editor] Re-publish failed:', err)
            const detail = err instanceof Error ? err.message : undefined
            toast.error(t.editor.toast.publishFailed, {
                description: detail,
                duration: 10000,
                action: {
                    label: 'Retry',
                    onClick: () => void handleRepublish(),
                },
            })
        } finally {
            setIsPublishing(false)
        }
    }, [handleSave, hasUnsavedChanges, isPublishing, markPublished, setPages, siteId])

    const handlePageSelected = useCallback(async (pageId: string) => {
        const store = useEditorStore.getState()

        // Cancel any pending auto-save timer to prevent cross-page data save
        if (store.autoSaveTimer) {
            clearTimeout(store.autoSaveTimer)
            useEditorStore.setState({ autoSaveTimer: null })
        }

        // Save current page before switching to prevent data loss
        if (store.hasUnsavedChanges) {
            await handleSave({ showToast: false, refreshPreview: false })
        }

        const nextParams = new URLSearchParams(searchParams.toString())
        nextParams.set('pageId', pageId)
        router.replace(`/editor/${siteId}?${nextParams.toString()}`)
        // Force iframe refresh to show new page content
        setIframeKey(k => k + 1)
        setSelectedBlock(null)
    }, [handleSave, router, searchParams, siteId])

    const handlePageUpdate = useCallback(async (pageId: string, changes: Partial<PageData>) => {
        try {
            const res = await fetch(`/api/sites/${siteId}/pages/${pageId}`, {
                method: 'PATCH',
                headers: { 'Content-type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(changes),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => null)
                throw new Error(data?.error || 'Failed to update page settings')
            }

            const data = await res.json()
            if (data?.page) {
                updatePageInState(pageId, {
                    title: data.page.title,
                    slug: data.page.slug,
                    status: data.page.status,
                    isVisible: data.page.isVisible,
                    seoTitle: data.page.seoTitle,
                    seoDescription: data.page.seoDescription,
                    updatedAt: data.page.updatedAt,
                    error: null,
                })
                if (changes.slug || changes.seoTitle || changes.seoDescription) {
                    setIframeKey(key => key + 1)
                }
                return data.page as PageData
            }
            return null
        } catch {
            toast.error('Failed to update page settings')
            return null
        }
    }, [siteId, updatePageInState])

    // BUG-F05-032/046: context-sensitive tab switching when blocks are clicked
    const handleBlockSelectWithContext = useCallback((blockIndex: number | null, blockType?: string) => {
        if (blockType === 'navigation' || blockType === 'footer') {
            setSelectedBlock(null)
            // Use unique key to force re-trigger even on repeated clicks
            setSettingsRequestedTab({ tab: 'menu', key: Date.now() })
        } else {
            setSelectedBlock(blockIndex)
            setSettingsRequestedTab(null)
        }
    }, [])

    const handleMobileBlockSelect = useCallback((blockIndex: number | null) => {
        setSelectedBlock(blockIndex)
        if (isCompactLayout && blockIndex !== null) {
            setIsMobileSettingsOpen(true)
        }
    }, [isCompactLayout])

    const sidebarTabs = [
        { id: 'chat' as const, label: 'AI Chat', icon: <span aria-hidden="true">💬</span> },
        { id: 'components' as const, label: 'Components', icon: <span aria-hidden="true">⚡</span> },
        { id: 'pages' as const, label: 'Pages', icon: <span aria-hidden="true">📄</span> },
    ]

    const sidebarContent = (
        <>
            {activeSidebarTab === 'chat' ? (
                <AIChatPanel
                    siteId={siteId}
                    blocks={blocks}
                    selectedBlock={selectedBlock}
                    onAIAction={handleAIAction}
                    onUndoLastAction={handleUndo}
                    siteName={siteName || site?.name || ''}
                    theme={theme}
                    currentPageSlug={page?.slug || 'home'}
                    currentPageTitle={currentPageTitle}
                    externalActivity={chatActivity}
                    blockContext={chatBlockContext}
                    onBlockContextDismiss={() => setChatBlockContext(null)}
                    compact={isCompactLayout}
                />
            ) : null}

            {activeSidebarTab === 'components' ? (
                <BlockLibraryPanel
                    blocks={blocks}
                    selectedBlock={selectedBlock}
                    onBlockSelect={handleMobileBlockSelect}
                    onAIAction={handleAIAction}
                />
            ) : null}

            {activeSidebarTab === 'pages' ? (
                <PageManagerPanel
                    siteId={siteId}
                    currentPageId={currentPageId}
                    siteStatus={site?.status}
                    onPageSelected={handlePageSelected}
                    onPagesChanged={() => setIframeKey(key => key + 1)}
                    onEditPage={() => setActiveSidebarTab('chat')}
                />
            ) : null}
        </>
    )

    return (
        <div className="flex h-[100dvh] flex-col bg-[#0B1120]">
            <EditorMenuDrawer
                siteId={siteId}
                open={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                currentUserRole={userData?.role}
                userName={userData?.name}
                userInitial={userData?.initial}
                hasUnsavedChanges={hasUnsavedChanges}
            />

            <EditorToolbar
                siteId={siteId}
                currentPageId={currentPageId}
                siteName={siteName || site?.name || ''}
                currentPageTitle={currentPageTitle}
                pages={pages}
                isPublished={Boolean(isPublished)}
                isSaving={isSaving}
                saveSuccess={saveSuccess}
                hasUnsavedChanges={hasUnsavedChanges}
                hasUnpublishedChanges={hasUnpublishedChanges}
                isPublishing={isPublishing}
                publishSuccess={publishSuccess}
                canUndo={canUndo()}
                canRedo={canRedo()}
                viewport={viewport}
                compact={isCompactLayout}
                onOpenMenu={() => setIsMenuOpen(true)}
                onOpenTemplates={() => setIsTemplateModalOpen(true)}
                onPageSelected={handlePageSelected}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onSave={() => {
                    if (templateApplied) {
                        setShowSaveGuard(true)
                    } else {
                        void handleSave()
                    }
                }}
                onPublish={() => setIsPublishModalOpen(true)}
                onRepublish={handleRepublish}
                onUnpublish={() => setIsUnpublishModalOpen(true)}
                onViewLive={() => siteUrl && window.open(siteUrl, '_blank')}
                onCopyLink={() => {
                    if (siteUrl) {
                        navigator.clipboard.writeText(siteUrl)
                        toast.success(t.editor.toast.linkCopied, { description: siteUrl })
                    }
                }}
                siteUrl={siteUrl}
                wasPublished={wasPublished}
                onViewportChange={setViewport}
            />

            <OfflineBanner isOnline={isOnline} isSyncing={isSyncing} />

            {isCompactLayout ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <EditorSidebar
                        tabs={sidebarTabs}
                        activeTab={activeSidebarTab}
                        onTabChange={setActiveSidebarTab}
                        compact
                    >
                        {sidebarContent}
                    </EditorSidebar>

                    {/* F05 FR-29: FAB chat button on mobile */}
                    {activeSidebarTab !== 'chat' && (
                        <button
                            type="button"
                            onClick={() => setActiveSidebarTab('chat')}
                            className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] text-white shadow-lg shadow-blue-500/25 transition-transform active:scale-95"
                            aria-label="Open AI Chat"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        </button>
                    )}

                    {/* F05 FR-31: Bottom sheet for block settings on mobile */}
                    {isMobileSettingsOpen && currentBlock && (
                        <div className="fixed inset-0 z-50 flex flex-col justify-end">
                            <div
                                className="absolute inset-0 bg-black/60"
                                onClick={() => setIsMobileSettingsOpen(false)}
                                onKeyDown={(e) => e.key === 'Escape' && setIsMobileSettingsOpen(false)}
                                role="button"
                                tabIndex={0}
                                aria-label="Close settings"
                            />
                            <div className="relative max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#0F172A]">
                                <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-[#0F172A] px-4 py-3">
                                    <span className="text-sm font-medium text-white">Block Settings</span>
                                    <button
                                        type="button"
                                        onClick={() => setIsMobileSettingsOpen(false)}
                                        className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    </button>
                                </div>
                                <SettingsPanel
                                    block={currentBlock}
                                    blockIndex={selectedBlock}
                                    theme={theme}
                                    site={site}
                                    siteName={siteName || site?.name || ''}
                                    siteStatus={site?.status || 'draft'}
                                    headerBlock={headerBlock}
                                    footerBlock={footerBlock}
                                    pages={pages}
                                    currentPageId={currentPageId}
                                    onThemeChange={handleThemeChange}
                                    onBlockFieldChange={handleBlockFieldChange}
                                    onBlockUpdate={handleBlockUpdate}
                                    onHeaderUpdate={(changes) => updateHeaderBlock(changes)}
                                    onFooterUpdate={(changes) => updateFooterBlock(changes)}
                                    onSiteSettingsChange={handleSiteSettingsChange}
                                    onPageUpdate={handlePageUpdate}
                                    requestedTab={settingsRequestedTab}
                                />
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-1 overflow-hidden">
                    <EditorSidebar
                        tabs={sidebarTabs}
                        activeTab={activeSidebarTab}
                        onTabChange={setActiveSidebarTab}
                    >
                        {sidebarContent}
                    </EditorSidebar>

                    <div className={cn("flex flex-1 flex-col transition-opacity duration-300", isTransitioning && "opacity-0")}>
                        <PreviewFrame
                            siteId={siteId}
                            pageId={currentPageId}
                            iframeKey={iframeKey}
                            isLoading={isLoading}
                            viewport={viewport}
                            selectedBlock={selectedBlock}
                            onBlockSelect={handleBlockSelectWithContext}
                            onBlockAIEdit={(blockIndex, blockType) => {
                                setActiveSidebarTab('chat')
                                setChatBlockContext({ blockIndex, blockType })
                            }}
                            onDeleteBlock={handleDeleteBlock}
                            onDuplicateBlock={handleDuplicateBlock}
                            onInlineEditApplied={async (content, blockIndex, detail) => {
                                setSelectedBlock(blockIndex)
                                setActiveSidebarTab('chat')
                                // BUG-F05-13: Show instruction + result separately in chat
                                if (detail) {
                                    setChatActivity({
                                        id: `inline-req-${Date.now()}`,
                                        content: `✏️ **${detail.blockType}**: ${detail.instruction}`,
                                    })
                                    setTimeout(() => {
                                        setChatActivity({
                                            id: `inline-res-${Date.now()}`,
                                            content: `✅ "${detail.originalText}" → "${detail.rewrittenText}"`,
                                        })
                                    }, 100)
                                } else {
                                    setChatActivity({
                                        id: `inline-${Date.now()}`,
                                        content,
                                    })
                                }
                                // BUG-F05-13: await save BEFORE iframe reload
                                await handleSave({ showToast: false, refreshPreview: false })
                                setIframeKey(key => key + 1)
                            }}
                            onReorderBlocks={handleReorderBlocks}
                            onBlockDrop={handleBlockDrop}
                            onImageReplaced={async () => {
                                await handleSave({ showToast: false, refreshPreview: false })
                                setIframeKey(key => key + 1)
                            }}
                            onPageNavigate={handlePageSelected}
                            onInlineEditSave={async () => {
                                // Inline edit already updated text in iframe — no reload needed.
                                // Reloading here causes visible jank while user is still editing.
                                await handleSave({ showToast: false, refreshPreview: false })
                            }}
                            onHandleReady={(handle) => { previewFrameSendRef.current = handle }}
                        />
                    </div>

                    <SettingsPanel
                        block={currentBlock}
                        blockIndex={selectedBlock}
                        theme={theme}
                        site={site}
                        siteName={siteName || site?.name || ''}
                        siteStatus={site?.status || 'draft'}
                        headerBlock={headerBlock}
                        footerBlock={footerBlock}
                        pages={pages}
                        currentPageId={currentPageId}
                        onThemeChange={handleThemeChange}
                        onBlockFieldChange={handleBlockFieldChange}
                        onBlockUpdate={handleBlockUpdate}
                        onHeaderUpdate={(changes) => updateHeaderBlock(changes)}
                        onFooterUpdate={(changes) => updateFooterBlock(changes)}
                        onSiteSettingsChange={handleSiteSettingsChange}
                        onPageUpdate={handlePageUpdate}
                        requestedTab={settingsRequestedTab}
                    />
                </div>
            )}

            <PrePublishModal
                isOpen={isPublishModalOpen}
                onOpenChange={setIsPublishModalOpen}
                onPublish={handlePublish}
                isPublishing={isPublishing}
                hasUnsavedChanges={hasUnsavedChanges}
                pages={pages}
            />
            
            <UnpublishModal
                isOpen={isUnpublishModalOpen}
                onOpenChange={setIsUnpublishModalOpen}
                onUnpublish={handlePublish}
                isPublishing={isPublishing}
            />

            <EditorTemplateModal
                isOpen={isTemplateModalOpen}
                onClose={() => setIsTemplateModalOpen(false)}
                siteId={siteId}
                onBeforeApply={async () => {
                    // ALWAYS force-save before template apply — draft/published version
                    // mismatch means hasUnsavedChanges can be stale
                    await handleSave({ showToast: false, refreshPreview: false })
                }}
                onApplied={async ({ templateName, unmatchedBlocks }: TemplateApplyResult) => {
                    setIsTemplateModalOpen(false)
                    setIsTransitioning(true)

                    try {
                        // Re-fetch fresh data from DB (template already applied by API)
                        const editorUrl = new URL(`/api/sites/${siteId}/editor-data`, window.location.origin)
                        if (currentPageId) editorUrl.searchParams.set('pageId', currentPageId)
                        const res = await fetch(editorUrl.toString(), { credentials: 'include' })
                        if (!res.ok) throw new Error('Failed to reload editor data')
                        const data = await res.json()

                        // Push as single undoable batch (existing history preserved for Ctrl+Z)
                        const store = useEditorStore.getState()
                        store.pushBatch(
                            data.page?.layout || [],
                            data.site?.theme || {},
                            `Apply template: ${templateName}`
                        )

                        // Disable auto-save BEFORE mutating store — prevents the 3s debounce
                        // timer from firing before user confirms the template save guard.
                        store.setAutoSaveEnabled(false)
                        const pendingTimer = useEditorStore.getState().autoSaveTimer
                        if (pendingTimer) {
                            clearTimeout(pendingTimer)
                            useEditorStore.setState({ autoSaveTimer: null })
                        }

                        // Update header/footer
                        if (data.site?.headerBlock) store.updateHeaderBlock(data.site.headerBlock)
                        if (data.site?.footerBlock) store.updateFooterBlock(data.site.footerBlock)

                        // Update local site state
                        if (data.site) setSite(data.site)

                        // Mark template as just applied (for save guard)
                        setTemplateApplied(true)

                        // Refresh preview iframe
                        setIframeKey(prev => prev + 1)

                        // Show unmatched block notification (Phase 3)
                        if (unmatchedBlocks && unmatchedBlocks.length > 0) {
                            const types = unmatchedBlocks.join(', ')
                            toast.info(
                                `${unmatchedBlocks.length} section(s) (${types}) had no match in the new template and were placed before the footer.`,
                                { duration: 6000 }
                            )
                        }

                        toast.success(`Template "${templateName}" applied! Press Ctrl+Z to undo.`)
                    } catch (err) {
                        const message = err instanceof Error ? err.message : 'Failed to refresh editor'
                        toast.error('Template applied but editor refresh failed', { description: message })
                        window.location.reload()
                    } finally {
                        setTimeout(() => setIsTransitioning(false), 300)
                    }
                }}
            />

            {/* Tab authority — suspend this tab if another tab claimed the editor */}
            {!isMaster && (
                <TabSuspendedOverlay
                    onReclaim={reclaimAuthority}
                    onReload={() => window.location.reload()}
                />
            )}

            {/* Save guard modal — warns user that saving after template apply is permanent */}
            {showSaveGuard && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowSaveGuard(false)}
                    />
                    <div
                        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1120] p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Save Template Changes?</h3>
                                <p className="mt-1 text-sm text-gray-400">
                                    Changes will be saved permanently. You will not be able to undo the template change after saving.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowSaveGuard(false)}
                                className="rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/10"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    setShowSaveGuard(false)
                                    setTemplateApplied(false)
                                    await handleSave({ showToast: true, refreshPreview: true })
                                }}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
                            >
                                Confirm Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
