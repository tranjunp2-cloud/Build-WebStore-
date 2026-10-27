'use client'

import { ExternalLink, Monitor, Smartphone } from 'lucide-react'
import type { BuilderPreviewMode } from '@/components/builder/BuilderPreviewPrimitives'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

interface BuilderPreviewToolbarProps {
    mode: BuilderPreviewMode
    onModeChange: (mode: BuilderPreviewMode) => void
    onOpenPreview: () => void
}

const TAB = 'relative z-[1] flex h-[34px] w-[104px] items-center justify-center gap-[7px] rounded-full text-[13px] font-medium transition-colors duration-200 hover:text-white'

/** One capsule: sliding Desktop/Mobile switch + "View full preview". */
export function BuilderPreviewToolbar({ mode, onModeChange, onOpenPreview }: BuilderPreviewToolbarProps) {
    const { t } = useI18n()
    return (
        <div
            className="box-border flex h-11 items-center gap-1 rounded-full border border-solid border-[rgba(148,163,184,.14)] bg-[rgba(30,41,59,.55)] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_12px_28px_-16px_rgba(0,0,0,.7)] backdrop-blur-[12px]"
            data-testid="builder-preview-toolbar"
        >
            <div className="relative flex" role="group">
                <span
                    aria-hidden
                    className="absolute left-0 top-0 box-border h-[34px] w-[104px] rounded-full border border-solid border-[rgba(56,189,248,.4)] shadow-[0_0_16px_rgba(56,189,248,.2),inset_0_1px_0_rgba(255,255,255,.12)] transition-transform duration-300 ease-[cubic-bezier(.3,.9,.3,1)] [background:linear-gradient(180deg,rgba(56,189,248,.24),rgba(56,189,248,.12))] motion-reduce:transition-none"
                    style={{ transform: mode === 'mobile' ? 'translateX(104px)' : 'none' }}
                />
                <button
                    aria-pressed={mode === 'desktop'}
                    className={cn(TAB, mode === 'desktop' ? 'text-white' : 'text-[#94a3b8]')}
                    onClick={() => onModeChange('desktop')}
                    type="button"
                >
                    <Monitor aria-hidden className="size-[15px]" strokeWidth={1.75} />
                    {t.common.desktop}
                </button>
                <button
                    aria-pressed={mode === 'mobile'}
                    className={cn(TAB, mode === 'mobile' ? 'text-white' : 'text-[#94a3b8]')}
                    onClick={() => onModeChange('mobile')}
                    type="button"
                >
                    <Smartphone aria-hidden className="size-[15px]" strokeWidth={1.75} />
                    {t.common.mobile}
                </button>
            </div>
            <span aria-hidden className="mx-1 h-5 w-px flex-none bg-[rgba(148,163,184,.22)]" />
            <button
                className="flex h-[34px] items-center gap-[7px] whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium text-[#e2e8f0] transition-colors duration-200 hover:bg-[rgba(56,189,248,.12)] hover:text-white"
                onClick={onOpenPreview}
                type="button"
            >
                <ExternalLink aria-hidden className="size-[15px]" />
                {t.onboarding.completion.viewFullPreview}
            </button>
        </div>
    )
}
