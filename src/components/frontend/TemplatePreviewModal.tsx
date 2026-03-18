'use client'

import { useState, useEffect } from 'react'
import { Monitor, Smartphone, Loader2, Sparkles, X } from 'lucide-react'
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

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [onClose])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative w-[95vw] h-[85vh] sm:h-[92vh] rounded-2xl border border-white/10 bg-[#0B1120] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Top bar */}
                <div className="flex items-center justify-between px-3 sm:px-6 py-3 border-b border-white/10 bg-[#0B1120]/95 backdrop-blur-md shrink-0">
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
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t.gallery.usingTemplate}
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-3.5 w-3.5" /> {t.gallery.useTemplate}
                                </>
                            )}
                        </button>

                        <button
                            onClick={onClose}
                            aria-label="Close preview"
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
                            viewMode === 'desktop' ? 'w-full' : 'w-[min(370px,90vw)]'
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
