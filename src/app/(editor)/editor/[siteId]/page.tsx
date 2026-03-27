'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
    ArrowLeft, Save, ExternalLink, Upload,
    Check, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useEditorStore } from '@/store/editorStore'
import { AIChatPanel } from '@/components/editor/AIChatPanel'
import { SettingsPanel } from '@/components/editor/SettingsPanel'
import { PreviewFrame } from '@/components/editor/PreviewFrame'
import { UndoRedoButtons } from '@/components/editor/UndoRedoButtons'
import { useUndoRedo } from '@/hooks/useUndoRedo'

// ─── Types ──────────────────────────────────────────────────────────────
type BlockData = { blockType: string } & Record<string, unknown>
type SiteData = { id: string; name: string; status: string; theme: Record<string, unknown>; siteType: string }
type PageData = { id: string; title: string; layout: BlockData[] }

// ─── Main Editor Page ───────────────────────────────────────────────────
export default function EditorPage() {
    const params = useParams()
    const router = useRouter()
    const siteId = params?.siteId as string

    const [isChatOpen, setIsChatOpen] = useState(true)
    const [selectedBlock, setSelectedBlock] = useState(0)
    const [site, setSite] = useState<SiteData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isPublishing, setIsPublishing] = useState(false)
    const [publishSuccess, setPublishSuccess] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

    // Editor store (F-11 Undo/Redo + F-07 Auto-Save)
    const editorStore = useEditorStore()

    // F-11: Keyboard shortcuts Ctrl+Z / Ctrl+Y (safe: skips contentEditable/inputs)
    useUndoRedo()

    // F-11: Sync local React state when store undo/redo changes historyIndex
    // Skip the first trigger (historyIndex -1 → 0 on init — not a real undo/redo)
    const storeHistoryIndex = useEditorStore((s) => s.historyIndex)
    const storeBlocks = useEditorStore((s) => s.blocks)
    const storeTheme = useEditorStore((s) => s.theme)
    const isInitialized = useRef(false)
    useEffect(() => {
        console.log('[Page] storeHistoryIndex changed to:', storeHistoryIndex, 'storeBlocks[0]:', storeBlocks[0])
        if (!isInitialized.current) {
            if (storeHistoryIndex >= 0) isInitialized.current = true
            return // skip initial load
        }
        setSite(prev => prev ? { ...prev, theme: storeTheme } : prev)
        setHasUnsavedChanges(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storeHistoryIndex])

    // ── Derived / Memoized values ────────────────────────────────────────
    const blocks = useMemo(() => storeBlocks || [], [storeBlocks])
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
                    editorStore.init(siteId, data.page?.layout || [], data.site?.theme || {}, data.site?.name || '')
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to load site data'
                toast.error('Failed to load site', { description: message })
            }
            finally { setIsLoading(false) }
        }
        loadData()
    }, [siteId])


    // Note: Ctrl+Z / Ctrl+Y are handled by useUndoRedo() hook above


    // ── F-07: Auto-save (every 30s if unsaved changes) ───────────────────
    useEffect(() => {
        if (!hasUnsavedChanges || !siteId) return
        const timer = setTimeout(() => { handleSave() }, 30000)
        return () => clearTimeout(timer)
    }, [hasUnsavedChanges, siteId])

    // ── Memoized Handlers ────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        if (!siteId || !storeBlocks) return
        setIsSaving(true)
        try {
            const res = await fetch(`/api/sites/${siteId}/save`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ blocks: storeBlocks, theme: site?.theme }),
            })
            if (res.ok) {
                setSaveSuccess(true)
                setHasUnsavedChanges(false)
                toast.success('Changes saved')
                setTimeout(() => setSaveSuccess(false), 2000)
            } else {
                toast.error('Save failed', { description: `Server returned ${res.status}` })
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Save failed'
            toast.error('Save failed', { description: message })
        }
        finally { setIsSaving(false) }
    }, [siteId, storeBlocks, site?.theme])

    // ── Ctrl+S: Save shortcut (placed after handleSave to avoid TDZ) ─────
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault()
                handleSave()
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [handleSave])

    const handleThemeChange = useCallback((key: string, value: string) => {
        const newTheme = { ...(site?.theme || {}), [key]: value }
        editorStore.updateTheme({ [key]: value }, `Changed theme: ${key}`)
        setSite(prev => prev ? { ...prev, theme: newTheme } : prev)
        setHasUnsavedChanges(true)
    }, [site?.theme, editorStore])

    const handleDeleteBlock = useCallback((idx: number) => {
        editorStore.deleteBlock(idx)
        setSelectedBlock(prev => Math.max(0, idx < prev ? prev - 1 : Math.min(prev, idx - 1)))
        setHasUnsavedChanges(true)
    }, [editorStore])

    const handleDuplicateBlock = useCallback((idx: number) => {
        editorStore.duplicateBlock(idx)
        setSelectedBlock(idx + 1)
        setHasUnsavedChanges(true)
    }, [editorStore])

    const handleBlockFieldChange = useCallback((idx: number, field: string, value: string) => {
        console.log('[Page handleBlockFieldChange]', { idx, field, value })
        editorStore.updateBlock(idx, { [field]: value }, `Edited ${field}`)
        setHasUnsavedChanges(true)
    }, [editorStore])

    const handleBlockUpdate = useCallback((idx: number, changes: Record<string, unknown>) => {
        editorStore.updateBlock(idx, changes, 'Updated block')
        setHasUnsavedChanges(true)
    }, [editorStore])

    const handleAIAction = useCallback((action: Record<string, unknown>) => {
        if (!storeBlocks) return

        // F-11: Compute next state, then push as a SINGLE batch action (BR-02)
        let newLayout = [...storeBlocks]
        let newTheme = { ...(site?.theme || {}) }
        let label = 'AI change'

        switch (action.action) {
            case 'update_block': {
                const idx = (action.blockIndex as number) ?? selectedBlock
                newLayout[idx] = { ...newLayout[idx], ...(action.changes as Record<string, unknown>) }
                label = `AI: updated ${newLayout[idx].blockType}`
                break
            }
            case 'update_theme': {
                newTheme = { ...newTheme, ...(action.changes as Record<string, unknown>) }
                label = 'AI: updated theme'
                break
            }
            case 'add_block': {
                const afterIdx = (action.afterIndex as number) ?? newLayout.length - 1
                newLayout.splice(afterIdx + 1, 0, action.block as BlockData)
                setSelectedBlock(afterIdx + 1)
                label = `AI: added ${(action.block as BlockData)?.blockType}`
                break
            }
            case 'delete_block': {
                const idx = (action.blockIndex as number) ?? selectedBlock
                label = `AI: deleted ${newLayout[idx]?.blockType}`
                newLayout = newLayout.filter((_, i) => i !== idx)
                setSelectedBlock(Math.max(0, idx - 1))
                break
            }
        }

        // Push entire AI response as 1 undoable action (F-11 FR-06)
        editorStore.pushBatch(newLayout, newTheme, label)
        setSite(prev => prev ? { ...prev, theme: newTheme } : prev)
        setHasUnsavedChanges(true)
    }, [storeBlocks, selectedBlock, site?.theme, editorStore])

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
                toast.success(currentlyPublished ? 'Site unpublished' : 'Site published!')
                setTimeout(() => setPublishSuccess(false), 3000)
            } else {
                toast.error('Publish failed', { description: `Server returned ${res.status}` })
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Publish failed'
            toast.error('Publish failed', { description: message })
        }
        finally { setIsPublishing(false) }
    }, [siteId, isPublishing, site?.status])

    const handleToggleChat = useCallback(() => setIsChatOpen(prev => !prev), [])



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
                    <div className="mx-2 h-5 w-px bg-white/10" />
                    {/* F-11: Undo/Redo — bên trái toolbar */}
                    <UndoRedoButtons />
                </div>

                <div className="flex items-center gap-2">
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
                        siteName={site?.name || ''}
                        blocks={blocks}
                        theme={site?.theme}
                        isLoading={isLoading}
                    />
                </div>

                <SettingsPanel
                    key={storeHistoryIndex}
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
