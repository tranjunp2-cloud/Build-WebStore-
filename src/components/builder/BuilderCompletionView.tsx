import type { ReactNode } from 'react'
import { Check, Clock3, ExternalLink, LayoutDashboard } from 'lucide-react'
import { BuilderPreviewMode, BuilderPreviewModeToggle, BuilderPreviewSurface } from '@/components/builder/BuilderPreviewPrimitives'
import { BuilderStepScreen } from '@/components/builder/onboarding/BuilderStepScreen'

interface BuilderCompletionViewProps {
    siteName: string
    totalBlocks: number
    generationTimeLabel?: string
    onDashboard: () => void
    onOpenEditor: () => void
    onOpenPreview: () => void
    previewContent: ReactNode
    floatingControls?: ReactNode
    previewMode: BuilderPreviewMode
    onPreviewModeChange: (mode: BuilderPreviewMode) => void
}

function CompletionPrimaryButton({
    icon,
    label,
    onClick,
}: {
    icon: ReactNode
    label: string
    onClick: () => void
}) {
    return (
        <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#3b82f6_0%,#2dd4bf_100%)] px-4 text-sm font-semibold text-white shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)] transition-all duration-300 hover:brightness-110"
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
}: {
    icon: ReactNode
    label: string
    onClick: () => void
}) {
    return (
        <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-[rgba(59,130,246,0.15)] bg-transparent px-4 text-sm font-medium text-[#f8fafc] transition-colors hover:border-[rgba(59,130,246,0.3)] hover:bg-white/[0.02]"
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
        <div className="relative h-[174px] w-full max-w-[448px] rounded-bl-2xl rounded-br-2xl rounded-tl-lg rounded-tr-2xl border border-[rgba(59,130,246,0.15)] bg-[rgba(30,41,59,0.6)] px-[21px] pb-px pt-[17px] shadow-[0px_8px_32px_0px_rgba(0,0,0,0.3)]">
            <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_1px_0px_0px_rgba(255,255,255,0.05)]" />
            <div className="relative flex flex-col items-start gap-4">
                <p className="text-sm font-medium leading-5 text-[#f8fafc]">
                    Website <span className="bg-[linear-gradient(158.2deg,#3b82f6_0%,#2dd4bf_100%)] bg-clip-text font-semibold text-transparent">"{siteName}"</span> has been created successfully!
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
    generationTimeLabel = '0s',
    onDashboard,
    onOpenEditor,
    onOpenPreview,
    previewContent,
    floatingControls,
    previewMode,
    onPreviewModeChange,
}: BuilderCompletionViewProps) {
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
        </div>
    )

    const leftFooter = (
        <div className="flex flex-col gap-3">
            <CompletionPrimaryButton
                icon={<LayoutDashboard className="size-4" />}
                label="Dashboard"
                onClick={onDashboard}
            />
            <CompletionSecondaryButton
                icon={<ExternalLink className="size-4" />}
                label="Open Editor"
                onClick={onOpenEditor}
            />
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
