'use client'

import { useRef, useState, type ComponentProps } from 'react'
import { ChevronDown, ChevronUp, Loader2, MessageCircle, Square, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { blockRegistry } from '@/blocks/registry'
import { PreviewFrame } from './PreviewFrame'
import { SettingsPanel, type SettingsTab } from './SettingsPanel'
import { DeleteBlockConfirm } from './DeleteBlockConfirm'
import { EditorAdvisoryBanner } from './EditorAdvisoryBanner'
import { EditorToolsSheet, type ToolsSheetPanelProps, type ToolsSheetTab } from './EditorToolsSheet'
import { useEditorStore, type BlockData, type PageData, type SiteLocale } from '@/store/editorStore'
import type { ThemeData } from '@/types/editor'
import type { SiteData } from '@/app/(editor)/editor/[siteId]/page'

/**
 * `PreviewFrame` props shared verbatim with the desktop mount in page.tsx.
 * Excludes `onBlockSelect` (compact routes taps through `handleMobileBlockSelect`,
 * desktop through `handleBlockSelectWithContext`), `disableDragDrop` (touch-only),
 * and `hideBlockActionBar` (touch-only — the floating duplicate/AI-edit/delete
 * overlay is redundant with the compact block-settings sheet's own controls).
 */
export type PreviewFrameSharedProps = Omit<ComponentProps<typeof PreviewFrame>, 'onBlockSelect' | 'disableDragDrop'>

export interface CompactEditorLayoutProps {
    // Canvas — shared bundle with the desktop PreviewFrame mount (page.tsx), see
    // `PreviewFrameSharedProps`. `onBlockSelect` is compact-specific (routes to the
    // F05 block-settings sheet); reorder/delete reuse the same page.tsx handlers the
    // desktop BlockActionBar calls (no forked business logic — new sheet UI only).
    previewFrameProps: PreviewFrameSharedProps
    onBlockSelect: (blockIndex: number | null, blockType?: string) => void
    totalBlocks: number
    onReorderBlock: (fromIndex: number, toIndex: number) => void
    onDeleteBlockConfirmed: (index: number) => void

    // F05 FR-31: block-settings bottom sheet (bsBlock)
    isMobileSettingsOpen: boolean
    onCloseMobileSettings: () => void
    currentBlock: BlockData | null
    selectedBlock: number | null
    theme: ThemeData
    site: SiteData | null
    siteName: string
    headerBlock: BlockData | null
    footerBlock: BlockData | null
    pages: PageData[]
    currentPageId: string | null
    siteLocale: SiteLocale
    primaryLocale: string
    secondaryLocale: string | null
    pendingLocale: string | null
    settingsRequestedTab: { tab: SettingsTab; key: number; section?: string } | null
    onNavLanguageSwitcherChange: (show: boolean) => void
    onAddLanguage: (locale: string) => void
    onRemoveLanguage: () => void
    onMakePrimary: (locale: string) => void
    onThemeChange: (key: string, value: string) => void
    onBlockFieldChange: (index: number, field: string, value: string) => void
    onBlockUpdate: (index: number, changes: Record<string, unknown>) => void
    onHeaderUpdate: (changes: Record<string, unknown>) => void
    onFooterUpdate: (changes: Record<string, unknown>) => void
    onSiteSettingsChange: (changes: Partial<SiteData>) => void | Promise<void>
    onPageUpdate: (pageId: string, changes: Partial<PageData>) => Promise<PageData | null> | PageData | null

    // F05 FR-3x: bottom bar → 4-tab Tools sheet (bsChat/bsSite unified) + empty-page FAB.
    // XOR with the block-settings sheet above — page.tsx owns both open-states so opening
    // one always closes the other.
    toolsSheetOpen: boolean
    toolsSheetTab: ToolsSheetTab
    onOpenTools: (tab?: ToolsSheetTab) => void
    onCloseTools: () => void
    onToolsTabChange: (tab: ToolsSheetTab) => void
    toolsPanelProps: ToolsSheetPanelProps
    // AI processing (F05 screen 2): canvas overlay + bottom bar becomes "■ Stop AI".
    aiRunning: boolean
    onStopAI: () => void

    // #1472 Part B: dismissible "better on Desktop" advisory banner, sticky above the
    // bottom bar. Same `onCopyLink` reference page.tsx passes to `EditorToolbar` (DRY —
    // no second clipboard implementation).
    onCopyLink: () => void
}

/** Swipe-up gesture threshold (px) — matches F05's `touchend` Δ>30 → open sheet. */
const SWIPE_UP_THRESHOLD = 30

const MOVE_BTN_CLS =
    'flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--editor-border)] bg-[var(--editor-overlay-bg)] py-2 text-xs font-medium text-[var(--editor-text)] transition-colors hover:bg-[var(--editor-overlay-hover)] disabled:cursor-not-allowed disabled:opacity-40'

/**
 * Compact (≤767px) `/editor/[siteId]` layout: canvas-first — the live `PreviewFrame`
 * is the main surface; tap-selecting a block auto-opens its own block-settings bottom
 * sheet (F05 `bsBlock`: header + move up/down + `SettingsPanel` block view + delete).
 *
 * Phase 02: replaces the Phase 01 full-screen `EditorSidebar` (no-canvas) compact body.
 * The AI Chat / Components / Pages tabs move into the Phase 03 bottom-bar Tools sheet.
 * Owns only the delete-confirm dialog's open state — all editor domain state (blocks,
 * selection, etc.) stays in page.tsx / the editor store, same as the desktop layout.
 */
export function CompactEditorLayout({
    previewFrameProps,
    onBlockSelect,
    totalBlocks,
    onReorderBlock,
    onDeleteBlockConfirmed,
    isMobileSettingsOpen,
    onCloseMobileSettings,
    currentBlock,
    selectedBlock,
    theme,
    site,
    siteName,
    headerBlock,
    footerBlock,
    pages,
    currentPageId,
    siteLocale,
    primaryLocale,
    secondaryLocale,
    pendingLocale,
    settingsRequestedTab,
    onNavLanguageSwitcherChange,
    onAddLanguage,
    onRemoveLanguage,
    onMakePrimary,
    onThemeChange,
    onBlockFieldChange,
    onBlockUpdate,
    onHeaderUpdate,
    onFooterUpdate,
    onSiteSettingsChange,
    onPageUpdate,
    toolsSheetOpen,
    toolsSheetTab,
    onOpenTools,
    onCloseTools,
    onToolsTabChange,
    toolsPanelProps,
    aiRunning,
    onStopAI,
    onCopyLink,
}: CompactEditorLayoutProps) {
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [bannerVisible, setBannerVisible] = useState(false)
    const swipeStartYRef = useRef<number | null>(null)

    const blockLabel = currentBlock
        ? blockRegistry.getBlockMeta(currentBlock.blockType)?.name || currentBlock.blockType
        : ''
    const canMoveUp = selectedBlock !== null && selectedBlock > 0
    const canMoveDown = selectedBlock !== null && selectedBlock < totalBlocks - 1
    // F05 screen 11: empty new-page state — FAB is the ONLY screen showing it, and it
    // hides while the Tools sheet is open (mirrors the F05 `.fab.hide` behavior).
    const showFab = totalBlocks === 0 && !toolsSheetOpen

    const handleConfirmDelete = () => {
        if (selectedBlock === null) return
        const deletedType = currentBlock?.blockType || 'block'
        onDeleteBlockConfirmed(selectedBlock)
        setDeleteConfirmOpen(false)
        onCloseMobileSettings()
        // Mirrors the desktop BlockActionBar's delete confirm + undo toast (PreviewFrame.tsx)
        // so both entry points give the same feedback — reuses the store's own undo(), no forked logic.
        toast.success(`Deleted ${deletedType.replace(/-/g, ' ')}`, {
            duration: 5000,
            action: { label: 'Undo', onClick: () => useEditorStore.getState().undo() },
        })
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="relative flex min-h-0 flex-1 flex-col">
                <PreviewFrame {...previewFrameProps} onBlockSelect={onBlockSelect} disableDragDrop hideBlockActionBar />

                {/* F05 screen 2: AI-processing overlay — canvas dims + spinner while an AI edit is in flight. */}
                {aiRunning && (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[var(--editor-bg)]/70 backdrop-blur-sm">
                        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" aria-hidden />
                        <p className="text-sm font-medium text-[var(--editor-text)]">AI is editing your design…</p>
                    </div>
                )}
            </div>

            {/* F05 FAB — empty-page screen (11) ONLY; hides while the Tools sheet is open.
                Bottom offset grows while the advisory banner is showing (its rough
                rendered height, ~110px) so the two never overlap. */}
            {showFab && (
                <button
                    type="button"
                    onClick={() => onOpenTools('chat')}
                    aria-label="Open AI Chat"
                    className={cn(
                        'fixed right-3.5 z-40 flex h-[50px] w-[50px] items-center justify-center rounded-full bg-gradient-to-br from-[hsl(var(--info))] to-[hsl(var(--primary))] text-white shadow-lg shadow-[hsl(var(--primary)/0.35)] transition-transform active:scale-90',
                        bannerVisible ? 'bottom-[calc(178px+env(safe-area-inset-bottom))]' : 'bottom-[calc(68px+env(safe-area-inset-bottom))]',
                    )}
                >
                    <MessageCircle className="h-5 w-5" aria-hidden />
                </button>
            )}

            {/* #1472 Part B: dismissible "better on Desktop" advisory — a normal flow row
                stacked directly above the bottom bar (not fixed/overlaid), so the two
                never overlap and both stay tappable. */}
            <EditorAdvisoryBanner onCopyLink={onCopyLink} onVisibleChange={setBannerVisible} />

            {/* F05 bottom bar — tap or swipe-up opens the 4-tab Tools sheet; becomes
                "■ Stop AI" while an AI edit is running (no undo/redo pill — hidden per F05-v2). */}
            <div
                role="button"
                tabIndex={0}
                aria-label={aiRunning ? 'Stop AI' : 'Open AI Chat & Tools'}
                onClick={() => (aiRunning ? onStopAI() : onOpenTools())}
                onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return
                    e.preventDefault()
                    aiRunning ? onStopAI() : onOpenTools()
                }}
                onTouchStart={(e) => { swipeStartYRef.current = e.touches[0]?.clientY ?? null }}
                onTouchEnd={(e) => {
                    const startY = swipeStartYRef.current
                    swipeStartYRef.current = null
                    if (aiRunning || startY === null) return
                    const endY = e.changedTouches[0]?.clientY ?? startY
                    if (startY - endY > SWIPE_UP_THRESHOLD) onOpenTools()
                }}
                className="relative z-20 flex min-h-[56px] shrink-0 cursor-pointer items-center justify-center gap-1.5 border-t border-[var(--editor-border)] bg-[var(--editor-surface)] px-4 pb-[env(safe-area-inset-bottom)] text-xs font-semibold text-[hsl(var(--primary))]"
            >
                <span className="absolute top-1.5 h-1 w-9 rounded-full bg-[var(--editor-text-muted)]/35" aria-hidden />
                {aiRunning ? (
                    <>
                        <Square className="h-3.5 w-3.5 fill-current" aria-hidden /> Stop AI
                    </>
                ) : (
                    <>
                        <MessageCircle className="h-3.5 w-3.5" aria-hidden /> Open AI Chat &amp; Tools
                        <ChevronUp className="h-4 w-4" aria-hidden />
                    </>
                )}
            </div>

            <EditorToolsSheet
                open={toolsSheetOpen}
                activeTab={toolsSheetTab}
                onTabChange={onToolsTabChange}
                onClose={onCloseTools}
                panelProps={toolsPanelProps}
            />

            {/* F05 screen 4: block-settings bottom sheet (bsBlock) — auto-opens on tap-select */}
            {isMobileSettingsOpen && currentBlock && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end">
                    <div
                        className="absolute inset-0 bg-black/60"
                        onClick={onCloseMobileSettings}
                        onKeyDown={(e) => e.key === 'Escape' && onCloseMobileSettings()}
                        role="button"
                        tabIndex={0}
                        aria-label="Close block settings"
                    />
                    <div className="relative flex max-h-[70vh] landscape:max-h-[90vh] flex-col overflow-hidden rounded-t-2xl border-t border-[var(--editor-border)] bg-[var(--editor-surface)]">
                        <div className="flex items-center justify-between border-b border-[var(--editor-border)] px-4 py-3">
                            <div className="flex min-w-0 items-baseline gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--editor-text-muted)]">Block</span>
                                <span className="truncate text-sm font-medium text-[var(--editor-text)]">{blockLabel}</span>
                            </div>
                            <button
                                type="button"
                                onClick={onCloseMobileSettings}
                                className="rounded-lg p-1.5 text-[var(--editor-text-muted)] hover:bg-[var(--editor-overlay-hover)] hover:text-[var(--editor-text)]"
                                aria-label="Close block settings"
                            >
                                <X className="h-5 w-5" aria-hidden />
                            </button>
                        </div>

                        {/* mv-bar (F05): calls the same reorder handler the desktop BlockActionBar uses */}
                        <div className="flex gap-2 border-b border-[var(--editor-border)] px-4 py-2.5">
                            <button
                                type="button"
                                disabled={!canMoveUp}
                                onClick={() => selectedBlock !== null && onReorderBlock(selectedBlock, selectedBlock - 1)}
                                className={MOVE_BTN_CLS}
                            >
                                <ChevronUp className="h-3.5 w-3.5" aria-hidden /> Move Up
                            </button>
                            <button
                                type="button"
                                disabled={!canMoveDown}
                                onClick={() => selectedBlock !== null && onReorderBlock(selectedBlock, selectedBlock + 1)}
                                className={MOVE_BTN_CLS}
                            >
                                <ChevronDown className="h-3.5 w-3.5" aria-hidden /> Move Down
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-1 py-1">
                            <SettingsPanel
                                block={currentBlock}
                                blockIndex={selectedBlock}
                                theme={theme}
                                site={site}
                                siteName={siteName || site?.name || ''}
                                siteStatus={site?.status || 'draft'}
                                headerBlock={headerBlock}
                                footerBlock={footerBlock}
                                pages={pages}
                                currentPageId={currentPageId}
                                siteLocale={siteLocale}
                                generationLocale={site?.generationLocale ?? siteLocale}
                                primaryLocale={primaryLocale} secondaryLocale={secondaryLocale}
                                pendingLocale={pendingLocale}
                                navShowLanguageSwitcher={Boolean((headerBlock as { showLanguageSwitcher?: boolean } | null)?.showLanguageSwitcher)}
                                navMultilingualEnabled={Boolean((headerBlock as { multilingualEnabled?: boolean; showLanguageSwitcher?: boolean } | null)?.multilingualEnabled ?? (headerBlock as { showLanguageSwitcher?: boolean } | null)?.showLanguageSwitcher)}
                                onNavLanguageSwitcherChange={onNavLanguageSwitcherChange}
                                onAddLanguage={onAddLanguage}
                                onRemoveLanguage={onRemoveLanguage}
                                onMakePrimary={onMakePrimary}
                                onThemeChange={onThemeChange}
                                onBlockFieldChange={onBlockFieldChange}
                                onBlockUpdate={onBlockUpdate}
                                onHeaderUpdate={onHeaderUpdate}
                                onFooterUpdate={onFooterUpdate}
                                onSiteSettingsChange={onSiteSettingsChange}
                                onPageUpdate={onPageUpdate}
                                requestedTab={settingsRequestedTab}
                                fullWidth
                                hideChrome
                            />
                        </div>

                        {/* F05 bs-del-bar: reuses the same delete handler as the desktop BlockActionBar */}
                        <div className="border-t border-[var(--editor-border)] px-4 py-3">
                            <button
                                type="button"
                                onClick={() => setDeleteConfirmOpen(true)}
                                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.1)] py-2.5 text-sm font-medium text-[hsl(var(--destructive))] transition-colors hover:bg-[hsl(var(--destructive)/0.16)]"
                            >
                                <Trash2 className="h-4 w-4" aria-hidden /> Delete Block
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <DeleteBlockConfirm
                open={deleteConfirmOpen}
                blockName={currentBlock?.blockType || 'block'}
                scope="page"
                onConfirm={handleConfirmDelete}
                onCancel={() => setDeleteConfirmOpen(false)}
            />
        </div>
    )
}
