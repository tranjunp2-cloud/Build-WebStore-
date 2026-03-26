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
    headerBlock: BlockData | null
    footerBlock: BlockData | null
    timestamp: number
}

export type PageData = {
    id: string
    title: string
    slug: string
    status: 'published' | 'draft'
    isHomepage?: boolean
    isVisible: boolean
    deletedAt?: string | null
    updatedAt: string
}

type EditorState = {
    // Data
    siteId: string | null
    blocks: BlockData[]
    theme: any
    siteName: string

    // Global Header/Footer (F-05-07)
    headerBlock: BlockData | null
    footerBlock: BlockData | null

    // Pages (F-05-02)
    pages: PageData[]
    currentPageId: string | null

    // History (F-06)
    history: EditorSnapshot[]
    historyIndex: number
    maxHistory: number

    // Save status (F-07)
    hasUnsavedChanges: boolean
    lastSavedAt: number | null
    isSaving: boolean
    autoSaveEnabled: boolean
    autoSaveIntervalMs: number
}

type EditorActions = {
    // Init
    init: (siteId: string, blocks: BlockData[], theme: any, siteName: string, headerBlock?: BlockData | null, footerBlock?: BlockData | null) => void

    // Pages (F-05-02)
    setPages: (pages: PageData[]) => void
    setCurrentPageId: (pageId: string) => void
    addPageToState: (page: PageData) => void
    updatePageInState: (id: string, data: Partial<PageData>) => void
    removePageFromState: (id: string) => void

    // Block operations (push to history)
    updateBlock: (index: number, changes: Record<string, any>) => void
    addBlock: (afterIndex: number, block: BlockData) => void
    deleteBlock: (index: number) => void
    duplicateBlock: (index: number) => void
    reorderBlocks: (fromIndex: number, toIndex: number) => void

    // Theme
    updateTheme: (changes: Record<string, any>) => void

    // Header/Footer (F-05-07)
    updateHeaderBlock: (changes: Record<string, any>) => void
    updateFooterBlock: (changes: Record<string, any>) => void

    // Undo/Redo (F-06)
    undo: () => void
    redo: () => void
    canUndo: () => boolean
    canRedo: () => boolean

    // Save (F-07)
    markSaved: () => void
    setIsSaving: (saving: boolean) => void

    // Reset
    reset: () => void
}

const MAX_HISTORY = 50

function createSnapshot(blocks: BlockData[], theme: any, headerBlock: BlockData | null = null, footerBlock: BlockData | null = null): EditorSnapshot {
    return {
        blocks: JSON.parse(JSON.stringify(blocks)),
        theme: JSON.parse(JSON.stringify(theme)),
        headerBlock: headerBlock ? JSON.parse(JSON.stringify(headerBlock)) : null,
        footerBlock: footerBlock ? JSON.parse(JSON.stringify(footerBlock)) : null,
        timestamp: Date.now(),
    }
}

