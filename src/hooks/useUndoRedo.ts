'use client'

import { useEffect } from 'react'
import { useEditorStore } from '@/store/editorStore'

/**
 * useUndoRedo — keyboard shortcut hook for F11 Undo/Redo
 *
 * Binds:
 *   Ctrl+Z / Cmd+Z        → undo()
 *   Ctrl+Y / Cmd+Shift+Z  → redo()
 *
 * Safety rules:
 *   1. Does nothing if AI is streaming (isAIStreaming = true)
 *   2. Does NOT intercept Ctrl+Z when focus is inside a native input/contentEditable
 *      (lets the browser handle native text undo instead — TC-F11.19)
 */
export function useUndoRedo() {
    const undo = useEditorStore((s) => s.undo)
    const redo = useEditorStore((s) => s.redo)
    const canUndo = useEditorStore((s) => s.canUndo)
    const canRedo = useEditorStore((s) => s.canRedo)

    useEffect(() => {
        const isNativeInput = () => {
            const el = document.activeElement
            if (!el) return false
            const tag = el.tagName.toLowerCase()
            if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
            if ((el as HTMLElement).isContentEditable) return true
            return false
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            const isMac = navigator.platform.toUpperCase().includes('MAC')
            const ctrl = isMac ? e.metaKey : e.ctrlKey

            if (!ctrl) return

            // Undo: Ctrl+Z / Cmd+Z
            if (e.key === 'z' && !e.shiftKey) {
                if (isNativeInput()) return  // Let browser handle native undo
                if (!canUndo()) return
                e.preventDefault()
                undo()
                return
            }

            // Redo: Ctrl+Y / Ctrl+Shift+Z / Cmd+Shift+Z
            if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
                if (isNativeInput()) return
                if (!canRedo()) return
                e.preventDefault()
                redo()
                return
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [undo, redo, canUndo, canRedo])
}
