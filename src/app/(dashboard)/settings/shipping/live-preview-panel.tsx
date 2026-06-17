"use client"

import { PartyPopper, Lightbulb } from 'lucide-react'
import { useI18n } from '@/i18n'
import type { ShippingConfig } from '@/lib/shipping'
import { getShippingRate } from '@/lib/shipping'

const SIM_STATE = 'Selangor'
const SIM_CART_SEN = 8000

function formatRm(sen: number) {
    return 'RM ' + (sen / 100).toFixed(2)
}

type Props = {
    westRateRm: string
    eastRateRm: string
    freeEnabled: boolean
    freeAboveRm: string
}

export function LivePreviewPanel({ westRateRm, eastRateRm, freeEnabled, freeAboveRm }: Props) {
    const { t } = useI18n()
    const s = t.dashboard.settings.shipping
    const cfg: ShippingConfig = {
        enabled: true,
        westRate: Math.round((parseFloat(westRateRm) || 0) * 100),
        eastRate: Math.round((parseFloat(eastRateRm) || 0) * 100),
        freeAbove: freeEnabled && freeAboveRm ? Math.round(parseFloat(freeAboveRm) * 100) : null,
    }
    const shipSen = getShippingRate(SIM_STATE, cfg, SIM_CART_SEN)
    const totalSen = SIM_CART_SEN + shipSen
    const isFree = cfg.freeAbove != null && SIM_CART_SEN >= cfg.freeAbove
    const gapSen = cfg.freeAbove != null && !isFree ? cfg.freeAbove - SIM_CART_SEN : null

    return (
        <div className="mt-1 rounded-[12px] border border-white/[0.08] bg-[#0B1120]/70 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
                <span className="text-[11px] font-semibold tracking-widest text-[var(--dash-text-muted)] uppercase">
                    {s.livePreview}
                </span>
                <span className="text-[11px] text-[var(--dash-text-muted)]">⊙ SELANGOR · MYR 80 CART</span>
            </div>
            <div className="px-4 py-3 space-y-2.5">
                <div className="flex justify-between text-[13px]">
                    <span className="text-[var(--dash-text-muted)]">{s.liveSubtotal}</span>
                    <span className="text-[var(--dash-text)]">{formatRm(SIM_CART_SEN)}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                    <span className="text-[var(--dash-text-muted)]">{s.liveShipping}</span>
                    {isFree ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold"><PartyPopper className="w-4 h-4 shrink-0" aria-hidden /> FREE</span>
                    ) : (
                        <span className="text-[var(--dash-text)]">{formatRm(shipSen)}</span>
                    )}
                </div>
                {gapSen != null && (
                    <div className="flex items-center gap-2 rounded-[8px] border border-emerald-500/20 bg-emerald-500/[0.08] px-3 py-2">
                        <Lightbulb className="w-4 h-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden />
                        <span className="text-[13px] text-emerald-700 dark:text-emerald-300">
                            {s.liveAddMore.replace('{amount}', formatRm(gapSen))}
                        </span>
                    </div>
                )}
                <div className="flex justify-between items-center pt-1.5 border-t border-white/[0.06]">
                    <span className="text-[14px] font-bold text-[var(--dash-text)]">{s.liveBuyerPays}</span>
                    <span className="text-[15px] font-bold text-[var(--dash-text)]">{formatRm(totalSen)}</span>
                </div>
            </div>
        </div>
    )
}
