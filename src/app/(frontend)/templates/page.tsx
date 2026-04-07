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
    X,
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
        <div className="min-h-screen bg-[#060918]">
            {/* ── Sticky Header ───────────────────────────────────── */}
            <div className="border-b border-white/[0.06] bg-[#060918]/80 backdrop-blur-xl sticky top-0 z-20">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            onClick={() => router.back()}
                            aria-label="Go back"
                            className="rounded-xl p-2 text-gray-500 hover:bg-white/5 hover:text-white transition-all shrink-0"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                        <div className="min-w-0">
                            <h1 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
                                <LayoutTemplate className="hidden sm:block h-4 w-4 text-blue-400 shrink-0" />
                                {t.gallery.title}
                            </h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <div className="hidden sm:block">
                            <LanguageSwitcher variant="pill" />
                        </div>
                        <Link
                            href="/builder/new"
                            className="group/cta flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-3.5 sm:px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:brightness-110 transition-all whitespace-nowrap"
                        >
                            <Sparkles className="h-3.5 w-3.5 group-hover/cta:animate-pulse" /> {t.gallery.createWithAI}
                        </Link>
                    </div>
                </div>
            </div>

            {/* ── Hero Section ────────────────────────────────────── */}
            <div className="relative overflow-hidden">
                {/* Ambient background glow */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-32 left-1/4 w-96 h-96 bg-blue-600/8 rounded-full blur-[128px]" />
                    <div className="absolute -top-24 right-1/4 w-80 h-80 bg-violet-600/6 rounded-full blur-[100px]" />
                </div>

                <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-8 pb-6">
                    {/* Subtitle */}
                    <p className="text-sm text-gray-500 mb-6">{t.gallery.subtitle}</p>

                    {/* Search Row */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
                        <div className="relative flex-1 max-w-xl">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={t.gallery.searchPlaceholder}
                                aria-label="Search templates"
                                className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] py-3 pl-11 pr-10 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/40 focus:bg-white/[0.05] focus:shadow-[0_0_0_4px_rgba(59,130,246,0.08)] transition-all"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as 'newest' | 'featured' | 'name')}
                                className="appearance-none rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 pr-8 text-sm text-gray-300 outline-none focus:border-blue-500/40 transition-all cursor-pointer hover:bg-white/[0.05]"
                            >
                                <option value="newest">{t.gallery.sortNewest}</option>
                                <option value="featured">{t.gallery.sortFeatured}</option>
                                <option value="name">{t.gallery.sortName}</option>
                            </select>
                        </div>
                    </div>

                    {/* Category Chips — horizontal scroll on mobile */}
                    <div className="relative -mx-4 sm:mx-0">
                        <div className="flex gap-2 overflow-x-auto px-4 sm:px-0 pb-2 scrollbar-none sm:flex-wrap sm:overflow-visible">
                            {CATEGORY_KEYS.map((key) => (
                                <button
                                    key={key}
                                    onClick={() => setActiveCategory(key)}
                                    className={cn(
                                        'shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-all duration-300 whitespace-nowrap',
                                        activeCategory === key
                                            ? 'bg-blue-500/15 text-blue-300 border border-blue-400/30 shadow-[0_0_16px_rgba(59,130,246,0.15)] font-semibold'
                                            : 'text-gray-500 hover:bg-white/[0.04] hover:text-gray-300 border border-transparent hover:border-white/[0.06]'
                                    )}
                                >
                                    {t.gallery.categories[key as keyof typeof t.gallery.categories] || key}
                                </button>
                            ))}
                        </div>
                        {/* Fade edges on mobile */}
                        <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-[#060918] to-transparent pointer-events-none sm:hidden" />
                    </div>
                </div>
            </div>

            {/* ── Content ─────────────────────────────────────────── */}
            <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-16">
                {/* Result count */}
                {!isLoading && filtered.length > 0 && (
                    <div className="flex items-center justify-between mb-6">
                        <p className="text-xs text-gray-600">
                            {filtered.length} {filtered.length === 1 ? 'template' : 'templates'}
                            {activeCategory !== 'all' && (
                                <span> in <span className="text-gray-400">{t.gallery.categories[activeCategory as keyof typeof t.gallery.categories] || activeCategory}</span></span>
                            )}
                            {search && (
                                <span> matching &ldquo;<span className="text-gray-400">{search}</span>&rdquo;</span>
                            )}
                        </p>
                    </div>
                )}

                {/* Loading Skeleton */}
                {isLoading && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden animate-pulse">
                                <div className="h-64 bg-white/[0.03]" />
                                <div className="p-5 space-y-3">
                                    <div className="h-4 w-28 rounded-lg bg-white/[0.05]" />
                                    <div className="h-3 w-44 rounded-lg bg-white/[0.03]" />
                                    <div className="flex gap-2 pt-1">
                                        <div className="h-5 w-14 rounded-full bg-white/[0.04]" />
                                        <div className="h-5 w-12 rounded-full bg-white/[0.04]" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {!isLoading && filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-2xl" />
                            <div className="relative rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
                                <LayoutTemplate className="h-8 w-8 text-gray-500" />
                            </div>
                        </div>
                        <h3 className="text-base font-semibold text-white mb-1">{t.gallery.noTemplates}</h3>
                        <p className="text-sm text-gray-600 mb-8 max-w-xs">
                            {search
                                ? `No results for "${search}". Try a different search or category.`
                                : t.gallery.createWithAI}
                        </p>
                        <Link
                            href="/builder/new"
                            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:brightness-110 transition-all"
                        >
                            <Sparkles className="h-4 w-4" /> {t.gallery.createWithAI}
                        </Link>
                    </div>
                )}

                {/* Template Grid */}
                {!isLoading && filtered.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filtered.map((t, i) => (
                            <div
                                key={t.id}
                                className="animate-in fade-in slide-in-from-bottom-4"
                                style={{ animationDelay: `${Math.min(i * 50, 300)}ms`, animationFillMode: 'both' }}
                            >
                                <TemplateCard
                                    template={t}
                                    onPreview={setPreviewTemplate}
                                    onUse={handleUseTemplate}
                                    isApplying={isApplying}
                                />
                            </div>
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
