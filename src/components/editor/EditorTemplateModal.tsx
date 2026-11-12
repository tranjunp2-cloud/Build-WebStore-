'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Loader2, X, AlertTriangle, Search, Sparkles, SearchX, LayoutTemplate } from 'lucide-react'
import { toast } from 'sonner'
import { TemplateCard, type Template } from '@/components/frontend/TemplateCard'
import { TemplatePreviewModal } from '@/components/frontend/TemplatePreviewModal'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { useApplyTemplate, useTemplateList, useTemplateSearch, useTemplateForSwap, type AppliedTemplateState } from '@/hooks/use-template-queries'
import {
    templateSearchFormSchema,
    type TemplateSearchFormValues,
    type TemplateSearchRequest,
} from '@/lib/validations/template-search'
import { detectTemplateSearchLocale } from '@/lib/templates/natural-language-search'

const CATEGORY_KEYS = [
    'all', 'restaurant', 'ecommerce', 'beauty', 'tech', 'health',
    'education', 'realEstate', 'fitness', 'creative', 'business',
    'cafeBakery', 'events', 'blog', 'travel',
] as const

const CATEGORY_VALUES: Record<string, string> = {
    all: 'all', restaurant: 'restaurant', ecommerce: 'ecommerce',
    beauty: 'beauty', tech: 'tech', health: 'health', education: 'education',
    realEstate: 'realestate', fitness: 'fitness', creative: 'creative',
    business: 'business', cafeBakery: 'fnb', events: 'events',
    blog: 'blog', travel: 'travel',
}

const EMPTY_TEMPLATES: Template[] = []

export interface TemplateApplyResult {
    templateName: string
    siteId: string | number
    unmatchedBlocks?: string[]
    appliedState?: AppliedTemplateState
    draftVersion?: string
}

interface EditorTemplateModalProps {
    isOpen: boolean
    onClose: () => void
    siteId: string
    pageId?: string | null
    onBeforeApply?: () => Promise<void>
    onApplyPending?: () => void
    onApplyStarted?: (template: Omit<Template, 'defaultTheme'> & { defaultTheme?: Record<string, unknown> | null }) => void
    onApplyFailed?: () => void
    onApplied: (result: TemplateApplyResult) => void | Promise<void>
}

function TemplateGridSkeleton() {
    return (
        <div
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
            data-testid="template-loading-state"
            aria-label="Loading templates"
        >
            {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                    <Skeleton className="h-64 w-full rounded-none" />
                    <div className="space-y-3 p-5">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                </div>
            ))}
        </div>
    )
}

