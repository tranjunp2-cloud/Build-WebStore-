'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
    ArrowLeft,
    Sparkles,
    Crown,
    Star,
    Loader2,
    Search,
    LayoutTemplate,
    Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────
type Template = {
    id: string
    name: string
    description: string
    category: string[]
    thumbnail?: { url: string }
    previewUrl?: string
    isPremium: boolean
    isFeatured: boolean
    defaultTheme: {
        primaryColor: string
        colorMode: string
    }
}

const CATEGORIES = [
    { value: 'all', label: 'Tất cả' },
    { value: 'business', label: 'Business' },
    { value: 'ecommerce', label: 'Online Store' },
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'portfolio', label: 'Portfolio' },
    { value: 'blog', label: 'Blog' },
    { value: 'service', label: 'Agency' },
]

// ─── Template Card ──────────────────────────────────────────────────────
function TemplateCard({
    template,
    onUse,
    isApplying,
}: {
    template: Template
    onUse: (id: string) => void
    isApplying: string | null
}) {
    const primaryColor = template.defaultTheme?.primaryColor || '#0ea5e9'
    const isDark = template.defaultTheme?.colorMode === 'dark'
    const isThisApplying = isApplying === template.id

    return (
        <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#1E293B] transition-all duration-300 hover:border-white/20 hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-1">
            {/* Thumbnail / Preview */}
            <div
                className="relative h-52 overflow-hidden"
                style={{
                    background: isDark
                        ? `linear-gradient(135deg, #09090b 0%, ${primaryColor}15 50%, #09090b 100%)`
                        : `linear-gradient(135deg, #ffffff 0%, ${primaryColor}15 50%, #f8fafc 100%)`,
                }}
            >
                {/* Mock preview content */}
                <div className="absolute inset-4">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: primaryColor }} />
                        <div className="h-2 w-16 rounded bg-current opacity-20" />
                        <div className="ml-auto flex gap-2">
                            <div className="h-2 w-8 rounded bg-current opacity-10" />
                            <div className="h-2 w-8 rounded bg-current opacity-10" />
                        </div>
                    </div>
                    <div className="mt-6 text-center">
                        <div className="mx-auto h-3 w-40 rounded bg-current opacity-20 mb-2" />
                        <div className="mx-auto h-2 w-28 rounded bg-current opacity-10 mb-4" />
                        <div
                            className="mx-auto h-6 w-20 rounded-lg"
                            style={{ backgroundColor: primaryColor, opacity: 0.8 }}
                        />
                    </div>
                    <div className="mt-6 grid grid-cols-3 gap-2">
                        <div className="h-10 rounded-lg bg-current opacity-5" />
                        <div className="h-10 rounded-lg bg-current opacity-5" />
                        <div className="h-10 rounded-lg bg-current opacity-5" />
                    </div>
                </div>

                {/* Badges */}
                <div className="absolute top-3 right-3 flex gap-1.5">
                    {template.isFeatured && (
                        <span className="flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-semibold text-yellow-400">
                            <Star className="h-2.5 w-2.5" /> Featured
                        </span>
                    )}
                    {template.isPremium && (
                        <span className="flex items-center gap-1 rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-400">
                            <Crown className="h-2.5 w-2.5" /> Pro
                        </span>
                    )}
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onUse(template.id)}
                        disabled={isThisApplying}
                        className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
                    >
                        {isThisApplying ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tạo...</>
                        ) : (
                            <><Sparkles className="h-3.5 w-3.5" /> Sử dụng</>
                        )}
                    </button>
                    {template.previewUrl && (
                        <a
                            href={template.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
                        >
                            <Eye className="h-3.5 w-3.5" /> Preview
                        </a>
                    )}
                </div>
            </div>

            {/* Info */}
            <div className="p-4">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="font-semibold text-white">{template.name}</h3>
                        <p className="mt-1 text-xs text-gray-400 line-clamp-2">{template.description}</p>
                    </div>
                    <div
                        className="h-5 w-5 rounded-full shrink-0 ml-3 border border-white/10"
                        style={{ backgroundColor: primaryColor }}
                    />
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
    const [templates, setTemplates] = useState<Template[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [activeCategory, setActiveCategory] = useState('all')
    const [search, setSearch] = useState('')
    const [isApplying, setIsApplying] = useState<string | null>(null)

    useEffect(() => {
        async function fetchTemplates() {
            try {
                const res = await fetch('/api/templates?limit=50&sort=sortOrder')
                if (res.ok) {
                    const data = await res.json()
                    setTemplates(data.docs || [])
                }
            } catch (err) {
                console.error('Failed to load templates', err)
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
        } catch (err) {
            console.error('Failed to apply template', err)
        } finally {
            setIsApplying(null)
        }
    }

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
                                Template Gallery
                            </h1>
                            <p className="text-xs text-gray-500">Chọn mẫu website phù hợp với ngành của bạn</p>
                        </div>
                    </div>
                    <Link
                        href="/builder/new"
                        className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                    >
                        <Sparkles className="h-3.5 w-3.5" /> Tạo bằng AI
                    </Link>
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
                            placeholder="Tìm template..."
                            className="w-full rounded-xl border border-white/10 bg-[#1E293B] py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500/50 transition-colors"
                        />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat.value}
                                onClick={() => setActiveCategory(cat.value)}
                                className={cn(
                                    'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                                    activeCategory === cat.value
                                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                        : 'text-gray-500 hover:bg-white/5 hover:text-gray-300 border border-transparent'
                                )}
                            >
                                {cat.label}
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
                        <h3 className="text-lg font-semibold text-white mb-1">Chưa có template</h3>
                        <p className="text-sm text-gray-500 mb-6">
                            Thử tạo website bằng AI thay thế
                        </p>
                        <Link
                            href="/builder/new"
                            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
                        >
                            <Sparkles className="h-4 w-4" /> Tạo bằng AI
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
                                onUse={handleUseTemplate}
                                isApplying={isApplying}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
