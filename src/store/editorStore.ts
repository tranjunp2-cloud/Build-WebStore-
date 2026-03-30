/**
 * Editor Store (Zustand)
 * Manages editor state with undo/redo history and auto-save.
 * Features: F-11 (Undo/Redo) + F-07 (Auto-Save & Draft)
 */

import { create } from 'zustand'

// ── Types ────────────────────────────────────────────────────────────────

export type BlockData = { blockType: string;[key: string]: unknown }

export type UndoActionSource = 'ai_chat' | 'inline_edit' | 'manual' | 'theme_change'

type EditorSnapshot = {
    id: string
    blocks: BlockData[]
    theme: ThemeState
    headerBlock: BlockData | null
    footerBlock: BlockData | null
    timestamp: number
    label?: string           // "Changed hero title"
    source?: UndoActionSource
}

export type PageData = {
    id: string
    title: string
    slug: string
    status: 'published' | 'draft'
    isHomepage?: boolean
    isVisible: boolean
    seoTitle?: string | null
    seoDescription?: string | null
    error?: string | null
    deletedAt?: string | null
    updatedAt: string
}

type EditorState = {
    // Data
    siteId: string | null
    blocks: BlockData[]
    theme: ThemeState
    siteName: string

    // Global Header/Footer (F-05-07)
    headerBlock: BlockData | null
    footerBlock: BlockData | null

    // Pages (F-05-02)
    pages: PageData[]
    currentPageId: string | null

    // History (F-06 / F-11)
    history: EditorSnapshot[]
    historyIndex: number
    maxHistory: number

    // AI streaming guard (F-11)
    isAIStreaming: boolean

    // Save status (F-07)
    hasUnsavedChanges: boolean
    lastSavedAt: number | null
    isSaving: boolean
    saveStatus: 'idle' | 'saving' | 'saved' | 'error'
    autoSaveTimer: NodeJS.Timeout | null
    autoSaveEnabled: boolean
    autoSaveIntervalMs: number
}

type ThemeState = Record<string, string | number | boolean | null | unknown>
type BlockPatch = Record<string, unknown>

type EditorActions = {
    // Init
    init: (siteId: string, blocks: BlockData[], theme: ThemeState, siteName: string, headerBlock?: BlockData | null, footerBlock?: BlockData | null) => void

    // Pages (F-05-02)
    setPages: (pages: PageData[]) => void
    setCurrentPageId: (pageId: string) => void
    addPageToState: (page: PageData) => void
    updatePageInState: (id: string, data: Partial<PageData>) => void
    removePageFromState: (id: string) => void

    // Block operations (push to history)
    updateBlock: (index: number, changes: BlockPatch, label?: string) => void
    addBlock: (afterIndex: number, block: BlockData, label?: string) => void
    deleteBlock: (index: number, label?: string) => void
    duplicateBlock: (index: number) => void
    reorderBlocks: (fromIndex: number, toIndex: number) => void

    // Theme
    updateTheme: (changes: ThemeState, label?: string) => void

    // Header/Footer (F-05-07)
    updateHeaderBlock: (changes: BlockPatch) => void
    updateFooterBlock: (changes: BlockPatch) => void

    // AI Batch (F-11) — push ALL AI changes as a single undoable action
    pushBatch: (blocks: BlockData[], theme: ThemeState, label: string) => void

    // Undo/Redo (F-06 / F-11)
    undo: () => void
    redo: () => void
    canUndo: () => boolean
    canRedo: () => boolean
    undoLabel: () => string | undefined
    redoLabel: () => string | undefined

    // AI streaming state (F-11)
    setIsAIStreaming: (streaming: boolean) => void

    // Save (F-07)
    handleContentChange: () => void
    performSave: (isManual?: boolean) => Promise<boolean>
    markSaved: () => void
    setIsSaving: (saving: boolean) => void

    // Reset
    reset: () => void
}

const MAX_HISTORY = 50

function createSnapshot(
    blocks: BlockData[],
    theme: ThemeState,
    headerBlock: BlockData | null = null,
    footerBlock: BlockData | null = null,
    label?: string,
    source?: UndoActionSource,
): EditorSnapshot {
    return {
        id: crypto.randomUUID(),
        blocks: JSON.parse(JSON.stringify(blocks)),
        theme: JSON.parse(JSON.stringify(theme)),
        headerBlock: headerBlock ? JSON.parse(JSON.stringify(headerBlock)) : null,
        footerBlock: footerBlock ? JSON.parse(JSON.stringify(footerBlock)) : null,
        timestamp: Date.now(),
        label,
        source,
    }
}