export function EditorTemplateModal({ isOpen, onClose, siteId, pageId, onBeforeApply, onApplyPending, onApplyStarted, onApplyFailed, onApplied }: EditorTemplateModalProps) {
    const { t, locale } = useI18n()
    const tt = t.editor.template
    const sub = t.common.subscriptionErrors
    const categories = CATEGORY_KEYS.map(key => ({ value: CATEGORY_VALUES[key], label: tt[key] }))
    const [submittedSearch, setSubmittedSearch] = useState<TemplateSearchRequest | null>(null)
    const [activeCategory, setActiveCategory] = useState('all')
    const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)
    const [confirmTemplate, setConfirmTemplate] = useState<Template | null>(null)
    const detailQuery = useTemplateForSwap(isOpen && confirmTemplate && !confirmTemplate.swapData ? confirmTemplate.id : null)
    const preparedTemplate = confirmTemplate?.swapData ? confirmTemplate : detailQuery.data
    const isPreparing = Boolean(confirmTemplate && !preparedTemplate)
    const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null)
    const applyGuardRef = useRef(false)
    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors },
    } = useForm<TemplateSearchFormValues>({
        resolver: zodResolver(templateSearchFormSchema),
        defaultValues: { query: '' },
    })
    const inputQuery = watch('query')
    const listQuery = useTemplateList(isOpen)
    const searchQuery = useTemplateSearch(submittedSearch, isOpen)
    const { mutateAsync: applyTemplate } = useApplyTemplate(sub)
    const templates = listQuery.data ?? EMPTY_TEMPLATES
    const searchResults = submittedSearch ? (searchQuery.data ?? EMPTY_TEMPLATES) : null
    const displayedTemplates = searchResults ?? templates
    const activeRequest = submittedSearch ? searchQuery : listQuery
    const isLoading = submittedSearch ? searchQuery.isPending : listQuery.isPending
    const isSearching = submittedSearch !== null && searchQuery.isFetching
    const activeError = activeRequest.error
    const isApplying = applyingTemplateId

    // Hover preview state (desktop only)
    const [hoverPreview, setHoverPreview] = useState<{ template: Template; rect: DOMRect } | null>(null)
    const hoverTimerRef = useRef<NodeJS.Timeout | null>(null)

    // Clean up hover timer on unmount
    useEffect(() => {
        return () => {
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
        }
    }, [])

    useEffect(() => {
        if (isOpen) return
        reset({ query: '' })
        setSubmittedSearch(null)
        setActiveCategory('all')
        setHoverPreview(null)
    }, [isOpen, reset])

    useEffect(() => {
        if (!activeError) return
        console.error('[EditorTemplateModal] Template request failed:', activeError)
        toast.error(tt.loadError)
    }, [activeError, tt.loadError])

    useEffect(() => {
        const error = detailQuery.error
        if (!error || ('status' in error && error.status === 401)) return
        toast.error(tt.loadError)
    }, [detailQuery.error, tt.loadError])

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (previewTemplate) setPreviewTemplate(null)
                else if (confirmTemplate) setConfirmTemplate(null)
                else onClose()
            }
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [isOpen, onClose, previewTemplate, confirmTemplate])

    const filtered = displayedTemplates.filter((template) => {
        return activeCategory === 'all' || template.category?.includes(activeCategory)
    })

    const handleSearch = useCallback((values: TemplateSearchFormValues) => {
        setActiveCategory('all')
        setHoverPreview(null)
        setSubmittedSearch({
            query: values.query,
            locale: detectTemplateSearchLocale(values.query, locale),
        })
    }, [locale])

    const clearSearch = useCallback(() => {
        reset({ query: '' })
        setSubmittedSearch(null)
        setActiveCategory('all')
    }, [reset])

    const handleUseTemplate = useCallback(
        (templateId: string) => {
            const template = (searchResults ?? templates).find((t) => t.id === templateId)
            if (template) {
                setPreviewTemplate(null)
                setHoverPreview(null)
                setConfirmTemplate(template)
            }
        },
        [searchResults, templates],
    )

    const handleConfirmApply = useCallback(async () => {
        if (!confirmTemplate || !preparedTemplate || applyGuardRef.current) return
        const templateToApply = preparedTemplate
        applyGuardRef.current = true
        setApplyingTemplateId(templateToApply.id)

        try {
            onApplyPending?.()
            // Save unsaved changes before applying template.
            // onBeforeApply throws with 'PRE_SAVE_FAILED' sentinel if save fails;
            // the caller (handleSave) already toasted the error, so we silently abort.
            if (onBeforeApply) await onBeforeApply()
            onApplyStarted?.(templateToApply.swapData ? {
                ...templateToApply,
                ...templateToApply.swapData,
                defaultTheme: templateToApply.swapData.defaultTheme ?? null,
            } : templateToApply)

            const data = await applyTemplate({ templateId: templateToApply.id, siteId, pageId: pageId || undefined })
            setConfirmTemplate(null)
            await onApplied({
                templateName: templateToApply.name,
                siteId: data.siteId ?? siteId,
                unmatchedBlocks: data.unmatchedBlocks,
                appliedState: data.appliedState,
                draftVersion: data.draftVersion,
            })
        } catch (err) {
            onApplyFailed?.()
            if (err instanceof Error && 'status' in err && err.status === 401) return
            const message = err instanceof Error ? err.message : tt.applyFailed
            // PRE_SAVE_FAILED: save already showed an error toast — don't duplicate
            if (message !== 'PRE_SAVE_FAILED') {
                toast.error(tt.applyFailed, { description: message })
            }
            // Retain confirmation for Retry after restoring the editor snapshot.
        } finally {
            applyGuardRef.current = false
            setApplyingTemplateId(null)
        }
    }, [applyTemplate, confirmTemplate, preparedTemplate, onApplied, onBeforeApply, onApplyPending, onApplyStarted, onApplyFailed, siteId, pageId, tt.applyFailed])

    // Hover preview handlers (desktop)
    const handleCardMouseEnter = useCallback((template: Template, e: React.MouseEvent) => {
        const target = e.currentTarget as HTMLElement
        hoverTimerRef.current = setTimeout(() => {
            const rect = target.getBoundingClientRect()
            setHoverPreview({ template, rect })
        }, 500)
    }, [])

    const handleCardMouseLeave = useCallback(() => {
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
        setHoverPreview(null)
    }, [])

    if (!isOpen) return null

    return (
        <>
            {/* Main modal */}
            <div className="fixed inset-0 z-[90] flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="editor-template-modal-title"
                    data-testid="editor-template-modal"
                    className="relative flex h-[calc(100dvh-1rem)] max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--editor-bg)] sm:h-[90vh]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 sm:px-6">
                        <h2 id="editor-template-modal-title" className="text-lg font-bold text-white">{tt.title}</h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
                            aria-label={tt.close}
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col gap-3 border-b border-white/5 px-4 py-3 sm:px-6">
                        <form className="flex w-full items-start gap-2" onSubmit={handleSubmit(handleSearch)} noValidate>
                            <div className="min-w-0 flex-1">
                                <div className="relative">
                                    <Sparkles aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-blue-300" />
                                    <Input
                                        {...register('query')}
                                        type="text"
                                        placeholder={tt.searchPlaceholder}
                                        autoComplete="off"
                                        className="h-10 pl-9 pr-10 text-[13px]"
                                        aria-label={tt.searchPlaceholder}
                                        aria-invalid={Boolean(errors.query)}
                                        aria-describedby={errors.query ? 'template-search-error' : undefined}
                                    />
                                    {inputQuery && (
                                        <button
                                            type="button"
                                            onClick={clearSearch}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                                            aria-label={tt.clearSearch}
                                            title={tt.clearSearch}
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                                {errors.query && (
                                    <p id="template-search-error" className="mt-1 text-xs text-red-400" role="alert">
                                        {errors.query.message}
                                    </p>
                                )}
                            </div>
                            <button
                                type="submit"
                                disabled={isSearching || !inputQuery?.trim()}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label={tt.searchAction}
                                title={tt.searchAction}
                            >
                                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            </button>
                        </form>
                        <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide sm:flex-wrap sm:pb-0">
                            {categories.map((cat) => (
                                <button
                                    key={cat.value}
                                    onClick={() => setActiveCategory(cat.value)}
                                    className={cn(
                                        'shrink-0 rounded-lg px-3 py-1 text-xs font-medium transition-colors',
                                        activeCategory === cat.value
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white',
                                    )}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Results info */}
                    {!isLoading && !activeError && displayedTemplates.length > 0 && (
                        <div className="px-4 pt-3 text-xs text-gray-500 sm:px-6">
                            {tt.showingCount.replace('{filtered}', String(filtered.length)).replace('{total}', String(displayedTemplates.length))}
                        </div>
                    )}

                    {/* Grid */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                        {confirmTemplate ? null : isLoading || isSearching ? (
                            <TemplateGridSkeleton />
                        ) : activeError ? (
                            <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 text-center" data-testid="template-error-state" role="alert">
                                <AlertTriangle className="h-8 w-8 text-red-400" aria-hidden="true" />
                                <div>
                                    <h3 className="font-semibold text-red-100">{tt.errorTitle}</h3>
                                    <p className="mt-1 text-sm text-red-200/70">{activeError.message || tt.loadError}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void activeRequest.refetch()}
                                    disabled={activeRequest.isFetching}
                                    className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
                                >
                                    {activeRequest.isFetching && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                                    {tt.retry}
                                </button>
                            </div>
                        ) : searchResults === null && templates.length === 0 ? (
                            <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-center text-gray-400" data-testid="template-list-empty">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                                    <LayoutTemplate className="h-6 w-6" aria-hidden="true" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white">{tt.noTemplates}</h3>
                                    <p className="mt-1 text-sm text-gray-500">{tt.noTemplatesDescription}</p>
                                </div>
                                <button type="button" onClick={() => void listQuery.refetch()} disabled={listQuery.isFetching} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
                                    {listQuery.isFetching && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                                    {tt.retry}
                                </button>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-center text-gray-400" data-testid="template-search-empty">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                                    <SearchX className="h-6 w-6" aria-hidden="true" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white">
                                        {submittedSearch?.locale === 'vi' ? tt.noMatchVi : tt.noMatch}
                                    </h3>
                                    <p className="mt-1 text-sm text-gray-500">{tt.noMatchDescription}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={submittedSearch ? clearSearch : () => setActiveCategory('all')}
                                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                                >
                                    {submittedSearch ? tt.clearSearch : tt.clearFilters}
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {filtered.map((template) => (
                                    <div
                                        key={template.id}
                                        data-testid="template-card-wrapper"
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleUseTemplate(template.id)
                                        }}
                                        onMouseEnter={(e) => handleCardMouseEnter(template, e)}
                                        onMouseLeave={handleCardMouseLeave}
                                        className="outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--editor-bg)] rounded-2xl"
                                    >
                                        <TemplateCard
                                            template={template}
                                            onPreview={setPreviewTemplate}
                                            onUse={handleUseTemplate}
                                            isApplying={isApplying}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Hover preview tooltip (desktop only) */}
            {hoverPreview && !confirmTemplate && (
                <div
                    className="fixed z-[100] hidden lg:block rounded-xl border border-white/10 bg-[var(--editor-bg)] p-3 shadow-2xl w-[420px]"
                    style={{
                        top: Math.min(hoverPreview.rect.top, typeof window !== 'undefined' ? window.innerHeight - 380 : 400),
                        left: hoverPreview.rect.right + 16,
                    }}
                >
                    <div className="aspect-[4/3] rounded-lg overflow-hidden bg-slate-800 mb-3">
                        <iframe
                            src={`/api/templates/preview?id=${hoverPreview.template.id}`}
                            className="w-[1200px] h-[900px] origin-top-left scale-[0.34] pointer-events-none border-0"
                            loading="lazy"
                            title={tt.previewTitle.replace('{name}', hoverPreview.template.name)}
                        />
                    </div>
                    <h4 className="font-semibold text-sm text-white">{hoverPreview.template.name}</h4>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{hoverPreview.template.description}</p>
                </div>
            )}

            {/* Preview modal (nested) */}
            {previewTemplate && (
                <TemplatePreviewModal
                    template={previewTemplate}
                    onClose={() => setPreviewTemplate(null)}
                    onUse={handleUseTemplate}
                    isApplying={isApplying === previewTemplate.id}
                />
            )}

            {/* Confirmation dialog */}
            {confirmTemplate && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => !isApplying && setConfirmTemplate(null)}
                    />
                    <div
                        role="alertdialog"
                        aria-modal="true"
                        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[var(--editor-bg)] p-5 sm:p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                                <AlertTriangle className="h-5 w-5 text-amber-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">
                                    {tt.applyConfirmTitle.replace('{name}', confirmTemplate.name)}
                                </h3>
                                <p className="mt-1 text-sm text-gray-400">
                                    {tt.applyConfirmDesc}
                                </p>
                            </div>
                        </div>
                        {isPreparing && (detailQuery.isError ? (
                            <div role="alert" className="mb-4 text-sm text-red-400">
                                <p>{detailQuery.error.message || tt.loadError}</p>
                                <button type="button" onClick={() => void detailQuery.refetch()} disabled={detailQuery.isFetching}
                                    className="mt-2 rounded-lg bg-red-500/15 px-3 py-2 font-semibold disabled:opacity-50">
                                    {tt.retry}
                                </button>
                            </div>
                        ) : (
                            <div role="status" aria-label={tt.loading} className="mb-4 space-y-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-2/3" />
                            </div>
                        ))}
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setConfirmTemplate(null)}
                                disabled={!!isApplying}
                                className="rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/10 disabled:opacity-50"
                            >
                                {tt.cancel}
                            </button>
                            <button
                                onClick={handleConfirmApply}
                                disabled={!!isApplying || isPreparing}
                                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                            >
                                {isApplying ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {tt.applying}
                                    </>
                                ) : (
                                    tt.applyButton
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
