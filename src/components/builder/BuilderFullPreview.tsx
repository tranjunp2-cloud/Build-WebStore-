'use client'

import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { BuilderPreviewMode, BuilderPreviewModeToggle, BuilderPreviewSurface } from '@/components/builder/BuilderPreviewPrimitives'
import { useI18n } from '@/i18n'

interface BuilderFullPreviewProps {
    mode: BuilderPreviewMode
    onModeChange: (mode: BuilderPreviewMode) => void
    onBack: () => void
    previewContent: ReactNode
}

export default function BuilderFullPreview({
    mode,
    onModeChange,
    onBack,
    previewContent,
}: BuilderFullPreviewProps) {
    const { t } = useI18n()
    return (
        <div className="h-screen overflow-hidden bg-[#0b1120] text-white">
            <div className="flex h-16 items-center justify-between border-b border-[rgba(59,130,246,0.15)] bg-[rgba(30,41,59,0.3)] px-6">
                <div className="flex items-center gap-4">
                    <button
                        className="flex h-8 items-center gap-2 rounded-[10px] px-2 text-sm font-medium text-[#f8fafc]"
                        onClick={onBack}
                        type="button"
                    >
                        <ArrowLeft className="size-4" />
                        <span>{t.common.back}</span>
                    </button>
                    <div className="h-6 w-px bg-[rgba(59,130,246,0.15)]" />
                    <h1 className="text-[18px] font-semibold leading-7 text-[#f8fafc]">
                        {t.onboarding.completion.previewTitle}
                    </h1>
                </div>

                <BuilderPreviewModeToggle mode={mode} onChange={onModeChange} />
            </div>

            <div className="h-[calc(100vh-64px)] overflow-hidden">
                <BuilderPreviewSurface mode={mode} variant="fullwidth">
                    {previewContent}
                </BuilderPreviewSurface>
            </div>
        </div>
    )
}
