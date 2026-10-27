import { cn } from '@/lib/utils'

interface BuilderStepListItem {
    id: number
    label: string
    active?: boolean
}

interface BuilderStepListProps {
    steps: BuilderStepListItem[]
}

export function BuilderStepList({ steps }: BuilderStepListProps) {
    return (
        <div className="flex flex-col gap-4">
            {steps.map((step) => (
                <div key={step.id} className="flex items-center gap-4">
                    <div
                        className={cn(
                            'flex size-10 shrink-0 items-center justify-center rounded-full border text-base font-semibold',
                            step.active
                                ? 'border-transparent bg-[linear-gradient(135deg,#3b82f6_0%,#2dd4bf_100%)] text-white'
                                : 'border-[rgba(59,130,246,0.15)] bg-[rgba(30,41,59,0.6)] text-[#94a3b8] shadow-[0px_8px_32px_0px_rgba(0,0,0,0.3),inset_0px_1px_0px_0px_rgba(255,255,255,0.05)]',
                        )}
                    >
                        {step.id}
                    </div>
                    <span
                        className={cn(
                            'text-sm font-medium leading-5',
                            step.active ? 'text-[#f8fafc]' : 'text-[#94a3b8]',
                        )}
                    >
                        {step.label}
                    </span>
                </div>
            ))}
        </div>
    )
}
