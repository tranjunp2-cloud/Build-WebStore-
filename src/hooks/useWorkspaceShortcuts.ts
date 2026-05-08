'use client'

import { useEffect } from 'react'
import { useWorkspaceStore } from '@/store/workspaceStore'

/**
 * useWorkspaceShortcuts — keyboard shortcuts for editor workspace layout.
 *
 * Binds:
 *   Ctrl+B / Cmd+B  → toggle Left Sidebar
 *   Ctrl+J / Cmd+J  → toggle Right Sidebar
 *
 * Skips when focus is inside a native input/contentEditable so users can
 * type 'b' or 'j' freely while editing text. Also ignores when Shift/Alt
 * are held (those combos may belong to other features).
 */
export function useWorkspaceShortcuts() {
    const toggleLeft = useWorkspaceStore((s) => s.toggleLeft)
    const toggleRight = useWorkspaceStore((s) => s.toggleRight)

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

            if (!ctrl || e.shiftKey || e.altKey) return
            if (isNativeInput()) return

            const key = e.key.toLowerCase()
            if (key === 'b') {
                e.preventDefault()
                toggleLeft()
                return
            }
            if (key === 'j') {
                e.preventDefault()
                toggleRight()
                return
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [toggleLeft, toggleRight])
}
