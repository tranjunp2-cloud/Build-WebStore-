'use client'

import { useState } from 'react'
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
    const isThisApplying = isApplying === template.id

    return (
        <div
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#1E293B] transition-all duration-500 hover:border-white/20 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1.5"
            style={{
                // @ts-ignore - custom property for hover glow
                '--hover-glow': `${primaryColor}20`
            } as React.CSSProperties}
        >
            {/* Live preview thumbnail via iframe */}
            <div className="relative h-56 overflow-hidden bg-[#09090b]">
                {/* Skeleton/Placeholder */}
                {!isLoaded && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#09090b]">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500/20 border-t-blue-500" />
                        <span className="text-[10px] text-gray-600 font-medium uppercase tracking-widest">Loading Preview</span>
                    </div>
                )}

                <iframe
                    src={`/api/templates/preview?id=${template.id}`}
                    onLoad={() => setIsLoaded(true)}
                    className={cn(
                        "w-[1200px] h-[800px] border-0 pointer-events-none origin-top-left transition-opacity duration-700",
                        isLoaded ? "opacity-100" : "opacity-0"
                    )}
                    style={{ transform: 'scale(0.3)', transformOrigin: 'top left' }}
                    title={template.name}
                    loading="lazy"
                />

                {/* Glow Overlay */}
                <div
                    className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#1E293B] to-transparent pointer-events-none group-hover:from-blue-500/10 transition-colors duration-500"
                />

                {/* Badges */}
                <div className="absolute top-3 right-3 flex gap-1.5 z-10">
                    {template.isFeatured && (
                        <span className="flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-semibold text-yellow-400 backdrop-blur-md border border-yellow-500/20">
                            <Star className="h-2.5 w-2.5" /> Featured
                        </span>
                    )}
                    {template.isPremium && (
                        <span className="flex items-center gap-1 rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-400 backdrop-blur-md border border-purple-500/20">
                            <Crown className="h-2.5 w-2.5" /> Pro
                        </span>
                    )}
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 backdrop-blur-[2px]">
                    <button
                        onClick={() => onPreview(template)}
                        className="flex items-center gap-1.5 rounded-xl bg-white/10 backdrop-blur-md px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 border border-white/10 transition-all active:scale-95"
                    >
                        <Eye className="h-3.5 w-3.5" /> {t.gallery.preview}
                    </button>
                    <button
                        onClick={() => onUse(template.id)}
                        disabled={isThisApplying}
                        className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-lg hover:shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
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

            {/* Info */}
            <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h3 className="font-bold text-white group-hover:text-blue-400 transition-colors truncate">{template.name}</h3>
                        <p className="mt-1.5 text-xs text-gray-400 line-clamp-2 leading-relaxed">{template.description}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5 p-1 rounded-full bg-white/5 border border-white/5">
                        <div
                            className="h-3.5 w-3.5 rounded-full border border-white/10 shadow-sm"
                            style={{ backgroundColor: primaryColor }}
                        />
                        {secondaryColor && (
                            <div
                                className="h-3.5 w-3.5 rounded-full border border-white/10 shadow-sm"
                                style={{ backgroundColor: secondaryColor }}
                            />
                        )}
                    </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                    {template.category?.map((cat) => (
                        <span
                            key={cat}
                            className="rounded-lg bg-white/5 px-2.5 py-1 text-[10px] font-medium text-gray-500 border border-white/5 group-hover:border-white/10 group-hover:bg-white/10 transition-all"
                        >
                            {cat}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}
