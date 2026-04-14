'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { SettingsPanel } from '@/components/editor/SettingsPanel'
import { useEditorStore } from '@/store/editorStore'
import type { AIAction } from '@/types/editor'
import { useI18n } from '@/i18n'
import { PrePublishModal } from '@/components/editor/PrePublishModal'
import { UnpublishModal } from '@/components/editor/UnpublishModal'
import { EditorTemplateModal } from '@/components/editor/EditorTemplateModal'

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
    const [userData, setUserData] = useState<{ name: string; initial: string } | null>(null)
    const [chatActivity, setChatActivity] = useState<{ id: string; content: string } | null>(null)
    const [isCompactLayout, setIsCompactLayout] = useState(false)
    const [isPublishModalOpen, setIsPublishModalOpen] = useState(false)
    const [isUnpublishModalOpen, setIsUnpublishModalOpen] = useState(false)
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
    const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false)

    const blocks = useEditorStore(state => state.blocks)
    const theme = useEditorStore(state => state.theme)
    const siteName = useEditorStore(state => state.siteName)
    const pages = useEditorStore(state => state.pages)
    const currentPageId = useEditorStore(state => state.currentPageId)
    const hasUnsavedChanges = useEditorStore(state => state.hasUnsavedChanges)
    const hasUnpublishedChanges = useEditorStore(state => state.hasUnpublishedChanges)
    const lastSavedAt = useEditorStore(state => state.lastSavedAt)
    const isSaving = useEditorStore(state => state.isSaving)
    const autoSaveEnabled = useEditorStore(state => state.autoSaveEnabled)
    const autoSaveIntervalMs = useEditorStore(state => state.autoSaveIntervalMs)
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
                    setUserData({ name, initial: name.charAt(0).toUpperCase() })
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
                    setPages(pagesData.pages || [])
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
                throw new Error(`Server returned ${res.status}`)
            }

            markSaved()
            setSaveSuccess(true)

            if (options.refreshPreview ?? true) {
                setIframeKey(key => key + 1)
            }

            if (options.showToast ?? true) {
                toast.success('Changes saved')
            }

            window.setTimeout(() => setSaveSuccess(false), 2000)
            return true
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Save failed'
            toast.error('Save failed', { description: message })
            return false
        } finally {
            setIsSaving(false)
        }
    }, [markSaved, page, setIsSaving, siteId])

    useEffect(() => {
        if (!siteId || !hasUnsavedChanges || !autoSaveEnabled) return

        const timer = window.setTimeout(() => {
            void handleSave({ showToast: false, refreshPreview: true })
        }, autoSaveIntervalMs)

        return () => window.clearTimeout(timer)
    }, [autoSaveEnabled, autoSaveIntervalMs, handleSave, hasUnsavedChanges, siteId])

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
                void handleSave()
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
            setIframeKey(key => key + 1)
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

    const handleBlockFieldChange = useCallback((index: number, field: string, value: string) => {
        updateBlock(index, { [field]: value })
        // Save + reload preview to show changes
        void handleSave({ showToast: false, refreshPreview: true })
    }, [updateBlock, handleSave])

    const handleBlockUpdate = useCallback((index: number, changes: Record<string, unknown>) => {
        updateBlock(index, changes)
        void handleSave({ showToast: false, refreshPreview: true })
    }, [updateBlock, handleSave])

    const handleReorderBlocks = useCallback(async (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return
        reorderBlocks(fromIndex, toIndex)
        setSelectedBlock(toIndex)
        // Save FIRST so iframe reloads with correct order from DB
        await handleSave({ showToast: false, refreshPreview: true })
        setChatActivity({
            id: `reorder-${Date.now()}`,
            content: `Moved block #${fromIndex + 1} to position #${toIndex + 1}`,
        })
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
                    // Auto-save + refresh preview to show new block
                    setTimeout(() => {
                        void handleSave({ showToast: false, refreshPreview: true })
                    }, 300)
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
                // Auto-save + refresh preview
                setTimeout(() => {
                    void handleSave({ showToast: false, refreshPreview: true })
                }, 300)
                break
            }

            case 'undo': {
                if (canUndo()) {
                    undo()
                    setIframeKey(key => key + 1)
                } else {
                    toast.error('Nothing to undo')
                }
                break
            }
        }

        await handleSave({ showToast: false, refreshPreview: true })
    }, [addBlock, blocks.length, deleteBlock, handleSave, selectedBlock, site?.name, siteName, theme, updateBlock, updateTheme, canUndo, undo])

    const handleUndo = useCallback(() => {
        if (!canUndo()) return
        undo()
        setIframeKey(key => key + 1)
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
            }

            if (!currentlyPublished) {
                const data = await res.json()
                const siteUrl = data?.data?.url || data?.data?.domain
                if (siteUrl) {
                    toast.success(`🎉 ${t.editor.toast.publishSuccess}`, {
                        description: ti(t.editor.toast.publishSuccessDomain, { domain: siteUrl.replace(/^https?:\/\//, '') }),
                        action: {
                            label: 'View',
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
            const message = err instanceof Error ? err.message : 'Publish failed'
            toast.error(t.editor.toast.publishFailed, { description: message })
        } finally {
            setIsPublishing(false)
        }
    }, [handleSave, hasUnsavedChanges, isPublishing, markPublished, site?.status, siteId, siteName])

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

            if (!res.ok) throw new Error(`Server returned ${res.status}`)

            markPublished()
            setPublishSuccess(true)

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
            const message = err instanceof Error ? err.message : 'Publish failed'
            toast.error(t.editor.toast.publishFailed, { description: message })
        } finally {
            setIsPublishing(false)
        }
    }, [handleSave, hasUnsavedChanges, isPublishing, markPublished, siteId])

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
                    blocks={blocks}
                    selectedBlock={selectedBlock}
                    onAIAction={handleAIAction}
                    onUndoLastAction={handleUndo}
                    siteName={siteName || site?.name || ''}
                    theme={theme}
                    externalActivity={chatActivity}
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
                userName={userData?.name}
                userInitial={userData?.initial}
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
                onSave={() => void handleSave()}
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
                                    onDeleteBlock={handleDeleteBlock}
                                    onDuplicateBlock={handleDuplicateBlock}
                                    onBlockFieldChange={handleBlockFieldChange}
                                    onBlockUpdate={handleBlockUpdate}
                                    onHeaderUpdate={(changes) => updateHeaderBlock(changes)}
                                    onFooterUpdate={(changes) => updateFooterBlock(changes)}
                                    onSiteSettingsChange={handleSiteSettingsChange}
                                    onPageUpdate={handlePageUpdate}
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

                    <div className="flex flex-1 flex-col">
                        <PreviewFrame
                            siteId={siteId}
                            pageId={currentPageId}
                            iframeKey={iframeKey}
                            isLoading={isLoading}
                            viewport={viewport}
                            selectedBlock={selectedBlock}
                            onBlockSelect={setSelectedBlock}
                            onInlineEditApplied={(content, blockIndex) => {
                                setSelectedBlock(blockIndex)
                                setActiveSidebarTab('chat')
                                setChatActivity({
                                    id: `inline-${Date.now()}`,
                                    content,
                                })
                                void handleSave({ showToast: false, refreshPreview: true })
                                setIframeKey(key => key + 1)
                            }}
                            onReorderBlocks={handleReorderBlocks}
                            onBlockDrop={handleBlockDrop}
                            onPageNavigate={handlePageSelected}
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
                        onDeleteBlock={handleDeleteBlock}
                        onDuplicateBlock={handleDuplicateBlock}
                        onBlockFieldChange={handleBlockFieldChange}
                        onBlockUpdate={handleBlockUpdate}
                        onHeaderUpdate={(changes) => updateHeaderBlock(changes)}
                        onFooterUpdate={(changes) => updateFooterBlock(changes)}
                        onSiteSettingsChange={handleSiteSettingsChange}
                        onPageUpdate={handlePageUpdate}
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
                onApplied={() => {
                    setIsTemplateModalOpen(false)
                    // Reload editor with new template data
                    window.location.reload()
                }}
            />
        </div>
    )
}
