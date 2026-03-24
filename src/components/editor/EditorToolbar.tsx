'use client'

import Link from 'next/link'
import {
    Check,
    ExternalLink,
    FileText,
    Loader2,
    Menu,
    Monitor,
    Palette,
    PanelLeft,
    Redo2,
    Save,
    Sparkles,
    Undo2,
    Upload,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EditorToolbarProps {
    siteId: string
    currentPageId: string | null
    siteName: string
    currentPageTitle: string
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
    onUndo,
    onRedo,
    onSave,
    onPublish,
    onViewportChange,
}: EditorToolbarProps) {
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
                                <Upload className="h-3.5 w-3.5" />
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
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#0B1120] px-4">
            <div className="flex min-w-0 items-center gap-3">
                <button
                    type="button"
                    onClick={onOpenMenu}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                    title="Open menu"
                >
                    <Menu className="h-4 w-4" />
                    Menu
                </button>

                <div className="h-5 w-px bg-white/10" />

                <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                        {siteName || 'Untitled Site'}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {currentPageTitle}
                        </span>
                        <Badge
                            variant={isPublished ? 'success' : 'warning'}
                            className="h-5 rounded-full px-2 text-[10px] uppercase tracking-[0.16em]"
                        >
                            {isPublished ? 'Live' : 'Draft'}
                        </Badge>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onUndo}
                    disabled={!canUndo}
                    title="Undo (Cmd/Ctrl+Z)"
                >
                    <Undo2 className="h-4 w-4" />
                </Button>

                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onRedo}
                    disabled={!canRedo}
                    title="Redo (Cmd/Ctrl+Shift+Z)"
                >
                    <Redo2 className="h-4 w-4" />
                </Button>

                <div className="mx-1 h-5 w-px bg-white/10" />

                <div className="flex items-center rounded-full border border-white/10 bg-white/5 p-1">
                    <button
                        type="button"
                        onClick={() => onViewportChange('desktop')}
                        className={cn(
                            'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                            viewport === 'desktop'
                                ? 'bg-blue-500 text-white'
                                : 'text-gray-400 hover:text-white',
                        )}
                    >
                        <Monitor className="h-3.5 w-3.5" />
                        Desktop
                    </button>
                    <button
                        type="button"
                        onClick={() => onViewportChange('mobile')}
                        className={cn(
                            'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                            viewport === 'mobile'
                                ? 'bg-blue-500 text-white'
                                : 'text-gray-400 hover:text-white',
                        )}
                    >
                        <Monitor className="h-3.5 w-3.5" />
                        Mobile
                    </button>
                </div>

                <div className="mx-1 h-5 w-px bg-white/10" />

                <Button
                    type="button"
                    variant={saveSuccess ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={onSave}
                    disabled={isSaving || saveSuccess || !hasUnsavedChanges}
                    className={cn(saveSuccess && 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300')}
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Saving
                        </>
                    ) : saveSuccess ? (
                        <>
                            <Check className="h-3.5 w-3.5" />
                            Saved
                        </>
                    ) : (
                        <>
                            <Save className="h-3.5 w-3.5" />
                            Save
                        </>
                    )}
                </Button>

                <Button variant="outline" size="sm" asChild>
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
                        isPublished && !publishSuccess && 'bg-emerald-600 hover:bg-emerald-500',
                        publishSuccess && 'bg-emerald-600 hover:bg-emerald-600',
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
                            {isPublished ? <Sparkles className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
                            {isPublished ? 'Republish' : 'Publish'}
                        </>
                    )}
                </Button>
            </div>
        </header>
    )
}
