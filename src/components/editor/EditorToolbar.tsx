'use client'

import React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
    AlertTriangle,
    ChevronDown,
    Check,
    Copy,
    ExternalLink,
    EyeOff,
    FilePenLine,
    FileWarning,
    FileText,
    Globe,
    Home,
    LayoutGrid,
    Loader2,
    Menu,
    Monitor,
    PanelLeftClose,
    PanelLeftOpen,
    PanelRightClose,
    PanelRightOpen,
    RefreshCw,
    ShoppingBag,
    Smartphone,
    SquareArrowOutUpRight,
    Palette,
    PanelLeft,
    Redo2,
    Rocket,
    Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import type { PageData } from '@/store/editorStore'
import { useWorkspaceStore, type WorkspacePreset } from '@/store/workspaceStore'

// ── Workspace layout controls ────────────────────────────────────────────
// Three header icons: layout-preset popover, left-sidebar toggle, right-sidebar toggle.
// State lives in workspaceStore (Zustand + localStorage persist).

const PRESETS: Array<{
    id: WorkspacePreset
    label: string
    cells: ('rail' | 'preview')[]
}> = [
    { id: 'default', label: 'Default', cells: ['rail', 'preview', 'rail'] },
    { id: 'focus', label: 'Focus', cells: ['preview'] },
    { id: 'structure', label: 'Structure', cells: ['rail', 'preview'] },
    { id: 'content', label: 'Content', cells: ['preview', 'rail'] },
]

function PresetThumb({ cells }: { cells: ('rail' | 'preview')[] }) {
    return (
        <div className="flex h-8 w-full items-center gap-0.5 rounded-md border border-white/[0.08] bg-[var(--editor-bg)] p-1">
            {cells.map((cell, i) => (
                <div
                    key={i}
                    className={cn(
                        'h-full rounded-sm',
                        cell === 'preview'
                            ? 'flex-1 bg-gradient-to-r from-[hsl(var(--info)/0.4)] to-[hsl(var(--primary)/0.4)]'
                            : 'w-3 bg-white/[0.08]',
                    )}
                />
            ))}
        </div>
    )
}

