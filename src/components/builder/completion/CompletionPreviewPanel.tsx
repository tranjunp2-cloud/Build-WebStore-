'use client'

import type { ReactNode } from 'react'
import { ExternalLink, Monitor, Smartphone } from 'lucide-react'
import { BuilderPreviewSurface, type BuilderPreviewMode } from '@/components/builder/BuilderPreviewPrimitives'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

const tabClass = (on: boolean) =>
    cn(
        'relative z-[1] flex h-[34px] w-[104px] items-center justify-center gap-[7px] rounded-full text-[13px] font-medium transition-colors duration-[250ms] hover:text-white',
        on ? 'text-white' : 'text-slate-400',
    )

/** One capsule: sliding Desktop/Mobile thumb + View full preview. */
function PreviewToolbar({
    mode,
    onModeChange,
    onOpenPreview,
}: {
    mode: BuilderPreviewMode
    onModeChange: (mode: BuilderPreviewMode) => void
    onOpenPreview: () => void
}) {
    const { t } = useI18n()
    const c = t.onboarding.completion
    return (
        <div
            className="flex h-11 items-center gap-1 rounded-full border border-slate-400/[0.14] bg-slate-800/55 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_28px_-16px_rgba(0,0,0,0.7)] backdrop-blur-xl"
            data-testid="preview-mode-toggle"
        >
            <div className="relative flex">
                <span
                    aria-hidden
                    className={cn(
                        'absolute left-0 top-0 h-[34px] w-[104px] rounded-full border border-sky-400/40 bg-[linear-gradient(180deg,rgba(56,189,248,0.24),rgba(56,189,248,0.12))] shadow-[0_0_16px_rgba(56,189,248,0.2),inset_0_1px_0_rgba(255,255,255,0.12)] transition-transform duration-300 ease-[cubic-bezier(0.3,0.9,0.3,1)] motion-reduce:transition-none',
                        mode === 'mobile' ? 'translate-x-[104px]' : 'translate-x-0',
                    )}
                    data-testid="preview-mode-thumb"
                />
                <button
                    aria-pressed={mode === 'desktop'}
                    className={tabClass(mode === 'desktop')}
                    data-testid="toggle-desktop"
                    onClick={() => onModeChange('desktop')}
                    type="button"
                >
                    <Monitor className="size-[15px]" strokeWidth={1.75} aria-hidden />
                    {t.common.desktop}
                </button>
                <button
                    aria-pressed={mode === 'mobile'}
                    className={tabClass(mode === 'mobile')}
                    data-testid="toggle-mobile"
                    onClick={() => onModeChange('mobile')}
                    type="button"
                >
                    <Smartphone className="size-[15px]" strokeWidth={1.75} aria-hidden />
                    {t.common.mobile}
                </button>
            </div>
            <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-slate-400/[0.22]" />
            <button
                className="flex h-[34px] items-center gap-[7px] whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium text-slate-200 transition-colors hover:bg-sky-400/[0.12] hover:text-white"
                onClick={onOpenPreview}
                type="button"
            >
                <ExternalLink className="size-[15px]" aria-hidden />
                <span>{c.viewFullPreview}</span>
            </button>
        </div>
    )
}

export function CompletionPreviewPanel({
    mode,
    onModeChange,
    previewContent,
    onOpenPreview,
    siteId,
    showBannerPad,
}: {
    mode: BuilderPreviewMode
    onModeChange: (mode: BuilderPreviewMode) => void
    previewContent: ReactNode
    onOpenPreview: () => void
    siteId?: string | null
    showBannerPad?: boolean
}) {
    const { t } = useI18n()
    const c = t.onboarding.completion
    return (
        <div className="relative h-screen overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_100%_0%,rgba(20,90,90,0.25),transparent_50%),#0b1222]" />
            <div className="relative flex h-full flex-col">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-6 pb-4 pt-[18px]">
                    <div className="min-w-0">
                        <h2 className="whitespace-nowrap text-[18px] font-semibold leading-[26px] text-[#2dd4bf]">
                            {c.previewTitle}
                        </h2>
                        <p className="mt-0.5 whitespace-nowrap text-xs leading-4 text-slate-300">{c.previewSubtitle}</p>
                    </div>
                    <PreviewToolbar mode={mode} onModeChange={onModeChange} onOpenPreview={onOpenPreview} />
                </div>

                <div className={`relative flex-1 overflow-hidden px-6 ${showBannerPad ? 'pb-[88px]' : 'pb-6'}`}>
                    <BuilderPreviewSurface mode={mode} variant="panel" siteId={siteId}>
                        {previewContent}
                    </BuilderPreviewSurface>
                </div>
            </div>
        </div>
    )
}
