'use client'
/**
 * builder-shell.tsx
 * 3-pane layout orchestrator. Initialises Zustand store from server-fetched
 * sections, wires auto-save, and composes Library | Canvas | Inspector.
 */
import { useEffect, useState } from 'react'
import { useBuilderStore } from '@/lib/admin/builder-store'
import type { Section } from '@/lib/admin/builder-store'
import { startAutoSave, loadAutoSave } from '@/lib/admin/builder-auto-save'
import { BuilderHeader } from './builder-header'
import { BuilderLibraryPane } from './builder-library-pane'
import { BuilderCanvasPane } from './builder-canvas-pane'
import { BuilderInspectorPane } from './builder-inspector-pane'

interface Props {
    templateId: number
    initialName: string
    initialStatus: string
    initialSections: Section[]
}

export function BuilderShell({ templateId, initialName, initialStatus, initialSections }: Props) {
    const { load, sections } = useBuilderStore()
    const [name, setName] = useState(initialName)
    const [status, setStatus] = useState(initialStatus)

    // Initialise store: prefer localStorage auto-save, fall back to DB sections
    useEffect(() => {
        const saved = loadAutoSave(templateId)
        load(templateId, saved ?? initialSections)
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

    return (
        <div className="flex flex-col h-screen overflow-hidden">
            <BuilderHeader
                templateId={templateId}
                templateName={name}
                templateStatus={status as 'draft' | 'review' | 'live' | 'scheduled' | 'archived'}
                onNameChange={handleNameChange}
                onStatusChange={handleStatusChange}
            />

            {/* 3-pane body */}
            <div className="flex flex-1 min-h-0 divide-x">
                {/* Library — fixed width */}
                <div className="w-56 flex-shrink-0 overflow-hidden">
                    <BuilderLibraryPane />
                </div>

                {/* Canvas — flexible */}
                <div className="flex-1 min-w-0 overflow-hidden bg-muted/20">
                    <BuilderCanvasPane />
                </div>

                {/* Inspector — fixed width */}
                <div className="w-64 flex-shrink-0 overflow-hidden">
                    <BuilderInspectorPane />
                </div>
            </div>

            {/* Footer status bar */}
            <div className="border-t px-4 py-1 flex items-center gap-3 text-[10px] text-muted-foreground bg-background flex-shrink-0">
                <span>{sections.length} section{sections.length !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span>Auto-saves every 30s to browser storage</span>
            </div>
        </div>
    )
}