export const useEditorStore = create<EditorState & EditorActions>((set, get) => ({
    // Initial state
    siteId: null,
    blocks: [],
    theme: {},
    siteName: '',
    headerBlock: null,
    footerBlock: null,
    pages: [],
    currentPageId: null,
    history: [],
    historyIndex: -1,
    maxHistory: MAX_HISTORY,
    hasUnsavedChanges: false,
    lastSavedAt: null,
    isSaving: false,
    autoSaveEnabled: true,
    autoSaveIntervalMs: 3000, // 3s

    init: (siteId, blocks, theme, siteName, headerBlock = null, footerBlock = null) => {
        const fallbackHeader = blocks.find(b => b.blockType === 'navigation')
        const fallbackFooter = blocks.find(b => b.blockType === 'footer')

        const effectiveHeader = headerBlock || (fallbackHeader ? JSON.parse(JSON.stringify(fallbackHeader)) : { blockType: 'navigation', links: [] })
        const effectiveFooter = footerBlock || (fallbackFooter ? JSON.parse(JSON.stringify(fallbackFooter)) : { blockType: 'footer' })

        const snapshot = createSnapshot(blocks, theme, effectiveHeader, effectiveFooter)

        set({
            siteId,
            blocks,
            theme,
            siteName,
            headerBlock: effectiveHeader,
            footerBlock: effectiveFooter,
            history: [snapshot],
            historyIndex: 0,
            hasUnsavedChanges: false,
            lastSavedAt: null,
        })
    },

    // ── Pages Operations ──────────────────────────────────────────────────

    setPages: (pages) => set({ pages }),
    setCurrentPageId: (currentPageId) => set({ currentPageId }),
    addPageToState: (page) => set((state) => ({ pages: [...state.pages, page] })),
    updatePageInState: (id, data) => set((state) => ({
        pages: state.pages.map((p) => p.id === id ? { ...p, ...data } : p)
    })),
    removePageFromState: (id) => set((state) => ({
        pages: state.pages.filter((p) => p.id !== id)
    })),

    // ── Block Operations ─────────────────────────────────────────────────

    updateBlock: (index, changes) => {
        const { blocks, theme, headerBlock, footerBlock, history, historyIndex, maxHistory } = get()
        const newBlocks = [...blocks]
        newBlocks[index] = { ...newBlocks[index], ...changes }

        const snapshot = createSnapshot(newBlocks, theme, headerBlock, footerBlock)
        const newHistory = history.slice(0, historyIndex + 1)
        if (newHistory.length >= maxHistory) newHistory.shift()
        newHistory.push(snapshot)

        set({
            blocks: newBlocks,
            history: newHistory,
            historyIndex: newHistory.length - 1,
            hasUnsavedChanges: true,
        })
    },

    addBlock: (afterIndex, block) => {
        const { blocks, theme, headerBlock, footerBlock, history, historyIndex, maxHistory } = get()
        const newBlocks = [...blocks]
        newBlocks.splice(afterIndex + 1, 0, block)

        const snapshot = createSnapshot(newBlocks, theme, headerBlock, footerBlock)
        const newHistory = history.slice(0, historyIndex + 1)
        if (newHistory.length >= maxHistory) newHistory.shift()
        newHistory.push(snapshot)

        set({
            blocks: newBlocks,
            history: newHistory,
            historyIndex: newHistory.length - 1,
            hasUnsavedChanges: true,
        })
    },

    deleteBlock: (index) => {
        const { blocks, theme, headerBlock, footerBlock, history, historyIndex, maxHistory } = get()
        const newBlocks = blocks.filter((_, i) => i !== index)

        const snapshot = createSnapshot(newBlocks, theme, headerBlock, footerBlock)
        const newHistory = history.slice(0, historyIndex + 1)
        if (newHistory.length >= maxHistory) newHistory.shift()
        newHistory.push(snapshot)

        set({
            blocks: newBlocks,
            history: newHistory,
            historyIndex: newHistory.length - 1,
            hasUnsavedChanges: true,
        })
    },

    duplicateBlock: (index) => {
        const { blocks, theme, headerBlock, footerBlock, history, historyIndex, maxHistory } = get()
        const blockCopy = JSON.parse(JSON.stringify(blocks[index]))
        const newBlocks = [...blocks]
        newBlocks.splice(index + 1, 0, blockCopy)

        const snapshot = createSnapshot(newBlocks, theme, headerBlock, footerBlock)
        const newHistory = history.slice(0, historyIndex + 1)
        if (newHistory.length >= maxHistory) newHistory.shift()
        newHistory.push(snapshot)

        set({
            blocks: newBlocks,
            history: newHistory,
            historyIndex: newHistory.length - 1,
            hasUnsavedChanges: true,
        })
    },

    reorderBlocks: (fromIndex, toIndex) => {
        const { blocks, theme, headerBlock, footerBlock, history, historyIndex, maxHistory } = get()
        const newBlocks = [...blocks]
        const [moved] = newBlocks.splice(fromIndex, 1)
        newBlocks.splice(toIndex, 0, moved)

        const snapshot = createSnapshot(newBlocks, theme, headerBlock, footerBlock)
        const newHistory = history.slice(0, historyIndex + 1)
        if (newHistory.length >= maxHistory) newHistory.shift()
        newHistory.push(snapshot)

        set({
            blocks: newBlocks,
            history: newHistory,
            historyIndex: newHistory.length - 1,
            hasUnsavedChanges: true,
        })
    },

    // ── Theme ────────────────────────────────────────────────────────────

    updateTheme: (changes) => {
        const { blocks, theme, headerBlock, footerBlock, history, historyIndex, maxHistory } = get()
        const newTheme = { ...theme, ...changes }

        const snapshot = createSnapshot(blocks, newTheme, headerBlock, footerBlock)
        const newHistory = history.slice(0, historyIndex + 1)
        if (newHistory.length >= maxHistory) newHistory.shift()
        newHistory.push(snapshot)

        set({
            theme: newTheme,
            history: newHistory,
            historyIndex: newHistory.length - 1,
            hasUnsavedChanges: true,
        })
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
            headerBlock: snapshot.headerBlock ? JSON.parse(JSON.stringify(snapshot.headerBlock)) : null,
            footerBlock: snapshot.footerBlock ? JSON.parse(JSON.stringify(snapshot.footerBlock)) : null,
            historyIndex: newIndex,
            hasUnsavedChanges: true,
        })
    },

    redo: () => {
        const { historyIndex, history } = get()
        if (historyIndex >= history.length - 1) return
        const newIndex = historyIndex + 1
        const snapshot = history[newIndex]
        set({
            blocks: JSON.parse(JSON.stringify(snapshot.blocks)),
            theme: JSON.parse(JSON.stringify(snapshot.theme)),
            headerBlock: snapshot.headerBlock ? JSON.parse(JSON.stringify(snapshot.headerBlock)) : null,
            footerBlock: snapshot.footerBlock ? JSON.parse(JSON.stringify(snapshot.footerBlock)) : null,
            historyIndex: newIndex,
            hasUnsavedChanges: true,
        })
    },

    canUndo: () => get().historyIndex > 0,
    canRedo: () => get().historyIndex < get().history.length - 1,

    // ── Save (F-07) ─────────────────────────────────────────────────────

    markSaved: () => set({ hasUnsavedChanges: false, lastSavedAt: Date.now() }),
    setIsSaving: (saving) => set({ isSaving: saving }),

    // ── Header/Footer (F-05-07) ──────────────────────────────────────────

    updateHeaderBlock: (changes) => {
        const { blocks, theme, headerBlock, footerBlock, history, historyIndex, maxHistory } = get()
        const newHeader = headerBlock ? { ...headerBlock, ...changes } : { blockType: 'navigation', ...changes }

        const snapshot = createSnapshot(blocks, theme, newHeader, footerBlock)
        const newHistory = history.slice(0, historyIndex + 1)
        if (newHistory.length >= maxHistory) newHistory.shift()
        newHistory.push(snapshot)

        set({
            headerBlock: newHeader,
            history: newHistory,
            historyIndex: newHistory.length - 1,
            hasUnsavedChanges: true,
        })
    },

    updateFooterBlock: (changes) => {
        const { blocks, theme, headerBlock, footerBlock, history, historyIndex, maxHistory } = get()
        const newFooter = footerBlock ? { ...footerBlock, ...changes } : { blockType: 'footer', ...changes }

        const snapshot = createSnapshot(blocks, theme, headerBlock, newFooter)
        const newHistory = history.slice(0, historyIndex + 1)
        if (newHistory.length >= maxHistory) newHistory.shift()
        newHistory.push(snapshot)

        set({
            footerBlock: newFooter,
            history: newHistory,
            historyIndex: newHistory.length - 1,
            hasUnsavedChanges: true,
        })
    },

    reset: () => set({
        siteId: null, blocks: [], theme: {}, siteName: '',
        headerBlock: null, footerBlock: null,
        pages: [], currentPageId: null,
        history: [], historyIndex: -1,
        hasUnsavedChanges: false, lastSavedAt: null, isSaving: false,
        autoSaveEnabled: true, autoSaveIntervalMs: 3000,
    }),
}))
