'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/i18n'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import {
    ArrowLeft,
    Sparkles,
    Crown,
    Star,
    Loader2,
    Search,
    LayoutTemplate,
    Eye,
    X,
    Monitor,
    Smartphone,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────
type Template = {
    id: string
    name: string
    description: string
    category: string[]
    thumbnail?: { url: string }
    isPremium: boolean
    isFeatured: boolean
    defaultTheme: {
        primaryColor: string
        secondaryColor?: string
        colorMode: string
    }
}

const CATEGORY_KEYS = [
    'all', 'restaurant', 'ecommerce', 'beauty', 'tech',
    'health', 'education', 'realestate', 'fitness', 'creative', 'business',
] as const

// ─── Preview Modal ─────────────────────────────────────────────────────
function PreviewModal({
    template,
    onClose,
    onUse,
    isApplying,
}: {
    template: Template
    onClose: () => void
    onUse: (id: string) => void
    isApplying: boolean
}) {
    const { t } = useI18n()
    const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop')

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [onClose])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative w-[95vw] h-[92vh] rounded-2xl border border-white/10 bg-[#0B1120] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Top bar */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-[#0B1120]/95 backdrop-blur-md shrink-0">
                    <div className="flex items-center gap-3">
                        <div
                            className="h-4 w-4 rounded-full border border-white/10"
                            style={{ backgroundColor: template.defaultTheme?.primaryColor || '#3B82F6' }}
                        />
                        <div>
                            <h3 className="text-sm font-semibold text-white">{template.name}</h3>
                            <p className="text-[10px] text-gray-500">{template.description}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* View mode toggle */}
                        <div className="flex items-center gap-1 rounded-lg bg-white/5 p-0.5">
                            <button
                                onClick={() => setViewMode('desktop')}
                                className={cn(
                                    'rounded-md p-1.5 transition-colors',
                                    viewMode === 'desktop' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'
                                )}
                            >
                                <Monitor className="h-3.5 w-3.5" />
                            </button>
                            <button
                                onClick={() => setViewMode('mobile')}
                                className={cn(
                                    'rounded-md p-1.5 transition-colors',
                                    viewMode === 'mobile' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'
                                )}
                            >
                                <Smartphone className="h-3.5 w-3.5" />
                            </button>
                        </div>

                        <button
                            onClick={() => onUse(template.id)}
                            disabled={isApplying}
                            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            {isApplying ? (
                                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t.gallery.usingTemplate}</>
                            ) : (
                                <><Sparkles className="h-3.5 w-3.5" /> {t.gallery.useTemplate}</>
                            )}
                        </button>

                        <button
                            onClick={onClose}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Preview iframe */}
                <div className="flex-1 flex items-center justify-center bg-[#09090b] overflow-hidden p-4">
                    <div
                        className={cn(
                            'h-full rounded-xl overflow-hidden border border-white/5 transition-all duration-500 bg-[#09090b]',
                            viewMode === 'desktop' ? 'w-full' : 'w-[390px]'
                        )}
                    >
                        <iframe
                            src={`/api/templates/preview?id=${template.id}`}
                            className="w-full h-full border-0"
                            title={`Preview: ${template.name}`}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Template Card ──────────────────────────────────────────────────────
