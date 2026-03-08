'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
    ArrowLeft, Undo2, Redo2, Save, ExternalLink, Upload,
    Check, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEditorStore } from '@/store/editorStore'
import { AIChatPanel } from '@/components/editor/AIChatPanel'
import { SettingsPanel } from '@/components/editor/SettingsPanel'
import { PreviewFrame } from '@/components/editor/PreviewFrame'

// ─── Types ──────────────────────────────────────────────────────────────
type BlockData = { blockType: string;[key: string]: any }
type SiteData = { id: string; name: string; status: string; theme: any; siteType: string }
type PageData = { id: string; title: string; layout: BlockData[] }

// ─── Main Editor Page ───────────────────────────────────────────────────
export default function EditorPage() {
    const params = useParams()
    const router = useRouter()
    const siteId = params?.siteId as string

    const [isChatOpen, setIsChatOpen] = useState(true)
    const [selectedBlock, setSelectedBlock] = useState(0)
    const [site, setSite] = useState<SiteData | null>(null)
    const [page, setPage] = useState<PageData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isPublishing, setIsPublishing] = useState(false)
    const [publishSuccess, setPublishSuccess] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [iframeKey, setIframeKey] = useState(0)

    // Editor store (F-06 Undo/Redo + F-07 Auto-Save)
    const editorStore = useEditorStore()

    // ── Derived / Memoized values ────────────────────────────────────────
    const blocks = useMemo(() => page?.layout || [], [page?.layout])
    const currentBlock = useMemo(() => blocks[selectedBlock] || null, [blocks, selectedBlock])
    const isPublished = useMemo(() => site?.status === 'published', [site?.status])

    // ── Fetch site and page data ─────────────────────────────────────────
    useEffect(() => {
        if (!siteId) return
        async function loadData() {
            try {
                const res = await fetch(`/api/sites/${siteId}/editor-data`)
                if (res.ok) {
                    const data = await res.json()
                    if (data.site) setSite(data.site)
                    if (data.page) setPage(data.page)
                    editorStore.init(siteId, data.page?.layout || [], data.site?.theme || {}, data.site?.name || '')
                }
            } catch (err) { console.error('Failed to load site data', err) }
            finally { setIsLoading(false) }
        }
        loadData()
    }, [siteId])

    // ── F-06: Keyboard shortcuts (Cmd+Z / Cmd+Shift+Z / Cmd+S) ──────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault()
                if (e.shiftKey) {
                    if (editorStore.canRedo()) {
                        editorStore.redo()
                        setPage(prev => prev ? { ...prev, layout: editorStore.blocks } : prev)
                        setSite(prev => prev ? { ...prev, theme: editorStore.theme } : prev)
                        setHasUnsavedChanges(true)
                        setIframeKey(k => k + 1)
                    }
                } else {
                    if (editorStore.canUndo()) {
                        editorStore.undo()
                        setPage(prev => prev ? { ...prev, layout: editorStore.blocks } : prev)
                        setSite(prev => prev ? { ...prev, theme: editorStore.theme } : prev)
                        setHasUnsavedChanges(true)
                        setIframeKey(k => k + 1)
                    }
                }
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault()
                handleSave()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [editorStore])

    // ── F-07: Auto-save (every 30s if unsaved changes) ───────────────────
    useEffect(() => {
        if (!hasUnsavedChanges || !siteId) return
        const timer = setTimeout(() => { handleSave() }, 30000)
        return () => clearTimeout(timer)
    }, [hasUnsavedChanges, siteId])

    // ── Memoized Handlers ────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        if (!siteId || !page) return
        setIsSaving(true)
        try {
            const res = await fetch(`/api/sites/${siteId}/save`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ blocks: page.layout, theme: site?.theme }),
            })
            if (res.ok) {
                setSaveSuccess(true)
                setHasUnsavedChanges(false)
                setIframeKey(k => k + 1)
                setTimeout(() => setSaveSuccess(false), 2000)
            } else {
                console.error('Save failed with status:', res.status)
            }
        } catch (err) { console.error('Save failed', err) }
        finally { setIsSaving(false) }
    }, [siteId, page, site?.theme])

    const handleThemeChange = useCallback((key: string, value: string) => {
        setSite(prev => prev ? { ...prev, theme: { ...prev.theme, [key]: value } } : prev)
        setHasUnsavedChanges(true)
    }, [])

    const handleDeleteBlock = useCallback((idx: number) => {
        setPage(prev => {
            if (!prev) return prev
            const newLayout = prev.layout.filter((_, i) => i !== idx)
            return { ...prev, layout: newLayout }
        })
        setSelectedBlock(prev => Math.max(0, idx < prev ? prev - 1 : Math.min(prev, idx - 1)))
        setHasUnsavedChanges(true)
    }, [])

    const handleDuplicateBlock = useCallback((idx: number) => {
        setPage(prev => {
            if (!prev) return prev
            const blockCopy = JSON.parse(JSON.stringify(prev.layout[idx]))
            const newLayout = [...prev.layout]
            newLayout.splice(idx + 1, 0, blockCopy)
            return { ...prev, layout: newLayout }
        })
        setSelectedBlock(idx + 1)
        setHasUnsavedChanges(true)
    }, [])

    const handleBlockFieldChange = useCallback((idx: number, field: string, value: string) => {
        setPage(prev => {
            if (!prev) return prev
            const newLayout = [...prev.layout]
            newLayout[idx] = { ...newLayout[idx], [field]: value }
            return { ...prev, layout: newLayout }
        })
        setHasUnsavedChanges(true)
    }, [])

    const handleBlockUpdate = useCallback((idx: number, changes: any) => {
        setPage(prev => {
            if (!prev) return prev
            const newLayout = [...prev.layout]
            newLayout[idx] = { ...newLayout[idx], ...changes }
            return { ...prev, layout: newLayout }
        })
        setHasUnsavedChanges(true)
    }, [])

    const handleAIAction = useCallback((action: any) => {
        if (!page) return

        switch (action.action) {
            case 'update_block': {
                const idx = action.blockIndex ?? selectedBlock
                setPage(prev => {
                    if (!prev) return prev
                    const newLayout = [...prev.layout]
                    newLayout[idx] = { ...newLayout[idx], ...action.changes }
                    return { ...prev, layout: newLayout }
                })
                setHasUnsavedChanges(true)
                break
            }
            case 'update_theme': {
                setSite(prev => prev ? { ...prev, theme: { ...prev.theme, ...action.changes } } : prev)
                setHasUnsavedChanges(true)
                break
            }
            case 'add_block': {
                const afterIdx = action.afterIndex ?? blocks.length - 1
                setPage(prev => {
                    if (!prev) return prev
                    const newLayout = [...prev.layout]
                    newLayout.splice(afterIdx + 1, 0, action.block)
                    return { ...prev, layout: newLayout }
                })
                setSelectedBlock(afterIdx + 1)
                setHasUnsavedChanges(true)
                break
            }
            case 'delete_block': {
                const idx = action.blockIndex ?? selectedBlock
                setPage(prev => {
                    if (!prev) return prev
                    const newLayout = prev.layout.filter((_, i) => i !== idx)
                    return { ...prev, layout: newLayout }
                })
                setSelectedBlock(Math.max(0, (action.blockIndex ?? selectedBlock) - 1))
                setHasUnsavedChanges(true)
                break
            }
        }

        // Refresh preview
        setIframeKey(k => k + 1)
    }, [page, selectedBlock, blocks.length])

    const handlePublish = useCallback(async () => {
        if (!siteId || isPublishing) return
        setIsPublishing(true)
        const currentlyPublished = site?.status === 'published'
        try {
            const res = await fetch(`/api/sites/${siteId}/publish`, {
                method: currentlyPublished ? 'DELETE' : 'PATCH',
                credentials: 'include',
            })
            if (res.ok) {
                setPublishSuccess(true)
                setSite(prev => prev ? { ...prev, status: currentlyPublished ? 'draft' : 'published' } : prev)
                setTimeout(() => setPublishSuccess(false), 3000)
            }
        } catch (err) { console.error('Publish/unpublish failed', err) }
        finally { setIsPublishing(false) }
    }, [siteId, isPublishing, site?.status])

    const handleToggleChat = useCallback(() => setIsChatOpen(prev => !prev), [])

    const handleUndo = useCallback(() => {
        editorStore.undo()
        setPage(p => p ? { ...p, layout: editorStore.blocks } : p)
        setSite(s => s ? { ...s, theme: editorStore.theme } : s)
        setHasUnsavedChanges(true)
        setIframeKey(k => k + 1)
    }, [editorStore])

    const handleRedo = useCallback(() => {
        editorStore.redo()
        setPage(p => p ? { ...p, layout: editorStore.blocks } : p)
        setSite(s => s ? { ...s, theme: editorStore.theme } : s)
        setHasUnsavedChanges(true)
        setIframeKey(k => k + 1)
    }, [editorStore])

    // ── Render ───────────────────────────────────────────────────────────
    return (
        <div className="flex h-screen flex-col bg-[#0B1120]">
            {/* ─── Top Toolbar ──────────────────────────────────────── */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
                <div className="flex items-center gap-2">
                    <Link href="/dashboard" className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-colors" title="Back to Dashboard">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div className="mx-2 h-5 w-px bg-white/10" />
                    {site && <span className="text-sm font-medium text-white">{site.name}</span>}
                </div>

                <div className="flex items-center gap-2">
                    {/* F-06: Undo/Redo buttons */}
                    <button onClick={handleUndo}
                        disabled={!editorStore.canUndo()}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-20" title="Undo (⌘Z)">
                        <Undo2 className="h-4 w-4" />
                    </button>
                    <button onClick={handleRedo}
                        disabled={!editorStore.canRedo()}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-20" title="Redo (⌘⇧Z)">
                        <Redo2 className="h-4 w-4" />
                    </button>
                    <div className="mx-1 h-5 w-px bg-white/10" />
                    {hasUnsavedChanges && <span className="text-[10px] text-yellow-400 animate-pulse">● Auto-save in 30s</span>}
                    <button onClick={handleSave} disabled={isSaving || saveSuccess || !hasUnsavedChanges}
                        className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                            saveSuccess ? 'bg-green-600/20 text-green-400' : hasUnsavedChanges ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-white/5 text-gray-500 cursor-default')}>
                        {isSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</> : saveSuccess ? <><Check className="h-3.5 w-3.5" /> Saved!</> : <><Save className="h-3.5 w-3.5" /> Save</>}
                    </button>
                    <a href={`/api/preview/${siteId}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10 transition-colors">
                        <ExternalLink className="h-3.5 w-3.5" /> Preview
                    </a>
                    <button onClick={handlePublish} disabled={isPublishing || publishSuccess}
                        className={cn('flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-colors shadow-lg',
                            publishSuccess ? 'bg-green-600 shadow-green-500/25' : isPublished ? 'bg-green-600/80 shadow-green-500/25 hover:bg-green-500' : 'bg-blue-600 shadow-blue-500/25 hover:bg-blue-500')}>
                        {isPublishing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Publishing...</> : publishSuccess ? <><Check className="h-3.5 w-3.5" /> Published!</> : isPublished ? <><Check className="h-3.5 w-3.5" /> Published</> : <><Upload className="h-3.5 w-3.5" /> Publish</>}
                    </button>
                </div>
            </div>

            {/* ─── Main Area (3 Panels) ─────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden">
                <AIChatPanel
                    isOpen={isChatOpen}
                    onToggle={handleToggleChat}
                    blocks={blocks}
                    onBlockSelect={setSelectedBlock}
                    selectedBlock={selectedBlock}
                    onAIAction={handleAIAction}
                    siteName={site?.name || ''}
                    theme={site?.theme}
                />

                {/* Center: Live Preview via iframe */}
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
                    theme={site?.theme}
                    onThemeChange={handleThemeChange}
                    onDeleteBlock={handleDeleteBlock}
                    onDuplicateBlock={handleDuplicateBlock}
                    onBlockFieldChange={handleBlockFieldChange}
                    onBlockUpdate={handleBlockUpdate}
                />
            </div>

            {/* ─── Status Bar ───────────────────────────────────────── */}
            <div className="flex h-8 shrink-0 items-center justify-between border-t border-white/10 px-4 text-[11px]">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-green-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> Connected
                    </span>
                    <span className="text-gray-500">Site ID: {siteId}</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-gray-500">{blocks.length} blocks</span>
                    <span className="text-gray-600">History: {editorStore.historyIndex + 1}/{editorStore.history.length}</span>
                    <span className={cn('rounded px-1.5 py-0.5 font-medium',
                        isPublished ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400')}>
                        {isPublished ? 'Published' : 'Draft'}
                    </span>
                </div>
            </div>
        </div>
    )
}
