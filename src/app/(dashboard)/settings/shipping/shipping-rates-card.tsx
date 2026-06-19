"use client"

import { useState } from 'react'
import { Truck, AlertCircle } from 'lucide-react'
import { useI18n } from '@/i18n'
import { WEST_MY_STATES } from '@/lib/shipping'
import { INPUT_FILTER } from '@/lib/shipping/validate-rate'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
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
    onWestBlur: (raw?: string) => void
    onEastBlur: (raw?: string) => void
    westWarning?: string
    eastWarning?: string
    helperText: string
}

// Geometry only — colors/border/focus inherited from shared <Input> primitive
const INPUT_CLS = 'min-h-[44px] rounded-[10px] pl-10 pr-3 text-[15px]'

const CHIP_CLS =
    'rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[11px] text-[var(--dash-text-muted)]'


export function ShippingRatesCard({
    westRateRm,
    eastRateRm,
    freeEnabled,
    freeAboveRm,
    onWestChange,
    onEastChange,
    westError,
    eastError,
    onWestBlur,
    onEastBlur,
    westWarning,
    eastWarning,
    helperText,
}: Props) {
    const { t } = useI18n()
    const s = t.dashboard.settings.shipping
    const [westExpanded, setWestExpanded] = useState(false)
    const westStates = westExpanded ? WEST_MY_STATES : WEST_STATES_PREVIEW
    return (
        <div className="flex flex-col p-6 rounded-[16px] border border-white/[0.08] bg-[hsl(var(--secondary)/0.6)] gap-5">
            {/* Card header */}
            <div className="flex items-start gap-4">
                <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[12px] bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.2)] shrink-0">
                    <Truck className="h-5 w-5 text-[hsl(var(--primary))]" />
                </div>
                <div>
                    <h3 className="text-[18px] font-semibold text-[var(--dash-text)]">{s.title}</h3>
                    <p className="mt-1 text-[13px] text-[var(--dash-text-muted)]">{s.subtitle}</p>
                </div>
            </div>

            {/* West / East rate rows */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* West Malaysia */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-[14px] font-medium text-[var(--dash-text)]">{s.westMalaysia}</span>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span tabIndex={0} className="cursor-default rounded-full bg-[hsl(var(--info)/0.15)] border border-[hsl(var(--info)/0.3)] px-2.5 py-0.5 text-[11px] font-semibold text-[hsl(var(--info))] tracking-wide">
                                    {s.westBadge}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent className="dash-shell" style={{ backgroundColor: 'var(--dash-secondary-bg)' }}>{s.westBadgeTooltip}</TooltipContent>
                        </Tooltip>
                    </div>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[var(--dash-text-muted)] select-none pointer-events-none">
                            RM
                        </span>
                        <Input
                            id="ship-rate-west"
                            type="text"
                            inputMode="decimal"
                            aria-label={s.westMalaysia}
                            aria-invalid={westError ? true : undefined}
                            aria-describedby={westError ? 'ship-rate-west-err' : undefined}
                            className={cn(INPUT_CLS, westError && 'border-[hsl(var(--destructive))]')}
                            placeholder="8.00"
                            value={westRateRm}
                            onChange={e => {
                                const v = e.target.value
                                if (v === '' || INPUT_FILTER.test(v)) onWestChange(v)
                            }}
                            onBlur={() => onWestBlur()}
                            onPaste={e => {
                                e.preventDefault()
                                const raw = e.clipboardData.getData('text').trim()
                                // Strip "RM " prefix from Excel/Sheets copy-paste (AC-11)
                                const stripped = raw.replace(/^RM\s*/i, '')
                                const filtered = INPUT_FILTER.test(stripped) ? stripped : ''
                                onWestChange(filtered)
                                onWestBlur(filtered)
                            }}
                        />
                    </div>
                    {westError && <p id="ship-rate-west-err" role="alert" className="mt-1 flex items-center gap-1.5 text-sm font-medium text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{westError}</p>}
                    {westWarning && !westError && <p role="status" className="mt-1 text-xs text-[var(--dash-text-muted)]">{westWarning}</p>}
                    {!westError && !westWarning && <p className="mt-1 text-xs text-[var(--dash-text-muted)]">{helperText}</p>}
                    <div className="flex flex-wrap gap-1.5">
                        {westStates.map(state => (
                            <span key={state} className={CHIP_CLS}>{state}</span>
                        ))}
                        {!westExpanded && (
                            <button
                                type="button"
                                onClick={() => setWestExpanded(true)}
                                className={CHIP_CLS + ' cursor-pointer text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] hover:border-white/20 transition-colors'}
                            >
                                {s.moreStates.replace('{count}', String(WEST_STATES_HIDDEN))}
                            </button>
                        )}
                        {westExpanded && (
                            <button
                                type="button"
                                onClick={() => setWestExpanded(false)}
                                className={CHIP_CLS + ' cursor-pointer text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] hover:border-white/20 transition-colors'}
                            >
                                {s.showLess}
                            </button>
                        )}
                    </div>
                </div>

                {/* East Malaysia */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-[14px] font-medium text-[var(--dash-text)]">{s.eastMalaysia}</span>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span tabIndex={0} className="cursor-default rounded-full bg-[hsl(var(--primary)/0.15)] border border-[hsl(var(--primary)/0.3)] px-2.5 py-0.5 text-[11px] font-semibold text-[hsl(var(--primary))] tracking-wide">
                                    {s.eastBadge}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent className="dash-shell" style={{ backgroundColor: 'var(--dash-secondary-bg)' }}>{s.eastBadgeTooltip}</TooltipContent>
                        </Tooltip>
                    </div>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[var(--dash-text-muted)] select-none pointer-events-none">
                            RM
                        </span>
                        <Input
                            id="ship-rate-east"
                            type="text"
                            inputMode="decimal"
                            aria-label={s.eastMalaysia}
                            aria-invalid={eastError ? true : undefined}
                            aria-describedby={eastError ? 'ship-rate-east-err' : undefined}
                            className={cn(INPUT_CLS, eastError && 'border-[hsl(var(--destructive))]')}
                            placeholder="15.00"
                            value={eastRateRm}
                            onChange={e => {
                                const v = e.target.value
                                if (v === '' || INPUT_FILTER.test(v)) onEastChange(v)
                            }}
                            onBlur={() => onEastBlur()}
                            onPaste={e => {
                                e.preventDefault()
                                const raw = e.clipboardData.getData('text').trim()
                                // Strip "RM " prefix from Excel/Sheets copy-paste (AC-11)
                                const stripped = raw.replace(/^RM\s*/i, '')
                                const filtered = INPUT_FILTER.test(stripped) ? stripped : ''
                                onEastChange(filtered)
                                onEastBlur(filtered)
                            }}
                        />
                    </div>
                    {eastError && <p id="ship-rate-east-err" role="alert" className="mt-1 flex items-center gap-1.5 text-sm font-medium text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{eastError}</p>}
                    {eastWarning && !eastError && <p role="status" className="mt-1 text-xs text-[var(--dash-text-muted)]">{eastWarning}</p>}
                    {!eastError && !eastWarning && <p className="mt-1 text-xs text-[var(--dash-text-muted)]">{helperText}</p>}
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
