'use client'

import { Check, Clock3, LayoutDashboard } from 'lucide-react'
import { useI18n } from '@/i18n'
import { GradientHairline } from '@/components/builder/onboarding/GradientHairline'

function StatTile({
    icon,
    tileClassName,
    value,
    label,
}: {
    icon: React.ReactNode
    tileClassName: string
    value: string
    label: string
}) {
    return (
        <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-slate-400/10 bg-slate-900/50 px-3 py-2.5">
            <span className={`flex size-[30px] shrink-0 items-center justify-center rounded-[9px] border ${tileClassName}`}>
                {icon}
            </span>
            <span className="grid min-w-0 gap-px">
                <span className="whitespace-nowrap text-sm font-semibold leading-[18px] tabular-nums text-white">{value}</span>
                <span className="text-[11.5px] leading-[15px] text-slate-400">{label}</span>
            </span>
        </div>
    )
}

/** Full-width glass "is ready!" card: success icon, Draft badge, stat tiles. */
export function CompletionReadyCard({
    siteName,
    totalBlocks,
    generationTimeLabel,
}: {
    siteName: string
    totalBlocks: number
    generationTimeLabel: string
}) {
    const { t, ti } = useI18n()
    const c = t.onboarding.completion
    return (
        <div className="relative">
            <span
                aria-hidden
                className="pointer-events-none absolute inset-x-[10%] bottom-0 top-[15%] rounded-full bg-[radial-gradient(closest-side,rgba(45,212,191,0.13),rgba(45,212,191,0))] blur-[18px]"
            />
            <div className="relative grid gap-3.5 rounded-2xl border border-slate-400/[0.12] bg-[linear-gradient(160deg,rgba(56,189,248,0.07)_0%,rgba(30,41,59,0.5)_38%,rgba(15,23,42,0.62)_100%)] p-[18px] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_48px_-24px_rgba(0,0,0,0.75)] backdrop-blur-xl">
                <GradientHairline gradient="linear-gradient(160deg,rgba(45,212,191,0.55) 0%,rgba(56,189,248,0.12) 35%,rgba(148,163,184,0.03) 65%,rgba(56,189,248,0.3) 100%)" />
                <div className="flex items-center gap-3">
                    <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#22c55e,#2dd4bf)] text-white shadow-[0_0_18px_rgba(34,197,94,0.35),inset_0_1px_0_rgba(255,255,255,0.25)]">
                        <span aria-hidden className="absolute inset-0 rounded-full border-2 border-[rgba(45,212,191,0.6)] opacity-0 motion-safe:animate-pw-ring motion-safe:[animation-delay:.35s] motion-safe:[animation-iteration-count:2]" />
                        <Check className="size-[18px]" strokeWidth={2.75} aria-hidden />
                    </span>
                    <p className="min-w-0 flex-1 break-words text-[15px] font-semibold leading-5 text-white">
                        <span className="text-sky-400">&quot;{siteName}&quot;</span> {c.successMessage}
                    </p>
                    <span
                        className="flex shrink-0 items-center gap-[5px] rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-medium uppercase leading-[14px] text-yellow-400"
                        data-testid="completion-draft-badge"
                    >
                        <span aria-hidden className="size-[5px] rounded-full bg-yellow-400" />
                        {c.draftBadge}
                    </span>
                </div>

                <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
                    <StatTile
                        icon={<LayoutDashboard className="size-[15px]" strokeWidth={1.75} aria-hidden />}
                        label={c.sectionsGeneratedLabel}
                        tileClassName="border-sky-400/25 bg-sky-400/[0.12] text-sky-300"
                        value={ti(c.sectionsGenerated, { count: totalBlocks })}
                    />
                    <StatTile
                        icon={<Clock3 className="size-[15px]" strokeWidth={1.75} aria-hidden />}
                        label={c.generationTimeLabel}
                        tileClassName="border-teal-400/25 bg-teal-400/[0.12] text-teal-300"
                        value={`+${generationTimeLabel}`}
                    />
                </div>

                <p className="text-[13px] leading-5 text-slate-400">{c.description}</p>
            </div>
        </div>
    )
}