function pushSnapshot(
    history: EditorSnapshot[],
    historyIndex: number,
    maxHistory: number,
    snapshot: EditorSnapshot,
) {
    // Slice off any redo branch (branch cut-off rule BR-01)
    const newHistory = history.slice(0, historyIndex + 1)
    if (newHistory.length >= maxHistory) newHistory.shift()
    newHistory.push(snapshot)
    return newHistory
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
    isAIStreaming: false,
    hasUnsavedChanges: false,
    lastSavedAt: null,
    isSaving: false,
    autoSaveEnabled: true,
    autoSaveIntervalMs: 3000,
    saveStatus: 'idle',
    autoSaveTimer: null,

    init: (siteId, blocks, theme, siteName, headerBlock = null, footerBlock = null) => {
        const fallbackHeader = blocks.find(b => b.blockType === 'navigation')
        const fallbackFooter = blocks.find(b => b.blockType === 'footer')

        const effectiveHeader = headerBlock || (fallbackHeader ? JSON.parse(JSON.stringify(fallbackHeader)) : { blockType: 'navigation', links: [] })
        const effectiveFooter = footerBlock || (fallbackFooter ? JSON.parse(JSON.stringify(fallbackFooter)) : { blockType: 'footer' })

        const snapshot = createSnapshot(blocks, theme, effectiveHeader, effectiveFooter, 'Initial state', 'manual')
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

    updateBlock: (index, changes, label) => {
        const { blocks, theme, headerBlock, footerBlock, history, historyIndex, maxHistory } = get()
        const newBlocks = [...blocks]
        newBlocks[index] = { ...newBlocks[index], ...changes }

        const snapshot = createSnapshot(newBlocks, theme, headerBlock, footerBlock, label ?? `Edited ${newBlocks[index].blockType}`, 'inline_edit')
        const newHistory = pushSnapshot(history, historyIndex, maxHistory, snapshot)

        set({
            blocks: newBlocks,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        })
        get().handleContentChange()
    },

    addBlock: (afterIndex, block, label) => {
        const { blocks, theme, headerBlock, footerBlock, history, historyIndex, maxHistory } = get()
        const newBlocks = [...blocks]
        newBlocks.splice(afterIndex + 1, 0, block)

        const snapshot = createSnapshot(newBlocks, theme, headerBlock, footerBlock, label ?? `Added ${block.blockType}`, 'manual')
        const newHistory = pushSnapshot(history, historyIndex, maxHistory, snapshot)

        set({
            blocks: newBlocks,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        })
        get().handleContentChange()
    },

    deleteBlock: (index, label) => {
        const { blocks, theme, headerBlock, footerBlock, history, historyIndex, maxHistory } = get()
        const blockType = blocks[index]?.blockType ?? 'block'
        const newBlocks = blocks.filter((_, i) => i !== index)

        const snapshot = createSnapshot(newBlocks, theme, headerBlock, footerBlock, label ?? `Deleted ${blockType}`, 'manual')
        const newHistory = pushSnapshot(history, historyIndex, maxHistory, snapshot)

        set({
            blocks: newBlocks,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        })
        get().handleContentChange()
    },

    duplicateBlock: (index) => {
        const { blocks, theme, headerBlock, footerBlock, history, historyIndex, maxHistory } = get()
        const blockCopy = JSON.parse(JSON.stringify(blocks[index]))
        const newBlocks = [...blocks]
        newBlocks.splice(index + 1, 0, blockCopy)

        const snapshot = createSnapshot(newBlocks, theme, headerBlock, footerBlock, `Duplicated ${blocks[index]?.blockType}`, 'manual')
        const newHistory = pushSnapshot(history, historyIndex, maxHistory, snapshot)

        set({
            blocks: newBlocks,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        })
        get().handleContentChange()
    },

    reorderBlocks: (fromIndex, toIndex) => {
        const { blocks, theme, headerBlock, footerBlock, history, historyIndex, maxHistory } = get()
        const newBlocks = [...blocks]
        const [moved] = newBlocks.splice(fromIndex, 1)
        newBlocks.splice(toIndex, 0, moved)

        const snapshot = createSnapshot(newBlocks, theme, headerBlock, footerBlock, `Moved ${moved?.blockType}`, 'manual')
        const newHistory = pushSnapshot(history, historyIndex, maxHistory, snapshot)

        set({
            blocks: newBlocks,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        })
        get().handleContentChange()
    },

    // ── Theme ────────────────────────────────────────────────────────────

    updateTheme: (changes, label) => {
        const { blocks, theme, headerBlock, footerBlock, history, historyIndex, maxHistory } = get()
        const newTheme = { ...theme, ...changes }

        const snapshot = createSnapshot(blocks, newTheme, headerBlock, footerBlock, label ?? 'Updated theme', 'theme_change')
        const newHistory = pushSnapshot(history, historyIndex, maxHistory, snapshot)

        set({
            theme: newTheme,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        })
        get().handleContentChange()
    },

    // ── AI Batch (F-11) ─────────────────────────────────────────────────
    // Groups an entire AI response into EXACTLY 1 undoable action (BR-02)

    pushBatch: (blocks, theme, label) => {
        const { headerBlock, footerBlock, history, historyIndex, maxHistory } = get()
        const snapshot = createSnapshot(blocks, theme, headerBlock, footerBlock, label, 'ai_chat')
        const newHistory = pushSnapshot(history, historyIndex, maxHistory, snapshot)

        set({
            blocks: JSON.parse(JSON.stringify(blocks)),
            theme: JSON.parse(JSON.stringify(theme)),
            history: newHistory,
            historyIndex: newHistory.length - 1,
            hasUnsavedChanges: true,
        })
    },

    // ── Undo/Redo (F-11) ────────────────────────────────────────────────

    undo: () => {
        const { historyIndex, history, isAIStreaming } = get()
        if (isAIStreaming || historyIndex <= 0) return
        const newIndex = historyIndex - 1
        const snapshot = history[newIndex]

        set({
            blocks: JSON.parse(JSON.stringify(snapshot.blocks)),
            theme: JSON.parse(JSON.stringify(snapshot.theme)),
            headerBlock: snapshot.headerBlock ? JSON.parse(JSON.stringify(snapshot.headerBlock)) : null,
            footerBlock: snapshot.footerBlock ? JSON.parse(JSON.stringify(snapshot.footerBlock)) : null,
            historyIndex: newIndex,
        })
        get().handleContentChange()
    },

    redo: () => {
        const { historyIndex, history, isAIStreaming } = get()
        if (isAIStreaming || historyIndex >= history.length - 1) return
        const newIndex = historyIndex + 1
        const snapshot = history[newIndex]

        set({
            blocks: JSON.parse(JSON.stringify(snapshot.blocks)),
            theme: JSON.parse(JSON.stringify(snapshot.theme)),
            headerBlock: snapshot.headerBlock ? JSON.parse(JSON.stringify(snapshot.headerBlock)) : null,
            footerBlock: snapshot.footerBlock ? JSON.parse(JSON.stringify(snapshot.footerBlock)) : null,
            historyIndex: newIndex,
        })
        get().handleContentChange()
    },

    canUndo: () => {
        const { historyIndex, isAIStreaming } = get()
        return !isAIStreaming && historyIndex > 0
    },
    canRedo: () => {
        const { historyIndex, history, isAIStreaming } = get()
        return !isAIStreaming && historyIndex < history.length - 1
    },

    undoLabel: () => {
        const { historyIndex, history } = get()
        if (historyIndex <= 0) return undefined
        return history[historyIndex]?.label
    },

    redoLabel: () => {
        const { historyIndex, history } = get()
        if (historyIndex >= history.length - 1) return undefined
        return history[historyIndex + 1]?.label
    },

    // ── AI Streaming Guard (F-11) ────────────────────────────────────────

    setIsAIStreaming: (streaming) => set({ isAIStreaming: streaming }),

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

    // ── Header/Footer (F-05-07) ──────────────────────────────────────────

    updateHeaderBlock: (changes) => {
        const { blocks, theme, headerBlock, footerBlock, history, historyIndex, maxHistory } = get()
        const newHeader = headerBlock ? { ...headerBlock, ...changes } : { blockType: 'navigation', ...changes }

        const snapshot = createSnapshot(blocks, theme, newHeader, footerBlock, 'Updated Header', 'inline_edit')
        const newHistory = pushSnapshot(history, historyIndex, maxHistory, snapshot)

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

        const snapshot = createSnapshot(blocks, theme, headerBlock, newFooter, 'Updated Footer', 'inline_edit')
        const newHistory = pushSnapshot(history, historyIndex, maxHistory, snapshot)

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
        isAIStreaming: false,
        hasUnsavedChanges: false, lastSavedAt: null, isSaving: false,
        autoSaveEnabled: true, autoSaveIntervalMs: 3000,
        saveStatus: 'idle', autoSaveTimer: null,
    }),
}))
