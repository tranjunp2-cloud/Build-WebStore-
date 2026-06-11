'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Search, X, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { TemplateCard, type Template } from '@/components/frontend/TemplateCard'
import { TemplatePreviewModal } from '@/components/frontend/TemplatePreviewModal'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { resolveApiError } from '@/lib/ui/resolve-api-error'

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

export interface TemplateApplyResult {
    templateName: string
    siteId: string | number
    unmatchedBlocks?: string[]
}

interface EditorTemplateModalProps {
    isOpen: boolean
    onClose: () => void
    siteId: string
    onBeforeApply?: () => Promise<void>
    onApplied: (result: TemplateApplyResult) => void
}

export function EditorTemplateModal({ isOpen, onClose, siteId, onBeforeApply, onApplied }: EditorTemplateModalProps) {
    const { t } = useI18n()
    const tt = t.editor.template
    const sub = t.common.subscriptionErrors
    const categories = CATEGORY_KEYS.map(key => ({ value: CATEGORY_VALUES[key], label: tt[key] }))
    const [templates, setTemplates] = useState<Template[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchInput, setSearchInput] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [activeCategory, setActiveCategory] = useState('all')
    const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)
    const [isApplying, setIsApplying] = useState<string | null>(null)
    const [confirmTemplate, setConfirmTemplate] = useState<Template | null>(null)

    // Hover preview state (desktop only)
    const [hoverPreview, setHoverPreview] = useState<{ template: Template; rect: DOMRect } | null>(null)
    const hoverTimerRef = useRef<NodeJS.Timeout | null>(null)

    // Debounced search (300ms)
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchInput), 300)
        return () => clearTimeout(timer)
    }, [searchInput])

    // Clean up hover timer on unmount
    useEffect(() => {
        return () => {
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
        }
    }, [])

    // Fetch templates on mount
    useEffect(() => {
        if (!isOpen) return
        setIsLoading(true)
        fetch('/api/templates/list?limit=100', { credentials: 'include' })
            .then((res) => {
                if (!res.ok) throw new Error(`Server returned ${res.status}`)
                return res.json()
            })
            .then((data) => {
                const docs = data.docs || data.results || []
                setTemplates(Array.isArray(docs) ? docs : [])
            })
            .catch((err) => {
                console.error('[EditorTemplateModal] Load error:', err)
                toast.error(tt.loadError)
            })
            .finally(() => setIsLoading(false))
    }, [isOpen])

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

    // Filter templates using debounced search + category match on name, description, and category
    const filtered = templates.filter((t) => {
        const matchesCategory = activeCategory === 'all' || t.category?.includes(activeCategory)
        const q = debouncedSearch.toLowerCase()
        const matchesSearch =
            !q ||
            t.name.toLowerCase().includes(q) ||
            t.description?.toLowerCase().includes(q) ||
            t.category?.some((cat) => cat.toLowerCase().includes(q))
        return matchesCategory && matchesSearch
    })

    const handleUseTemplate = useCallback(
        (templateId: string) => {
            const template = templates.find((t) => t.id === templateId)
            if (template) {
                setPreviewTemplate(null)
                setConfirmTemplate(template)
            }
        },
        [templates],
    )

    const handleConfirmApply = useCallback(async () => {
        if (!confirmTemplate) return
        setIsApplying(confirmTemplate.id)

        try {
            // Save unsaved changes before applying template.
            // onBeforeApply throws with 'PRE_SAVE_FAILED' sentinel if save fails;
            // the caller (handleSave) already toasted the error, so we silently abort.
            if (onBeforeApply) await onBeforeApply()

            const res = await fetch('/api/ai/apply-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ templateId: confirmTemplate.id, siteId }),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => null)
                throw new Error(resolveApiError(data, `Server returned ${res.status}`, sub))
            }

            const data = await res.json().catch(() => ({}))
            setConfirmTemplate(null)
            onApplied({
                templateName: confirmTemplate.name,
                siteId: data.siteId ?? siteId,
                unmatchedBlocks: data.unmatchedBlocks,
            })
        } catch (err) {
            const message = err instanceof Error ? err.message : tt.applyFailed
            // PRE_SAVE_FAILED: save already showed an error toast — don't duplicate
            if (message !== 'PRE_SAVE_FAILED') {
                toast.error(tt.applyFailed, { description: message })
            }
            setConfirmTemplate(null)
        } finally {
            setIsApplying(null)
        }
    }, [confirmTemplate, siteId, onApplied, sub, tt])

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
            <div className="fixed inset-0 z-[90] flex items-center justify-center" onClick={onClose}>
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

                <div
                    className="relative flex h-[90vh] w-[95vw] max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0B1120]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                        <h2 className="text-lg font-bold text-white">{tt.title}</h2>
                        <button
                            onClick={onClose}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col gap-3 border-b border-white/5 px-6 py-3 sm:flex-row sm:flex-wrap sm:items-center">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                            <input
                                type="text"
                                placeholder={tt.searchPlaceholder}
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:outline-none sm:w-auto"
                            />
                        </div>
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
                    {!isLoading && templates.length > 0 && (
                        <div className="px-6 pt-3 text-xs text-gray-500">
                            {tt.showingCount.replace('{filtered}', String(filtered.length)).replace('{total}', String(templates.length))}
                        </div>
                    )}

                    {/* Grid */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {isLoading ? (
                            <div className="flex h-40 flex-col items-center justify-center gap-2">
                                <Loader2 className="h-6 w-6 animate-spin text-white/30" />
                                <span className="text-xs text-gray-600">{tt.loading}</span>
                            </div>
                        ) : templates.length === 0 ? (
                            <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-gray-500">
                                <p>{tt.noTemplates}</p>
                                <p className="text-xs text-gray-600">
                                    {tt.seedHint}
                                </p>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex h-40 items-center justify-center text-sm text-gray-500">
                                {tt.noMatch}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {filtered.map((template) => (
                                    <div
                                        key={template.id}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleUseTemplate(template.id)
                                        }}
                                        onMouseEnter={(e) => handleCardMouseEnter(template, e)}
                                        onMouseLeave={handleCardMouseLeave}
                                        className="outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1120] rounded-2xl"
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
            {hoverPreview && (
                <div
                    className="fixed z-[100] hidden lg:block rounded-xl border border-white/10 bg-[#0B1120] p-3 shadow-2xl w-[420px]"
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
                <div className="fixed inset-0 z-[110] flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => !isApplying && setConfirmTemplate(null)}
                    />
                    <div
                        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1120] p-6"
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
                                disabled={!!isApplying}
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
