/**
 * Editor Store (Zustand)
 * Manages editor state with undo/redo history and auto-save.
 * Features: F-06 (Undo/Redo) + F-07 (Auto-Save & Draft)
 */

import { create } from 'zustand'

// ── Types ────────────────────────────────────────────────────────────────

type BlockData = { blockType: string;[key: string]: any }

type EditorSnapshot = {
    blocks: BlockData[]
    theme: any
    timestamp: number
}

type EditorState = {
    // Data
    siteId: string | null
    blocks: BlockData[]
    theme: any
    siteName: string

    // History (F-06)
    history: EditorSnapshot[]
    historyIndex: number
    maxHistory: number

    // Save status (F-07)
    hasUnsavedChanges: boolean
    lastSavedAt: number | null
    isSaving: boolean
    saveStatus: 'idle' | 'saving' | 'saved' | 'error'
    autoSaveTimer: NodeJS.Timeout | null
}

type EditorActions = {
    // Init
    init: (siteId: string, blocks: BlockData[], theme: any, siteName: string) => void

    // Block operations (push to history)
    updateBlock: (index: number, changes: Record<string, any>) => void
    addBlock: (afterIndex: number, block: BlockData) => void
    deleteBlock: (index: number) => void
    duplicateBlock: (index: number) => void
    reorderBlocks: (fromIndex: number, toIndex: number) => void

    // Theme
    updateTheme: (changes: Record<string, any>) => void

    // Undo/Redo (F-06)
    undo: () => void
    redo: () => void
    canUndo: () => boolean
    canRedo: () => boolean

    // Save (F-07)
    handleContentChange: () => void
    performSave: (isManual?: boolean) => Promise<boolean>
    markSaved: () => void
    setIsSaving: (saving: boolean) => void

    // Reset
    reset: () => void
}

const MAX_HISTORY = 50

function createSnapshot(blocks: BlockData[], theme: any): EditorSnapshot {
    return {
        blocks: JSON.parse(JSON.stringify(blocks)),
        theme: JSON.parse(JSON.stringify(theme)),
        timestamp: Date.now(),
    }
}

