'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
    ChevronDown,
    Check,
    ExternalLink,
    FilePenLine,
    FileWarning,
    FileText,
    Home,
    Loader2,
    Menu,
    Monitor,
    ShoppingBag,
    Smartphone,
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
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[rgba(30,41,59,0.3)] px-2.5">
                <div className="flex min-w-0 items-center gap-1">
                    <button
                        type="button"
                        onClick={onOpenMenu}
                        className="inline-flex h-9 items-center gap-2 rounded-xl px-2.5 text-sm font-medium text-slate-100 transition-colors hover:bg-white/5"
                    >
                        <Menu className="h-4 w-4 text-slate-300" />
                        <span>Menu</span>
                    </button>

                    <button
                        type="button"
                        onClick={onOpenTemplates}
                        className="inline-flex h-9 items-center gap-2 rounded-xl px-2.5 text-sm font-medium text-slate-100 transition-colors hover:bg-white/5"
                    >
                        <Palette className="h-4 w-4 text-amber-300" />
                        <span>Templates</span>
                    </button>
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        type="button"
                        size="sm"
                        onClick={onPublish}
                        disabled={isPublishing || publishSuccess}
                        className={cn(
                            'h-9 rounded-full border-0 bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] px-4 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(45,212,191,0.18)] hover:opacity-95',
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

                    <Button variant="ghost" size="icon" asChild className="h-9 w-9 rounded-xl text-slate-300 hover:bg-white/5 hover:text-white">
                        <a
                            href={currentPageId ? `/api/preview/${siteId}?pageId=${currentPageId}` : `/api/preview/${siteId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open preview"
                        >
                            <PanelLeft className="h-4 w-4" />
                        </a>
                    </Button>
                </div>
            </header>
        )
    }

    return (
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-white/5 bg-[#111827] px-3">
            <div className="flex min-w-0 items-center gap-3">
                <button
                    type="button"
                    onClick={onOpenMenu}
                    className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                    title="Open menu"
                >
                    <Menu className="h-3.5 w-3.5" />
                    Menu
                </button>

                <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                        <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-100 transition-colors hover:bg-white/5 hover:text-white"
                        >
                            <CurrentPageIcon className="h-3.5 w-3.5" />
                            <span className="truncate">{currentPageTitle}</span>
                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        </button>
                    </DropdownMenu.Trigger>

                    <DropdownMenu.Portal>
                        <DropdownMenu.Content
                            sideOffset={8}
                            align="start"
                            className="z-50 min-w-[192px] rounded-xl border border-[rgba(59,130,246,0.15)] bg-[rgba(30,41,59,0.95)] p-1 shadow-[0_18px_40px_rgba(2,6,23,0.45)] backdrop-blur-[5px]"
                        >
                            {selectablePages.map(page => {
                                const isActive = page.id === currentPageId
                                const PageIcon = getPageIcon(page)
                                return (
                                    <DropdownMenu.Item
                                        key={page.id}
                                        onSelect={() => onPageSelected(page.id)}
                                        className={cn(
                                            'flex h-9 cursor-pointer items-center gap-2.5 rounded-[10px] px-4 text-sm font-medium text-[#F8FAFC] outline-none transition-colors',
                                            isActive ? 'bg-white/5' : 'hover:bg-white/5',
                                        )}
                                    >
                                        <PageIcon className="h-4 w-4 shrink-0 text-slate-300" />
                                        <span className="truncate">{page.title}</span>
                                    </DropdownMenu.Item>
                                )
                            })}
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu.Root>

                <button
                    type="button"
                    onClick={onOpenTemplates}
                    className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                >
                    <Palette className="h-3.5 w-3.5 text-amber-300" />
                    Templates
                </button>

                <div className="mx-1 h-3.5 w-px bg-white/10" />

                <button
                    type="button"
                    onClick={onUndo}
                    disabled={!canUndo}
                    className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    title="Undo (Cmd/Ctrl+Z)"
                >
                    <Undo2 className="h-3.5 w-3.5" />
                    Undo
                </button>

                <button
                    type="button"
                    onClick={onRedo}
                    disabled={!canRedo}
                    className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    title="Redo (Cmd/Ctrl+Shift+Z)"
                >
                    <Redo2 className="h-3.5 w-3.5" />
                    Redo
                </button>
            </div>

            <div className="flex items-center gap-2">
                <div className="flex items-center rounded-full bg-white/[0.04] p-0.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                    <button
                        type="button"
                        onClick={() => onViewportChange('desktop')}
                        className={cn(
                            'inline-flex min-w-[76px] items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors',
                            viewport === 'desktop'
                                ? 'bg-[#3B82F6] text-white'
                                : 'text-slate-500 hover:text-white',
                        )}
                    >
                        <Monitor className="h-3.5 w-3.5" />
                        Desktop
                    </button>
                    <button
                        type="button"
                        onClick={() => onViewportChange('mobile')}
                        className={cn(
                            'inline-flex min-w-[76px] items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors',
                            viewport === 'mobile'
                                ? 'bg-[#3B82F6] text-white'
                                : 'text-slate-500 hover:text-white',
                        )}
                    >
                        <Smartphone className="h-3.5 w-3.5" />
                        Mobile
                    </button>
                </div>

                <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                    <span className={cn('h-1.5 w-1.5 rounded-full', isSaving ? 'bg-amber-400' : 'bg-emerald-400')} />
                    <span>{isSaving ? 'Saving' : saveSuccess || !hasUnsavedChanges ? 'Saved' : 'Draft changes'}</span>
                </div>

                <div className="inline-flex items-center rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-slate-300 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                    {isPublished ? 'Live' : 'Draft'}
                </div>

                <Button variant="ghost" size="sm" asChild className="h-8 rounded-full px-3 text-[11px] font-medium text-slate-300 hover:bg-white/5 hover:text-white">
                    <a
                        href={currentPageId ? `/api/preview/${siteId}?pageId=${currentPageId}` : `/api/preview/${siteId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Preview
                    </a>
                </Button>

                <Button
                    type="button"
                    size="sm"
                    onClick={onPublish}
                    disabled={isPublishing || publishSuccess}
                    className={cn(
                        'h-7 rounded-full border border-[#60A5FA]/20 bg-gradient-to-r from-[#3B82F6] to-[#22C55E] px-3.5 text-[11px] font-semibold text-white shadow-[0_10px_20px_rgba(59,130,246,0.18)] hover:opacity-95',
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
