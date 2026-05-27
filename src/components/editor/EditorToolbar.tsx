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
        <div className="flex h-8 w-full items-center gap-0.5 rounded-md border border-white/[0.08] bg-[#0B1120] p-1">
            {cells.map((cell, i) => (
                <div
                    key={i}
                    className={cn(
                        'h-full rounded-sm',
                        cell === 'preview'
                            ? 'flex-1 bg-gradient-to-r from-[#3B82F6]/40 to-[#2DD4BF]/40'
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
                ? 'bg-white/[0.08] text-[#F8FAFC] hover:bg-white/[0.12]'
                : 'text-slate-500 hover:bg-white/5 hover:text-[#F8FAFC]',
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
                    className="editor-portal w-56 rounded-xl border dark:border-white/[0.08] border-[rgba(0,0,0,0.1)] dark:bg-[#1E293B] bg-white p-2 dark:text-slate-200 text-slate-700 shadow-2xl"
                >
                    <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider dark:text-slate-400 text-slate-500">
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
                                            ? 'border-[#3B82F6]/60 bg-[#3B82F6]/10'
                                            : 'dark:border-white/[0.06] border-[rgba(0,0,0,0.08)] bg-transparent dark:hover:bg-white/[0.04] hover:bg-slate-50',
                                    )}
                                >
                                    <PresetThumb cells={p.cells} />
                                    <span className="text-[11px] font-medium dark:text-slate-200 text-slate-700">{p.label}</span>
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
}: EditorToolbarProps) {
    const { t } = useI18n()
    const et = t.editor.toolbar
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
        return (
            <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0F172A]/90 backdrop-blur-sm px-3">
                <div className="flex min-w-0 items-center gap-0.5">
                    <button
                        type="button"
                        onClick={onOpenMenu}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                        title={et.menu}
                    >
                        <Menu className="h-4 w-4" />
                    </button>

                    <button
                        type="button"
                        onClick={onOpenTemplates}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-amber-300/80 transition-colors hover:bg-white/[0.06]"
                        title={et.templates}
                    >
                        <Palette className="h-4 w-4" />
                    </button>

                    <div className="mx-1 h-4 w-px bg-white/[0.06]" />

                    <div className="flex items-center gap-1">
                        <span className={cn('h-1.5 w-1.5 rounded-full', isSaving ? 'animate-pulse bg-amber-400' : hasUnsavedChanges ? 'bg-amber-400' : 'bg-emerald-400')} />
                        <span className="text-[11px] text-slate-400">{isSaving ? et.saving : hasUnsavedChanges ? et.unsaved : et.saved}</span>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <Button variant="ghost" size="icon" asChild className="h-8 w-8 rounded-lg text-slate-300 hover:bg-white/[0.06] hover:text-white">
                        <a
                            href={currentPageId ? `/preview/${siteId}?pageId=${currentPageId}` : `/preview/${siteId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={et.preview}
                        >
                            <SquareArrowOutUpRight className="h-3.5 w-3.5" />
                        </a>
                    </Button>

                    {isPublished && siteUrl ? (
                        <>
                        {(hasUnsavedChanges || hasUnpublishedChanges) && (
                            <Button
                                type="button"
                                size="sm"
                                onClick={onRepublish}
                                disabled={isPublishing || isSaving}
                                className="h-8 rounded-lg border-0 bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] px-3.5 text-[11px] font-semibold text-white hover:opacity-95"
                            >
                                {isPublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><RefreshCw className="h-3.5 w-3.5" /> {et.update}</>}
                            </Button>
                        )}
                        <Button
                            type="button"
                            size="sm"
                            onClick={onViewLive}
                            className="h-8 rounded-lg border-0 bg-gradient-to-r from-emerald-500 to-emerald-400 px-3.5 text-[11px] font-semibold text-white hover:opacity-95"
                        >
                            <Globe className="h-3.5 w-3.5" />
                            {et.live}
                        </Button>
                        </>
                    ) : (
                        <Button
                            type="button"
                            size="sm"
                            onClick={onPublish}
                            disabled={isPublishing || publishSuccess}
                            className={cn(
                                'h-8 rounded-lg border-0 bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] px-3.5 text-[11px] font-semibold text-white hover:opacity-95',
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
        )
    }

    return (
        <>
        <header className="flex h-12 shrink-0 items-center overflow-hidden border-b border-white/[0.06] bg-[#0F172A]/90 backdrop-blur-sm px-5">
            {/* LEFT: page tools. Text labels collapse only at tier 2 (< 1024px). */}
            <div className="flex shrink-0 items-center gap-2">
                <button
                    type="button"
                    onClick={onOpenMenu}
                    className="inline-flex h-8 shrink-0 items-center gap-0 rounded-xl px-2 text-sm font-medium text-[#F8FAFC] transition-all hover:bg-white/5 lg:gap-2 lg:px-3"
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
                    className="inline-flex h-9 shrink-0 items-center gap-0 rounded-xl px-2 text-sm font-medium text-[#F8FAFC] transition-all hover:bg-white/5 lg:gap-2 lg:px-3"
                    title={et.templates}
                >
                    <span className="text-base leading-none">🎨</span>
                    <span className="hidden lg:inline">{et.templates}</span>
                </button>

                <div className="mx-1 h-4 w-px shrink-0 bg-white/[0.08]" />

                <button
                    type="button"
                    onClick={onUndo}
                    disabled={!canUndo}
                    className="inline-flex h-8 shrink-0 items-center gap-0 rounded-[10px] px-2 text-xs font-medium text-[#F8FAFC] transition-all hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50 lg:gap-2 lg:px-2.5"
                    title={et.undoShortcut}
                >
                    <Undo2 className="h-4 w-4 shrink-0" />
                    <span className="hidden lg:inline">{et.undo}</span>
                </button>

                <button
                    type="button"
                    onClick={onRedo}
                    disabled={!canRedo}
                    className="inline-flex h-8 shrink-0 items-center gap-0 rounded-[10px] px-2 text-xs font-medium text-[#F8FAFC] transition-all hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50 lg:gap-2 lg:px-2.5"
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
                <div className="hidden h-[38px] items-center rounded-full border border-[rgba(59,130,246,0.04)] bg-[rgba(30,41,59,0.8)] px-[5px] py-px lg:flex">
                    <button
                        type="button"
                        onClick={() => onViewportChange('desktop')}
                        className={cn(
                            'inline-flex h-7 shrink-0 items-center justify-center gap-0 rounded-full px-2 text-xs transition-all min-[1366px]:min-w-[104px] min-[1366px]:gap-2 min-[1366px]:px-4',
                            viewport === 'desktop'
                                ? 'bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] font-semibold text-white'
                                : 'font-medium text-white/70 hover:text-white',
                        )}
                        title={et.desktop}
                    >
                        <span className="text-[15px] leading-none">💻</span>
                        <span className="hidden min-[1366px]:inline">{et.desktop}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onViewportChange('mobile')}
                        className={cn(
                            'inline-flex h-7 shrink-0 items-center justify-center gap-0 rounded-full px-2 text-xs transition-all min-[1366px]:min-w-[94px] min-[1366px]:gap-2 min-[1366px]:px-4',
                            viewport === 'mobile'
                                ? 'bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] font-semibold text-white'
                                : 'font-medium text-white/70 hover:text-white',
                        )}
                        title={et.mobile}
                    >
                        <span className="text-[15px] leading-none">📱</span>
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

                {isPublished && siteUrl ? (
                    <>
                        {/* Re-publish / Update button (AC-2: visible when has unsaved or unpublished changes) */}
                        {(hasUnsavedChanges || hasUnpublishedChanges) && (
                            <Button
                                type="button"
                                size="sm"
                                onClick={onRepublish}
                                disabled={isPublishing || isSaving}
                                className="h-8 rounded-lg border-0 bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] px-3.5 text-[11px] font-semibold text-white shadow-lg shadow-blue-500/15 hover:shadow-blue-500/25 hover:opacity-95"
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
                                    className="editor-portal z-50 min-w-[180px] rounded-xl border dark:border-white/[0.08] border-[rgba(0,0,0,0.1)] dark:bg-[#1E293B] bg-white p-1.5 shadow-2xl"
                                    sideOffset={8}
                                    align="end"
                                >
                                    <DropdownMenu.Item
                                        onSelect={onViewLive}
                                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium dark:text-slate-200 text-slate-700 outline-none dark:hover:bg-white/[0.06] hover:bg-slate-100 dark:focus:bg-white/[0.06] focus:bg-slate-100"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                                        {vm.openWebsite}
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                        onSelect={onCopyLink}
                                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium dark:text-slate-200 text-slate-700 outline-none dark:hover:bg-white/[0.06] hover:bg-slate-100 dark:focus:bg-white/[0.06] focus:bg-slate-100"
                                    >
                                        <Copy className="h-3.5 w-3.5 text-slate-400" />
                                        {vm.copyLink}
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Separator className="my-1 h-px dark:bg-white/[0.08] bg-[rgba(0,0,0,0.08)]" />
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
                        disabled={isPublishing || publishSuccess}
                        className={cn(
                            'h-8 rounded-lg border-0 bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] px-4 text-[11px] font-semibold text-white shadow-lg shadow-blue-500/15 hover:shadow-blue-500/25 hover:opacity-95',
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
