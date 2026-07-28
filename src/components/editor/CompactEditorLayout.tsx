'use client'

import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { ChevronDown, ChevronUp, Loader2, MessageCircle, Square, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { blockRegistry } from '@/blocks/registry'
import { useI18n } from '@/i18n'
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
    isContactSavePending: boolean
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
    onBlockFieldChange: (index: number, field: string, value: string | boolean) => void
    onBlockUpdate: (index: number, changes: Record<string, unknown>) => void
    onHeaderUpdate: (changes: Record<string, unknown>) => void
    onFooterUpdate: (changes: Record<string, unknown>) => void
    onSiteSettingsChange: (changes: Partial<SiteData>) => void | boolean | Promise<void | boolean>
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

/** FAB bottom clearance (px) above the bottom bar when the advisory banner is hidden. */
const FAB_BASE_OFFSET_PX = 68
/** Default advisory-banner height (px) assumed before the first ResizeObserver
 * measurement fires — matches the previous hardcoded `178px` total (68 + 110) so
 * there's no flash on first paint while the banner is visible. */
const FAB_DEFAULT_BANNER_HEIGHT_PX = 110

const MOVE_BTN_CLS =
    'flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-solid border-[var(--editor-border)] bg-[var(--editor-overlay-bg)] py-2 text-xs font-medium text-[var(--editor-text)] transition-colors hover:bg-[var(--editor-overlay-hover)] disabled:cursor-not-allowed disabled:opacity-40 min-[768px]:min-h-11 min-[768px]:text-sm'

/**
 * Compact (<1280px, phone + all iPads) `/editor/[siteId]` layout: canvas-first — the live `PreviewFrame`
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
    isContactSavePending,
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
    const { t, ti } = useI18n()
    const cl = t.editor.compactLayout
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [bannerVisible, setBannerVisible] = useState(false)
    const swipeStartYRef = useRef<number | null>(null)
    // M3 (PR #1485 review fix): measure the advisory banner's real rendered height
    // instead of assuming a fixed ~110px — its text can wrap to more lines (e.g.
    // longer Malay strings), which would otherwise push the FAB under the banner.
    const bannerWrapperRef = useRef<HTMLDivElement | null>(null)
    const [bannerHeight, setBannerHeight] = useState(FAB_DEFAULT_BANNER_HEIGHT_PX)

    useEffect(() => {
        const el = bannerWrapperRef.current
        if (!el) return
        const observer = new ResizeObserver((entries) => {
            const height = entries[0]?.contentRect.height
            if (typeof height === 'number') setBannerHeight(height)
        })
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    // GH-1557 Bug 4: lock background canvas scroll while either mobile sheet is open.
    // Single effect keyed on BOTH flags (not one per sheet) — page.tsx already enforces
    // isMobileSettingsOpen/toolsSheetOpen are mutually exclusive (see XOR note above), but
    // two independent effects toggling the same document.body.style.overflow could still
    // race across the open-A→open-B transition depending on cleanup/effect ordering. One
    // effect with an OR condition has no such race.
    useEffect(() => {
        if (!isMobileSettingsOpen && !toolsSheetOpen) return
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = ''
        }
    }, [isMobileSettingsOpen, toolsSheetOpen])

    // GH-1557 Bug 7: navigation/footer/breadcrumb have no entry in `blocks` or `globalBlocks`
    // (unlike cartWidget/whatsapp-button/social), so `currentBlock` is null for them — but the
    // sheet must still open, driven by `settingsRequestedTab` alone. Desktop's SettingsPanel is
    // always mounted so `block=null` there is a non-issue; this compact sheet only mounts when
    // `currentBlock` is truthy, hence the dedicated mode below.
    const navFooterMenuMode = !currentBlock && settingsRequestedTab?.tab === 'menu'
    const navFooterMenuLabel = settingsRequestedTab?.section === 'breadcrumb'
        ? 'Breadcrumb'
        : settingsRequestedTab?.section === 'footer'
            ? 'Footer'
            : 'Navigation'

    const blockLabel = currentBlock
        ? blockRegistry.getBlockMeta(currentBlock.blockType)?.name || currentBlock.blockType
        : navFooterMenuMode
            ? navFooterMenuLabel
            : ''
    // Floating global widgets (cartWidget/whatsapp-button/social) use negative indices and
    // aren't part of the page's block flow — move/delete don't apply to them (their own
    // enable/disable + variant controls live in the SettingsPanel block view below).
    // Nav/footer/breadcrumb menu mode has no block at all, so it hides the same way.
    const isGlobalWidget = (selectedBlock !== null && selectedBlock < 0) || navFooterMenuMode
    const canMoveUp = selectedBlock !== null && selectedBlock > 0
    const canMoveDown = selectedBlock !== null && selectedBlock >= 0 && selectedBlock < totalBlocks - 1
    // F05 screen 11: empty new-page state — FAB is the ONLY screen showing it, and it
    // hides while the Tools sheet is open (mirrors the F05 `.fab.hide` behavior).
    const showFab = totalBlocks === 0 && !toolsSheetOpen

    const handleConfirmDelete = () => {
        // Defense-in-depth: the delete-bar button itself is hidden for floating widgets
        // (isGlobalWidget) above, but guard here too — deleteBlock(negativeIndex) is a
        // silent no-op against the page's block array and must never fire a fake success.
        if (selectedBlock === null || selectedBlock < 0) return
        const deletedType = currentBlock?.blockType || 'block'
        onDeleteBlockConfirmed(selectedBlock)
        setDeleteConfirmOpen(false)
        onCloseMobileSettings()
        // Mirrors the desktop BlockActionBar's delete confirm + undo toast (PreviewFrame.tsx)
        // so both entry points give the same feedback — reuses the store's own undo(), no forked logic.
        toast.success(ti(cl.deletedBlock, { type: deletedType.replace(/-/g, ' ') }), {
            duration: 5000,
            action: { label: t.editor.aiChat.undo, onClick: () => useEditorStore.getState().undo() },
        })
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Phase 06: tablet band (≥768) caps + centers the canvas so it reads as a
                comfortable "sheet" on iPad instead of edge-to-edge full-bleed; phone
                (<768) keeps the previous unconstrained full-width canvas untouched. */}
            <div className="relative flex min-h-0 flex-1 flex-col min-[768px]:mx-auto min-[768px]:w-full min-[768px]:max-w-[920px]">
                <PreviewFrame {...previewFrameProps} onBlockSelect={onBlockSelect} disableDragDrop hideBlockActionBar />

                {/* F05 screen 2: AI-processing overlay — canvas dims + spinner while an AI edit is in flight. */}
                {aiRunning && (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[var(--editor-bg)]/70 backdrop-blur-sm">
                        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" aria-hidden />
                        <p className="text-sm font-medium text-[var(--editor-text)]">{cl.aiEditing}</p>
                    </div>
                )}
            </div>

            {/* F05 FAB — empty-page screen (11) ONLY; hides while the Tools sheet is open.
                Bottom offset grows by the advisory banner's real measured height (M3 fix)
                while it's showing, so the two never overlap regardless of text wrap. */}
            {showFab && (
                <button
                    type="button"
                    onClick={() => onOpenTools('chat')}
                    aria-label={cl.openAIChat}
                    className="fixed right-3.5 z-40 flex h-[50px] w-[50px] items-center justify-center rounded-full bg-gradient-to-br from-[hsl(var(--info))] to-[hsl(var(--primary))] text-white shadow-lg shadow-[hsl(var(--primary)/0.35)] transition-transform active:scale-90"
                    style={{ bottom: `calc(${bannerVisible ? FAB_BASE_OFFSET_PX + bannerHeight : FAB_BASE_OFFSET_PX}px + env(safe-area-inset-bottom))` }}
                >
                    <MessageCircle className="h-5 w-5" aria-hidden />
                </button>
            )}

            {/* #1472 Part B: dismissible "better on Desktop" advisory — a normal flow row
                stacked directly above the bottom bar (not fixed/overlaid), so the two
                never overlap and both stay tappable. Wrapped so the FAB above can measure
                its real rendered height via ResizeObserver (M3 fix) — the wrapper carries
                no size of its own, it collapses to 0 when the banner renders `null`. */}
            <div ref={bannerWrapperRef}>
                <EditorAdvisoryBanner onCopyLink={onCopyLink} onVisibleChange={setBannerVisible} />
            </div>

            {/* F05 bottom bar — tap or swipe-up opens the 4-tab Tools sheet; becomes
                "■ Stop AI" while an AI edit is running (no undo/redo pill — hidden per F05-v2). */}
            <div
                role="button"
                tabIndex={0}
                aria-label={aiRunning ? t.editor.aiChat.stopAI : cl.openChatAndTools}
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
                className="relative z-20 flex min-h-[56px] shrink-0 cursor-pointer items-center justify-center gap-1.5 border-t border-solid border-[var(--editor-border)] bg-[var(--editor-surface)] px-4 pb-[env(safe-area-inset-bottom)] text-xs font-semibold text-[hsl(var(--primary))]"
            >
                <span className="absolute top-1.5 h-1 w-9 rounded-full bg-[var(--editor-text-muted)]" style={{ opacity: 0.35 }} aria-hidden />
                {aiRunning ? (
                    <>
                        <Square className="h-3.5 w-3.5 fill-current" aria-hidden /> {t.editor.aiChat.stopAI}
                    </>
                ) : (
                    <>
                        <MessageCircle className="h-3.5 w-3.5" aria-hidden /> {cl.openChatAndTools}
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

            {/* F05 screen 4: block-settings bottom sheet (bsBlock) — auto-opens on tap-select.
                GH-1557 Bug 7: also opens for nav/footer/breadcrumb, which have no `currentBlock`. */}
            {isMobileSettingsOpen && (currentBlock || navFooterMenuMode) && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end min-[768px]:items-center">
                    <div
                        className="absolute inset-0 bg-black/60"
                        onClick={onCloseMobileSettings}
                        onKeyDown={(e) => e.key === 'Escape' && onCloseMobileSettings()}
                        role="button"
                        tabIndex={0}
                        aria-label="Close block settings"
                    />
                    {/* Phase 06: tablet band caps width + height and centers horizontally, but
                        stays flush against the bottom edge (top corners only, no bottom margin)
                        same as phone; phone (<768) keeps the original edge-to-edge bottom sheet
                        unchanged. */}
                    <div className="relative flex max-h-[70vh] max-[767px]:landscape:max-h-[90vh] min-[768px]:max-h-[640px] flex-col overflow-hidden rounded-t-2xl border-t border-solid border-[var(--editor-border)] bg-[var(--editor-surface)] min-[768px]:w-full min-[768px]:max-w-[680px] min-[768px]:shadow-2xl">
                        <div className="flex items-center justify-between border-b border-solid border-[var(--editor-border)] px-4 py-3">
                            <div className="flex min-w-0 items-baseline gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--editor-text-muted)]">Block</span>
                                <span className="truncate text-sm font-medium text-[var(--editor-text)] min-[768px]:text-base">{blockLabel}</span>
                            </div>
                            <button
                                type="button"
                                onClick={onCloseMobileSettings}
                                className="flex items-center justify-center rounded-lg p-1.5 text-[var(--editor-text-muted)] hover:bg-[var(--editor-overlay-hover)] hover:text-[var(--editor-text)] min-[768px]:h-11 min-[768px]:w-11"
                                aria-label="Close block settings"
                            >
                                <X className="h-5 w-5" aria-hidden />
                            </button>
                        </div>

                        {/* mv-bar (F05): calls the same reorder handler the desktop BlockActionBar uses.
                            Hidden for floating global widgets — negative indices aren't page-flow
                            positions, so move up/down doesn't apply. */}
                        {!isGlobalWidget && (
                            <div className="flex gap-2 border-b border-solid border-[var(--editor-border)] px-4 py-2.5">
                                <button
                                    type="button"
                                    disabled={!canMoveUp}
                                    onClick={() => selectedBlock !== null && onReorderBlock(selectedBlock, selectedBlock - 1)}
                                    className={MOVE_BTN_CLS}
                                >
                                    <ChevronUp className="h-3.5 w-3.5" aria-hidden /> {cl.moveUp}
                                </button>
                                <button
                                    type="button"
                                    disabled={!canMoveDown}
                                    onClick={() => selectedBlock !== null && onReorderBlock(selectedBlock, selectedBlock + 1)}
                                    className={MOVE_BTN_CLS}
                                >
                                    <ChevronDown className="h-3.5 w-3.5" aria-hidden /> {cl.moveDown}
                                </button>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto px-1 py-1">
                            <SettingsPanel
                                block={currentBlock}
                                blockIndex={selectedBlock}
                                theme={theme}
                                site={site}
                                siteName={siteName || site?.name || ''}
                                isContactSavePending={isContactSavePending}
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

                        {/* F05 bs-del-bar: reuses the same delete handler as the desktop BlockActionBar.
                            Hidden for floating global widgets — deleteBlock(negativeIndex) is a
                            no-op against the page's block array (widgets aren't in it); their
                            on/off toggle already lives in the SettingsPanel block view above. */}
                        {!isGlobalWidget && (
                            <div className="border-t border-solid border-[var(--editor-border)] px-4 py-3">
                                <button
                                    type="button"
                                    onClick={() => setDeleteConfirmOpen(true)}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-solid border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.1)] py-2.5 text-sm font-medium text-[hsl(var(--destructive))] transition-colors hover:bg-[hsl(var(--destructive)/0.16)] min-[768px]:min-h-11"
                                >
                                    <Trash2 className="h-4 w-4" aria-hidden /> {cl.deleteBlock}
                                </button>
                            </div>
                        )}
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
