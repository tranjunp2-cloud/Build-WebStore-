/**
 * Workspace Store (Zustand) — Editor layout preferences.
 * Controls left/right sidebar visibility + layout preset.
 * Persisted to localStorage so SME's preferred workspace survives reload.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type WorkspacePreset = 'default' | 'focus' | 'structure' | 'content'

type WorkspaceState = {
    leftSidebarVisible: boolean
    rightSidebarVisible: boolean
    preset: WorkspacePreset
}

type WorkspaceActions = {
    toggleLeft: () => void
    toggleRight: () => void
    applyPreset: (preset: WorkspacePreset) => void
}

const PRESET_VISIBILITY: Record<WorkspacePreset, { left: boolean; right: boolean }> = {
    default: { left: true, right: true },
    focus: { left: false, right: false },
    structure: { left: true, right: false },
    content: { left: false, right: true },
}

function derivePreset(left: boolean, right: boolean): WorkspacePreset {
    if (left && right) return 'default'
    if (!left && !right) return 'focus'
    if (left && !right) return 'structure'
    return 'content'
}

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>()(
    persist(
        (set) => ({
            leftSidebarVisible: true,
            rightSidebarVisible: true,
            preset: 'default',

            toggleLeft: () =>
                set((s) => {
                    const next = !s.leftSidebarVisible
                    return {
                        leftSidebarVisible: next,
                        preset: derivePreset(next, s.rightSidebarVisible),
                    }
                }),

            toggleRight: () =>
                set((s) => {
                    const next = !s.rightSidebarVisible
                    return {
                        rightSidebarVisible: next,
                        preset: derivePreset(s.leftSidebarVisible, next),
                    }
                }),

            applyPreset: (preset) =>
                set(() => ({
                    preset,
                    leftSidebarVisible: PRESET_VISIBILITY[preset].left,
                    rightSidebarVisible: PRESET_VISIBILITY[preset].right,
                })),
        }),
        {
            name: 'editor-workspace-layout',
            storage: createJSONStorage(() => localStorage),
            version: 1,
        },
    ),
)
