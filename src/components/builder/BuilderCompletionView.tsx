import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, Clock3, ExternalLink, LayoutDashboard, Loader2, Rocket } from 'lucide-react'
import { BuilderPreviewMode, BuilderPreviewModeToggle, BuilderPreviewSurface } from '@/components/builder/BuilderPreviewPrimitives'
import { BuilderStepScreen } from '@/components/builder/onboarding/BuilderStepScreen'

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
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#3b82f6_0%,#2dd4bf_100%)] px-4 text-sm font-semibold text-white shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)] transition-all duration-300 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
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
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-[rgba(59,130,246,0.15)] bg-transparent px-4 text-sm font-medium text-[#f8fafc] transition-colors hover:border-[rgba(59,130,246,0.3)] hover:bg-white/[0.02] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled}
            onClick={onClick}
            type="button"
        >
            {icon}
            <span>{label}</span>
        </button>
    )
}

function CompletionStatusCard({
    siteName,
    totalBlocks,
    generationTimeLabel,
}: {
    siteName: string
    totalBlocks: number
    generationTimeLabel: string
}) {
    return (
        <div className="relative h-auto min-h-[174px] w-full max-w-[448px] rounded-bl-2xl rounded-br-2xl rounded-tl-lg rounded-tr-2xl border border-[rgba(59,130,246,0.15)] bg-[rgba(30,41,59,0.6)] px-[21px] pb-4 pt-[17px] shadow-[0px_8px_32px_0px_rgba(0,0,0,0.3)]">
            <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_1px_0px_0px_rgba(255,255,255,0.05)]" />
            <div className="relative flex flex-col items-start gap-4">
                <p className="text-sm font-medium leading-5 text-[#f8fafc]">
                    Website <span className="bg-[linear-gradient(158.2deg,#3b82f6_0%,#2dd4bf_100%)] bg-clip-text font-semibold text-transparent">&quot;{siteName}&quot;</span> has been created successfully!
                </p>

                <div className="flex h-12 w-full flex-col items-start gap-2">
                    <div className="flex h-5 w-full items-center gap-2">
                        <LayoutDashboard className="size-4 text-[#94a3b8]" />
                        <p className="text-sm leading-5 text-[#f8fafc]">
                            <span className="font-medium">+{totalBlocks} sections</span>
                            <span className="text-[#94a3b8]"> generated</span>
                        </p>
                    </div>
                    <div className="flex h-5 w-full items-center gap-2">
                        <Clock3 className="size-4 text-[#94a3b8]" />
                        <p className="text-sm leading-5 text-[#f8fafc]">
                            <span className="font-medium">+{generationTimeLabel}</span>
                            <span className="text-[#94a3b8]"> generation time</span>
                        </p>
                    </div>
                </div>

                <p className="max-w-[377px] text-sm leading-5 text-[#94a3b8]">
                    You can view the Preview on the right, open the Editor to make changes, or Publish now!
                </p>
            </div>
        </div>
    )
}

