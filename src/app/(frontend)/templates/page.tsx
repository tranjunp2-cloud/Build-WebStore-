'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/i18n'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import {
    ArrowLeft,
    Sparkles,
    Loader2,
    Search,
    LayoutTemplate,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { TemplateCard, type Template } from '@/components/frontend/TemplateCard'
import { TemplatePreviewModal } from '@/components/frontend/TemplatePreviewModal'

// v1.0: ecommerce category hidden (deferred to v1.1)
const CATEGORY_KEYS = [
    'all', 'restaurant', 'beauty', 'tech',
    'health', 'education', 'realestate', 'fitness', 'creative', 'business',
    'fnb', 'events', 'blog', 'travel',
] as const

// ─── Main Page ──────────────────────────────────────────────────────────
export default function TemplatesPage() {
    const router = useRouter()
    const { t } = useI18n()
    const [templates, setTemplates] = useState<Template[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [activeCategory, setActiveCategory] = useState('all')
    const [search, setSearch] = useState('')
    const [sortBy, setSortBy] = useState<'newest' | 'featured' | 'name'>('newest')
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
            const data = await res.json()
            if (res.ok && data.success) {
                toast.success('Template applied! Redirecting to editor...')
                router.push(`/editor/${data.siteId}`)
            } else if (res.status === 401) {
                toast.error('Please login first to use templates')
                router.push('/login')
            } else {
                toast.error(data.error || `Failed to apply template (${res.status})`)
            }
        } catch {
            toast.error('Network error — failed to apply template')
        } finally {
            setIsApplying(null)
        }
    }

    const handleClosePreview = useCallback(() => setPreviewTemplate(null), [])

    const filtered = templates
        .filter((t) => {
            const matchCat = activeCategory === 'all' || t.category?.includes(activeCategory)
            const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase())
            return matchCat && matchSearch
        })
        .sort((a, b) => {
            if (sortBy === 'featured') {
                if (a.isFeatured && !b.isFeatured) return -1
                if (!a.isFeatured && b.isFeatured) return 1
                return 0
            }
            if (sortBy === 'name') {
                return a.name.localeCompare(b.name)
            }
            // default 'newest'
            return 0
        })

    return (
        <div className="min-h-screen bg-[#0B1120]">
            {/* Header */}
            <div className="border-b border-white/10 bg-[#0B1120]/95 backdrop-blur-md sticky top-0 z-20">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <Link
                            href="/onboarding"
                            aria-label="Back to onboarding"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-colors shrink-0"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        <div className="min-w-0">
                            <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                                <LayoutTemplate className="hidden sm:block h-5 w-5 text-blue-400 shrink-0" />
                                {t.gallery.title}
                            </h1>
                            <p className="hidden sm:block text-xs text-gray-500 truncate">{t.gallery.subtitle}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <div className="hidden sm:block">
                            <LanguageSwitcher variant="pill" />
                        </div>
                        <Link
                            href="/builder/new"
                            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:opacity-90 transition-opacity whitespace-nowrap"
                        >
                            <Sparkles className="h-3.5 w-3.5" /> {t.gallery.createWithAI}
                        </Link>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
                {/* Search + Filters */}
                <div className="flex flex-col gap-4 mb-8">
                    {/* Top Row: Search & Sort */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="relative w-full sm:max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={t.gallery.searchPlaceholder}
                                aria-label="Search templates"
                                className="w-full rounded-xl border border-white/10 bg-[#1E293B] py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500/50 transition-colors"
                            />
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <span className="text-xs font-medium text-gray-400 whitespace-nowrap">{t.gallery.sort}:</span>
                            <select
                                value={sortBy}
                                // @ts-ignore
                                onChange={(e) => setSortBy(e.target.value)}
                                className="w-full sm:w-auto appearance-none rounded-xl border border-white/10 bg-[#1E293B] px-4 py-2.5 pr-8 text-sm text-white outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
                            >
                                <option value="newest">{t.gallery.sortNewest}</option>
                                <option value="featured">{t.gallery.sortFeatured}</option>
                                <option value="name">{t.gallery.sortName}</option>
                            </select>
                        </div>
                    </div>

                    {/* Bottom Row: Categories */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {CATEGORY_KEYS.map((key) => (
                            <button
                                key={key}
                                onClick={() => setActiveCategory(key)}
                                className={cn(
                                    'rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-300',
                                    activeCategory === key
                                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                                        : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent hover:border-white/10'
                                )}
                            >
                                {t.gallery.categories[key as keyof typeof t.gallery.categories] || key}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Loading State */}
                {isLoading && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="rounded-2xl border border-white/10 bg-[#1E293B] overflow-hidden">
                                <div className="h-56 bg-white/5" />
                                <div className="p-4 space-y-3">
                                    <div className="h-5 w-32 rounded bg-white/5" />
                                    <div className="h-3 w-48 rounded bg-white/5" />
                                    <div className="flex gap-1.5">
                                        <div className="h-5 w-16 rounded-full bg-white/5" />
                                        <div className="h-5 w-14 rounded-full bg-white/5" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty State */}
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
                <TemplatePreviewModal
                    template={previewTemplate}
                    onClose={handleClosePreview}
                    onUse={handleUseTemplate}
                    isApplying={isApplying === previewTemplate.id}
                />
            )}
        </div>
    )
}
