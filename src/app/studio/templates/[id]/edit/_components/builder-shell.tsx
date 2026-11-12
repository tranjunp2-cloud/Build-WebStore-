'use client'
/**
 * builder-shell.tsx
 * 3-pane layout orchestrator. Initialises Zustand store from server-fetched
 * sections, wires auto-save, and composes Library | Canvas | Inspector.
 * Mode state machine: 'builder' | 'catalog' | 'block-detail' (Phase A).
 * Visual re-skin: uses builder-shell CSS grid from bundle (builder.css).
 */
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useBuilderStore } from '@/lib/admin/builder-store'
import type { Section, BlockPromptOverride } from '@/lib/admin/builder-store'
import { startAutoSave, loadAutoSave } from '@/lib/admin/builder-auto-save'
import { canEditTemplateContent } from '@/lib/admin/studio-permissions'
import { useStudioRoles } from '../../../../_components/studio-permissions-context'
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
    const roles = useStudioRoles()
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

    // Status only changes in the UI once the server accepted it; a refused move keeps the old status.
    async function handleStatusChange(newStatus: string): Promise<boolean> {
        try {
            const res = await fetch(`/api/admin/templates/${templateId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
            }
            setStatus(newStatus)
            return true
        } catch (err) {
            toast.error(`Status change failed: ${err instanceof Error ? err.message : String(err)}`)
            return false
        }
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

    const canEdit = canEditTemplateContent(roles, status)

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
                canAdd={canEdit}
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
            <BuilderLibraryPane canEdit={canEdit} />
            <BuilderCanvasPane canEdit={canEdit} />
            <BuilderInspectorPane
                templateId={templateId}
                canEdit={canEdit}
                onOpenBlockDetail={(slug) => {
                    setDetailBlockSlug(slug)
                    setMode('block-detail')
                }}
            />
        </div>
    )
}
