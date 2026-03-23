import type { ReactNode } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { BuilderStepScreen } from '@/components/builder/onboarding/BuilderStepScreen'

interface BuilderGenerationViewProps {
    message?: string
    progress: number
    floatingControls?: ReactNode
}

function BuilderGenerationCard({ progress }: { progress: number }) {
    return (
        <div className="mx-auto flex w-full max-w-[864px] items-center justify-center px-12">
            <div className="relative w-full max-w-[448px] rounded-2xl border border-[rgba(59,130,246,0.15)] bg-[rgba(30,41,59,0.6)] p-8 shadow-[0px_8px_32px_0px_rgba(0,0,0,0.3)]">
                <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_1px_0px_0px_rgba(255,255,255,0.05)]" />
                <div className="relative">
                    <div className="mb-6 flex justify-center">
                        <div className="flex size-20 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#3b82f6_0%,#2dd4bf_100%)] shadow-[0px_0px_24px_0px_rgba(59,130,246,0.6),0px_0px_40px_0px_rgba(45,212,191,0.3)]">
                            <Loader2 className="size-10 animate-spin text-white" />
                        </div>
                    </div>

                    <div className="mb-8 text-center">
                        <h2 className="bg-[linear-gradient(173.5deg,#3b82f6_0%,#2dd4bf_100%)] bg-clip-text text-2xl font-semibold leading-8 text-transparent">
                            Creating Your Website...
                        </h2>
                        <p className="mx-auto mt-3 max-w-[372px] text-sm leading-5 text-[#94a3b8]">
                            AI is analyzing your business and generating the perfect design.
                        </p>
                    </div>

                    <div className="mb-6 flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[rgba(0,201,80,0.2)] text-[#00C950]">
                                <Check className="size-4" strokeWidth={3} />
                            </div>
                            <span className="text-sm leading-5 text-[#f8fafc]">Analyzing business information</span>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#3b82f6_0%,#2dd4bf_100%)] opacity-65">
                                <Loader2 className="size-4 animate-spin text-white" />
                            </div>
                            <span className="text-sm leading-5 text-[#f8fafc]">Generating content & design</span>
                        </div>

                        <div className="flex items-center gap-3 opacity-50">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)]">
                                <span className="text-sm font-medium text-[#94a3b8]">3</span>
                            </div>
                            <span className="text-sm leading-5 text-[#94a3b8]">Preparing preview</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs leading-4 text-[#94a3b8]">Building your website</span>
                            <span className="text-xs font-medium leading-4 text-[#3b82f6]">Processing...</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
                            <div
                                className="h-full rounded-full bg-[linear-gradient(90deg,#3b82f6_0%,#2dd4bf_100%)] transition-all duration-300"
                                style={{ width: `${Math.max(10, progress)}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function BuilderGenerationView({
    message,
    progress,
    floatingControls,
}: BuilderGenerationViewProps) {
    const leftBody = (
        <div className="flex flex-col gap-6">
            <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#3b82f6_0%,#2dd4bf_100%)] text-sm">
                    🚀
                </div>
                <div className="relative rounded-bl-2xl rounded-br-2xl rounded-tl-lg rounded-tr-2xl border border-[rgba(59,130,246,0.15)] bg-[rgba(30,41,59,0.6)] px-[17px] py-[13px] shadow-[0px_8px_32px_0px_rgba(0,0,0,0.3)]">
                    <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_1px_0px_0px_rgba(255,255,255,0.05)]" />
                    <p className="relative text-sm leading-5 text-[#f8fafc]">
                        {message || 'Starting website creation...'}
                    </p>
                </div>
            </div>

            <div className="lg:hidden">
                <BuilderGenerationCard progress={progress} />
            </div>
        </div>
    )

    return (
        <BuilderStepScreen
            floatingControls={floatingControls}
            leftBody={leftBody}
            right={<BuilderGenerationCard progress={progress} />}
            subtitle="Website Generation"
            title="Create Website with AI"
        />
    )
}
