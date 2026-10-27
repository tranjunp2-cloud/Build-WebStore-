'use client'

import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { BuilderChatBubble } from '@/components/builder/BuilderChatBubble'
import { BuilderCompletionActions } from '@/components/builder/BuilderCompletionActions'
import { BuilderPreviewMode, BuilderPreviewSurface } from '@/components/builder/BuilderPreviewPrimitives'
import { BuilderPreviewToolbar } from '@/components/builder/BuilderPreviewToolbar'
import { BuilderReadyCard } from '@/components/builder/BuilderReadyCard'
import { BuilderStepScreen } from '@/components/builder/onboarding/BuilderStepScreen'
import { useI18n } from '@/i18n'

export type BuilderSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

interface BuilderCompletionViewProps {
    siteName: string
    totalBlocks: number
    blocks?: Array<{ _id?: string; blockType?: string; headline?: string; sectionLabel?: string; logoText?: string; title?: string }>
    generationTimeLabel?: string
    onDashboard: () => void
    onOpenEditor: () => void
    onOpenPreview: () => void
    onPublish: () => void
    onMoveBlock?: (blockId: string, direction: 'up' | 'down') => void
    previewContent: ReactNode
    floatingControls?: ReactNode
    previewMode: BuilderPreviewMode
    onPreviewModeChange: (mode: BuilderPreviewMode) => void
    isPublishing?: boolean
    isNavigating?: boolean
    isBlocked?: boolean
    siteId?: string | null
    showBannerPad?: boolean
    /** "Saved 2:12 PM" etc. — shown as a pill over the preview. */
    saveStatusLabel?: string | null
    saveState?: BuilderSaveState
}

function getBlockDisplayLabel(block: {
    blockType?: string
    headline?: string
    sectionLabel?: string
    logoText?: string
    title?: string
}) {
    return (
        block.sectionLabel ||
        block.headline ||
        block.title ||
        block.logoText ||
        (block.blockType ? `${block.blockType.charAt(0).toUpperCase()}${block.blockType.slice(1)}` : 'Section')
    )
}

