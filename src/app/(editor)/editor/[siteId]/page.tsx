'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, LayoutGrid, MessageCircle } from 'lucide-react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { normalizeAddSectionBlock } from '@/lib/ai/add-section'
import { AIChatPanel } from '@/components/editor/AIChatPanel'
import { BlockLibraryPanel } from '@/components/editor/BlockLibraryPanel'
import { EditorMenuDrawer } from '@/components/editor/EditorMenuDrawer'
import { EditorSidebar, type EditorSidebarTabId } from '@/components/editor/EditorSidebar'
import { EditorStatusBar } from '@/components/editor/EditorStatusBar'
import { EditorToolbar } from '@/components/editor/EditorToolbar'
import { PageManagerPanel } from '@/components/editor/PageManagerPanel'
import { PreviewFrame } from '@/components/editor/PreviewFrame'
import { SettingsPanel } from '@/components/editor/SettingsPanel'
import { useEditorStore } from '@/store/editorStore'
import type { AIAction } from '@/types/editor'

type SiteData = {
    id: string
    name: string
    status: string
    theme: Record<string, unknown>
    siteType: string
}

type LoadedPageData = {
    id: string
    title: string
}

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
    const [chatActivity, setChatActivity] = useState<{ id: string; content: string } | null>(null)
    const [isCompactLayout, setIsCompactLayout] = useState(false)

    const blocks = useEditorStore(state => state.blocks)
    const theme = useEditorStore(state => state.theme)
    const siteName = useEditorStore(state => state.siteName)
    const pages = useEditorStore(state => state.pages)
    const currentPageId = useEditorStore(state => state.currentPageId)
    const hasUnsavedChanges = useEditorStore(state => state.hasUnsavedChanges)
    const lastSavedAt = useEditorStore(state => state.lastSavedAt)
    const isSaving = useEditorStore(state => state.isSaving)
    const autoSaveEnabled = useEditorStore(state => state.autoSaveEnabled)
    const autoSaveIntervalMs = useEditorStore(state => state.autoSaveIntervalMs)
    const init = useEditorStore(state => state.init)
    const setPages = useEditorStore(state => state.setPages)
    const setCurrentPageId = useEditorStore(state => state.setCurrentPageId)
    const updateBlock = useEditorStore(state => state.updateBlock)
    const addBlock = useEditorStore(state => state.addBlock)
    const deleteBlock = useEditorStore(state => state.deleteBlock)
    const duplicateBlock = useEditorStore(state => state.duplicateBlock)
    const updateTheme = useEditorStore(state => state.updateTheme)
    const undo = useEditorStore(state => state.undo)
    const redo = useEditorStore(state => state.redo)
    const canUndo = useEditorStore(state => state.canUndo)
    const canRedo = useEditorStore(state => state.canRedo)
    const markSaved = useEditorStore(state => state.markSaved)
    const setIsSaving = useEditorStore(state => state.setIsSaving)

    const currentBlock = useMemo(
        () => (selectedBlock !== null ? blocks[selectedBlock] || null : null),
        [blocks, selectedBlock],
    )
    const isPublished = site?.status === 'published'
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

                if (data.page) {
                    const loadedPage = { id: data.page.id, title: data.page.title }
                    setPage(loadedPage)
                    setCurrentPageId(data.page.id)
                } else {
                    setPage(null)
                    setCurrentPageId('')
                }

                init(siteId, data.page?.layout || [], data.site?.theme || {}, data.site?.name || '')

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

    const handleSave = useCallback(async (options: SaveOptions = {}) => {
        if (!siteId) return false

        const snapshot = useEditorStore.getState()
        const currentBlocks = snapshot.blocks
        const currentTheme = snapshot.theme

        if (currentBlocks.length === 0 && !page) return false

        setIsSaving(true)

        try {
            const saveUrl = new URL(`/api/sites/${siteId}/save`, window.location.origin)
            if (currentPageId) {
                saveUrl.searchParams.set('pageId', currentPageId)
            }

            const res = await fetch(saveUrl.toString(), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ blocks: currentBlocks, theme: currentTheme }),
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
    }, [currentPageId, markSaved, page, setIsSaving, siteId])

    useEffect(() => {
        if (!siteId || !hasUnsavedChanges || !autoSaveEnabled) return

        const timer = window.setTimeout(() => {
            void handleSave({ showToast: false, refreshPreview: true })
        }, autoSaveIntervalMs)

        return () => window.clearTimeout(timer)
    }, [autoSaveEnabled, autoSaveIntervalMs, handleSave, hasUnsavedChanges, siteId])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
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
    }, [updateTheme])

    const handleDeleteBlock = useCallback((index: number) => {
        deleteBlock(index)
        setSelectedBlock(prev => {
            if (prev === null) return null
            if (index < prev) return prev - 1
            if (index === prev) return null
            return prev
        })
    }, [deleteBlock])

    const handleDuplicateBlock = useCallback((index: number) => {
        duplicateBlock(index)
        setSelectedBlock(index + 1)
    }, [duplicateBlock])

    const handleBlockFieldChange = useCallback((index: number, field: string, value: string) => {
        updateBlock(index, { [field]: value })
    }, [updateBlock])

    const handleBlockUpdate = useCallback((index: number, changes: Record<string, unknown>) => {
        updateBlock(index, changes)
    }, [updateBlock])

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
        }

        await handleSave({ showToast: false, refreshPreview: true })
    }, [addBlock, blocks.length, deleteBlock, handleSave, selectedBlock, site?.name, siteName, theme, updateBlock, updateTheme])

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
            toast.success(currentlyPublished ? 'Site unpublished' : 'Site published!')
            window.setTimeout(() => setPublishSuccess(false), 3000)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Publish failed'
            toast.error('Publish failed', { description: message })
        } finally {
            setIsPublishing(false)
        }
    }, [handleSave, hasUnsavedChanges, isPublishing, site?.status, siteId])

    const handlePageSelected = useCallback((pageId: string) => {
        const nextParams = new URLSearchParams(searchParams.toString())
        nextParams.set('pageId', pageId)
        router.replace(`/editor/${siteId}?${nextParams.toString()}`)
    }, [router, searchParams, siteId])

    const statusText = isSaving
        ? 'Saving draft...'
        : hasUnsavedChanges
            ? `Autosave ON - ${Math.round(autoSaveIntervalMs / 1000)}s debounce`
            : lastSavedLabel
                ? `Autosave ON - Saved at ${lastSavedLabel}`
                : 'Autosave ON'

    const sidebarTabs = [
        { id: 'chat' as const, label: 'AI Chat', icon: <MessageCircle className="h-3.5 w-3.5" /> },
        { id: 'components' as const, label: 'Components', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
        { id: 'pages' as const, label: 'Pages', icon: <FileText className="h-3.5 w-3.5" /> },
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
                    onBlockSelect={setSelectedBlock}
                    onAIAction={handleAIAction}
                />
            ) : null}

            {activeSidebarTab === 'pages' ? (
                <PageManagerPanel
                    siteId={siteId}
                    currentPageId={currentPageId}
                    onPageSelected={handlePageSelected}
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
            />

            <EditorToolbar
                siteId={siteId}
                currentPageId={currentPageId}
                siteName={siteName || site?.name || ''}
                currentPageTitle={currentPageTitle}
                isPublished={Boolean(isPublished)}
                isSaving={isSaving}
                saveSuccess={saveSuccess}
                hasUnsavedChanges={hasUnsavedChanges}
                isPublishing={isPublishing}
                publishSuccess={publishSuccess}
                canUndo={canUndo()}
                canRedo={canRedo()}
                viewport={viewport}
                compact={isCompactLayout}
                onOpenMenu={() => setIsMenuOpen(true)}
                onOpenTemplates={() => toast.info('Template gallery will be connected in the next step.')}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onSave={() => void handleSave()}
                onPublish={handlePublish}
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
                </div>
            ) : (
                <>
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
                                onInlineEditApplied={(content, blockIndex) => {
                                    setSelectedBlock(blockIndex)
                                    setActiveSidebarTab('chat')
                                    setChatActivity({
                                        id: `inline-${Date.now()}`,
                                        content,
                                    })
                                }}
                            />
                        </div>

                        <SettingsPanel
                            block={currentBlock}
                            blockIndex={selectedBlock}
                            theme={theme}
                            siteName={siteName || site?.name || ''}
                            siteStatus={site?.status || 'draft'}
                            onThemeChange={handleThemeChange}
                            onDeleteBlock={handleDeleteBlock}
                            onDuplicateBlock={handleDuplicateBlock}
                            onBlockFieldChange={handleBlockFieldChange}
                            onBlockUpdate={handleBlockUpdate}
                        />
                    </div>

                    <EditorStatusBar
                        statusText={statusText}
                        currentPageTitle={currentPageTitle}
                        blockCount={blocks.length}
                    />
                </>
            )}
        </div>
    )
}