export const useEditorStore = create<EditorState & EditorActions>((set, get) => ({
    // Initial state
    siteId: null,
    blocks: [],
    theme: {},
    siteName: '',
    history: [],
    historyIndex: -1,
    maxHistory: MAX_HISTORY,
    hasUnsavedChanges: false,
    lastSavedAt: null,
    isSaving: false,
    saveStatus: 'idle',
    autoSaveTimer: null,

    init: (siteId, blocks, theme, siteName) => {
        const snapshot = createSnapshot(blocks, theme)
        set({
            siteId, blocks, theme, siteName,
            history: [snapshot],
            historyIndex: 0,
            hasUnsavedChanges: false,
        })
    },

    // ── Block Operations ─────────────────────────────────────────────────

    updateBlock: (index, changes) => {
        const { blocks, theme, history, historyIndex, maxHistory } = get()
        const newBlocks = [...blocks]
        newBlocks[index] = { ...newBlocks[index], ...changes }

        const snapshot = createSnapshot(newBlocks, theme)
        const newHistory = history.slice(0, historyIndex + 1)
        if (newHistory.length >= maxHistory) newHistory.shift()
        newHistory.push(snapshot)

        set({
            blocks: newBlocks,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        })
        get().handleContentChange()
    },

    addBlock: (afterIndex, block) => {
        const { blocks, theme, history, historyIndex, maxHistory } = get()
        const newBlocks = [...blocks]
        newBlocks.splice(afterIndex + 1, 0, block)

        const snapshot = createSnapshot(newBlocks, theme)
        const newHistory = history.slice(0, historyIndex + 1)
        if (newHistory.length >= maxHistory) newHistory.shift()
        newHistory.push(snapshot)

        set({
            blocks: newBlocks,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        })
        get().handleContentChange()
    },

    deleteBlock: (index) => {
        const { blocks, theme, history, historyIndex, maxHistory } = get()
        const newBlocks = blocks.filter((_, i) => i !== index)

        const snapshot = createSnapshot(newBlocks, theme)
        const newHistory = history.slice(0, historyIndex + 1)
        if (newHistory.length >= maxHistory) newHistory.shift()
        newHistory.push(snapshot)

        set({
            blocks: newBlocks,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        })
        get().handleContentChange()
    },

    duplicateBlock: (index) => {
        const { blocks, theme, history, historyIndex, maxHistory } = get()
        const blockCopy = JSON.parse(JSON.stringify(blocks[index]))
        const newBlocks = [...blocks]
        newBlocks.splice(index + 1, 0, blockCopy)

        const snapshot = createSnapshot(newBlocks, theme)
        const newHistory = history.slice(0, historyIndex + 1)
        if (newHistory.length >= maxHistory) newHistory.shift()
        newHistory.push(snapshot)

        set({
            blocks: newBlocks,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        })
        get().handleContentChange()
    },

    reorderBlocks: (fromIndex, toIndex) => {
        const { blocks, theme, history, historyIndex, maxHistory } = get()
        const newBlocks = [...blocks]
        const [moved] = newBlocks.splice(fromIndex, 1)
        newBlocks.splice(toIndex, 0, moved)

        const snapshot = createSnapshot(newBlocks, theme)
        const newHistory = history.slice(0, historyIndex + 1)
        if (newHistory.length >= maxHistory) newHistory.shift()
        newHistory.push(snapshot)

        set({
            blocks: newBlocks,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        })
        get().handleContentChange()
    },

    // ── Theme ────────────────────────────────────────────────────────────

    updateTheme: (changes) => {
        const { blocks, theme, history, historyIndex, maxHistory } = get()
        const newTheme = { ...theme, ...changes }

        const snapshot = createSnapshot(blocks, newTheme)
        const newHistory = history.slice(0, historyIndex + 1)
        if (newHistory.length >= maxHistory) newHistory.shift()
        newHistory.push(snapshot)

        set({
            theme: newTheme,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        })
        get().handleContentChange()
    },

    // ── Undo/Redo (F-06) ────────────────────────────────────────────────

    undo: () => {
        const { historyIndex, history } = get()
        if (historyIndex <= 0) return
        const newIndex = historyIndex - 1
        const snapshot = history[newIndex]
        set({
            blocks: JSON.parse(JSON.stringify(snapshot.blocks)),
            theme: JSON.parse(JSON.stringify(snapshot.theme)),
            historyIndex: newIndex,
        })
        get().handleContentChange()
    },

    redo: () => {
        const { historyIndex, history } = get()
        if (historyIndex >= history.length - 1) return
        const newIndex = historyIndex + 1
        const snapshot = history[newIndex]
        set({
            blocks: JSON.parse(JSON.stringify(snapshot.blocks)),
            theme: JSON.parse(JSON.stringify(snapshot.theme)),
            historyIndex: newIndex,
        })
        get().handleContentChange()
    },

    canUndo: () => get().historyIndex > 0,
    canRedo: () => get().historyIndex < get().history.length - 1,

    // ── Save (F-07) ─────────────────────────────────────────────────────
    handleContentChange: () => {
        const { autoSaveTimer, siteId } = get()
        if (!siteId) return

        set({ hasUnsavedChanges: true, saveStatus: 'idle' })

        if (autoSaveTimer) clearTimeout(autoSaveTimer)

        const timer = setTimeout(() => {
            get().performSave()
        }, 3000) // 3s debounce

        set({ autoSaveTimer: timer })
    },

    performSave: async (isManual = false) => {
        const { siteId, autoSaveTimer, isSaving } = get()
        if (!siteId) return false

        // Anti-spam backpressure for manual save
        if (isManual && isSaving) return false

        if (autoSaveTimer) clearTimeout(autoSaveTimer)
        set({ isSaving: true, saveStatus: 'saving', autoSaveTimer: null })

        const RETRY_DELAYS = [5000, 10000, 20000]

        const attemptSave = async (retryCount = 0): Promise<boolean> => {
            const { blocks, theme } = get()
            try {
                const res = await fetch(`/api/sites/${siteId}/save`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ blocks, theme, isDraft: true }),
                })

                if (res.ok) {
                    set({
                        hasUnsavedChanges: false,
                        saveStatus: 'saved',
                        lastSavedAt: Date.now(),
                        isSaving: false,
                    })
                    return true
                } else {
                    if (res.status === 401) {
                        set({ saveStatus: 'error', isSaving: false })
                        return false
                    }
                    throw new Error('Save failed')
                }
            } catch (err) {
                set({ saveStatus: 'error', isSaving: false })
                if (retryCount < RETRY_DELAYS.length) {
                    const timer = setTimeout(() => {
                        set({ isSaving: true, saveStatus: 'saving' })
                        attemptSave(retryCount + 1)
                    }, RETRY_DELAYS[retryCount])
                    set({ autoSaveTimer: timer })
                }
                return false
            }
        }

        return await attemptSave(0)
    },

    markSaved: () => set({ hasUnsavedChanges: false, lastSavedAt: Date.now(), saveStatus: 'saved' }),
    setIsSaving: (saving) => set({ isSaving: saving }),

    reset: () => set({
        siteId: null, blocks: [], theme: {}, siteName: '',
        history: [], historyIndex: -1,
        hasUnsavedChanges: false, lastSavedAt: null, isSaving: false,
    }),
}))