function TemplateCard({
    template,
    onPreview,
    onUse,
    isApplying,
}: {
    template: Template
    onPreview: (t: Template) => void
    onUse: (id: string) => void
    isApplying: string | null
}) {
    const { t } = useI18n()
    const primaryColor = template.defaultTheme?.primaryColor || '#3B82F6'
    const secondaryColor = template.defaultTheme?.secondaryColor || '#8B5CF6'
    const isThisApplying = isApplying === template.id

    return (
        <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#1E293B] transition-all duration-300 hover:border-white/20 hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-1">
            {/* Live preview thumbnail via iframe */}
            <div className="relative h-56 overflow-hidden bg-[#09090b]">
                <iframe
                    src={`/api/templates/preview?id=${template.id}`}
                    className="w-[1200px] h-[800px] border-0 pointer-events-none origin-top-left"
                    style={{ transform: 'scale(0.3)', transformOrigin: 'top left' }}
                    title={template.name}
                    loading="lazy"
                />

                {/* Badges */}
                <div className="absolute top-3 right-3 flex gap-1.5 z-10">
                    {template.isFeatured && (
                        <span className="flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-semibold text-yellow-400 backdrop-blur-sm">
                            <Star className="h-2.5 w-2.5" /> Featured
                        </span>
                    )}
                    {template.isPremium && (
                        <span className="flex items-center gap-1 rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-400 backdrop-blur-sm">
                            <Crown className="h-2.5 w-2.5" /> Pro
                        </span>
                    )}
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button
                        onClick={() => onPreview(template)}
                        className="flex items-center gap-1.5 rounded-xl bg-white/15 backdrop-blur-sm px-4 py-2 text-sm font-semibold text-white hover:bg-white/25 transition-colors"
                    >
                        <Eye className="h-3.5 w-3.5" /> {t.gallery.preview}
                    </button>
                    <button
                        onClick={() => onUse(template.id)}
                        disabled={isThisApplying}
                        className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {isThisApplying ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t.gallery.usingTemplate}</>
                        ) : (
                            <><Sparkles className="h-3.5 w-3.5" /> {t.gallery.useTemplate}</>
                        )}
                    </button>
                </div>
            </div>

            {/* Info */}
            <div className="p-4">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="font-semibold text-white">{template.name}</h3>
                        <p className="mt-1 text-xs text-gray-400 line-clamp-2">{template.description}</p>
                    </div>
                    <div className="flex shrink-0 ml-3 gap-1">
                        <div
                            className="h-4 w-4 rounded-full border border-white/10"
                            style={{ backgroundColor: primaryColor }}
                        />
                        <div
                            className="h-4 w-4 rounded-full border border-white/10"
                            style={{ backgroundColor: secondaryColor }}
                        />
                    </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {template.category?.map((cat) => (
                        <span
                            key={cat}
                            className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-gray-500"
                        >
                            {cat}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}

// ─── Main Page ──────────────────────────────────────────────────────────
export default function TemplatesPage() {
    const router = useRouter()
    const { t } = useI18n()
    const [templates, setTemplates] = useState<Template[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [activeCategory, setActiveCategory] = useState('all')
    const [search, setSearch] = useState('')
    const [isApplying, setIsApplying] = useState<string | null>(null)
    const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)

    useEffect(() => {
        async function fetchTemplates() {
            try {
                const res = await fetch('/api/templates/list?limit=50&sort=sortOrder')
                if (res.ok) {
                    const data = await res.json()
                    setTemplates(data.docs || [])
                }
            } catch {
                toast.error('Failed to load templates')
            } finally {
                setIsLoading(false)
            }
        }
        fetchTemplates()
    }, [])

    const handleUseTemplate = async (templateId: string) => {
        setIsApplying(templateId)
        try {
            const res = await fetch('/api/ai/apply-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ templateId }),
            })
            if (res.ok) {
                const data = await res.json()
                router.push(`/editor/${data.siteId}`)
            }
        } catch {
            toast.error('Failed to apply template')
        } finally {
            setIsApplying(null)
        }
    }

    const handleClosePreview = useCallback(() => setPreviewTemplate(null), [])

    const filtered = templates.filter((t) => {
        const matchCat = activeCategory === 'all' || t.category?.includes(activeCategory)
        const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase())
        return matchCat && matchSearch
    })

    return (
        <div className="min-h-screen bg-[#0B1120]">
            {/* Header */}
            <div className="border-b border-white/10 bg-[#0B1120]/95 backdrop-blur-md sticky top-0 z-20">
                <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/onboarding"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        <div>
                            <h1 className="text-lg font-bold text-white flex items-center gap-2">
                                <LayoutTemplate className="h-5 w-5 text-blue-400" />
                                {t.gallery.title}
                            </h1>
                            <p className="text-xs text-gray-500">{t.gallery.subtitle}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <LanguageSwitcher variant="pill" />
                        <Link
                            href="/builder/new"
                            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                        >
                            <Sparkles className="h-3.5 w-3.5" /> {t.gallery.createWithAI}
                        </Link>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-7xl px-6 py-8">
                {/* Search + Filters */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t.gallery.searchPlaceholder}
                            className="w-full rounded-xl border border-white/10 bg-[#1E293B] py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500/50 transition-colors"
                        />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {CATEGORY_KEYS.map((key) => (
                            <button
                                key={key}
                                onClick={() => setActiveCategory(key)}
                                className={cn(
                                    'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                                    activeCategory === key
                                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                        : 'text-gray-500 hover:bg-white/5 hover:text-gray-300 border border-transparent'
                                )}
                            >
                                {t.gallery.categories[key as keyof typeof t.gallery.categories] || key}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Loading */}
                {isLoading && (
                    <div className="flex items-center justify-center py-32">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                    </div>
                )}

                {/* Empty */}
                {!isLoading && filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                        <LayoutTemplate className="h-12 w-12 text-gray-600 mb-4" />
                        <h3 className="text-lg font-semibold text-white mb-1">{t.gallery.noTemplates}</h3>
                        <p className="text-sm text-gray-500 mb-6">
                            {t.gallery.createWithAI}
                        </p>
                        <Link
                            href="/builder/new"
                            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
                        >
                            <Sparkles className="h-4 w-4" /> {t.gallery.createWithAI}
                        </Link>
                    </div>
                )}

                {/* Grid */}
                {!isLoading && filtered.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filtered.map((t) => (
                            <TemplateCard
                                key={t.id}
                                template={t}
                                onPreview={setPreviewTemplate}
                                onUse={handleUseTemplate}
                                isApplying={isApplying}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Preview Modal */}
            {previewTemplate && (
                <PreviewModal
                    template={previewTemplate}
                    onClose={handleClosePreview}
                    onUse={handleUseTemplate}
                    isApplying={isApplying === previewTemplate.id}
                />
            )}
        </div>
    )
}
