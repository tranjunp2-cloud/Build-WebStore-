'use client'
/**
 * builder-store.ts
 * Zustand store for the 3-pane template builder.
 * Manages sections state + mutations.
 */
import { create } from 'zustand'

export interface Section {
    /** Unique ID — crypto.randomUUID() */
    id: string
    blockType: string
    config: Record<string, unknown>
}

interface BuilderState {
    templateId: number
    sections: Section[]
    selectedId: string | null
    dirty: boolean

    // Mutations
    load: (templateId: number, sections: Section[]) => void
    addBlock: (type: string, atIdx?: number) => void
    reorder: (fromIdx: number, toIdx: number) => void
    updateSelected: (patch: Record<string, unknown>) => void
    patchSection: (id: string, patch: Record<string, unknown>) => void
    deleteSection: (id: string) => void
    duplicateSection: (id: string) => void
    select: (id: string | null) => void
    markClean: () => void
}

function makeId(): string {
    return typeof crypto !== 'undefined'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const useBuilderStore = create<BuilderState>((set, get) => ({
    templateId: 0,
    sections: [],
    selectedId: null,
    dirty: false,

    load(templateId, sections) {
        set({ templateId, sections, selectedId: null, dirty: false })
    },

    addBlock(type, atIdx) {
        const newSection: Section = { id: makeId(), blockType: type, config: {} }
        set((state) => {
            const next = [...state.sections]
            const insertAt = atIdx != null ? Math.min(atIdx, next.length) : next.length
            next.splice(insertAt, 0, newSection)
            return { sections: next, selectedId: newSection.id, dirty: true }
        })
    },

    reorder(fromIdx, toIdx) {
        set((state) => {
            const next = [...state.sections]
            const [moved] = next.splice(fromIdx, 1)
            next.splice(toIdx, 0, moved)
            return { sections: next, dirty: true }
        })
    },

    updateSelected(patch) {
        const { selectedId } = get()
        if (!selectedId) return
        set((state) => ({
            sections: state.sections.map((s) =>
                s.id === selectedId
                    ? { ...s, config: { ...s.config, ...patch } }
                    : s,
            ),
            dirty: true,
        }))
    },

    patchSection(id, patch) {
        set((state) => ({
            sections: state.sections.map((s) =>
                s.id === id ? { ...s, config: { ...s.config, ...patch } } : s,
            ),
            dirty: true,
        }))
    },

    deleteSection(id) {
        set((state) => {
            const next = state.sections.filter((s) => s.id !== id)
            const selectedId = state.selectedId === id ? null : state.selectedId
            return { sections: next, selectedId, dirty: true }
        })
    },

    duplicateSection(id) {
        set((state) => {
            const idx = state.sections.findIndex((s) => s.id === id)
            if (idx === -1) return state
            const orig = state.sections[idx]
            const copy: Section = { id: makeId(), blockType: orig.blockType, config: { ...orig.config } }
            const next = [...state.sections]
            next.splice(idx + 1, 0, copy)
            return { sections: next, selectedId: copy.id, dirty: true }
        })
    },

    select(id) {
        set({ selectedId: id })
    },

    markClean() {
        set({ dirty: false })
    },
}))
