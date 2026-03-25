import { BuilderStepList } from '@/components/builder/onboarding/BuilderStepList'

interface BuilderPromoCardProps {
    title: string
    description: string
    steps: Array<{ id: number; label: string; active?: boolean }>
}

const BUILDER_PROMO_ICON_URL = '/assets/builder/builder-promo-icon.svg'

export function BuilderPromoCard({
    title,
    description,
    steps,
}: BuilderPromoCardProps) {
    return (
        <div className="mx-auto flex w-full max-w-[448px] justify-center">
            <div className="relative w-full rounded-2xl border border-[rgba(59,130,246,0.15)] bg-[rgba(30,41,59,0.6)] p-8 shadow-[0px_8px_32px_0px_rgba(0,0,0,0.3)]">
                <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_1px_0px_0px_rgba(255,255,255,0.05)]" />
                <div className="relative flex flex-col gap-8">
                    <div className="flex size-16 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#3b82f6_0%,#2dd4bf_100%)] px-4 shadow-[0px_0px_24px_0px_rgba(59,130,246,0.6),0px_0px_40px_0px_rgba(45,212,191,0.3)]">
                        <img
                            alt=""
                            className="size-8"
                            src={BUILDER_PROMO_ICON_URL}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <h2 className="text-2xl font-semibold leading-8 text-white">
                            {title}
                        </h2>
                        <p className="max-w-[373px] text-sm leading-[22.75px] text-[#94a3b8]">
                            {description}
                        </p>
                    </div>
                    <BuilderStepList steps={steps} />
                </div>
            </div>
        </div>
    )
}
