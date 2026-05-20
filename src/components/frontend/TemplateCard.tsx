'use client'

import { useState, useRef, useEffect } from 'react'
import { Star, Crown, Eye, Loader2, Sparkles } from 'lucide-react'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

export type Template = {
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

interface TemplateCardProps {
    template: Template
    onPreview: (t: Template) => void
    onUse: (id: string) => void
    isApplying: string | null
}

export function TemplateCard({
    template,
    onPreview,
    onUse,
    isApplying,
}: TemplateCardProps) {
    const { t } = useI18n()
    const primaryColor = template.defaultTheme?.primaryColor || '#3B82F6'
    const secondaryColor = template.defaultTheme?.secondaryColor || '#8B5CF6'
    const [isLoaded, setIsLoaded] = useState(false)
    const [isVisible, setIsVisible] = useState(false)
    const cardRef = useRef<HTMLDivElement>(null)
    const isThisApplying = isApplying === template.id

    // Only load iframe when card is visible in viewport
    useEffect(() => {
        const el = cardRef.current
        if (!el) return
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect() } },
            { rootMargin: '200px' },
        )
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    return (
        <div ref={cardRef} className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] transition-all duration-500 hover:border-white/[0.12] hover:bg-white/[0.04] hover:shadow-2xl hover:shadow-blue-500/[0.06] hover:-translate-y-1">
            {/* Live preview thumbnail via iframe */}
            <div className="relative h-64 overflow-hidden bg-[#08080c]">
                {/* Skeleton/Placeholder */}
                {!isLoaded && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#08080c]">
                        <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-500/20 border-t-blue-400" />
                        <span className="text-[10px] text-gray-700 font-medium uppercase tracking-[0.15em]">Loading</span>
                    </div>
                )}

                {isVisible && (
                    <iframe
                        src={`/api/templates/preview?id=${template.id}`}
                        onLoad={() => setIsLoaded(true)}
                        className={cn(
                            "w-[1200px] h-[900px] border-0 pointer-events-none origin-top-left transition-opacity duration-700",
                            isLoaded ? "opacity-100" : "opacity-0"
                        )}
                        style={{ transform: 'scale(0.32)', transformOrigin: 'top left' }}
                        title={template.name}
                    />
                )}

                {/* Bottom fade */}
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0a0a12] to-transparent pointer-events-none" />

                {/* Badges */}
                <div className="absolute top-3 right-3 flex gap-1.5 z-10">
                    {template.isFeatured && (
                        <span className="flex items-center gap-1 rounded-lg bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-400 backdrop-blur-xl border border-amber-500/15">
                            <Star className="h-2.5 w-2.5 fill-amber-400" /> Featured
                        </span>
                    )}
                    {template.isPremium && (
                        <span className="flex items-center gap-1 rounded-lg bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold text-violet-400 backdrop-blur-xl border border-violet-500/15">
                            <Crown className="h-2.5 w-2.5" /> Pro
                        </span>
                    )}
                </div>

                {/* Hover overlay with actions */}
                <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/50 opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 backdrop-blur-[3px]">
                    <button
                        onClick={() => onPreview(template)}
                        className="flex items-center gap-1.5 rounded-xl bg-white/10 backdrop-blur-xl px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/20 border border-white/10 transition-all active:scale-95"
                    >
                        <Eye className="h-3.5 w-3.5" /> {t.gallery.preview}
                    </button>
                    <button
                        onClick={() => onUse(template.id)}
                        disabled={isThisApplying}
                        className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:brightness-110 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isThisApplying ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t.gallery.usingTemplate}
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-3.5 w-3.5" /> {t.gallery.useTemplate}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Info Section */}
            <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors duration-300 truncate">
                            {template.name}
                        </h3>
                        <p className="mt-1 text-xs text-gray-600 line-clamp-2 leading-relaxed">
                            {template.description}
                        </p>
                    </div>
                    {/* Color swatches */}
                    <div className="flex shrink-0 gap-1 mt-0.5">
                        <div
                            className="h-3 w-3 rounded-full ring-1 ring-white/10"
                            style={{ backgroundColor: primaryColor }}
                        />
                        {secondaryColor && (
                            <div
                                className="h-3 w-3 rounded-full ring-1 ring-white/10"
                                style={{ backgroundColor: secondaryColor }}
                            />
                        )}
                    </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {template.category?.map((cat) => (
                        <span
                            key={cat}
                            className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-gray-600 border border-white/[0.04] group-hover:border-white/[0.08] group-hover:text-gray-500 transition-all"
                        >
                            {cat}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}
