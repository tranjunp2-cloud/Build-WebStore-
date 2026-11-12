/**
 * Editor Store (Zustand)
 * Manages editor state with undo/redo history and auto-save.
 * Features: F-11 (Undo/Redo) + F-07 (Auto-Save & Draft) + F-26 (Multilingual)
 */

import { create } from 'zustand'
import { COMMERCE_BLOCK_TYPES } from '@/lib/site-renderer/detect-commerce-presence'
import { resolveBlockContent } from '@/lib/ai/add-section-content'
import { templatePatch } from '@/lib/i18n/template-content'
import { localizedBlockOrNull } from '@/lib/i18n/locale-display'
import { uuid } from '@/lib/uuid'
import { buildSavePayload, draftBase } from '@/lib/editor/save-payload'
import { routeBlockChanges } from '@/lib/editor/structural-block-fields'

export { draftBase }

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

/** After a successful save: keep the revision the server left (header `x-draft-version`). */
export function keepDraftVersion(res: Response, state: { setDraftVersion: (version: string | null) => void }): void {
    const version = res.headers?.get('x-draft-version')
    if (version) state.setDraftVersion(version)
}

/**
 * A save refused because the draft changed elsewhere (409 DRAFT_CHANGED), not a transient conflict:
 * the stored revision it was refused against (`draftVersion`, what "Keep my version" saves over), else null.
 */
export async function readDraftConflict(res: Response): Promise<{ draftVersion: string | null } | null> {
    if (res.status !== 409) return null
    const body = await (typeof res.clone === 'function' ? res.clone() : res).json().catch(() => null) as { code?: unknown; draftVersion?: unknown } | null
    if (body?.code !== 'DRAFT_CHANGED') return null
    return { draftVersion: typeof body.draftVersion === 'string' ? body.draftVersion : null }
}

export async function isDraftConflict(res: Response): Promise<boolean> {
    return (await readDraftConflict(res)) !== null
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
    /** the assistant change this step applied (ai_chat steps) — see pushBatch */
    changeSetId?: string
    /** the kind of that change ("page", "theme", …) */
    aiKind?: string
    /** text typed straight on the canvas: the canvas shows it from its own DOM, so Undo/Redo must reload it */
    canvasTyped?: boolean
    /** Global → Contact info edit this step stands for (saved straight to the site, outside the draft) */
    contactInfoChange?: { before: ContactInfoValue; after: ContactInfoValue }
}

/** The contact fields a history step carries (only the ones that changed). */
export type ContactInfoValue = { phone?: string; email?: string; address?: string }

/** What an Undo / Redo just moved across: the step, for the caller to keep the rest of the editor in step. */
export type CrossedStep = {
    label?: string
    source?: UndoActionSource
    /** set when the step is an assistant change */
    changeSetId?: string
    /** the theme differs on the two sides of this step (it is written to the LIVE site by the autosave) */
    themeChanged: boolean
    canvasTyped: boolean
    /** the contact info to write to the site: the step's `before` on Undo, its `after` on Redo */
    contactInfo?: ContactInfoValue
}

/**
 * Where an assistant change stands in this page's history: `head` it is the newest applied step (Undo takes it),
 * `behind` newer steps come after it, `undone` Undo already took it (Redo brings it back), `none` it is not in the
 * history (applied before this page was opened, or the history ended).
 */
export type AiStepState = 'head' | 'behind' | 'undone' | 'none'

export function aiStepState(history: ReadonlyArray<{ changeSetId?: string }>, historyIndex: number, changeSetId: string): AiStepState {
    const at = history.findIndex((step) => step.changeSetId === changeSetId)
    if (at < 0) return 'none'
    if (at === historyIndex) return 'head'
    return at < historyIndex ? 'behind' : 'undone'
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

    // The assistant's change is being put into the page (held → reloaded): typing on the canvas now would be replaced.
    isApplyingAi: boolean

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
    /** the stored draft revision this editor's content is based on ("<site>.<page>", sent as `base` with each save) */
    draftVersion: string | null
    /** a save was refused because the draft changed elsewhere: saving stops until the editor reloads */
    draftConflict: boolean
    /** the stored revision the refused save met (409 body) — "Keep my version" saves over it */
    conflictDraftVersion: string | null
    /**
     * the id of a save whose outcome is unknown (network error, 5xx — it may have been committed): the next
     * save reuses it, so the server can tell its own committed write from someone else's (not stale)
     */
    unconfirmedSaveId: string | null
}