function CompletionPreviewPanel({
    mode,
    onModeChange,
    previewContent,
    onOpenPreview,
}: {
    mode: BuilderPreviewMode
    onModeChange: (mode: BuilderPreviewMode) => void
    previewContent: ReactNode
    onOpenPreview: () => void
}) {
    return (
        <div className="relative h-screen overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(104.73deg,#0b1120_0%,#0b1120_50%,rgba(59,130,246,0.05)_100%)]" />
            <div className="relative flex h-full flex-col">
                <div className="bg-[linear-gradient(174.85deg,#0b1120_0%,#0b1120_50%,rgba(59,130,246,0.05)_100%)] px-6 pt-5">
                    <div className="grid min-h-[50px] grid-cols-[1fr_auto_1fr] items-center gap-4">
                        <div className="flex min-w-0 flex-col gap-0.5">
                            <h2 className="text-[18px] font-semibold leading-7 text-[#2dd4bf]">
                                Website Preview
                            </h2>
                            <p className="text-xs leading-4 text-[rgba(248,250,252,0.7)]">
                                Your AI-generated website
                            </p>
                        </div>

                        <div className="flex justify-center">
                            <BuilderPreviewModeToggle mode={mode} onChange={onModeChange} />
                        </div>

                        <div className="flex justify-end">
                            <button
                                className="flex h-10 items-center gap-2 whitespace-nowrap rounded-full bg-[linear-gradient(90deg,#3b82f6_0%,#2dd4bf_100%)] px-4 text-sm font-semibold text-white shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)] transition-all hover:brightness-110"
                                onClick={onOpenPreview}
                                type="button"
                            >
                                <ExternalLink className="size-4" />
                                <span>View Full Preview</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="relative flex-1 overflow-hidden px-6 pb-6 pt-4">
                    <BuilderPreviewSurface mode={mode} variant="panel">
                        {previewContent}
                    </BuilderPreviewSurface>
                </div>
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
}: BuilderCompletionViewProps) {
    const movableBlocks = blocks.filter(
        (block) => block._id && block.blockType !== 'navigation' && block.blockType !== 'footer',
    )

    const leftBody = (
        <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#3b82f6_0%,#2dd4bf_100%)] text-sm">
                    🚀
                </div>
                <div className="relative rounded-bl-2xl rounded-br-2xl rounded-tl-lg rounded-tr-2xl border border-[rgba(59,130,246,0.15)] bg-[rgba(30,41,59,0.6)] px-[17px] py-[13px] shadow-[0px_8px_32px_0px_rgba(0,0,0,0.3)]">
                    <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_1px_0px_0px_rgba(255,255,255,0.05)]" />
                    <p className="relative text-sm leading-5 text-[#f8fafc]">
                        Starting website creation...
                    </p>
                </div>
            </div>

            <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#00c950_0%,#00bc7d_100%)] text-sm">
                    ✅
                </div>
                <CompletionStatusCard
                    generationTimeLabel={generationTimeLabel}
                    siteName={siteName}
                    totalBlocks={totalBlocks}
                />
            </div>

            <div className="rounded-2xl border border-[rgba(59,130,246,0.12)] bg-[rgba(15,23,42,0.55)] p-4 lg:hidden">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold text-[#f8fafc]">Mobile preview</p>
                        <p className="mt-1 text-xs leading-5 text-[#94a3b8]">
                            Open the immersive preview to review the generated site on mobile.
                        </p>
                    </div>
                    <button
                        className="shrink-0 rounded-xl border border-[rgba(59,130,246,0.18)] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/[0.03]"
                        onClick={onOpenPreview}
                        type="button"
                    >
                        Open Preview
                    </button>
                </div>
            </div>

            {movableBlocks.length > 0 && onMoveBlock ? (
                <div className="rounded-2xl border border-[rgba(59,130,246,0.12)] bg-[rgba(15,23,42,0.55)] p-4 lg:hidden">
                    <div className="mb-3">
                        <p className="text-sm font-semibold text-[#f8fafc]">Arrange sections</p>
                        <p className="mt-1 text-xs leading-5 text-[#94a3b8]">
                            Use list mode on mobile to move sections up or down safely.
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

    // Design 2026-04-14: two primary actions side-by-side (Open Editor + Publish Website)
    // with a tertiary "Go To Dashboard" text link below. Matches the approved reference
    // at docs/design/F01 completion screen.
    const leftFooter = (
        <div className="flex flex-col items-center gap-4">
            <div className="flex w-full gap-3">
                <CompletionPrimaryButton
                    icon={<ExternalLink className="size-4" />}
                    label="Open Editor"
                    onClick={onOpenEditor}
                    disabled={isPublishing || isNavigating}
                />
                <CompletionSecondaryButton
                    icon={isPublishing ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                    label={isPublishing ? 'Publishing...' : 'Publish Website'}
                    onClick={onPublish}
                    disabled={isPublishing}
                />
            </div>
            <button
                className="text-sm font-medium text-[#3b82f6] underline underline-offset-4 transition-colors hover:text-[#60a5fa] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isPublishing || isNavigating}
                onClick={onDashboard}
                type="button"
            >
                {isNavigating ? 'Loading...' : 'Go To Dashboard'}
            </button>
        </div>
    )

    return (
        <BuilderStepScreen
            floatingControls={floatingControls}
            leftBody={leftBody}
            leftFooter={leftFooter}
            right={(
                <CompletionPreviewPanel
                    mode={previewMode}
                    onModeChange={onPreviewModeChange}
                    onOpenPreview={onOpenPreview}
                    previewContent={previewContent}
                />
            )}
            rightContentClassName="h-full max-w-none px-0 xl:px-0"
            rightPaneClassName="lg:items-stretch lg:justify-stretch"
            subtitle="Website Generation"
            title="Create Website with AI"
        />
    )
}
