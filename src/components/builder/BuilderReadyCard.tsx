'use client'

import type { ReactNode } from 'react'
import { Check, Clock, LayoutGrid } from 'lucide-react'
import { BuilderGradientBorder } from '@/components/builder/BuilderMotion'
import { useI18n } from '@/i18n'

interface BuilderReadyCardProps {
    siteName: string
    totalBlocks: number
    generationTimeLabel: string
}

function StatTile({ icon, tone, value, label }: { icon: ReactNode; tone: 'sky' | 'teal'; value: string; label: string }) {
    return (
        <div className="box-border flex min-w-0 items-center gap-2.5 rounded-xl border border-solid border-[rgba(148,163,184,.1)] bg-[rgba(15,23,42,.5)] px-3 py-2.5">
            <span
                className={
                    tone === 'sky'
                        ? 'box-border flex size-[30px] flex-none items-center justify-center rounded-[9px] border border-solid border-[rgba(56,189,248,.26)] bg-[rgba(56,189,248,.12)] text-[#7dd3fc]'
                        : 'box-border flex size-[30px] flex-none items-center justify-center rounded-[9px] border border-solid border-[rgba(45,212,191,.26)] bg-[rgba(45,212,191,.12)] text-[#5eead4]'
                }
            >
                {icon}
            </span>
            <span className="grid min-w-0 gap-px">
                <span className="whitespace-nowrap text-sm font-semibold leading-[18px] text-white [font-variant-numeric:tabular-nums]">{value}</span>
                <span className="text-[11.5px] leading-[15px] text-[#94a3b8]">{label}</span>
            </span>
        </div>
    )
}

/** Full-width glass "…is ready!" card of the done state. */
export function BuilderReadyCard({ siteName, totalBlocks, generationTimeLabel }: BuilderReadyCardProps) {
    const { t, ti } = useI18n()
    const c = t.onboarding.completion
    return (
        <div className="bld-in relative" data-testid="builder-ready-card" style={{ animationDuration: '.45s' }}>
            <span aria-hidden className="pointer-events-none absolute inset-x-[10%] bottom-0 top-[15%] rounded-[50%] blur-[18px] [background:radial-gradient(closest-side,rgba(45,212,191,.13),rgba(45,212,191,0))]" />
            <div className="relative box-border grid gap-3.5 rounded-2xl border border-solid border-[rgba(148,163,184,.12)] p-[18px] shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_24px_48px_-24px_rgba(0,0,0,.75)] backdrop-blur-[16px] [background:linear-gradient(160deg,rgba(56,189,248,.07)_0%,rgba(30,41,59,.5)_38%,rgba(15,23,42,.62)_100%)]">
                <BuilderGradientBorder gradient="linear-gradient(160deg,rgba(45,212,191,.55) 0%,rgba(56,189,248,.12) 35%,rgba(148,163,184,.03) 65%,rgba(56,189,248,.3) 100%)" />
                <div className="flex items-center gap-3">
                    <span className="relative flex size-9 flex-none items-center justify-center rounded-full text-white shadow-[0_0_18px_rgba(34,197,94,.35),inset_0_1px_0_rgba(255,255,255,.25)] [background-image:linear-gradient(135deg,#22c55e,#2dd4bf)]">
                        <span aria-hidden className="bld-ring pointer-events-none absolute inset-0 rounded-full border-2 border-solid border-[rgba(45,212,191,.6)]" />
                        <Check aria-hidden className="size-[18px]" strokeWidth={2.75} />
                    </span>
                    <p className="m-0 min-w-0 flex-1 text-[15px] font-semibold leading-5 text-white [overflow-wrap:anywhere]">
                        <span className="text-[#38bdf8]">&quot;{siteName}&quot;</span> {c.successMessage}
                    </p>
                    <span className="flex flex-none items-center gap-[5px] rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-medium uppercase leading-[14px] text-yellow-400">
                        <span aria-hidden className="size-[5px] rounded-full bg-yellow-400" />
                        {t.dashboard.sites.draft}
                    </span>
                </div>
                <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
                    <StatTile icon={<LayoutGrid className="size-[15px]" strokeWidth={1.75} />} label={c.sectionsGeneratedLabel} tone="sky" value={ti(c.sectionsGenerated, { count: totalBlocks })} />
                    <StatTile icon={<Clock className="size-[15px]" strokeWidth={1.75} />} label={c.generationTimeLabel} tone="teal" value={`+${generationTimeLabel}`} />
                </div>
                <p className="m-0 text-[13px] leading-5 text-[#94a3b8] [text-wrap:pretty]">{c.description}</p>
            </div>
        </div>
    )
}