function CompletionPreviewPanel({
    mode,
    onModeChange,
    previewContent,
    onOpenPreview,
    siteId,
    showBannerPad,
    saveStatusLabel,
    saveState,
}: {
    mode: BuilderPreviewMode
    onModeChange: (mode: BuilderPreviewMode) => void
    previewContent: ReactNode
    onOpenPreview: () => void
    siteId?: string | null
    showBannerPad?: boolean
    saveStatusLabel?: string | null
    saveState?: BuilderSaveState
}) {
    const { t } = useI18n()
    const c = t.onboarding.completion
    const dot = saveState === 'error' ? 'bg-red-400' : saveState === 'dirty' || saveState === 'saving' ? 'bg-yellow-400' : 'bg-[#2dd4bf] shadow-[0_0_8px_rgba(45,212,191,.6)]'
    return (
        <div className={`bld-in flex h-full min-h-0 flex-col ${showBannerPad ? 'pb-[78px]' : ''}`} style={{ animationDuration: '.5s' }}>
            <div className="flex flex-none flex-wrap items-center justify-between gap-x-4 gap-y-3 pb-4">
                <div className="min-w-0">
                    <h2 className="whitespace-nowrap text-lg font-semibold leading-[26px] text-[#2dd4bf]">{c.previewTitle}</h2>
                    <p className="mt-0.5 whitespace-nowrap text-xs leading-4 text-[#cbd5e1]">{c.previewSubtitle}</p>
                </div>
                <BuilderPreviewToolbar mode={mode} onModeChange={onModeChange} onOpenPreview={onOpenPreview} />
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-[#0a0a0a]">
                <BuilderPreviewSurface mode={mode} siteId={siteId} variant="dock">
                    {previewContent}
                </BuilderPreviewSurface>
                {saveStatusLabel ? (
                    <span
                        className="absolute bottom-3 right-3 box-border flex h-[30px] items-center gap-[7px] rounded-full border border-solid border-[rgba(148,163,184,.16)] bg-[rgba(15,23,42,.88)] px-3 text-xs text-[#cbd5e1] backdrop-blur-[8px]"
                        data-testid="builder-save-status"
                        role="status"
                    >
                        <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />
                        {saveStatusLabel}
                    </span>
                ) : null}
            </div>
        </div>
    )
}

export default function BuilderCompletionView({
    siteName,
    totalBlocks,
    blocks = [],
    generationTimeLabel = '0s',
    onDashboard,
    onOpenEditor,
    onOpenPreview,
    onPublish,
    onMoveBlock,
    previewContent,
    floatingControls,
    previewMode,
    onPreviewModeChange,
    isPublishing = false,
    isNavigating = false,
    isBlocked = false,
    siteId,
    showBannerPad,
    saveStatusLabel,
    saveState,
}: BuilderCompletionViewProps) {
    const { t } = useI18n()
    const c = t.onboarding.completion
    const g = t.onboarding.generating
    const movableBlocks = blocks.filter(
        (block) => block._id && block.blockType !== 'navigation' && block.blockType !== 'footer',
    )

    const leftBody = (
        <div className="flex flex-col gap-3.5">
            <BuilderChatBubble>{g.startingMessage}</BuilderChatBubble>

            <BuilderReadyCard
                generationTimeLabel={generationTimeLabel}
                siteName={siteName}
                totalBlocks={totalBlocks}
            />

            <div className="rounded-2xl border border-solid border-[rgba(59,130,246,0.12)] bg-[rgba(15,23,42,0.55)] p-4 lg:hidden">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold text-[#f8fafc]">{c.mobilePreviewTitle}</p>
                        <p className="mt-1 text-xs leading-5 text-[#94a3b8]">
                            {c.mobilePreviewDescription}
                        </p>
                    </div>
                    <button
                        className="shrink-0 rounded-xl border border-solid border-[rgba(59,130,246,0.18)] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/[0.03]"
                        onClick={onOpenPreview}
                        type="button"
                    >
                        {c.openPreviewButton}
                    </button>
                </div>
            </div>

            {movableBlocks.length > 0 && onMoveBlock ? (
                <div className="rounded-2xl border border-solid border-[rgba(59,130,246,0.12)] bg-[rgba(15,23,42,0.55)] p-4 lg:hidden">
                    <div className="mb-3">
                        <p className="text-sm font-semibold text-[#f8fafc]">{c.arrangeSectionsTitle}</p>
                        <p className="mt-1 text-xs leading-5 text-[#94a3b8]">
                            {c.arrangeSectionsDescription}
                        </p>
                    </div>

                    <div className="flex flex-col gap-2">
                        {movableBlocks.map((block, index) => (
                            <div
                                className="flex items-center justify-between gap-3 rounded-2xl border border-solid border-white/10 bg-white/[0.03] px-3 py-3"
                                key={block._id}
                            >
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-[#f8fafc]">
                                        {getBlockDisplayLabel(block)}
                                    </p>
                                    <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-[#64748b]">
                                        {block.blockType}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        className="rounded-xl border border-solid border-white/10 p-2 text-white/80 transition-colors hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
                                        disabled={index === 0}
                                        onClick={() => onMoveBlock(block._id!, 'up')}
                                        type="button"
                                    >
                                        <ArrowUp className="size-4" />
                                    </button>
                                    <button
                                        className="rounded-xl border border-solid border-white/10 p-2 text-white/80 transition-colors hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
                                        disabled={index === movableBlocks.length - 1}
                                        onClick={() => onMoveBlock(block._id!, 'down')}
                                        type="button"
                                    >
                                        <ArrowDown className="size-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    )

    const leftFooter = (
        <BuilderCompletionActions
            isNavigating={isNavigating}
            isPublishing={isPublishing}
            onDashboard={onDashboard}
            onOpenEditor={onOpenEditor}
            onPublish={onPublish}
        />
    )

    return (
        <BuilderStepScreen
            floatingControls={floatingControls}
            layout="chat"
            leftBody={leftBody}
            leftFooter={isBlocked ? undefined : leftFooter}
            right={(
                <CompletionPreviewPanel
                    mode={previewMode}
                    onModeChange={onPreviewModeChange}
                    onOpenPreview={onOpenPreview}
                    previewContent={previewContent}
                    saveState={saveState}
                    saveStatusLabel={saveStatusLabel}
                    showBannerPad={showBannerPad}
                    siteId={siteId}
                />
            )}
            subtitle={g.subtitle}
            title={g.title}
        />
    )
}