/** What an assistant step in the history is: the change it applied, or the change it took back. */
export type AiStepMeta = { changeSetId?: string; undoOf?: string; kind?: string }

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
    updateBlock: (index: number, changes: BlockPatch, label?: string, options?: { canvasTyped?: boolean }) => void
    /**
     * An edit of the text/settings of one section as the merchant sees it, written where it belongs
     * (routeBlockChanges): the section itself on the base language, and the language copy on screen
     * (localeOverrides) — together, as ONE history step. Settings panel and canvas typing both use it,
     * so neither leaves an old copy that shadows the edit after a reload.
     */
    editBlock: (index: number, changes: BlockPatch, label?: string, options?: { canvasTyped?: boolean }) => void
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
        meta?: AiStepMeta,
    ) => void

    /**
     * Take the header, footer and menu the server holds (after a change that is undone from its chat card, never
     * from the history: a new page's menu link, the website languages, a publish) into the editor AND into every
     * step of the history, so Undo can never put the older menu back over it.
     */
    adoptServerFrame: (frame: { headerBlock: BlockData | null; footerBlock: BlockData | null }) => void

    // Undo/Redo (F-06 / F-11) — return the step they moved across (null: nothing to undo / redo)
    undo: () => CrossedStep | null
    redo: () => CrossedStep | null
    /**
     * Next Undo / Redo step's contact info change, so the caller can save it before moving the pointer:
     * `apply` is the value to write for that direction, `revert` the one that puts the site back.
     */
    peekContactInfoStep: (direction: 'undo' | 'redo') => { apply: ContactInfoValue; revert: ContactInfoValue } | null
    /** Record a Global contact info edit (already saved) as an Undo step. It does not mark the draft dirty. */
    pushContactInfoStep: (before: ContactInfoValue, after: ContactInfoValue) => void
    canUndo: () => boolean
    canRedo: () => boolean
    undoLabel: () => string | undefined
    redoLabel: () => string | undefined

    // AI streaming state (F-11)
    setIsAIStreaming: (streaming: boolean) => void

    setIsApplyingAi: (applying: boolean) => void

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
    /** the revision editor-data or a save returned (null = unknown: saves go through unchecked) */
    setDraftVersion: (version: string | null) => void
    /** a save was refused as stale: stop saving (no retry loop) until the editor reloads or keeps its version */
    markDraftConflict: (conflictVersion?: string | null) => void
    /** "Keep my version" after a refused save: base the draft on the revision it met and save over it */
    keepMyVersion: () => Promise<boolean>
    /** the id to send with the next save: the unconfirmed one (a retry), else a new one */
    nextSaveId: () => string
    /** after a save: 2xx / 409 → the server answered (forget the id); network error / 5xx → keep it for the retry */
    settleSaveId: (saveId: string, status: number | null) => void

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
    /**
     * Take back an automatic translation: each block whose `locale` slot still
     * holds exactly what it wrote (`written[blockId]`) gets the section's own
     * text for those fields instead (so the next switch does not translate it
     * again). Blocks the user has edited since are left alone. Returns the count.
     */
    discardLocaleOverrides: (locale: string, written: Record<string, Record<string, unknown>>) => number
    /**
     * Merge localeOverrides[block.id][activeLocale] onto block for rendering.
     * Priority: localeOverride wins → fall back to flat block if same locale → defaults.
     */
    getDisplayBlock: (block: BlockData) => BlockData
    /**
     * The block in the language the site was written in: its copy for that language (the editor keeps one
     * when the merchant switches away) laid over the stored block. What a translation is made FROM: the
     * stored block can hold another language's text (the layout is saved as shown), never a target slot.
     */
    getSourceBlock: (block: BlockData) => BlockData
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
        id: uuid(),
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
    const newLinks = Array.isArray(ch.links) ? (ch.links as unknown as Array<Record<string, unknown>>) : null
    const newCols = Array.isArray(ch.columns) ? (ch.columns as unknown as Array<Record<string, unknown>>) : null
    if (!newLinks && !newCols) return undefined

    const out: Record<string, Record<string, unknown>> = {}
    for (const [loc, slot] of Object.entries(lc)) {
        let next = slot
        if (newLinks && Array.isArray(slot?.links)) {
            next = { ...next, links: reconcileLinksByUrl(slot.links, newLinks) }
        }
        if (newCols && Array.isArray(slot?.columns)) {
            const oldCols = slot.columns as unknown as Array<Record<string, unknown>>
            next = {
                ...next,
                columns: newCols.map((nc, i) => {
                    const oc = oldCols[i]
                    return {
                        ...nc,
                        ...(oc?.title ? { title: oc.title } : {}),
                        ...(Array.isArray(nc.links) ? { links: reconcileLinksByUrl(oc?.links, nc.links as unknown as Array<Record<string, unknown>>) } : {}),
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

/** JSON with object keys sorted, so a slot read back from Postgres jsonb (keys reordered) still compares equal. */
function sortedJson(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
    if (Array.isArray(value)) return `[${value.map(sortedJson).join(',')}]`
    const object = value as Record<string, unknown>
    return `{${Object.keys(object).filter(k => object[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${sortedJson(object[k])}`).join(',')}}`
}

function crossedStep(step: EditorSnapshot, other: EditorSnapshot): CrossedStep {
    return {
        label: step.label,
        source: step.source,
        changeSetId: step.changeSetId,
        themeChanged: sortedJson(step.theme) !== sortedJson(other.theme),
        canvasTyped: step.canvasTyped === true,
    }
}

/** Contact-only steps change nothing in the draft: Undo/Redo must not mark it dirty. */
function isContactOnlyStep(step: EditorSnapshot): boolean {
    return step.contactInfoChange !== undefined
}

/** Put a history step back into the editor (blocks, theme, menu, widgets, language copies) and move the pointer. */
function restoreSnapshot(set: (partial: Partial<EditorState>) => void, snapshot: EditorSnapshot, index: number): void {
    set({
        blocks: JSON.parse(JSON.stringify(snapshot.blocks)),
        theme: JSON.parse(JSON.stringify(snapshot.theme)),
        headerBlock: snapshot.headerBlock ? JSON.parse(JSON.stringify(snapshot.headerBlock)) : null,
        footerBlock: snapshot.footerBlock ? JSON.parse(JSON.stringify(snapshot.footerBlock)) : null,
        globalBlocks: snapshot.globalBlocks ? JSON.parse(JSON.stringify(snapshot.globalBlocks)) : null,
        localeOverrides: JSON.parse(JSON.stringify(snapshot.localeOverrides)),
        historyIndex: index,
    })
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
    isApplyingAi: false,
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
    draftVersion: null,
    draftConflict: false,
    conflictDraftVersion: null,
    unconfirmedSaveId: null,
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

    updateBlock: (index, changes, label, options) => {
        const { blocks, theme, headerBlock, footerBlock, globalBlocks, localeOverrides, history, historyIndex, maxHistory } = get()
        // An index past the page would leave holes that fail every later save.
        if (!Number.isInteger(index) || index < 0 || index >= blocks.length) return
        const newBlocks = [...blocks]
        newBlocks[index] = { ...newBlocks[index], ...changes }

        const snapshot = createSnapshot(newBlocks, theme, headerBlock, footerBlock, label ?? `Edited ${newBlocks[index].blockType}`, 'inline_edit', globalBlocks, localeOverrides)
        if (options?.canvasTyped) snapshot.canvasTyped = true
        const newHistory = pushSnapshot(history, historyIndex, maxHistory, snapshot)

        set({
            blocks: newBlocks,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        })
        get().handleContentChange()
    },

    editBlock: (index, changes, label, options) => {
        const { blocks, theme, headerBlock, footerBlock, globalBlocks, localeOverrides, history, historyIndex, maxHistory, activeLocale, generationLocale, siteLocale } = get()
        if (!Number.isInteger(index) || index < 0 || index >= blocks.length) return
        const block = blocks[index]
        const blockId = typeof block.id === 'string' && block.id ? block.id : undefined
        // structural keys → the section; content keys → the language copy on screen (+ the section on the base language)
        const { flatChanges, contentOverride, purgeKeys } = routeBlockChanges(changes, { hasBlockId: Boolean(blockId), activeLocale, generationLocale, siteLocale })

        const newBlocks = [...blocks]
        if (Object.keys(flatChanges).length > 0) newBlocks[index] = { ...block, ...flatChanges }

        let nextOverrides = localeOverrides
        if (blockId) {
            const slots = localeOverrides[blockId]
            // stale per-language copies of structural keys would shadow the section's value
            const purged = slots && purgeKeys.length > 0
                ? Object.fromEntries(Object.entries(slots).map(([loc, fields]) => [loc, Object.fromEntries(Object.entries(fields).filter(([k]) => !purgeKeys.includes(k)))]))
                : slots
            if (Object.keys(contentOverride).length > 0) {
                const base = purged ?? { en: {}, ms: {} }
                nextOverrides = { ...localeOverrides, [blockId]: { ...base, [activeLocale]: { ...(base[activeLocale] ?? {}), ...contentOverride } } }
            } else if (purged !== slots) {
                nextOverrides = { ...localeOverrides, [blockId]: purged as NonNullable<typeof purged> }
            }
        }
        if (newBlocks[index] === block && nextOverrides === localeOverrides) return

        // one snapshot AFTER both writes: Undo/Redo restore the section and its language copy together
        const snapshot = createSnapshot(newBlocks, theme, headerBlock, footerBlock, label ?? `Edited ${block.blockType}`, 'inline_edit', globalBlocks, nextOverrides)
        if (options?.canvasTyped) snapshot.canvasTyped = true
        const newHistory = pushSnapshot(history, historyIndex, maxHistory, snapshot)
        set({ blocks: newBlocks, localeOverrides: nextOverrides, history: newHistory, historyIndex: newHistory.length - 1 })
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
        if (!Number.isInteger(index) || index < 0 || index >= blocks.length) return
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
        blockCopy.id = uuid()
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

        const snapshot = createSnapshot(blocks, newTheme, headerBlock, footerBlock, label ?? 'Updated theme (live)', 'theme_change', globalBlocks, localeOverrides)
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

    pushBatch: (blocks, theme, label, globals, meta) => {
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
        if (meta?.changeSetId) snapshot.changeSetId = meta.changeSetId
        if (meta?.kind) snapshot.aiKind = meta.kind
        let newHistory: EditorSnapshot[]
        if (meta?.undoOf) {
            // The chat card took an assistant change back (the draft on the server is already restored). The
            // header Undo must never put that change back behind the card's back, so no step may lead to it:
            //  - it was the newest step: the step is replaced by the restored state (nothing to redo);
            //  - the merchant edited after it: older steps would re-apply it, so the history starts here.
            const head = history[historyIndex]
            newHistory = head?.changeSetId === meta.undoOf && historyIndex > 0
                ? [...history.slice(0, historyIndex - 1), { ...snapshot, label: history[historyIndex - 1]?.label, source: history[historyIndex - 1]?.source }]
                : [snapshot]
        } else {
            newHistory = pushSnapshot(history, historyIndex, maxHistory, snapshot)
        }

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
        if (isAIStreaming || historyIndex <= 0) return null
        const newIndex = historyIndex - 1
        // the step undone is the one we stand on
        const crossed = crossedStep(history[historyIndex]!, history[newIndex]!)
        const contactChange = history[historyIndex]!.contactInfoChange
        restoreSnapshot(set, history[newIndex]!, newIndex)
        if (contactChange) return { ...crossed, contactInfo: contactChange.before }
        get().handleContentChange()
        return crossed
    },

    redo: () => {
        const { historyIndex, history, isAIStreaming } = get()
        if (isAIStreaming || historyIndex >= history.length - 1) return null
        const newIndex = historyIndex + 1
        const crossed = crossedStep(history[newIndex]!, history[historyIndex]!)
        const contactChange = history[newIndex]!.contactInfoChange
        restoreSnapshot(set, history[newIndex]!, newIndex)
        if (contactChange) return { ...crossed, contactInfo: contactChange.after }
        get().handleContentChange()
        return crossed
    },

    peekContactInfoStep: (direction) => {
        const { historyIndex, history } = get()
        const step = direction === 'undo' ? history[historyIndex] : history[historyIndex + 1]
        if (!step || !isContactOnlyStep(step)) return null
        const change = step.contactInfoChange!
        return direction === 'undo'
            ? { apply: change.before, revert: change.after }
            : { apply: change.after, revert: change.before }
    },

    pushContactInfoStep: (before, after) => {
        const { blocks, theme, headerBlock, footerBlock, globalBlocks, localeOverrides, history, historyIndex, maxHistory } = get()
        const snapshot = createSnapshot(blocks, theme, headerBlock, footerBlock, 'Changed contact info', 'manual', globalBlocks, localeOverrides)
        snapshot.contactInfoChange = { before: { ...before }, after: { ...after } }
        const newHistory = pushSnapshot(history, historyIndex, maxHistory, snapshot)
        set({ history: newHistory, historyIndex: newHistory.length - 1 })
    },

    adoptServerFrame: ({ headerBlock, footerBlock }) => {
        const clone = (block: BlockData | null) => (block ? (JSON.parse(JSON.stringify(block)) as BlockData) : null)
        set(state => ({
            headerBlock: clone(headerBlock),
            footerBlock: clone(footerBlock),
            history: state.history.map(step => ({ ...step, headerBlock: clone(headerBlock), footerBlock: clone(footerBlock) })),
        }))
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

    setIsApplyingAi: (applying) => set({ isApplyingAi: applying }),

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
        // a refused (stale) save stops every save until the editor reloads
        if (get().draftConflict) return false

        if (autoSaveTimer) clearTimeout(autoSaveTimer)
        set({ autoSaveTimer: null })

        const RETRY_DELAYS = [5000, 10000, 20000]

        const attemptSave = async (retryCount = 0): Promise<boolean> => {
            if (!isEditorSaveContextCurrent(saveContext, get())) return false

            // Re-read all state each attempt to prevent stale closure after page switch
            const { currentPageId: pageIdNow, contentRevision: savedRevision } = get()
            set({ isSaving: true, saveStatus: 'saving' })
            try {
                const saveUrl = new URL(`/api/sites/${siteId}/save`, window.location.origin)
                if (pageIdNow) {
                    saveUrl.searchParams.set('pageId', pageIdNow)
                }
                // the same body as the explicit save: sections, theme, header/footer/widgets AND the language copies
                const saveId = get().nextSaveId()
                const body = buildSavePayload(get(), { saveId })
                let res: Response
                try {
                    res = await fetch(saveUrl.toString(), {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(body),
                    })
                } catch (transportError) {
                    get().settleSaveId(saveId, null)
                    throw transportError
                }
                get().settleSaveId(saveId, res.ok ? 200 : res.status)

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
                    keepDraftVersion(res, current)
                    return true
                } else {
                    // the draft changed elsewhere: retrying would overwrite it — stop and offer a reload
                    const conflict = res.status === 409 ? await readDraftConflict(res) : null
                    if (conflict) {
                        current.markDraftConflict(conflict.draftVersion)
                        return false
                    }
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
    setDraftVersion: (version) => set({ draftVersion: version, draftConflict: false, conflictDraftVersion: null }),
    markDraftConflict: (conflictVersion = null) => {
        const { autoSaveTimer } = get()
        if (autoSaveTimer) clearTimeout(autoSaveTimer)
        set({
            draftConflict: true,
            conflictDraftVersion: conflictVersion,
            autoSaveEnabled: false,
            autoSaveTimer: null,
            saveStatus: 'error',
            isSaving: false,
        })
    },
    keepMyVersion: async () => {
        const { draftConflict, conflictDraftVersion } = get()
        if (!draftConflict || !conflictDraftVersion) return false
        // the merchant chose to overwrite what changed elsewhere: base this editor on the revision the
        // refused save met, so the next save passes the check and writes this tab's content over it
        set({ draftVersion: conflictDraftVersion, draftConflict: false, conflictDraftVersion: null, autoSaveEnabled: true })
        return get().performSave(true)
    },
    nextSaveId: () => get().unconfirmedSaveId ?? uuid(),
    settleSaveId: (saveId, status) => {
        if (status === null || status >= 500) {
            set({ unconfirmedSaveId: saveId })
        } else if ((status >= 200 && status < 300) || status === 409) {
            set({ unconfirmedSaveId: null })
        }
    },

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

    discardLocaleOverrides: (locale, written) => {
        const { localeOverrides, blocks } = get()
        const next = { ...localeOverrides }
        let discarded = 0
        for (const [blockId, fields] of Object.entries(written)) {
            const slot = next[blockId]?.[locale]
            if (!slot || sortedJson(slot) !== sortedJson(fields)) continue
            // the section's own text, not an empty slot: an empty slot in the other language shows template copy
            const block = blocks.find(b => b.id === blockId) as Record<string, unknown> | undefined
            if (!block) continue
            next[blockId] = { ...next[blockId], [locale]: Object.fromEntries(Object.keys(fields).filter(k => block[k] !== undefined).map(k => [k, JSON.parse(JSON.stringify(block[k]))])) }
            discarded++
        }
        if (discarded === 0) return 0
        set(state => ({
            localeOverrides: next,
            hasUnsavedChanges: true,
            saveStatus: 'idle',
            contentRevision: state.contentRevision + 1,
        }))
        return discarded
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

    getDisplayBlock: (block) => {
        const { activeLocale, siteLocale, generationLocale, localeOverrides, siteName } = get()

        // 1. The section's copy in this language (localeOverrides, the page's locale_content) wins,
        // 2. else the copy a header/footer carries (_localeContent[locale]). Structural fields
        //    (variant, backgroundColor, …) always come from the flat block. Same rule as the
        //    preview and the live site (lib/i18n/locale-display).
        const localized = localizedBlockOrNull(block, activeLocale, localeOverrides, siteName || 'Your Brand')
        if (localized) return localized

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

        // 5. A saved block with no copy in this language shows its own text. Generic template text is not the
        //    merchant's text in that language, and the layout is saved as shown: a failed or pending translation
        //    must never turn the page into filler. Only fields still holding untouched template text (in any
        //    language) take the template of this language.
        const patch = templatePatch(block as Record<string, unknown>, activeLocale === 'ms' ? 'ms' : 'en', siteName || 'Your Brand')
        return Object.keys(patch).length > 0 ? { ...block, ...patch } : block
    },

    getSourceBlock: (block) => {
        const { generationLocale, siteLocale, localeOverrides, siteName } = get()
        // the written language's copy over the section — template filler is not a copy (lib/i18n/locale-display)
        return localizedBlockOrNull(block, generationLocale || siteLocale, localeOverrides, siteName || 'Your Brand') ?? block
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
            isApplyingAi: false,
            isInlineEditing: false,
            hasUnsavedChanges: false, lastSavedAt: null, isSaving: false,
            contentRevision: 0,
            autoSaveEnabled: true, autoSaveIntervalMs: 3000,
            saveStatus: 'idle', autoSaveTimer: null,
            draftVersion: null, draftConflict: false, conflictDraftVersion: null, unconfirmedSaveId: null,
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
