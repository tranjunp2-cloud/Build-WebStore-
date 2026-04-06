'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
    ChevronDown,
    Check,
    FilePenLine,
    FileWarning,
    FileText,
    Home,
    Loader2,
    Menu,
    Monitor,
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
import type { PageData } from '@/store/editorStore'

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
    onViewportChange,
}: EditorToolbarProps) {
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
                        title="Menu"
                    >
                        <Menu className="h-4 w-4" />
                    </button>

                    <button
                        type="button"
                        onClick={onOpenTemplates}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-amber-300/80 transition-colors hover:bg-white/[0.06]"
                        title="Templates"
                    >
                        <Palette className="h-4 w-4" />
                    </button>

                    <div className="mx-1 h-4 w-px bg-white/[0.06]" />

                    <div className="flex items-center gap-1">
                        <span className={cn('h-1.5 w-1.5 rounded-full', isSaving ? 'animate-pulse bg-amber-400' : hasUnsavedChanges ? 'bg-amber-400' : 'bg-emerald-400')} />
                        <span className="text-[11px] text-slate-400">{isSaving ? 'Saving...' : hasUnsavedChanges ? 'Unsaved' : 'Saved'}</span>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <Button variant="ghost" size="icon" asChild className="h-8 w-8 rounded-lg text-slate-300 hover:bg-white/[0.06] hover:text-white">
                        <a
                            href={currentPageId ? `/preview/${siteId}?pageId=${currentPageId}` : `/preview/${siteId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Preview"
                        >
                            <SquareArrowOutUpRight className="h-3.5 w-3.5" />
                        </a>
                    </Button>

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
                            <>
                                <Check className="h-3.5 w-3.5" />
                                Live
                            </>
                        ) : (
                            <>
                                <Rocket className="h-3.5 w-3.5" />
                                Publish
                            </>
                        )}
                    </Button>

                </div>
            </header>
        )
    }

    return (
        <header className="relative flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0F172A]/90 backdrop-blur-sm px-5">
            <div className="flex min-w-0 items-center gap-3">
                <button
                    type="button"
                    onClick={onOpenMenu}
                    className="inline-flex h-8 items-center gap-2 rounded-xl px-3 text-sm font-medium text-[#F8FAFC] transition-colors hover:bg-white/5"
                    title="Open menu"
                >
                    <Menu className="h-4 w-4" />
                    Menu
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
                    Templates
                </button>

                <div className="mx-1.5 h-4 w-px bg-white/[0.08]" />

                <button
                    type="button"
                    onClick={onUndo}
                    disabled={!canUndo}
                    className="inline-flex h-8 items-center gap-2 rounded-[10px] px-2.5 text-xs font-medium text-[#F8FAFC] transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Undo (Cmd/Ctrl+Z)"
                >
                    <Undo2 className="h-4 w-4" />
                    Undo
                </button>

                <button
                    type="button"
                    onClick={onRedo}
                    disabled={!canRedo}
                    className="inline-flex h-8 items-center gap-2 rounded-[10px] px-2.5 text-xs font-medium text-[#F8FAFC] transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Redo (Cmd/Ctrl+Shift+Z)"
                >
                    <Redo2 className="h-4 w-4" />
                    Redo
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
                        Desktop
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
                        Mobile
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2.5">
                <div className="inline-flex items-center gap-1.5 text-[11px]">
                    <span className={cn('h-1.5 w-1.5 rounded-full', isSaving ? 'animate-pulse bg-amber-400' : hasUnsavedChanges ? 'bg-amber-400' : 'bg-emerald-400')} />
                    <span className="text-slate-400">{isSaving ? 'Saving...' : hasUnsavedChanges ? 'Unsaved' : 'Saved'}</span>
                </div>

                <div className="h-4 w-px bg-white/[0.08]" />

                <div className={cn(
                    'inline-flex h-6 items-center rounded-md px-2 text-[10px] font-semibold uppercase tracking-wider',
                    isPublished ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/[0.06] text-slate-400',
                )}>
                    {isPublished ? 'Live' : 'Draft'}
                </div>

                <Button variant="ghost" size="sm" asChild className="h-8 rounded-lg border border-white/[0.08] px-3 text-[11px] font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white">
                    <a
                        href={currentPageId ? `/preview/${siteId}?pageId=${currentPageId}` : `/preview/${siteId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <SquareArrowOutUpRight className="h-3.5 w-3.5" />
                        Preview
                    </a>
                </Button>

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
                        <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Publishing
                        </>
                    ) : publishSuccess ? (
                        <>
                            <Check className="h-3.5 w-3.5" />
                            Published
                        </>
                    ) : (
                        <>
                            <Rocket className="h-3.5 w-3.5" />
                            Publish
                        </>
                    )}
                </Button>
            </div>
        </header>
    )
}
