'use client'
/**
 * builder-shell.tsx
 * 3-pane layout orchestrator. Initialises Zustand store from server-fetched
 * sections, wires auto-save, and composes Library | Canvas | Inspector.
 * Mode state machine: 'builder' | 'catalog' | 'block-detail' (Phase A).
 * Visual re-skin: uses builder-shell CSS grid from bundle (builder.css).
 */
import { useEffect, useState } from 'react'
import { useBuilderStore } from '@/lib/admin/builder-store'
import type { Section, BlockPromptOverride } from '@/lib/admin/builder-store'
import { startAutoSave, loadAutoSave } from '@/lib/admin/builder-auto-save'
import { BuilderHeader } from './builder-header'
import { BuilderLibraryPane } from './builder-library-pane'
import { BuilderCanvasPane } from './builder-canvas-pane'
import { BuilderInspectorPane } from './builder-inspector-pane'
import { BuilderCatalogOverlay } from './builder-catalog-overlay'
import { BuilderBlockDetailOverlay } from './builder-block-detail-overlay'

type BuilderMode = 'builder' | 'catalog' | 'block-detail'

interface Props {
    templateId: number
    initialName: string
    initialStatus: string
    initialSections: Section[]
    /** Per-block AI prompt overrides from DB. Seeded into Zustand store on mount. */
    initialBlockPromptOverrides?: Record<string, BlockPromptOverride>
}

export function BuilderShell({ templateId, initialName, initialStatus, initialSections, initialBlockPromptOverrides = {} }: Props) {
    const { load, addBlock } = useBuilderStore()
    const [name, setName] = useState(initialName)
    const [status, setStatus] = useState(initialStatus)
    const [mode, setMode] = useState<BuilderMode>('builder')
    const [detailBlockSlug, setDetailBlockSlug] = useState<string | null>(null)

    // Initialise store: prefer localStorage auto-save, fall back to DB sections
    // Always seed blockPromptOverrides from server (localStorage doesn't store them)
    useEffect(() => {
        const saved = loadAutoSave(templateId)
        load(templateId, saved ?? initialSections, initialBlockPromptOverrides)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [templateId])

    // Start 30s auto-save interval
    useEffect(() => {
        const stop = startAutoSave(templateId, () => useBuilderStore.getState().sections)
        return stop
    }, [templateId])

    // Sync status change to DB via PATCH (best-effort, non-blocking)
    function handleStatusChange(newStatus: string) {
        setStatus(newStatus)
        fetch(`/api/admin/templates/${templateId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
        }).catch(() => {/* non-fatal */})
    }

    // Sync name change to DB via PATCH (best-effort, non-blocking)
    function handleNameChange(newName: string) {
        setName(newName)
        fetch(`/api/admin/templates/${templateId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName }),
        }).catch(() => {/* non-fatal */})
    }

    // Catalog overlay (replaces full shell subtree, preserves Zustand state)
    if (mode === 'catalog') {
        return (
            <BuilderCatalogOverlay
                onOpenBlockDetail={(slug: string) => {
                    setDetailBlockSlug(slug)
                    setMode('block-detail')
                }}
                onBack={() => setMode('builder')}
            />
        )
    }

    // Block detail overlay
    if (mode === 'block-detail' && detailBlockSlug) {
        return (
            <BuilderBlockDetailOverlay
                slug={detailBlockSlug}
                onAddToTemplate={(blockType: string) => {
                    addBlock(blockType)
                    setMode('builder')
                }}
                onBack={() => setMode('catalog')}
            />
        )
    }

    return (
        /*
         * builder-shell: 3-pane CSS grid.
         * Rendered inside AdminShell > studio-main-col > main.
         * Uses negative margin to break out of <main>'s padding,
         * then fills the remaining viewport height below the studio topbar (56px).
         */
        <div className="builder-shell builder-shell--breakout">
            <BuilderHeader
                templateId={templateId}
                templateName={name}
                templateStatus={status as 'draft' | 'review' | 'live' | 'scheduled' | 'archived'}
                onNameChange={handleNameChange}
                onStatusChange={handleStatusChange}
                mode={mode}
                onModeChange={(m) => setMode(m)}
            />
            <BuilderLibraryPane />
            <BuilderCanvasPane />
            <BuilderInspectorPane
                templateId={templateId}
                onOpenBlockDetail={(slug) => {
                    setDetailBlockSlug(slug)
                    setMode('block-detail')
                }}
            />
        </div>
    )
}
