/**
 * Editor Store (Zustand)
 * Manages editor state with undo/redo history and auto-save.
 * Features: F-11 (Undo/Redo) + F-07 (Auto-Save & Draft) + F-26 (Multilingual)
 */

import { create } from 'zustand'
import { COMMERCE_BLOCK_TYPES } from '@/lib/site-renderer/detect-commerce-presence'
import { resolveBlockContent } from '@/lib/ai/add-section-content'
import { stripStructuralFields } from '@/lib/editor/structural-block-fields'

// Serialize all editor writes for a site within this browser tab. Each task is
// created only after earlier writes settle, so it can snapshot the latest state.
const editorSaveTails = new Map<string, Promise<void>>()

export type EditorSaveContext = {
    siteId: string
    pageId: string | null
}

export function isEditorSaveContextCurrent(
    expected: EditorSaveContext,
    current: { siteId: string | null; currentPageId: string | null },
): boolean {
    return current.siteId === expected.siteId
        && (current.currentPageId || null) === expected.pageId
}

export function hasPendingSerializedEditorSave(siteId: string): boolean {
    return editorSaveTails.has(siteId)
}

export async function runSerializedEditorSave<T>(
    siteId: string,
    task: () => Promise<T>,
): Promise<T> {
    const previous = editorSaveTails.get(siteId)
    let run: Promise<T>
    if (previous) {
        run = previous.catch(() => undefined).then(task)
    } else {
        try {
            run = Promise.resolve(task())
        } catch (error) {
            run = Promise.reject(error)
        }
    }
    const tail = run.then(() => undefined, () => undefined)
    editorSaveTails.set(siteId, tail)

    try {
        return await run
    } finally {
        if (editorSaveTails.get(siteId) === tail) {
            editorSaveTails.delete(siteId)
        }
    }
}

// ── Types ────────────────────────────────────────────────────────────────

export type BlockData = { blockType: string;[key: string]: unknown }

export type SiteLocale = 'en' | 'ms'

export type UndoActionSource = 'ai_chat' | 'inline_edit' | 'manual' | 'theme_change'

export type GlobalBlockKey = 'cartWidget' | 'whatsappButton' | 'socialWidget'

export type GlobalBlocksState = {
    cartWidget: BlockData | null
    whatsappButton: BlockData | null
    socialWidget: BlockData | null
} | null

export const BLOCK_TYPE_TO_KEY: Record<string, GlobalBlockKey> = {
    'cartWidget': 'cartWidget',
    'whatsapp-button': 'whatsappButton',
    'socialWidget': 'socialWidget',
}

type EditorSnapshot = {
    id: string
    blocks: BlockData[]
    theme: ThemeState
    headerBlock: BlockData | null
    footerBlock: BlockData | null
    globalBlocks: GlobalBlocksState
    localeOverrides: Record<string, Record<string, Record<string, unknown>>>
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
    blockCount?: number
    /** F26/GH-1136: per-locale overrides incl. page-title translations under the reserved
     *  `__pageMeta` key — localeContent['__pageMeta'][locale] = { title }. Block-level overrides
     *  share this JSON column keyed by block id. */
    localeContent?: Record<string, Record<string, Record<string, unknown>>>
}

/** Reserved localeContent key holding page-level (non-block) translations, e.g. the page title. */
export const PAGE_META_LOCALE_KEY = '__pageMeta'

/**
 * F26/GH-1136: the page title to display for a given locale.
 * Falls back to the original `page.title` (generation language) when no translation exists.
 */
export function getDisplayPageTitle(
    page: Pick<PageData, 'title' | 'localeContent'>,
    locale: string,
): string {
    const translated = page.localeContent?.[PAGE_META_LOCALE_KEY]?.[locale]?.title
    return (typeof translated === 'string' && translated.trim()) ? translated : page.title
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
    globalBlocks: GlobalBlocksState

    // Pages (F-05-02)
    pages: PageData[]
    currentPageId: string | null

    // F-26: Multilingual locale state
    /** Active display locale. Any ISO 639-1 code — e.g. 'en', 'ms', 'vi', 'el'. */
    activeLocale: string
    /** Translation slot — EN/MS only (Sites.locale). */
    siteLocale: SiteLocale
    /** Actual ISO 639-1 code the site was generated in — may be non-EN/MS (e.g. 'el', 'th'). */
    generationLocale: string
    /** User-chosen primary display locale (Make Default). Defaults to generationLocale. */
    primaryLocale: string
    /** The 2nd active language (the one [Add]ed). null = single-language site. Persisted in
     *  headerBlock.secondaryLocale — single source of truth for both the Quick Language panel
     *  and the visitor header switcher (which renders exactly [primary, secondary]). */
    secondaryLocale: string | null
    /** Locale currently being translated (after [Add] click). null when idle. */
    pendingLocale: string | null
    /** Per-block locale overrides: localeOverrides[blockId][locale] = { field: value } */
    localeOverrides: Record<string, Record<string, Record<string, unknown>>>

    // History (F-06 / F-11)
    history: EditorSnapshot[]
    historyIndex: number
    maxHistory: number

    // AI streaming guard (F-11)
    isAIStreaming: boolean

    // Inline editing guard — true while user is editing text directly in iframe.
    // Auto-save is suspended during this window to prevent stale-block saves.
    isInlineEditing: boolean

    // Save status (F-07)
    hasUnsavedChanges: boolean
    hasUnpublishedChanges: boolean
    lastSavedAt: number | null
    isSaving: boolean
    contentRevision: number
    saveStatus: 'idle' | 'saving' | 'saved' | 'error'
    autoSaveTimer: NodeJS.Timeout | null
    autoSaveEnabled: boolean
    autoSaveIntervalMs: number
}

