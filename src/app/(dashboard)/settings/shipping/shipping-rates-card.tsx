"use client"

import { useState } from 'react'
import { Truck } from 'lucide-react'
import { useI18n } from '@/i18n'
import { WEST_MY_STATES } from '@/lib/shipping'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { LivePreviewPanel } from './live-preview-panel'

const WEST_STATES_PREVIEW = WEST_MY_STATES.slice(0, 5)
const WEST_STATES_HIDDEN = WEST_MY_STATES.length - WEST_STATES_PREVIEW.length
const EAST_STATES_DISPLAY = ['Sabah', 'Sarawak', 'Labuan']

type Props = {
    westRateRm: string
    eastRateRm: string
    freeEnabled: boolean
    freeAboveRm: string
    onWestChange: (v: string) => void
    onEastChange: (v: string) => void
    westError?: string
    eastError?: string
}

const INPUT_CLS =
    'min-h-[44px] w-full rounded-[10px] border border-white/[0.12] bg-[#0B1120]/50 pl-10 pr-3 text-[15px] text-slate-50 placeholder:text-slate-50/30 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30'

const CHIP_CLS =
    'rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[11px] text-slate-400'


export function ShippingRatesCard({
    westRateRm,
    eastRateRm,
    freeEnabled,
    freeAboveRm,
    onWestChange,
    onEastChange,
    westError,
    eastError,
}: Props) {
    const { t } = useI18n()
    const s = t.dashboard.settings.shipping
    const [westExpanded, setWestExpanded] = useState(false)
    const westStates = westExpanded ? WEST_MY_STATES : WEST_STATES_PREVIEW
    return (
        <div className="flex flex-col p-6 rounded-[16px] border border-white/[0.08] bg-[#1E293B]/60 gap-5">
            {/* Card header */}
            <div className="flex items-start gap-4">
                <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[12px] bg-[#2DD4BF]/10 border border-[#2DD4BF]/20 shrink-0">
                    <Truck className="h-5 w-5 text-[#2DD4BF]" />
                </div>
                <div>
                    <h3 className="text-[18px] font-semibold text-slate-50">{s.title}</h3>
                    <p className="mt-1 text-[13px] text-slate-50/50">{s.subtitle}</p>
                </div>
            </div>

            {/* West / East rate rows */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* West Malaysia */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-[14px] font-medium text-slate-200">{s.westMalaysia}</span>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span tabIndex={0} className="cursor-default rounded-full bg-cyan-500/15 border border-cyan-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-400 tracking-wide">
                                    {s.westBadge}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>{s.westBadgeTooltip}</TooltipContent>
                        </Tooltip>
                    </div>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400 select-none pointer-events-none">
                            RM
                        </span>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1000"
                            inputMode="decimal"
                            className={INPUT_CLS + (westError ? ' border-destructive' : '')}
                            placeholder="8.00"
                            value={westRateRm}
                            onChange={e => onWestChange(e.target.value)}
                        />
                    </div>
                    {westError && <p className="mt-1 text-xs text-destructive">{westError}</p>}
                    <div className="flex flex-wrap gap-1.5">
                        {westStates.map(state => (
                            <span key={state} className={CHIP_CLS}>{state}</span>
                        ))}
                        {!westExpanded && (
                            <button
                                type="button"
                                onClick={() => setWestExpanded(true)}
                                className={CHIP_CLS + ' cursor-pointer text-slate-500 hover:text-slate-300 hover:border-white/20 transition-colors'}
                            >
                                {s.moreStates.replace('{count}', String(WEST_STATES_HIDDEN))}
                            </button>
                        )}
                        {westExpanded && (
                            <button
                                type="button"
                                onClick={() => setWestExpanded(false)}
                                className={CHIP_CLS + ' cursor-pointer text-slate-500 hover:text-slate-300 hover:border-white/20 transition-colors'}
                            >
                                {s.showLess}
                            </button>
                        )}
                    </div>
                </div>

                {/* East Malaysia */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-[14px] font-medium text-slate-200">{s.eastMalaysia}</span>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span tabIndex={0} className="cursor-default rounded-full bg-fuchsia-500/15 border border-fuchsia-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-fuchsia-400 tracking-wide">
                                    {s.eastBadge}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>{s.eastBadgeTooltip}</TooltipContent>
                        </Tooltip>
                    </div>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400 select-none pointer-events-none">
                            RM
                        </span>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1000"
                            inputMode="decimal"
                            className={INPUT_CLS + (eastError ? ' border-destructive' : '')}
                            placeholder="15.00"
                            value={eastRateRm}
                            onChange={e => onEastChange(e.target.value)}
                        />
                    </div>
                    {eastError && <p className="mt-1 text-xs text-destructive">{eastError}</p>}
                    <div className="flex flex-wrap gap-1.5">
                        {EAST_STATES_DISPLAY.map(s => (
                            <span key={s} className={CHIP_CLS}>{s}</span>
                        ))}
                    </div>
                </div>
            </div>

            <LivePreviewPanel
                westRateRm={westRateRm}
                eastRateRm={eastRateRm}
                freeEnabled={freeEnabled}
                freeAboveRm={freeAboveRm}
            />
        </div>
    )
}
