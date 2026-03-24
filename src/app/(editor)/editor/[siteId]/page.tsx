'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
    ArrowLeft,
    Undo2,
    Redo2,
    Save,
    ExternalLink,
    Upload,
    Check,
    Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useEditorStore } from '@/store/editorStore'
import { AIChatPanel } from '@/components/editor/AIChatPanel'
import { SettingsPanel } from '@/components/editor/SettingsPanel'
import { PreviewFrame } from '@/components/editor/PreviewFrame'
import type { AIAction } from '@/types/editor'

type SiteData = {
    id: string
    name: string
    status: string
    theme: Record<string, unknown>
    siteType: string
}

type PageData = {
    id: string
    title: string
}

type SaveOptions = {
    showToast?: boolean
    refreshPreview?: boolean
}

export default function EditorPage() {
    const params = useParams()
    const siteId = params?.siteId as string

    const [isChatOpen, setIsChatOpen] = useState(true)
    const [selectedBlock, setSelectedBlock] = useState<number | null>(null)
    const [site, setSite] = useState<SiteData | null>(null)
    const [page, setPage] = useState<PageData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isPublishing, setIsPublishing] = useState(false)
    const [publishSuccess, setPublishSuccess] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [iframeKey, setIframeKey] = useState(0)

    const blocks = useEditorStore(state => state.blocks)
    const theme = useEditorStore(state => state.theme)
    const siteName = useEditorStore(state => state.siteName)
    const history = useEditorStore(state => state.history)
    const historyIndex = useEditorStore(state => state.historyIndex)
    const hasUnsavedChanges = useEditorStore(state => state.hasUnsavedChanges)
    const lastSavedAt = useEditorStore(state => state.lastSavedAt)
    const isSaving = useEditorStore(state => state.isSaving)
    const autoSaveEnabled = useEditorStore(state => state.autoSaveEnabled)
    const autoSaveIntervalMs = useEditorStore(state => state.autoSaveIntervalMs)
    const init = useEditorStore(state => state.init)
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
    const isPublished = useMemo(() => site?.status === 'published', [site?.status])
    const lastSavedLabel = useMemo(() => {
        if (!lastSavedAt) return null
        return new Date(lastSavedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        })
    }, [lastSavedAt])

    useEffect(() => {
        if (!siteId) return

        async function loadData() {
            try {
                const res = await fetch(`/api/sites/${siteId}/editor-data`, {
                    credentials: 'include',
                })

                if (!res.ok) {
                    throw new Error(`Failed to load editor data (${res.status})`)
                }

                const data = await res.json()
                if (data.site) {
                    setSite(data.site)
                }
                if (data.page) {
                    setPage({ id: data.page.id, title: data.page.title })
                }

                init(siteId, data.page?.layout || [], data.site?.theme || {}, data.site?.name || '')
                setSelectedBlock(null)
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to load site data'
                toast.error('Failed to load site', { description: message })
            } finally {
                setIsLoading(false)
            }
        }

        void loadData()
    }, [init, siteId])

    const handleSave = useCallback(async (options: SaveOptions = {}) => {
        if (!siteId) return false

        const snapshot = useEditorStore.getState()
        const currentBlocks = snapshot.blocks
        const currentTheme = snapshot.theme

        if (currentBlocks.length === 0 && !page) return false

        setIsSaving(true)

        try {
            const res = await fetch(`/api/sites/${siteId}/save`, {
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
    }, [markSaved, page, setIsSaving, siteId])

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

    const handleDeleteBlock = useCallback((idx: number) => {
        deleteBlock(idx)
        setSelectedBlock(prev => {
            if (prev === null) return null
            if (idx < prev) return prev - 1
            if (idx === prev) return null
            return prev
        })
    }, [deleteBlock])

    const handleDuplicateBlock = useCallback((idx: number) => {
        duplicateBlock(idx)
        setSelectedBlock(idx + 1)
    }, [duplicateBlock])

    const handleBlockFieldChange = useCallback((idx: number, field: string, value: string) => {
        updateBlock(idx, { [field]: value })
    }, [updateBlock])

    const handleBlockUpdate = useCallback((idx: number, changes: Record<string, unknown>) => {
        updateBlock(idx, changes)
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
                const afterIndex = action.afterIndex ?? selectedBlock ?? (blocks.length - 1)
                if (action.block) {
                    addBlock(afterIndex, action.block)
                    setSelectedBlock(Math.max(0, afterIndex + 1))
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
    }, [addBlock, blocks.length, deleteBlock, handleSave, selectedBlock, updateBlock, updateTheme])

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

    const statusText = isSaving
        ? 'Saving draft...'
        : hasUnsavedChanges
            ? `Autosave ON - ${Math.round(autoSaveIntervalMs / 1000)}s debounce`
            : lastSavedLabel
                ? `Autosave ON - Saved at ${lastSavedLabel}`
                : 'Autosave ON'

    return (
        <div className="flex h-screen flex-col bg-[#0B1120]">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
                <div className="flex items-center gap-2">
                    <Link
                        href="/dashboard"
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
                        title="Back to Dashboard"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div className="mx-2 h-5 w-px bg-white/10" />
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">
                            {siteName || site?.name || 'Untitled Site'}
                        </span>
                        <span
                            className={cn(
                                'rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]',
                                isPublished ? 'bg-green-500/15 text-green-300' : 'bg-yellow-500/15 text-yellow-300',
                            )}
                        >
                            {isPublished ? 'Published' : 'Draft'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleUndo}
                        disabled={!canUndo()}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-20"
                        title="Undo (Cmd/Ctrl+Z)"
                    >
                        <Undo2 className="h-4 w-4" />
                    </button>
                    <button
                        onClick={handleRedo}
                        disabled={!canRedo()}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-20"
                        title="Redo (Cmd/Ctrl+Shift+Z)"
                    >
                        <Redo2 className="h-4 w-4" />
                    </button>
                    <div className="mx-1 h-5 w-px bg-white/10" />
                    <button
                        onClick={() => void handleSave()}
                        disabled={isSaving || saveSuccess || !hasUnsavedChanges}
                        className={cn(
                            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                            saveSuccess
                                ? 'bg-green-600/20 text-green-400'
                                : hasUnsavedChanges
                                    ? 'bg-white/10 text-white hover:bg-white/15'
                                    : 'cursor-default bg-white/5 text-gray-500',
                        )}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Saving...
                            </>
                        ) : saveSuccess ? (
                            <>
                                <Check className="h-3.5 w-3.5" />
                                Saved!
                            </>
                        ) : (
                            <>
                                <Save className="h-3.5 w-3.5" />
                                Save
                            </>
                        )}
                    </button>
                    <a
                        href={`/api/preview/${siteId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-sm text-gray-300 transition-colors hover:bg-white/10"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Preview
                    </a>
                    <button
                        onClick={handlePublish}
                        disabled={isPublishing || publishSuccess}
                        className={cn(
                            'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium text-white shadow-lg transition-colors',
                            publishSuccess
                                ? 'bg-green-600 shadow-green-500/25'
                                : isPublished
                                    ? 'bg-green-600/80 shadow-green-500/25 hover:bg-green-500'
                                    : 'bg-blue-600 shadow-blue-500/25 hover:bg-blue-500',
                        )}
                    >
                        {isPublishing ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Publishing...
                            </>
                        ) : publishSuccess ? (
                            <>
                                <Check className="h-3.5 w-3.5" />
                                Published!
                            </>
                        ) : isPublished ? (
                            <>
                                <Check className="h-3.5 w-3.5" />
                                Published
                            </>
                        ) : (
                            <>
                                <Upload className="h-3.5 w-3.5" />
                                Publish
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                <AIChatPanel
                    isOpen={isChatOpen}
                    onToggle={() => setIsChatOpen(prev => !prev)}
                    blocks={blocks}
                    onBlockSelect={setSelectedBlock}
                    selectedBlock={selectedBlock}
                    onAIAction={handleAIAction}
                    onUndoLastAction={handleUndo}
                    siteName={siteName || site?.name || ''}
                    theme={theme}
                />

                <div className="flex flex-1 flex-col">
                    <PreviewFrame
                        siteId={siteId}
                        iframeKey={iframeKey}
                        isLoading={isLoading}
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

            <div className="flex h-8 shrink-0 items-center justify-between border-t border-white/10 px-4 text-[11px]">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-green-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                        Connected
                    </span>
                    <span className="text-gray-500">Site ID: {siteId}</span>
                    {page ? <span className="text-gray-500">Page: {page.title}</span> : null}
                </div>

                <div className="flex items-center gap-3">
                    <span className={cn(
                        'rounded-full px-2 py-1 text-[10px] font-medium',
                        isSaving ? 'bg-blue-500/15 text-blue-300' : 'bg-white/5 text-gray-300',
                    )}>
                        {statusText}
                    </span>
                    <span className="text-gray-500">{blocks.length} blocks</span>
                    <span className="text-gray-600">
                        History: {historyIndex + 1}/{history.length}
                    </span>
                </div>
            </div>
        </div>
    )
}