function WorkspaceLayoutControls() {
    const leftVisible = useWorkspaceStore((s) => s.leftSidebarVisible)
    const rightVisible = useWorkspaceStore((s) => s.rightSidebarVisible)
    const preset = useWorkspaceStore((s) => s.preset)
    const toggleLeft = useWorkspaceStore((s) => s.toggleLeft)
    const toggleRight = useWorkspaceStore((s) => s.toggleRight)
    const applyPreset = useWorkspaceStore((s) => s.applyPreset)

    const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)
    const mod = isMac ? '⌘' : 'Ctrl+'

    const iconCls = (active: boolean) =>
        cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors',
            active
                ? 'bg-white/[0.08] text-[var(--editor-text)] hover:bg-white/[0.12]'
                : 'text-slate-500 hover:bg-white/5 hover:text-[var(--editor-text)]',
        )

    return (
        <div className="flex shrink-0 items-center gap-0.5">
            <Popover>
                <PopoverTrigger asChild>
                    <button type="button" className={iconCls(false)} title="Layout presets">
                        <LayoutGrid className="h-4 w-4" />
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    align="start"
                    sideOffset={8}
                    className="editor-portal w-56 rounded-xl border border-[var(--editor-border)] bg-[var(--editor-surface-elevated)] p-2 text-[var(--editor-text)] shadow-2xl"
                >
                    <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--editor-text-muted)]">
                        Workspace
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                        {PRESETS.map((p) => {
                            const active = preset === p.id
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => applyPreset(p.id)}
                                    className={cn(
                                        'flex flex-col gap-1.5 rounded-lg border p-2 text-left transition-colors',
                                        active
                                            ? 'border-[hsl(var(--primary)/0.6)] bg-[hsl(var(--primary)/0.1)]'
                                            : 'border-[var(--editor-border)] bg-transparent hover:bg-[var(--editor-overlay-hover)]',
                                    )}
                                >
                                    <PresetThumb cells={p.cells} />
                                    <span className="text-[11px] font-medium text-[var(--editor-text-muted)]">{p.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </PopoverContent>
            </Popover>

            <button
                type="button"
                onClick={toggleLeft}
                className={iconCls(leftVisible)}
                title={`${leftVisible ? 'Hide' : 'Show'} left sidebar (${mod}B)`}
                aria-pressed={leftVisible}
            >
                {leftVisible ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>

            <button
                type="button"
                onClick={toggleRight}
                className={iconCls(rightVisible)}
                title={`${rightVisible ? 'Hide' : 'Show'} right sidebar (${mod}J)`}
                aria-pressed={rightVisible}
            >
                {rightVisible ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </button>
        </div>
    )
}

export type PublishState = 'draft' | 'publishing' | 'live' | 'live-dirty' | 'updating'

export function derivePublishState(opts: {
    isPublished: boolean
    isPublishing: boolean
    hasUnsavedChanges: boolean
    hasUnpublishedChanges: boolean
}): PublishState {
    if (opts.isPublishing && opts.isPublished) return 'updating'
    if (opts.isPublishing) return 'publishing'
    if (opts.isPublished && (opts.hasUnsavedChanges || opts.hasUnpublishedChanges)) return 'live-dirty'
    if (opts.isPublished) return 'live'
    return 'draft'
}

interface EditorToolbarProps {
    siteId: string
    currentPageId: string | null
    siteName: string
    currentPageTitle: string
    pages: PageData[]
    isPublished: boolean
    isSaving: boolean
    saveSuccess: boolean
    hasUnsavedChanges: boolean
    hasUnpublishedChanges?: boolean
    isPublishing: boolean
    publishSuccess: boolean
    canUndo: boolean
    canRedo: boolean
    viewport: 'desktop' | 'mobile'
    compact?: boolean
    /** Phase 04: shared with the compact Tools-sheet AI-chat panel (Phase 03) — drives the
     * "Processing…" save-status label and disables Publish/Update while an AI edit is in flight. */
    aiRunning?: boolean
    onOpenMenu: () => void
    onOpenTemplates?: () => void
    onPageSelected: (pageId: string) => void
    onUndo: () => void
    onRedo: () => void
    onSave: () => void
    onPublish: () => void
    onRepublish?: () => void
    onUnpublish?: () => void
    onViewLive?: () => void
    onCopyLink?: () => void
    siteUrl?: string | null
    wasPublished?: boolean
    onViewportChange: (viewport: 'desktop' | 'mobile') => void
    /** F-26: Optional language switcher rendered near workspace controls */
    languageSwitcherSlot?: React.ReactNode
    /** F26-04: When set, translation is in flight — disable Preview/Publish until null. */
    pendingLocale?: string | null
}

export function EditorToolbar({
    siteId,
    currentPageId,
    siteName,
    currentPageTitle,
    pages,
    isPublished,
    isSaving,
    saveSuccess,
    hasUnsavedChanges,
    hasUnpublishedChanges = false,
    isPublishing,
    publishSuccess,
    canUndo,
    canRedo,
    viewport,
    compact = false,
    aiRunning = false,
    onOpenMenu,
    onOpenTemplates,
    onPageSelected,
    onUndo,
    onRedo,
    onSave,
    onPublish,
    onRepublish,
    onUnpublish,
    onViewLive,
    onCopyLink,
    siteUrl,
    wasPublished,
    onViewportChange,
    languageSwitcherSlot,
    pendingLocale,
}: EditorToolbarProps) {
    const { t } = useI18n()
    const et = t.editor.toolbar

    // F26-04: Preview/Publish disabled while translation or save in flight so users can't
    // open a tab against stale DB state. Once everything settles, buttons re-enable.
    const previewDisabled = !!pendingLocale || isSaving || hasUnsavedChanges
    const previewDisabledTitle = pendingLocale
        ? `Translating to ${pendingLocale === 'ms' ? 'Malay' : 'English'}… Preview will be available when complete.`
        : (isSaving || hasUnsavedChanges)
            ? 'Saving changes… Preview will be available when complete.'
            : et.preview
    const vm = t.editor.viewLiveMenu
    const mt = t.editor.maintenance
    const selectablePages = pages.filter(page => !page.deletedAt)
    const currentPage = selectablePages.find(page => page.id === currentPageId) ?? null

    const getPageIcon = (page: Pick<PageData, 'isHomepage' | 'slug'>) => {
        if (page.isHomepage || page.slug === 'home' || page.slug === '') return Home
        if (page.slug === '404' || page.slug === '/404') return FileWarning
        if (page.slug.includes('product') || page.slug.includes('shop') || page.slug.includes('store')) return ShoppingBag
        if (page.slug.includes('about') || page.slug.includes('blog') || page.slug.includes('news')) return FilePenLine
        return FileText
    }

    const CurrentPageIcon = getPageIcon(currentPage ?? { isHomepage: false, slug: '' })

    if (compact) {
        // Phase 04: reuses `t.editor.unpublishModal.processing` ("Processing…") rather than
        // adding a new toolbar.* i18n key — same string already covers this exact meaning.
        const processingLabel = t.editor.unpublishModal.processing

        return (
            <>
            <header className="flex h-12 shrink-0 items-center justify-between overflow-hidden border-b border-white/[0.06] bg-[var(--editor-surface)]/90 backdrop-blur-sm px-3">
                <div className="flex min-w-0 items-center gap-0.5">
                    <button
                        type="button"
                        onClick={onOpenMenu}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white min-[768px]:h-11 min-[768px]:w-11"
                        title={et.menu}
                    >
                        <Menu className="h-4 w-4" />
                    </button>

                    {/* Phase 04 (audit #2): page-selector chip removed from the header (2026-07-02,
                        user: not in F05's header design) — page-switching stays reachable via the
                        Phase 03 Tools sheet Pages tab (PageManagerPanel), no functionality lost. */}

                    <button
                        type="button"
                        onClick={onOpenTemplates}
                        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-1.5 text-amber-300/80 transition-colors hover:bg-white/[0.06] min-[768px]:h-11 min-[768px]:px-2.5"
                        title={et.templates}
                    >
                        <Palette className="h-4 w-4 shrink-0" />
                        <span className="text-[11px] font-medium min-[768px]:text-xs">{et.templates}</span>
                    </button>

                    {/* Phase 06: tablet-only language chip (site content locale) — reuses the
                        same `languageSwitcherSlot` the desktop header already supports (currently
                        unpopulated by page.tsx on either branch, per audit #10); revealing it here
                        keeps compact ready for the slot without forking a second switcher. */}
                    {languageSwitcherSlot && (
                        <div className="hidden min-[768px]:flex items-center pl-0.5">
                            {languageSwitcherSlot}
                        </div>
                    )}

                    <div className="mx-1 h-4 w-px shrink-0 bg-white/[0.06]" />

                    <div className="flex min-w-0 items-center gap-1">
                        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', aiRunning ? 'animate-pulse bg-blue-400' : isSaving ? 'animate-pulse bg-amber-400' : hasUnsavedChanges ? 'bg-amber-400' : 'bg-emerald-400')} />
                        <span className="truncate text-[11px] text-slate-400 min-[768px]:text-xs">{aiRunning ? processingLabel : isSaving ? et.saving : hasUnsavedChanges ? et.unsaved : et.saved}</span>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                    {/* Phase 04 (audit #12): publish-state badge removed from phone (2026-07-02,
                        user: redundant with the saved-status dot + the Live/Publish button's own
                        color — not in F05). Phase 06: tablet has room to spare, so re-surface a
                        compact version ≥768 only (phone stays exactly as Phase 04 left it). */}
                    {(() => {
                        const ps = derivePublishState({ isPublished, isPublishing, hasUnsavedChanges, hasUnpublishedChanges })
                        const tabletBadge: Record<PublishState, { label: string; cls: string }> = {
                            draft: { label: et.draft, cls: 'bg-white/[0.06] text-slate-400' },
                            publishing: { label: et.publishing, cls: 'bg-blue-500/15 text-blue-400 animate-pulse' },
                            live: { label: et.live, cls: 'bg-emerald-500/15 text-emerald-400' },
                            'live-dirty': { label: et.changesPending, cls: 'bg-amber-500/15 text-amber-400' },
                            updating: { label: et.updating || 'Updating...', cls: 'bg-blue-500/15 text-blue-400 animate-pulse' },
                        }
                        const { label, cls } = tabletBadge[ps]
                        return (
                            <span className={cn('hidden min-[768px]:inline-flex h-6 shrink-0 items-center rounded-md px-2 text-[10px] font-semibold uppercase tracking-wider', cls)}>
                                {label}
                            </span>
                        )
                    })()}

                    {previewDisabled ? (
                        <Button
                            variant="ghost"
                            size="icon"
                            disabled
                            title={previewDisabledTitle}
                            className="h-8 w-8 rounded-lg text-slate-500 cursor-not-allowed opacity-50 min-[768px]:h-11 min-[768px]:w-11"
                        >
                            <SquareArrowOutUpRight className="h-3.5 w-3.5" />
                        </Button>
                    ) : (
                        <Button variant="ghost" size="icon" asChild className="h-8 w-8 rounded-lg text-slate-300 hover:bg-white/[0.06] hover:text-white min-[768px]:h-11 min-[768px]:w-11">
                            <a
                                href={currentPageId ? `/preview/${siteId}?pageId=${currentPageId}` : `/preview/${siteId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={et.preview}
                            >
                                <SquareArrowOutUpRight className="h-3.5 w-3.5" />
                            </a>
                        </Button>
                    )}

                    {isPublished && siteUrl ? (
                        <>
                        {(hasUnsavedChanges || hasUnpublishedChanges) && (
                            <Button
                                type="button"
                                size="sm"
                                onClick={onRepublish}
                                disabled={isPublishing || isSaving || aiRunning}
                                className="h-8 rounded-lg border-0 bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--primary))] px-3.5 text-[11px] font-semibold text-white hover:opacity-95 min-[768px]:h-11 min-[768px]:px-4"
                            >
                                {isPublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><RefreshCw className="h-3.5 w-3.5" /> {et.update}</>}
                            </Button>
                        )}
                        {/* Phase 04 (audit #15-18): View-Live dropdown ported from the desktop
                            branch — Open Website / Copy Link / Unpublish (→ UnpublishModal).
                            Phone (2026-07-03, chị): header too tight to show Update + Live at
                            once — hide Live while dirty so only Update shows; tablet keeps both
                            (has room). */}
                        <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                                <Button
                                    type="button"
                                    size="sm"
                                    className={cn(
                                        'h-8 rounded-lg border-0 bg-gradient-to-r from-emerald-500 to-emerald-400 px-3.5 text-[11px] font-semibold text-white hover:opacity-95 min-[768px]:h-11 min-[768px]:px-4',
                                        (hasUnsavedChanges || hasUnpublishedChanges) && 'hidden min-[768px]:inline-flex',
                                    )}
                                >
                                    <Globe className="h-3.5 w-3.5" />
                                    {et.live}
                                    <ChevronDown className="ml-1 h-3 w-3" />
                                </Button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                                <DropdownMenu.Content
                                    className="editor-portal z-50 min-w-[180px] rounded-xl border border-[var(--editor-border)] bg-[var(--editor-surface-elevated)] p-1.5 shadow-2xl"
                                    sideOffset={8}
                                    align="end"
                                >
                                    <DropdownMenu.Item
                                        onSelect={onViewLive}
                                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium text-[var(--editor-text)] outline-none hover:bg-[var(--editor-overlay-hover)] focus:bg-[var(--editor-overlay-hover)]"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                                        {vm.openWebsite}
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                        onSelect={onCopyLink}
                                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium text-[var(--editor-text)] outline-none hover:bg-[var(--editor-overlay-hover)] focus:bg-[var(--editor-overlay-hover)]"
                                    >
                                        <Copy className="h-3.5 w-3.5 text-slate-400" />
                                        {vm.copyLink}
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Separator className="my-1 h-px bg-[var(--editor-border)]" />
                                    <DropdownMenu.Item
                                        onSelect={onUnpublish}
                                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium text-red-400 outline-none hover:bg-red-500/10 focus:bg-red-500/10"
                                    >
                                        <EyeOff className="h-3.5 w-3.5" />
                                        {vm.unpublish}
                                    </DropdownMenu.Item>
                                </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                        </>
                    ) : (
                        <Button
                            type="button"
                            size="sm"
                            onClick={onPublish}
                            disabled={isPublishing || publishSuccess || aiRunning}
                            className={cn(
                                'h-8 rounded-lg border-0 bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--primary))] px-3.5 text-[11px] font-semibold text-white hover:opacity-95 min-[768px]:h-11 min-[768px]:px-4',
                                publishSuccess && 'from-emerald-500 to-emerald-400',
                            )}
                        >
                            {isPublishing ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : publishSuccess ? (
                                <><Check className="h-3.5 w-3.5" /> {et.live}</>
                            ) : (
                                <><Rocket className="h-3.5 w-3.5" /> {et.publish}</>
                            )}
                        </Button>
                    )}

                </div>
            </header>
            {/* Phase 04 (audit #20): maintenance banner — duplicated from the desktop fragment
                below (same condition/content/handler) so it also renders on compact. */}
            {wasPublished && !isPublished && (
                <div className="flex shrink-0 items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>{mt.banner}</span>
                    <Button size="sm" variant="ghost" onClick={onPublish} className="ml-auto h-6 px-2 text-[10px] text-amber-400 hover:bg-amber-500/10 hover:text-amber-300">
                        {mt.republish}
                    </Button>
                </div>
            )}
            </>
        )
    }

    return (
        <>
        <header className="flex h-12 shrink-0 items-center overflow-hidden border-b border-white/[0.06] bg-[var(--editor-surface)]/90 backdrop-blur-sm px-5">
            {/* LEFT: page tools. Text labels collapse only at tier 2 (< 1024px). */}
            <div className="flex shrink-0 items-center gap-2">
                <button
                    type="button"
                    onClick={onOpenMenu}
                    className="inline-flex h-8 shrink-0 items-center gap-0 rounded-xl px-2 text-sm font-medium text-[var(--editor-text)] transition-all hover:bg-white/5 lg:gap-2 lg:px-3"
                    title={et.openMenu}
                >
                    <Menu className="h-4 w-4 shrink-0" />
                    <span className="hidden lg:inline">{et.menu}</span>
                </button>

                <div
                    className="inline-flex h-8 shrink-0 items-center gap-0 rounded-lg bg-white/[0.04] px-2 transition-all lg:gap-2 lg:px-3"
                    title={currentPageTitle}
                >
                    <CurrentPageIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="hidden lg:inline max-w-[120px] truncate text-[12px] font-medium text-slate-300">{currentPageTitle}</span>
                </div>

                <button
                    type="button"
                    onClick={onOpenTemplates}
                    className="inline-flex h-9 shrink-0 items-center gap-0 rounded-xl px-2 text-sm font-medium text-[var(--editor-text)] transition-all hover:bg-white/5 lg:gap-2 lg:px-3"
                    title={et.templates}
                >
                    <Palette className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="hidden lg:inline">{et.templates}</span>
                </button>

                <div className="mx-1 h-4 w-px shrink-0 bg-white/[0.08]" />

                <button
                    type="button"
                    onClick={onUndo}
                    disabled={!canUndo}
                    className="inline-flex h-8 shrink-0 items-center gap-0 rounded-[10px] px-2 text-xs font-medium text-[var(--editor-text)] transition-all hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50 lg:gap-2 lg:px-2.5"
                    title={et.undoShortcut}
                >
                    <Undo2 className="h-4 w-4 shrink-0" />
                    <span className="hidden lg:inline">{et.undo}</span>
                </button>

                <button
                    type="button"
                    onClick={onRedo}
                    disabled={!canRedo}
                    className="inline-flex h-8 shrink-0 items-center gap-0 rounded-[10px] px-2 text-xs font-medium text-[var(--editor-text)] transition-all hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50 lg:gap-2 lg:px-2.5"
                    title={et.redoShortcut}
                >
                    <Redo2 className="h-4 w-4 shrink-0" />
                    <span className="hidden lg:inline">{et.redo}</span>
                </button>
            </div>

            {/* Spacer 1 — flex-grows to keep CENTER centered. Shrinks first when narrowing. */}
            <div className="min-w-2 flex-1" />

            {/* CENTER: device toggle + layout icons. Text collapses at tier 1 (< 1366px). */}
            <div className="flex shrink-0 items-center gap-2">
                <div className="hidden h-[38px] items-center rounded-full border border-[hsl(var(--primary)/0.04)] bg-[rgb(var(--editor-surface-elevated-rgb)/0.8)] px-[5px] py-px lg:flex">
                    <button
                        type="button"
                        onClick={() => onViewportChange('desktop')}
                        className={cn(
                            'inline-flex h-7 shrink-0 items-center justify-center gap-0 rounded-full px-2 text-xs transition-all min-[1366px]:min-w-[104px] min-[1366px]:gap-2 min-[1366px]:px-4',
                            viewport === 'desktop'
                                ? 'bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--primary))] font-semibold text-white'
                                : 'font-medium text-white/70 hover:text-white',
                        )}
                        title={et.desktop}
                    >
                        <Monitor className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="hidden min-[1366px]:inline">{et.desktop}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onViewportChange('mobile')}
                        className={cn(
                            'inline-flex h-7 shrink-0 items-center justify-center gap-0 rounded-full px-2 text-xs transition-all min-[1366px]:min-w-[94px] min-[1366px]:gap-2 min-[1366px]:px-4',
                            viewport === 'mobile'
                                ? 'bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--primary))] font-semibold text-white'
                                : 'font-medium text-white/70 hover:text-white',
                        )}
                        title={et.mobile}
                    >
                        <Smartphone className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="hidden min-[1366px]:inline">{et.mobile}</span>
                    </button>
                </div>

                <WorkspaceLayoutControls />
                {languageSwitcherSlot && (
                    <div className="hidden lg:flex items-center">
                        {languageSwitcherSlot}
                    </div>
                )}
            </div>

            {/* Spacer 2 — symmetric counterpart so CENTER lands at the visual midpoint. */}
            <div className="min-w-2 flex-1" />

            {/* RIGHT: status + actions. Text collapses at tier 1 (< 1366px). */}
            <div className="flex shrink-0 items-center gap-2.5">
                <div
                    className="inline-flex shrink-0 items-center gap-0 text-[11px] transition-all min-[1366px]:gap-1.5"
                    title={isSaving ? et.saving : hasUnsavedChanges ? et.unsaved : et.saved}
                >
                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', isSaving ? 'animate-pulse bg-amber-400' : hasUnsavedChanges ? 'bg-amber-400' : 'bg-emerald-400')} />
                    <span className="hidden text-slate-400 min-[1366px]:inline">{isSaving ? et.saving : hasUnsavedChanges ? et.unsaved : et.saved}</span>
                </div>

                <div className="hidden h-4 w-px shrink-0 bg-white/[0.08] min-[1366px]:block" />

                {(() => {
                    const ps = derivePublishState({ isPublished, isPublishing, hasUnsavedChanges, hasUnpublishedChanges })
                    const badgeConfig: Record<PublishState, { label: string; cls: string; dot?: string }> = {
                        draft: { label: et.draft, cls: 'bg-white/[0.06] text-slate-400' },
                        publishing: { label: et.publishing, cls: 'bg-blue-500/15 text-blue-400 animate-pulse', dot: 'bg-blue-400' },
                        live: { label: et.live, cls: 'bg-emerald-500/15 text-emerald-400', dot: 'bg-emerald-400' },
                        'live-dirty': { label: et.changesPending, cls: 'bg-amber-500/15 text-amber-400', dot: 'bg-amber-400 animate-pulse' },
                        updating: { label: et.updating || 'Updating...', cls: 'bg-blue-500/15 text-blue-400 animate-pulse', dot: 'bg-blue-400' },
                    }
                    const { label, cls, dot } = badgeConfig[ps]
                    // Below tier 2 (< 1024px) the draft badge collapses entirely (no actionable info);
                    // other states keep a colored dot so the user still sees status at a glance.
                    const wrapperVisibility = ps === 'draft' ? 'hidden lg:inline-flex' : 'inline-flex'
                    return (
                        <div
                            className={cn(wrapperVisibility, 'h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-[10px] font-semibold uppercase tracking-wider transition-all', cls)}
                            title={label}
                        >
                            {dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} />}
                            <span className="hidden min-[1366px]:inline">{label}</span>
                        </div>
                    )
                })()}

                {previewDisabled ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled
                        title={previewDisabledTitle}
                        className="h-8 shrink-0 rounded-lg border border-white/[0.08] px-2 text-[11px] font-medium text-slate-500 cursor-not-allowed opacity-50 min-[1366px]:px-3"
                    >
                        <SquareArrowOutUpRight className="h-3.5 w-3.5 shrink-0" />
                        <span className="hidden min-[1366px]:inline">{et.preview}</span>
                    </Button>
                ) : (
                    <Button variant="ghost" size="sm" asChild className="h-8 shrink-0 rounded-lg border border-white/[0.08] px-2 text-[11px] font-medium text-slate-300 transition-all hover:bg-white/[0.06] hover:text-white min-[1366px]:px-3">
                        <a
                            href={currentPageId ? `/preview/${siteId}?pageId=${currentPageId}` : `/preview/${siteId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={et.preview}
                        >
                            <SquareArrowOutUpRight className="h-3.5 w-3.5 shrink-0" />
                            <span className="hidden min-[1366px]:inline">{et.preview}</span>
                        </a>
                    </Button>
                )}

                {isPublished && siteUrl ? (
                    <>
                        {/* Re-publish / Update button (AC-2: visible when has unsaved or unpublished changes) */}
                        {(hasUnsavedChanges || hasUnpublishedChanges) && (
                            <Button
                                type="button"
                                size="sm"
                                onClick={onRepublish}
                                disabled={isPublishing || isSaving || aiRunning}
                                className="h-8 rounded-lg border-0 bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--primary))] px-3.5 text-[11px] font-semibold text-white shadow-lg shadow-blue-500/15 hover:shadow-blue-500/25 hover:opacity-95"
                            >
                                {isPublishing ? (
                                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {et.updating}</>
                                ) : (
                                    <><RefreshCw className="h-3.5 w-3.5" /> {et.update}</>
                                )}
                            </Button>
                        )}

                        {/* View Live dropdown (AC-1: persistent link access) */}
                        <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                                <Button
                                    type="button"
                                    size="sm"
                                    className="h-8 rounded-lg border-0 bg-gradient-to-r from-emerald-500 to-emerald-400 px-3.5 text-[11px] font-semibold text-white shadow-lg shadow-emerald-500/15 hover:shadow-emerald-500/25 hover:opacity-95"
                                >
                                    <Globe className="h-3.5 w-3.5" />
                                    {et.viewLive}
                                    <ChevronDown className="ml-1 h-3 w-3" />
                                </Button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                                <DropdownMenu.Content
                                    className="editor-portal z-50 min-w-[180px] rounded-xl border border-[var(--editor-border)] bg-[var(--editor-surface-elevated)] p-1.5 shadow-2xl"
                                    sideOffset={8}
                                    align="end"
                                >
                                    <DropdownMenu.Item
                                        onSelect={onViewLive}
                                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium text-[var(--editor-text)] outline-none hover:bg-[var(--editor-overlay-hover)] focus:bg-[var(--editor-overlay-hover)]"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                                        {vm.openWebsite}
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                        onSelect={onCopyLink}
                                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium text-[var(--editor-text)] outline-none hover:bg-[var(--editor-overlay-hover)] focus:bg-[var(--editor-overlay-hover)]"
                                    >
                                        <Copy className="h-3.5 w-3.5 text-slate-400" />
                                        {vm.copyLink}
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Separator className="my-1 h-px bg-[var(--editor-border)]" />
                                    <DropdownMenu.Item
                                        onSelect={onUnpublish}
                                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium text-red-400 outline-none hover:bg-red-500/10 focus:bg-red-500/10"
                                    >
                                        <EyeOff className="h-3.5 w-3.5" />
                                        {vm.unpublish}
                                    </DropdownMenu.Item>
                                </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                    </>
                ) : (
                    /* Draft state: Publish button */
                    <Button
                        type="button"
                        size="sm"
                        onClick={onPublish}
                        disabled={isPublishing || publishSuccess || aiRunning}
                        className={cn(
                            'h-8 rounded-lg border-0 bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--primary))] px-4 text-[11px] font-semibold text-white shadow-lg shadow-blue-500/15 hover:shadow-blue-500/25 hover:opacity-95',
                            publishSuccess && 'from-emerald-500 to-emerald-400',
                        )}
                    >
                        {isPublishing ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {et.publishing}</>
                        ) : publishSuccess ? (
                            <><Check className="h-3.5 w-3.5" /> {et.published}</>
                        ) : (
                            <><Rocket className="h-3.5 w-3.5" /> {et.publish}</>
                        )}
                    </Button>
                )}
            </div>

        </header>
            {/* Maintenance mode warning banner (AC-4) — outside header to avoid overlap */}
            {wasPublished && !isPublished && (
                <div className="flex shrink-0 items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-5 py-2 text-xs text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>{mt.banner}</span>
                    <Button size="sm" variant="ghost" onClick={onPublish} className="ml-auto h-6 px-2 text-[10px] text-amber-400 hover:bg-amber-500/10 hover:text-amber-300">
                        {mt.republish}
                    </Button>
                </div>
            )}
        </>
    )
}
