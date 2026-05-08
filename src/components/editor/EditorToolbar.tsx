'use client'

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
    Loader2,
    Menu,
    Monitor,
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
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import type { PageData } from '@/store/editorStore'

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
        <header className="relative flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0F172A]/90 backdrop-blur-sm px-5">
            <div className="flex min-w-0 items-center gap-3">
                <button
                    type="button"
                    onClick={onOpenMenu}
                    className="inline-flex h-8 items-center gap-2 rounded-xl px-3 text-sm font-medium text-[#F8FAFC] transition-colors hover:bg-white/5"
                    title={et.openMenu}
                >
                    <Menu className="h-4 w-4" />
                    {et.menu}
                </button>

                <div className="inline-flex h-8 items-center gap-2 rounded-lg bg-white/[0.04] px-3">
                    <CurrentPageIcon className="h-3.5 w-3.5 text-slate-400" />
                    <span className="max-w-[120px] truncate text-[12px] font-medium text-slate-300">{currentPageTitle}</span>
                </div>

                <button
                    type="button"
                    onClick={onOpenTemplates}
                    className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium text-[#F8FAFC] transition-colors hover:bg-white/5"
                >
                    <span className="text-base leading-none">🎨</span>
                    {et.templates}
                </button>

                <div className="mx-1.5 h-4 w-px bg-white/[0.08]" />

                <button
                    type="button"
                    onClick={onUndo}
                    disabled={!canUndo}
                    className="inline-flex h-8 items-center gap-2 rounded-[10px] px-2.5 text-xs font-medium text-[#F8FAFC] transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                    title={et.undoShortcut}
                >
                    <Undo2 className="h-4 w-4" />
                    {et.undo}
                </button>

                <button
                    type="button"
                    onClick={onRedo}
                    disabled={!canRedo}
                    className="inline-flex h-8 items-center gap-2 rounded-[10px] px-2.5 text-xs font-medium text-[#F8FAFC] transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                    title={et.redoShortcut}
                >
                    <Redo2 className="h-4 w-4" />
                    {et.redo}
                </button>
            </div>

            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="flex h-[38px] items-center rounded-full border border-[rgba(59,130,246,0.04)] bg-[rgba(30,41,59,0.8)] px-[5px] py-px">
                    <button
                        type="button"
                        onClick={() => onViewportChange('desktop')}
                        className={cn(
                            'inline-flex h-7 min-w-[104px] items-center justify-center gap-2 rounded-full px-4 text-xs transition-colors',
                            viewport === 'desktop'
                                ? 'bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] font-semibold text-white'
                                : 'font-medium text-white/70 hover:text-white',
                        )}
                    >
                        <span className="text-[15px] leading-none">💻</span>
                        {et.desktop}
                    </button>
                    <button
                        type="button"
                        onClick={() => onViewportChange('mobile')}
                        className={cn(
                            'inline-flex h-7 min-w-[94px] items-center justify-center gap-2 rounded-full px-4 text-xs transition-colors',
                            viewport === 'mobile'
                                ? 'bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] font-semibold text-white'
                                : 'font-medium text-white/70 hover:text-white',
                        )}
                    >
                        <span className="text-[15px] leading-none">📱</span>
                        {et.mobile}
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2.5">
                <div className="inline-flex items-center gap-1.5 text-[11px]">
                    <span className={cn('h-1.5 w-1.5 rounded-full', isSaving ? 'animate-pulse bg-amber-400' : hasUnsavedChanges ? 'bg-amber-400' : 'bg-emerald-400')} />
                    <span className="text-slate-400">{isSaving ? et.saving : hasUnsavedChanges ? et.unsaved : et.saved}</span>
                </div>

                <div className="h-4 w-px bg-white/[0.08]" />

                {(() => {
                    const ps = derivePublishState({ isPublished, isPublishing, hasUnsavedChanges, hasUnpublishedChanges })
                    const badgeConfig: Record<PublishState, { label: string; cls: string }> = {
                        draft: { label: et.draft, cls: 'bg-white/[0.06] text-slate-400' },
                        publishing: { label: et.publishing, cls: 'bg-blue-500/15 text-blue-400 animate-pulse' },
                        live: { label: et.live, cls: 'bg-emerald-500/15 text-emerald-400' },
                        'live-dirty': { label: et.changesPending, cls: 'bg-amber-500/15 text-amber-400' },
                        updating: { label: et.updating || 'Updating...', cls: 'bg-blue-500/15 text-blue-400 animate-pulse' },
                    }
                    const { label, cls } = badgeConfig[ps]
                    return (
                        <div className={cn('inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-[10px] font-semibold uppercase tracking-wider', cls)}>
                            {ps === 'live' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                            {label}
                        </div>
                    )
                })()}

                <Button variant="ghost" size="sm" asChild className="h-8 rounded-lg border border-white/[0.08] px-3 text-[11px] font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white">
                    <a
                        href={currentPageId ? `/preview/${siteId}?pageId=${currentPageId}` : `/preview/${siteId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <SquareArrowOutUpRight className="h-3.5 w-3.5" />
                        {et.preview}
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
                                    className="z-50 min-w-[180px] rounded-xl border border-white/[0.08] bg-[#1E293B] p-1.5 shadow-2xl"
                                    sideOffset={8}
                                    align="end"
                                >
                                    <DropdownMenu.Item
                                        onSelect={onViewLive}
                                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium text-slate-200 outline-none hover:bg-white/[0.06] focus:bg-white/[0.06]"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                                        {vm.openWebsite}
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                        onSelect={onCopyLink}
                                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium text-slate-200 outline-none hover:bg-white/[0.06] focus:bg-white/[0.06]"
                                    >
                                        <Copy className="h-3.5 w-3.5 text-slate-400" />
                                        {vm.copyLink}
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Separator className="my-1 h-px bg-white/[0.08]" />
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
