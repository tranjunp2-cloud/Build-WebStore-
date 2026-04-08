'use client'

import { useState, useEffect } from 'react'
import { Monitor, Smartphone, Loader2, Sparkles, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import type { Template } from './TemplateCard'

interface TemplatePreviewModalProps {
    template: Template
    onClose: () => void
    onUse: (id: string) => void
    isApplying: boolean
}

export function TemplatePreviewModal({
    template,
    onClose,
    onUse,
    isApplying,
}: TemplatePreviewModalProps) {
    const { t } = useI18n()
    const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop')
    const [iframeLoaded, setIframeLoaded] = useState(false)

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handler)
        document.body.style.overflow = 'hidden'
        return () => {
            document.removeEventListener('keydown', handler)
            document.body.style.overflow = ''
        }
    }, [onClose])

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center animate-in fade-in duration-200"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />

            {/* Modal */}
            <div
                className="relative w-[96vw] h-[90vh] rounded-2xl border border-white/[0.08] bg-[#0a0a14] overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-2 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Top bar */}
                <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/[0.06] bg-[#0a0a14]/90 backdrop-blur-xl shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div
                            className="h-3.5 w-3.5 rounded-full ring-1 ring-white/10 shrink-0"
                            style={{ backgroundColor: template.defaultTheme?.primaryColor || '#3B82F6' }}
                        />
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-white truncate">{template.name}</h3>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {/* View mode toggle */}
                        <div className="hidden sm:flex items-center gap-0.5 rounded-xl bg-white/[0.04] p-1 border border-white/[0.06]">
                            <button
                                onClick={() => setViewMode('desktop')}
                                className={cn(
                                    'rounded-lg p-1.5 transition-all',
                                    viewMode === 'desktop' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-600 hover:text-gray-300'
                                )}
                            >
                                <Monitor className="h-3.5 w-3.5" />
                            </button>
                            <button
                                onClick={() => setViewMode('mobile')}
                                className={cn(
                                    'rounded-lg p-1.5 transition-all',
                                    viewMode === 'mobile' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-600 hover:text-gray-300'
                                )}
                            >
                                <Smartphone className="h-3.5 w-3.5" />
                            </button>
                        </div>

                        <button
                            onClick={() => onUse(template.id)}
                            disabled={isApplying}
                            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:brightness-110 transition-all disabled:opacity-50"
                        >
                            {isApplying ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t.gallery.usingTemplate || 'Applying...'}
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-3.5 w-3.5" /> {t.gallery.useTemplate || 'Use This Template'}
                                </>
                            )}
                        </button>

                        <button
                            onClick={onClose}
                            aria-label="Close preview"
                            className="rounded-xl p-2 text-gray-500 hover:bg-white/5 hover:text-white transition-all"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Preview iframe */}
                <div className="flex-1 flex items-center justify-center bg-[#06060a] overflow-hidden p-3 sm:p-5">
                    <div
                        className={cn(
                            'relative h-full rounded-xl overflow-hidden border border-white/[0.04] transition-all duration-500 bg-[#08080c]',
                            viewMode === 'desktop' ? 'w-full' : 'w-[min(375px,100%)]'
                        )}
                    >
                        {!iframeLoaded && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#08080c] z-10 gap-3">
                                <Loader2 className="h-6 w-6 animate-spin text-blue-500/40" />
                                <span className="text-[10px] text-gray-700 font-medium uppercase tracking-[0.15em]">Loading preview</span>
                            </div>
                        )}
                        <iframe
                            src={`/api/templates/preview?id=${template.id}`}
                            className={cn("w-full h-full border-0 transition-opacity duration-500", iframeLoaded ? "opacity-100" : "opacity-0")}
                            title={`Preview: ${template.name}`}
                            onLoad={() => setIframeLoaded(true)}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
