"use client"

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
    const sstSen = Math.round(SIM_CART_SEN * 0.06)
    const totalSen = SIM_CART_SEN + shipSen + sstSen
    const isFree = cfg.freeAbove != null && SIM_CART_SEN >= cfg.freeAbove
    const gapSen = cfg.freeAbove != null && !isFree ? cfg.freeAbove - SIM_CART_SEN : null

    return (
        <div className="mt-1 rounded-[12px] border border-white/[0.08] bg-[#0B1120]/70 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
                <span className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase">
                    {s.livePreview}
                </span>
                <span className="text-[11px] text-slate-500">⊙ SELANGOR · MYR 80 CART</span>
            </div>
            <div className="px-4 py-3 space-y-2.5">
                <div className="flex justify-between text-[13px]">
                    <span className="text-slate-400">{s.liveSubtotal}</span>
                    <span className="text-slate-200">{formatRm(SIM_CART_SEN)}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                    <span className="text-slate-400">{s.liveShipping}</span>
                    {isFree ? (
                        <span className="text-emerald-400 font-semibold">🎉 FREE</span>
                    ) : (
                        <span className="text-slate-200">{formatRm(shipSen)}</span>
                    )}
                </div>
                {gapSen != null && (
                    <div className="flex items-center gap-2 rounded-[8px] border border-emerald-500/20 bg-emerald-500/[0.08] px-3 py-2">
                        <span className="text-[13px] text-emerald-300">
                            💡 {s.liveAddMore.replace('{amount}', formatRm(gapSen))}
                        </span>
                    </div>
                )}
                <div className="flex justify-between text-[13px]">
                    <span className="text-slate-400">{s.liveSst}</span>
                    <span className="text-slate-200">{formatRm(sstSen)}</span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-white/[0.06]">
                    <span className="text-[14px] font-bold text-slate-200">{s.liveBuyerPays}</span>
                    <span className="text-[15px] font-bold text-slate-50">{formatRm(totalSen)}</span>
                </div>
            </div>
        </div>
    )
}