type ThemeState = Record<string, string | number | boolean | null | unknown>
type BlockPatch = Record<string, unknown>

type EditorActions = {
    // Init
    init: (siteId: string, blocks: BlockData[], theme: ThemeState, siteName: string, headerBlock?: BlockData | null, footerBlock?: BlockData | null, globalBlocks?: GlobalBlocksState, localeOverrides?: Record<string, Record<string, Record<string, unknown>>>) => void

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
    updateSiteName: (name: string) => void

    // Header/Footer (F-05-07)
    updateHeaderBlock: (changes: BlockPatch) => void
    updateFooterBlock: (changes: BlockPatch) => void

    // AI Batch (F-11) — push ALL AI changes as a single undoable action
    pushBatch: (
        blocks: BlockData[],
        theme: ThemeState,
        label: string,
        globals?: {
            headerBlock?: BlockData | null
            footerBlock?: BlockData | null
            globalBlocks?: GlobalBlocksState
            localeOverrides?: Record<string, Record<string, Record<string, unknown>>>
        },
    ) => void

    // Undo/Redo (F-06 / F-11)
    undo: () => void
    redo: () => void
    canUndo: () => boolean
    canRedo: () => boolean
    undoLabel: () => string | undefined
    redoLabel: () => string | undefined

    // AI streaming state (F-11)
    setIsAIStreaming: (streaming: boolean) => void

    // Inline editing guard
    setIsInlineEditing: (editing: boolean) => void

    // Save (F-07)
    handleContentChange: () => void
    performSave: (isManual?: boolean) => Promise<boolean>
    markDirty: (scheduleAutoSave?: boolean) => void
    markSaved: (savedRevision?: number) => void
    markPublished: () => void
    setIsSaving: (saving: boolean) => void
    setAutoSaveEnabled: (val: boolean) => void

    // Global Blocks (F-09/F-10)
    updateGlobalBlock: (type: GlobalBlockKey, patch: BlockPatch) => void
    deleteGlobalBlock: (type: GlobalBlockKey) => void
    flipBlockVariant: (blockType: string, newVariant: 'inline' | 'floating', sourceIndex?: number) => void

    // F-26: Multilingual locale actions
    setActiveLocale: (locale: string) => void
    setSiteLocale: (locale: SiteLocale) => void
    setGenerationLocale: (locale: string) => void
    setPrimaryLocale: (locale: string) => void
    setSecondaryLocale: (locale: string | null) => void
    setPendingLocale: (locale: string | null) => void
    setLocaleOverride: (blockId: string, locale: string, fields: Record<string, unknown>) => void
    /**
     * Remove a field from every locale slot of a block's overrides. Used when a
     * structural field (variant, backgroundColor, …) is written to the flat
     * block — stale per-locale copies would otherwise shadow the flat value in
     * getDisplayBlock and silently revert the edit on the next render.
     */
    clearLocaleOverrideField: (blockId: string, field: string) => void
    initLocaleFromBlock: (blockId: string, localeInit: { en: Record<string, unknown>; ms: Record<string, unknown> }) => void
    /**
     * Merge localeOverrides[block.id][activeLocale] onto block for rendering.
     * Priority: localeOverride wins → fall back to flat block if same locale → defaults.
     */
    getDisplayBlock: (block: BlockData) => BlockData
    /**
     * Returns all blocks with locale display applied — use this for every iframe send.
     * Ensures BM/EN content is always correct regardless of the action (add/delete/undo/redo/reorder).
     */
    getDisplayBlocks: () => BlockData[]

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
    globalBlocks: GlobalBlocksState = null,
    localeOverrides: Record<string, Record<string, Record<string, unknown>>> = {},
): EditorSnapshot {
    return {
        id: crypto.randomUUID(),
        blocks: JSON.parse(JSON.stringify(blocks)),
        theme: JSON.parse(JSON.stringify(theme)),
        headerBlock: headerBlock ? JSON.parse(JSON.stringify(headerBlock)) : null,
        footerBlock: footerBlock ? JSON.parse(JSON.stringify(footerBlock)) : null,
        globalBlocks: globalBlocks ? JSON.parse(JSON.stringify(globalBlocks)) : null,
        localeOverrides: JSON.parse(JSON.stringify(localeOverrides)),
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

function syncSystemBlockInLayout(
    blocks: BlockData[],
    blockType: 'navigation' | 'footer',
    changes: BlockPatch,
) {
    let updated = false
    const nextBlocks = blocks.map((block) => {
        if (!updated && block.blockType === blockType) {
            updated = true
            return { ...block, ...changes }
        }
        return block
    })

    return updated ? nextBlocks : blocks
}

// F26: reconcile each `_localeContent[locale]` slot after a STRUCTURAL edit to header/footer links.
// getDisplayBlock merges the whole slot over the block, so a slot's stale `links`/`columns` array
// shadows a top-level edit (e.g. a deleted nav link reappears in the rendered header). We rebuild
// the slot's structure to mirror the new one — keyed by `url` so surviving links keep their
// translated label, removed links drop, and new links inherit the base label.
function reconcileLinksByUrl(
    slotLinks: unknown,
    newLinks: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
    const oldByUrl = new Map(
        (Array.isArray(slotLinks) ? slotLinks : []).map((l) => [String((l as Record<string, unknown>)?.url), l as Record<string, unknown>]),
    )
    return newLinks.map((nl) => {
        const old = oldByUrl.get(String(nl?.url))
        return old ? { ...nl, label: old.label ?? nl.label } : { ...nl }
    })
}

function reconcileLocaleContentStructure(
    localeContent: unknown,
    changes: BlockPatch,
): Record<string, Record<string, unknown>> | undefined {
    if (!localeContent || typeof localeContent !== 'object') return undefined
    const lc = localeContent as Record<string, Record<string, unknown>>
    const ch = changes as Record<string, unknown>
    const newLinks = Array.isArray(ch.links) ? (ch.links as Array<Record<string, unknown>>) : null
    const newCols = Array.isArray(ch.columns) ? (ch.columns as Array<Record<string, unknown>>) : null
    if (!newLinks && !newCols) return undefined

    const out: Record<string, Record<string, unknown>> = {}
    for (const [loc, slot] of Object.entries(lc)) {
        let next = slot
        if (newLinks && Array.isArray(slot?.links)) {
            next = { ...next, links: reconcileLinksByUrl(slot.links, newLinks) }
        }
        if (newCols && Array.isArray(slot?.columns)) {
            const oldCols = slot.columns as Array<Record<string, unknown>>
            next = {
                ...next,
                columns: newCols.map((nc, i) => {
                    const oc = oldCols[i]
                    return {
                        ...nc,
                        ...(oc?.title ? { title: oc.title } : {}),
                        ...(Array.isArray(nc.links) ? { links: reconcileLinksByUrl(oc?.links, nc.links as Array<Record<string, unknown>>) } : {}),
                    }
                }),
            }
        }
        out[loc] = next
    }
    return out
}

/** Apply reconcile only for structural link/column edits that aren't themselves a _localeContent write. */
function withLocaleContentReconcile(block: Record<string, unknown> | null, changes: BlockPatch): BlockPatch {
    const ch = changes as Record<string, unknown>
    if ('_localeContent' in ch) return changes // translation write — never reconcile
    if (!Array.isArray(ch.links) && !Array.isArray(ch.columns)) return changes
    const reconciled = reconcileLocaleContentStructure(block?._localeContent, changes)
    return reconciled ? ({ ...changes, _localeContent: reconciled } as BlockPatch) : changes
}

export const useEditorStore = create<EditorState & EditorActions>((set, get) => ({
    // Initial state
    siteId: null,
    blocks: [],
    theme: {},
    siteName: '',
    headerBlock: null,
    footerBlock: null,
    globalBlocks: null,
    pages: [],
    currentPageId: null,
    history: [],
    historyIndex: -1,
    maxHistory: MAX_HISTORY,
    isAIStreaming: false,
    isInlineEditing: false,
    hasUnsavedChanges: false,
    hasUnpublishedChanges: false,
    lastSavedAt: null,
    isSaving: false,
    contentRevision: 0,
    autoSaveEnabled: true,
    autoSaveIntervalMs: 3000,
    saveStatus: 'idle',
    autoSaveTimer: null,
    // F-26: Multilingual
    activeLocale: 'en',
    siteLocale: 'en',
    generationLocale: 'en',
    primaryLocale: 'en',
    secondaryLocale: null,
    pendingLocale: null,
    localeOverrides: {},

    init: (siteId, blocks, theme, siteName, headerBlock = null, footerBlock = null, globalBlocks = null, localeOverrides = {}) => {
        // Clear any pending auto-save timer from previous page to prevent cross-page save
        const { autoSaveTimer } = get()
        if (autoSaveTimer) clearTimeout(autoSaveTimer)

        const fallbackHeader = blocks.find(b => b.blockType === 'navigation')
        const fallbackFooter = blocks.find(b => b.blockType === 'footer')

        const effectiveHeader = headerBlock || (fallbackHeader ? JSON.parse(JSON.stringify(fallbackHeader)) : { blockType: 'navigation', links: [] })
        const effectiveFooter = footerBlock || (fallbackFooter ? JSON.parse(JSON.stringify(fallbackFooter)) : { blockType: 'footer' })

        // Keep blocks as-is (including nav/footer) for preview iframe index consistency
        const snapshot = createSnapshot(blocks, theme, effectiveHeader, effectiveFooter, 'Initial state', 'manual', globalBlocks, localeOverrides)
        set({
            siteId,
            blocks,
            theme,
            siteName,
            headerBlock: effectiveHeader,
            footerBlock: effectiveFooter,
            globalBlocks,
            localeOverrides,
            history: [snapshot],
            historyIndex: 0,
            hasUnsavedChanges: false,
            hasUnpublishedChanges: false,
            lastSavedAt: null,
            autoSaveTimer: null,
            isSaving: false,
            contentRevision: 0,
            saveStatus: 'idle',
            isAIStreaming: false,
            // M1 fix: reset locale selection state on every page switch so stale values never bleed.
            // localeOverrides itself is hydrated above so the initial undo snapshot is complete.
            // F26-04: also reset pendingLocale + primaryLocale so navigation between sites
            // doesn't carry over translation state from previous site.
            activeLocale: 'en',
            siteLocale: 'en',
            generationLocale: 'en',
            primaryLocale: 'en',
            secondaryLocale: null,
            pendingLocale: null,
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
        const { blocks, theme, headerBlock, footerBlock, globalBlocks, localeOverrides, history, historyIndex, maxHistory } = get()
        const newBlocks = [...blocks]
        newBlocks[index] = { ...newBlocks[index], ...changes }

        const snapshot = createSnapshot(newBlocks, theme, headerBlock, footerBlock, label ?? `Edited ${newBlocks[index].blockType}`, 'inline_edit', globalBlocks, localeOverrides)
        const newHistory = pushSnapshot(history, historyIndex, maxHistory, snapshot)

        set({
            blocks: newBlocks,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        })
        get().handleContentChange()
    },

    addBlock: (afterIndex, block, label) => {
        const { blocks, theme, headerBlock, footerBlock, globalBlocks, localeOverrides, history, historyIndex, maxHistory } = get()
        // Footer must always be last — clamp insert position to just before it
        const footerIdx = blocks.findIndex(b => b.blockType === 'footer')
        const safeAfterIndex = footerIdx >= 0 ? Math.min(afterIndex, footerIdx - 1) : afterIndex
        const newBlocks = [...blocks]
        newBlocks.splice(safeAfterIndex + 1, 0, block)

        // Auto-restore cart when a commerce block is added, unless cart is already active.
        // globalBlocks === null: fresh site (never configured) — restore.
        // globalBlocks.cartWidget === null: user explicitly deleted — restore.
        // globalBlocks.cartWidget = {...}: already configured — no restore needed.
        const cartAlreadyActive = globalBlocks !== null && globalBlocks.cartWidget != null
        const needsCartRestore = COMMERCE_BLOCK_TYPES.has(block.blockType) && !cartAlreadyActive
        const effectiveGlobalBlocks: GlobalBlocksState = needsCartRestore
            ? {
                  cartWidget: { blockType: 'cartWidget', variant: 'floating' } as BlockData,
                  whatsappButton: globalBlocks?.whatsappButton ?? null,
                  socialWidget: globalBlocks?.socialWidget ?? null,
              }
            : globalBlocks

        const snapshot = createSnapshot(newBlocks, theme, headerBlock, footerBlock, label ?? `Added ${block.blockType}`, 'manual', effectiveGlobalBlocks, localeOverrides)
        const newHistory = pushSnapshot(history, historyIndex, maxHistory, snapshot)

        set({
            blocks: newBlocks,
            globalBlocks: effectiveGlobalBlocks,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        })
        get().handleContentChange()
    },

    deleteBlock: (index, label) => {
        const { blocks, theme, headerBlock, footerBlock, globalBlocks, localeOverrides, history, historyIndex, maxHistory } = get()
        const blockType = blocks[index]?.blockType ?? 'block'
        const newBlocks = blocks.filter((_, i) => i !== index)

        const snapshot = createSnapshot(newBlocks, theme, headerBlock, footerBlock, label ?? `Deleted ${blockType}`, 'manual', globalBlocks, localeOverrides)
        const newHistory = pushSnapshot(history, historyIndex, maxHistory, snapshot)

        set({
            blocks: newBlocks,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        })
        get().handleContentChange()
    },

    duplicateBlock: (index) => {
        const { blocks, theme, headerBlock, footerBlock, globalBlocks, localeOverrides, history, historyIndex, maxHistory } = get()
        const footerIdx = blocks.findIndex(b => b.blockType === 'footer')
        if (index === footerIdx) return // never duplicate footer
        const blockCopy = JSON.parse(JSON.stringify(blocks[index]))
        // F26: block ids are now preserved verbatim on save (they are the row PK). A duplicate must
        // get a fresh id or the two rows collide on pages_blocks_*_pkey → save 500.
        blockCopy.id = crypto.randomUUID()
        const insertAt = footerIdx >= 0 ? Math.min(index + 1, footerIdx) : index + 1
        const newBlocks = [...blocks]
        newBlocks.splice(insertAt, 0, blockCopy)

        const snapshot = createSnapshot(newBlocks, theme, headerBlock, footerBlock, `Duplicated ${blocks[index]?.blockType}`, 'manual', globalBlocks, localeOverrides)
        const newHistory = pushSnapshot(history, historyIndex, maxHistory, snapshot)

        set({
            blocks: newBlocks,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        })
        get().handleContentChange()
    },

    reorderBlocks: (fromIndex, toIndex) => {
        const { blocks, theme, headerBlock, footerBlock, globalBlocks, localeOverrides, history, historyIndex, maxHistory } = get()
        // Footer must always be last — block any move that violates this
        const footerIdx = blocks.findIndex(b => b.blockType === 'footer')
        if (footerIdx >= 0) {
            if (fromIndex === footerIdx) return // footer itself cannot move
            if (toIndex >= footerIdx) return // nothing can land after footer
        }
        const newBlocks = [...blocks]
        const [moved] = newBlocks.splice(fromIndex, 1)
        newBlocks.splice(toIndex, 0, moved)

        const snapshot = createSnapshot(newBlocks, theme, headerBlock, footerBlock, `Moved ${moved?.blockType}`, 'manual', globalBlocks, localeOverrides)
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
        const { blocks, theme, headerBlock, footerBlock, globalBlocks, localeOverrides, history, historyIndex, maxHistory } = get()
        const newTheme = { ...theme, ...changes }

        const snapshot = createSnapshot(blocks, newTheme, headerBlock, footerBlock, label ?? 'Updated theme', 'theme_change', globalBlocks, localeOverrides)
        const newHistory = pushSnapshot(history, historyIndex, maxHistory, snapshot)

        set({
            theme: newTheme,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        })
        get().handleContentChange()
    },

    updateSiteName: (name: string) => {
        set({ siteName: name })
    },

    // ── AI Batch (F-11) ─────────────────────────────────────────────────
    // Groups an entire AI response into EXACTLY 1 undoable action (BR-02)

    pushBatch: (blocks, theme, label, globals) => {
        const { headerBlock, footerBlock, globalBlocks, localeOverrides, history, historyIndex, maxHistory } = get()
        const nextHeader = globals?.headerBlock === undefined ? headerBlock : globals.headerBlock
        const nextFooter = globals?.footerBlock === undefined ? footerBlock : globals.footerBlock
        const nextGlobalBlocks = globals?.globalBlocks === undefined ? globalBlocks : globals.globalBlocks
        const nextLocaleOverrides = globals?.localeOverrides === undefined ? localeOverrides : globals.localeOverrides
        // Enforce footer-last invariant on AI-generated blocks — dedupe and sort
        const footerBlocks = blocks.filter(b => b.blockType === 'footer')
        const nonFooter = blocks.filter(b => b.blockType !== 'footer')
        const sanitized = footerBlocks.length > 0 ? [...nonFooter, footerBlocks[0]] : nonFooter
        const snapshot = createSnapshot(sanitized, theme, nextHeader, nextFooter, label, 'ai_chat', nextGlobalBlocks, nextLocaleOverrides)
        const newHistory = pushSnapshot(history, historyIndex, maxHistory, snapshot)

        set(state => ({
            blocks: JSON.parse(JSON.stringify(sanitized)),
            theme: JSON.parse(JSON.stringify(theme)),
            headerBlock: nextHeader ? JSON.parse(JSON.stringify(nextHeader)) : null,
            footerBlock: nextFooter ? JSON.parse(JSON.stringify(nextFooter)) : null,
            globalBlocks: nextGlobalBlocks ? JSON.parse(JSON.stringify(nextGlobalBlocks)) : null,
            localeOverrides: JSON.parse(JSON.stringify(nextLocaleOverrides)),
            history: newHistory,
            historyIndex: newHistory.length - 1,
            hasUnsavedChanges: true,
            saveStatus: 'idle',
            contentRevision: state.contentRevision + 1,
        }))
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
            globalBlocks: snapshot.globalBlocks ? JSON.parse(JSON.stringify(snapshot.globalBlocks)) : null,
            localeOverrides: JSON.parse(JSON.stringify(snapshot.localeOverrides)),
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
            globalBlocks: snapshot.globalBlocks ? JSON.parse(JSON.stringify(snapshot.globalBlocks)) : null,
            localeOverrides: JSON.parse(JSON.stringify(snapshot.localeOverrides)),
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

    // ── Inline Editing Guard ─────────────────────────────────────────────

    setIsInlineEditing: (editing) => set({ isInlineEditing: editing }),

    // ── Save (F-07) ─────────────────────────────────────────────────────
    handleContentChange: () => {
        const { autoSaveTimer, siteId, isInlineEditing, autoSaveEnabled } = get()
        if (!siteId) return

        // Always mark dirty — auto-save disabled only suspends scheduling, not tracking
        set(state => ({
            hasUnsavedChanges: true,
            saveStatus: 'idle',
            contentRevision: state.contentRevision + 1,
        }))

        // Suspend scheduling while auto-save is disabled (e.g. template applied) or
        // inline editing is active (TEXT_EDITING_STOPPED pipeline handles that case)
        if (!autoSaveEnabled || isInlineEditing) return

        if (autoSaveTimer) clearTimeout(autoSaveTimer)

        const timer = setTimeout(() => {
            get().performSave()
        }, 3000) // 3s debounce

        set({ autoSaveTimer: timer })
    },

    performSave: async (_isManual = false) => {
        const { siteId, currentPageId, autoSaveTimer, isSaving } = get()
        if (!siteId) return false
        const saveContext: EditorSaveContext = {
            siteId,
            pageId: currentPageId || null,
        }
        // `isSaving` is also used by UI code. If it is set without a registered
        // task, preserve the existing anti-spam behavior instead of starting an
        // unowned request. Active queue tasks are safe to serialize behind.
        if (isSaving && !editorSaveTails.has(siteId)) return false

        if (autoSaveTimer) clearTimeout(autoSaveTimer)
        set({ autoSaveTimer: null })

        const RETRY_DELAYS = [5000, 10000, 20000]

        const attemptSave = async (retryCount = 0): Promise<boolean> => {
            if (!isEditorSaveContextCurrent(saveContext, get())) return false

            // Re-read all state each attempt to prevent stale closure after page switch
            const {
                blocks,
                theme,
                headerBlock,
                footerBlock,
                globalBlocks,
                currentPageId: pageIdNow,
                contentRevision: savedRevision,
            } = get()
            set({ isSaving: true, saveStatus: 'saving' })
            try {
                const saveUrl = new URL(`/api/sites/${siteId}/save`, window.location.origin)
                if (pageIdNow) {
                    saveUrl.searchParams.set('pageId', pageIdNow)
                }
                // Only send globalBlocks when non-null — omitting keeps the DB value unchanged
                // for legacy sites that have never set globalBlocks (prevents accidental wipe).
                const body: Record<string, unknown> = { blocks, theme, headerBlock, footerBlock, isDraft: true }
                if (globalBlocks !== null) body.globalBlocks = globalBlocks
                const res = await fetch(saveUrl.toString(), {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(body),
                })

                const current = get()
                if (!isEditorSaveContextCurrent(saveContext, current)) {
                    if (current.siteId === saveContext.siteId) {
                        set({ isSaving: false })
                    }
                    return false
                }

                if (res.ok) {
                    current.markSaved(savedRevision)
                    set({ isSaving: false })
                    return true
                } else {
                    if (res.status === 401) {
                        set({ saveStatus: 'error', isSaving: false })
                        return false
                    }
                    throw new Error('Save failed')
                }
            } catch (err) {
                const current = get()
                if (!isEditorSaveContextCurrent(saveContext, current)) {
                    if (current.siteId === saveContext.siteId) {
                        set({ isSaving: false })
                    }
                    return false
                }
                set({ saveStatus: 'error', isSaving: false })
                if (retryCount < RETRY_DELAYS.length) {
                    const timer = setTimeout(() => {
                        set({ autoSaveTimer: null })
                        const state = get()
                        if (state.siteId !== siteId || !state.hasUnsavedChanges) return
                        void runSerializedEditorSave(siteId, () => attemptSave(retryCount + 1))
                    }, RETRY_DELAYS[retryCount])
                    set({ autoSaveTimer: timer })
                }
                return false
            }
        }

        return await runSerializedEditorSave(siteId, () => attemptSave(0))
    },

    markDirty: (scheduleAutoSave = true) => {
        if (scheduleAutoSave) {
            get().handleContentChange()
            return
        }
        set(state => ({
            hasUnsavedChanges: true,
            saveStatus: 'idle',
            contentRevision: state.contentRevision + 1,
        }))
    },
    markSaved: (savedRevision) => set(state => ({
        hasUnsavedChanges: savedRevision === undefined || state.contentRevision === savedRevision
            ? false
            : state.hasUnsavedChanges,
        hasUnpublishedChanges: true,
        lastSavedAt: Date.now(),
        saveStatus: savedRevision === undefined || state.contentRevision === savedRevision
            ? 'saved'
            : state.saveStatus,
    })),
    markPublished: () => set({ hasUnpublishedChanges: false }),
    setIsSaving: (saving) => set({ isSaving: saving }),
    setAutoSaveEnabled: (val) => set({ autoSaveEnabled: val }),

    // ── Header/Footer (F-05-07) ──────────────────────────────────────────

    updateHeaderBlock: (rawChanges) => {
        const { blocks, theme, headerBlock, footerBlock, globalBlocks, localeOverrides, history, historyIndex, maxHistory } = get()
        // F26: keep per-locale slots in sync on structural link edits (deleted/added/reordered nav links).
        const changes = withLocaleContentReconcile(headerBlock as Record<string, unknown> | null, rawChanges)
        const newHeader = headerBlock ? { ...headerBlock, ...changes } : { blockType: 'navigation', ...changes }
        const newBlocks = syncSystemBlockInLayout(blocks, 'navigation', changes)

        const snapshot = createSnapshot(newBlocks, theme, newHeader, footerBlock, 'Updated Header', 'inline_edit', globalBlocks, localeOverrides)
        const newHistory = pushSnapshot(history, historyIndex, maxHistory, snapshot)

        set({
            blocks: newBlocks,
            headerBlock: newHeader,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        })
        get().handleContentChange()
    },

    updateFooterBlock: (rawChanges) => {
        const { blocks, theme, headerBlock, footerBlock, globalBlocks, localeOverrides, history, historyIndex, maxHistory } = get()
        // F26: keep per-locale slots in sync on structural footer column/link edits.
        const changes = withLocaleContentReconcile(footerBlock as Record<string, unknown> | null, rawChanges)
        const newFooter = footerBlock ? { ...footerBlock, ...changes } : { blockType: 'footer', ...changes }
        const newBlocks = syncSystemBlockInLayout(blocks, 'footer', changes)

        const snapshot = createSnapshot(newBlocks, theme, headerBlock, newFooter, 'Updated Footer', 'inline_edit', globalBlocks, localeOverrides)
        const newHistory = pushSnapshot(history, historyIndex, maxHistory, snapshot)

        set({
            blocks: newBlocks,
            footerBlock: newFooter,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        })
        get().handleContentChange()
    },

    // ── Global Blocks (F-09/F-10) ────────────────────────────────────────

    updateGlobalBlock: (type, patch) => {
        const { blocks, theme, headerBlock, footerBlock, globalBlocks, localeOverrides, history, historyIndex, maxHistory } = get()
        const existing = globalBlocks?.[type] ?? null
        const newEntry = existing ? { ...existing, ...patch } : { blockType: type === 'whatsappButton' ? 'whatsapp-button' : type, ...patch }
        const newGlobalBlocks: NonNullable<GlobalBlocksState> = {
            cartWidget: globalBlocks?.cartWidget ?? null,
            whatsappButton: globalBlocks?.whatsappButton ?? null,
            socialWidget: globalBlocks?.socialWidget ?? null,
            [type]: newEntry,
        }

        const snapshot = createSnapshot(blocks, theme, headerBlock, footerBlock, `Updated ${type}`, 'inline_edit', newGlobalBlocks, localeOverrides)
        const newHistory = pushSnapshot(history, historyIndex, maxHistory, snapshot)

        set({ globalBlocks: newGlobalBlocks, history: newHistory, historyIndex: newHistory.length - 1 })
        get().handleContentChange()
    },

    deleteGlobalBlock: (type) => {
        const { blocks, theme, headerBlock, footerBlock, globalBlocks, localeOverrides, history, historyIndex, maxHistory } = get()
        const newGlobalBlocks: NonNullable<GlobalBlocksState> = {
            cartWidget: globalBlocks?.cartWidget ?? null,
            whatsappButton: globalBlocks?.whatsappButton ?? null,
            socialWidget: globalBlocks?.socialWidget ?? null,
            [type]: null,
        }

        const snapshot = createSnapshot(blocks, theme, headerBlock, footerBlock, `Deleted ${type}`, 'manual', newGlobalBlocks, localeOverrides)
        const newHistory = pushSnapshot(history, historyIndex, maxHistory, snapshot)

        set({ globalBlocks: newGlobalBlocks, history: newHistory, historyIndex: newHistory.length - 1 })
        get().handleContentChange()
    },

    flipBlockVariant: (blockType, newVariant, sourceIndex) => {
        const { blocks, theme, headerBlock, footerBlock, globalBlocks, localeOverrides, history, historyIndex, maxHistory } = get()
        const key = BLOCK_TYPE_TO_KEY[blockType]
        if (!key) return

        let newBlocks = [...blocks]
        let newGlobalBlocks: GlobalBlocksState = {
            cartWidget: globalBlocks?.cartWidget ?? null,
            whatsappButton: globalBlocks?.whatsappButton ?? null,
            socialWidget: globalBlocks?.socialWidget ?? null,
        }

        if (newVariant === 'floating') {
            // inline → floating: remove from page layout, promote to globalBlocks
            const idx = sourceIndex ?? newBlocks.findIndex(b => b.blockType === blockType && b.variant === 'inline')
            if (idx < 0) return
            const [removed] = newBlocks.splice(idx, 1)
            newGlobalBlocks = { ...newGlobalBlocks, [key]: { ...removed, variant: 'floating' } }
        } else {
            // floating → inline: remove from globalBlocks, push to page layout
            const entry = globalBlocks?.[key]
            if (!entry) return
            newGlobalBlocks = { ...newGlobalBlocks, [key]: null }
            newBlocks = [...newBlocks, { ...entry, blockType, variant: 'inline' }]
        }

        const snapshot = createSnapshot(newBlocks, theme, headerBlock, footerBlock, `Switched ${blockType} to ${newVariant}`, 'manual', newGlobalBlocks, localeOverrides)
        const newHistory = pushSnapshot(history, historyIndex, maxHistory, snapshot)

        set({ blocks: newBlocks, globalBlocks: newGlobalBlocks, history: newHistory, historyIndex: newHistory.length - 1 })
        get().handleContentChange()
    },

    // ── F-26: Multilingual locale actions ───────────────────────────────

    setActiveLocale: (locale) => set({ activeLocale: locale }),
    setGenerationLocale: (locale) => set({ generationLocale: locale }),
    setPrimaryLocale: (locale) => set({ primaryLocale: locale }),
    setSecondaryLocale: (locale) => set({ secondaryLocale: locale }),
    setPendingLocale: (locale) => set({ pendingLocale: locale }),

    setSiteLocale: (locale) => set({ siteLocale: locale }),

    setLocaleOverride: (blockId, locale, fields) => {
        set(state => {
            const existing = state.localeOverrides[blockId]?.[locale] ?? {}
            return {
                localeOverrides: {
                    ...state.localeOverrides,
                    [blockId]: {
                        ...(state.localeOverrides[blockId] ?? { en: {}, ms: {} }),
                        [locale]: { ...existing, ...fields },
                    },
                },
                // Mark dirty so save + nav guard fire for non-EN edits.
                hasUnsavedChanges: true,
                saveStatus: 'idle',
                contentRevision: state.contentRevision + 1,
            }
        })
    },

    clearLocaleOverrideField: (blockId, field) => {
        const { localeOverrides } = get()
        const forBlock = localeOverrides[blockId]
        if (!forBlock) return
        const cleaned = Object.fromEntries(
            Object.entries(forBlock).map(([locale, fields]) => [
                locale,
                Object.fromEntries(Object.entries(fields).filter(([k]) => k !== field)),
            ]),
        )
        set({ localeOverrides: { ...localeOverrides, [blockId]: cleaned } })
    },

    initLocaleFromBlock: (blockId, localeInit) => {
        const { localeOverrides } = get()
        // Seed both EN and MS slots with template defaults — only for blocks that have no user edits yet.
        // EN edits go through setLocaleOverride (handleBlockFieldChange / handleBlockUpdate paths),
        // which merges on top of the seeded defaults, so user edits always win.
        const existing = localeOverrides[blockId]
        set({
            localeOverrides: {
                ...localeOverrides,
                [blockId]: {
                    en: existing?.en && Object.keys(existing.en).length > 0 ? existing.en : localeInit.en,
                    ms: existing?.ms && Object.keys(existing.ms).length > 0 ? existing.ms : localeInit.ms,
                },
            },
        })
    },

    getDisplayBlock: (block) => {
        const { activeLocale, siteLocale, generationLocale, localeOverrides, siteName } = get()

        // 1. User override wins for any locale (custom edit takes priority).
        //    Structural fields (variant, backgroundColor, …) are stripped from the
        //    patch: they are site-wide, always sourced from the flat block. A stale
        //    per-locale copy (from pre-fix sessions or persisted _localeContent)
        //    must never shadow the flat value.
        const override = block.id ? localeOverrides[block.id as string]?.[activeLocale] : null
        if (override && Object.keys(override).length > 0) {
            return { ...block, ...stripStructuralFields(override) }
        }

        // 2. Embedded translation (header/footer with _localeContent[locale]).
        const embedded = (block as Record<string, unknown>)._localeContent as
            | Record<string, Record<string, unknown>>
            | undefined
        if (embedded?.[activeLocale] && Object.keys(embedded[activeLocale]).length > 0) {
            return { ...block, ...stripStructuralFields(embedded[activeLocale]) }
        }

        // 3. Native view — viewing the actual language base blocks were authored in.
        //    For non-standard sites (vi, el), generationLocale is the source. For standard,
        //    generationLocale === siteLocale so check still holds.
        const baseLocale = generationLocale || siteLocale
        if (activeLocale === baseLocale) return block

        // 4. Blocks without id (pre-save new blocks) fall through to locale resolver.
        if (!block.id) {
            const resolveLocale = (activeLocale === 'ms' ? 'ms' : 'en') as 'en' | 'ms'
            const resolved = resolveBlockContent(block.blockType, resolveLocale, siteName || 'Your Brand')
            return resolved.content && Object.keys(resolved.content).length > 0 ? { ...block, ...resolved.content } : block
        }

        // Alternate locale with no override → resolve locale defaults
        // (e.g. EN switch on MS site, or MS preview on EN site)
        const resolveLocale2 = (activeLocale === 'ms' ? 'ms' : 'en') as 'en' | 'ms'
        const resolved = resolveBlockContent(block.blockType, resolveLocale2, siteName || 'Your Brand')
        if (resolved.content && Object.keys(resolved.content).length > 0) {
            return { ...block, ...resolved.content }
        }
        return block
    },

    getDisplayBlocks: () => {
        const state = get()
        return state.blocks.map(b => state.getDisplayBlock(b))
    },

    reset: () => {
        // Cancel any pending auto-save/retry timer before clearing state — prevents
        // stale cross-site writes when the user navigates to a different site.
        const { autoSaveTimer } = get()
        if (autoSaveTimer) clearTimeout(autoSaveTimer)
        set({
            siteId: null, blocks: [], theme: {}, siteName: '',
            headerBlock: null, footerBlock: null, globalBlocks: null,
            pages: [], currentPageId: null,
            history: [], historyIndex: -1,
            isAIStreaming: false,
            isInlineEditing: false,
            hasUnsavedChanges: false, lastSavedAt: null, isSaving: false,
            contentRevision: 0,
            autoSaveEnabled: true, autoSaveIntervalMs: 3000,
            saveStatus: 'idle', autoSaveTimer: null,
            // F26-04: reset all locale-related state (was leaking across site navigations).
            activeLocale: 'en',
            siteLocale: 'en',
            generationLocale: 'en',
            primaryLocale: 'en',
            secondaryLocale: null,
            pendingLocale: null,
            localeOverrides: {},
        })
    },
}))
