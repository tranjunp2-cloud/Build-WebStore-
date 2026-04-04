'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Search, X, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { TemplateCard, type Template } from '@/components/frontend/TemplateCard'
import { TemplatePreviewModal } from '@/components/frontend/TemplatePreviewModal'
import { cn } from '@/lib/utils'

const CATEGORIES = [
    { value: 'all', label: 'All' },
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'beauty', label: 'Beauty' },
    { value: 'tech', label: 'Tech' },
    { value: 'health', label: 'Health' },
    { value: 'education', label: 'Education' },
    { value: 'realestate', label: 'Real Estate' },
    { value: 'fitness', label: 'Fitness' },
    { value: 'creative', label: 'Creative' },
    { value: 'business', label: 'Business' },
]

interface EditorTemplateModalProps {
    isOpen: boolean
    onClose: () => void
    siteId: string
    onApplied: () => void
}

export function EditorTemplateModal({ isOpen, onClose, siteId, onApplied }: EditorTemplateModalProps) {
    const [templates, setTemplates] = useState<Template[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [activeCategory, setActiveCategory] = useState('all')
    const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)
    const [isApplying, setIsApplying] = useState<string | null>(null)
    const [confirmTemplate, setConfirmTemplate] = useState<Template | null>(null)

    // Fetch templates on mount
    useEffect(() => {
        if (!isOpen) return
        setIsLoading(true)
        fetch('/api/templates/list?limit=50&sort=sortOrder', { credentials: 'include' })
            .then((res) => res.json())
            .then((data) => setTemplates(data.docs || []))
            .catch(() => toast.error('Failed to load templates'))
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

    // Filter templates
    const filtered = templates.filter((t) => {
        const matchesCategory = activeCategory === 'all' || t.category?.includes(activeCategory)
        const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase())
        return matchesCategory && matchesSearch
    })

    const handleUseTemplate = useCallback((templateId: string) => {
        const template = templates.find((t) => t.id === templateId)
        if (template) {
            setPreviewTemplate(null)
            setConfirmTemplate(template)
        }
    }, [templates])

    const handleConfirmApply = useCallback(async () => {
        if (!confirmTemplate) return
        setIsApplying(confirmTemplate.id)

        try {
            const res = await fetch('/api/ai/apply-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ templateId: confirmTemplate.id, siteId }),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => null)
                let errMsg = `Server returned ${res.status}`
                if (typeof data?.error === 'string') {
                    errMsg = data.error
                } else if (data?.error) {
                    errMsg = typeof data.error.code === 'string' ? data.error.code : JSON.stringify(data.error)
                }
                throw new Error(errMsg)
            }

            toast.success(`Template "${confirmTemplate.name}" applied!`)
            setConfirmTemplate(null)
            onApplied()
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to apply template'
            toast.error('Failed to apply template', { description: message })
        } finally {
            setIsApplying(null)
        }
    }, [confirmTemplate, siteId, onApplied])

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
                        <h2 className="text-lg font-bold text-white">Choose a Template</h2>
                        <button
                            onClick={onClose}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-3 border-b border-white/5 px-6 py-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search templates..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="rounded-lg border border-white/10 bg-white/5 py-1.5 pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:outline-none"
                            />
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {CATEGORIES.map((cat) => (
                                <button
                                    key={cat.value}
                                    onClick={() => setActiveCategory(cat.value)}
                                    className={cn(
                                        'rounded-lg px-3 py-1 text-xs font-medium transition-colors',
                                        activeCategory === cat.value
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                    )}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {isLoading ? (
                            <div className="flex h-40 items-center justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-white/30" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex h-40 items-center justify-center text-sm text-gray-500">
                                No templates found
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                                {filtered.map((template) => (
                                    <TemplateCard
                                        key={template.id}
                                        template={template}
                                        onPreview={setPreviewTemplate}
                                        onUse={handleUseTemplate}
                                        isApplying={isApplying}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

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
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isApplying && setConfirmTemplate(null)} />
                    <div
                        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1120] p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                                <AlertTriangle className="h-5 w-5 text-amber-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Apply &ldquo;{confirmTemplate.name}&rdquo;?</h3>
                                <p className="mt-1 text-sm text-gray-400">
                                    This will replace your current page layout and theme. This action cannot be undone.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setConfirmTemplate(null)}
                                disabled={!!isApplying}
                                className="rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/10 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmApply}
                                disabled={!!isApplying}
                                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                            >
                                {isApplying ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Applying...
                                    </>
                                ) : (
                                    'Apply Template'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
