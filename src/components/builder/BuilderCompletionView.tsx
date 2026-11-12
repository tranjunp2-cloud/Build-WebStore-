'use client'

import type { ReactNode } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, ExternalLink, Loader2, Rocket } from 'lucide-react'
import type { BuilderPreviewMode } from '@/components/builder/BuilderPreviewPrimitives'
import { CompletionPreviewPanel } from '@/components/builder/completion/CompletionPreviewPanel'
import { CompletionReadyCard } from '@/components/builder/completion/CompletionReadyCard'
import { BuilderStepScreen } from '@/components/builder/onboarding/BuilderStepScreen'
import { useI18n } from '@/i18n'

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

function CompletionPrimaryButton({
    icon,
    label,
    onClick,
    disabled = false,
}: {
    icon: ReactNode
    label: string
    onClick: () => void
    disabled?: boolean
}) {
    return (
        <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(90deg,#3b82f6,#2dd4bf)] px-4 text-sm font-semibold text-white shadow-[0_12px_26px_-12px_rgba(45,212,191,0.6),inset_0_1px_0_rgba(255,255,255,0.22)] transition-[filter,transform] duration-200 hover:brightness-110 active:scale-[0.98] motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled}
            onClick={onClick}
            type="button"
        >
            {icon}
            <span>{label}</span>
        </button>
    )
}

function CompletionSecondaryButton({
    icon,
    label,
    onClick,
    disabled = false,
}: {
    icon: ReactNode
    label: string
    onClick: () => void
    disabled?: boolean
}) {
    return (
        <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-400/[0.24] bg-slate-400/[0.06] px-4 text-sm font-semibold text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md transition-colors hover:border-sky-400/55 hover:bg-sky-400/[0.08] hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled}
            onClick={onClick}
            type="button"
        >
            {icon}
            <span>{label}</span>
        </button>
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
}: BuilderCompletionViewProps) {
    const { t } = useI18n()
    const c = t.onboarding.completion
    const g = t.onboarding.generating
    const movableBlocks = blocks.filter(
        (block) => block._id && block.blockType !== 'navigation' && block.blockType !== 'footer',
    )

    const leftBody = (
        <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
                <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#3b82f6_0%,#2dd4bf_100%)]">
                    <Rocket className="h-4 w-4 text-white" aria-hidden />
                </div>
                <div className="relative rounded-xl border border-slate-400/[0.13] bg-[linear-gradient(160deg,rgba(51,65,85,0.42),rgba(30,41,59,0.32))] px-4 py-[11px] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl">
                    <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_1px_0px_0px_rgba(255,255,255,0.05)]" />
                    <p className="relative text-sm leading-5 text-[#f8fafc]">
                        {g.startingMessage}
                    </p>
                </div>
            </div>

            <CompletionReadyCard
                generationTimeLabel={generationTimeLabel}
                siteName={siteName}
                totalBlocks={totalBlocks}
            />

            <div className="rounded-2xl border border-[rgba(59,130,246,0.12)] bg-[rgba(15,23,42,0.55)] p-4 lg:hidden">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold text-[#f8fafc]">{c.mobilePreviewTitle}</p>
                        <p className="mt-1 text-xs leading-5 text-[#94a3b8]">
                            {c.mobilePreviewDescription}
                        </p>
                    </div>
                    <button
                        className="shrink-0 rounded-xl border border-[rgba(59,130,246,0.18)] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/[0.03]"
                        onClick={onOpenPreview}
                        type="button"
                    >
                        {c.openPreviewButton}
                    </button>
                </div>
            </div>

            {movableBlocks.length > 0 && onMoveBlock ? (
                <div className="rounded-2xl border border-[rgba(59,130,246,0.12)] bg-[rgba(15,23,42,0.55)] p-4 lg:hidden">
                    <div className="mb-3">
                        <p className="text-sm font-semibold text-[#f8fafc]">{c.arrangeSectionsTitle}</p>
                        <p className="mt-1 text-xs leading-5 text-[#94a3b8]">
                            {c.arrangeSectionsDescription}
                        </p>
                    </div>

                    <div className="flex flex-col gap-2">
                        {movableBlocks.map((block, index) => (
                            <div
                                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3"
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
                                        className="rounded-xl border border-white/10 p-2 text-white/80 transition-colors hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
                                        disabled={index === 0}
                                        onClick={() => onMoveBlock(block._id!, 'up')}
                                        type="button"
                                    >
                                        <ArrowUp className="size-4" />
                                    </button>
                                    <button
                                        className="rounded-xl border border-white/10 p-2 text-white/80 transition-colors hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
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

    // Prototype builder-v2: full-width dock — gradient primary, outline secondary,
    // subtle text button with arrow for dashboard.
    const leftFooter = (
        <div className="grid gap-2.5">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
                <CompletionPrimaryButton
                    icon={<ExternalLink className="size-4" />}
                    label={c.openEditor}
                    onClick={onOpenEditor}
                    disabled={isPublishing || isNavigating}
                />
                <CompletionSecondaryButton
                    icon={isPublishing ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                    label={isPublishing ? c.publishing : c.publishWebsite}
                    onClick={onPublish}
                    disabled={isPublishing}
                />
            </div>
            <button
                className="flex h-8 items-center gap-1.5 justify-self-center rounded-lg px-2.5 text-[13px] font-medium text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isPublishing || isNavigating}
                onClick={onDashboard}
                type="button"
            >
                {isNavigating ? c.loading : c.goToDashboard}
                <ArrowRight className="size-3.5" aria-hidden />
            </button>
        </div>
    )

    return (
        <BuilderStepScreen
            compactLeft
            floatingControls={floatingControls}
            gridClassName="lg:grid-cols-[min(440px,40%)_1fr]"
            leftBody={leftBody}
            leftFooter={isBlocked ? undefined : leftFooter}
            right={(
                <CompletionPreviewPanel
                    mode={previewMode}
                    onModeChange={onPreviewModeChange}
                    onOpenPreview={onOpenPreview}
                    previewContent={previewContent}
                    siteId={siteId}
                    showBannerPad={showBannerPad}
                />
            )}
            rightContentClassName="h-full max-w-none px-0 xl:px-0"
            rightPaneClassName="lg:items-stretch lg:justify-stretch"
            subtitle={g.subtitle}
            title={g.title}
        />
    )
}
