'use client'

import type { CSSProperties, ReactNode } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { splitProducts } from '@/components/builder/BuilderTemplatePreview'
import { fontStack, type StagePalette } from '@/components/builder/builder-stage-palette'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

export interface GenerationBrief {
    businessName: string
    industryLabel: string
    products: string
    shortDescription: string
}

interface BuilderGenerationBriefProps {
    brief: GenerationBrief
    visible: boolean
    briefRead: number
    /** Real theme picks once `theme_set` arrived; neutral placeholders until then. */
    palette: StagePalette | null
    width: number
    height: number
    scale: number
}

const HEADING = 'text-[10px] font-semibold uppercase leading-[14px] tracking-[.08em] text-[#64748b]'

function InsightBox({ label, ready, skeletonWidth, delay, children }: { label: string; ready: boolean; skeletonWidth: string; delay: number; children: ReactNode }) {
    return (
        <div
            className="box-border grid gap-[5px] rounded-lg border border-solid px-2.5 py-2"
            style={{
                borderColor: ready ? 'rgba(45,212,191,.3)' : 'rgba(148,163,184,.09)',
                backgroundColor: ready ? 'rgba(45,212,191,.06)' : 'rgba(30,41,59,.5)',
                transition: `border-color .4s ${delay}s, background-color .4s ${delay}s`,
            }}
        >
            <span className="text-[10px] leading-[13px] text-[#64748b]">{label}</span>
            <div className="relative h-5">
                <span className="bld-shimmer absolute left-0 top-1.5 h-2 rounded" style={{ width: skeletonWidth, opacity: ready ? 0 : 1, transition: `opacity .3s ${delay}s` }} />
                <div
                    className="absolute inset-0 flex min-w-0 items-center gap-[5px]"
                    style={{ opacity: ready ? 1 : 0, transform: ready ? 'none' : 'translateY(4px)', transition: `opacity .4s ${delay + 0.1}s, transform .4s ${delay + 0.1}s` }}
                >
                    {ready ? children : null}
                </div>
            </div>
        </div>
    )
}

/** Stage 1 of the generating panel: the business brief being read + the AI's theme picks. */
export function BuilderGenerationBrief({ brief, visible, briefRead, palette, width, height, scale }: BuilderGenerationBriefProps) {
    const { t } = useI18n()
    const g = t.onboarding.generating
    const f = t.onboarding.form
    const chips = splitProducts(brief.products).slice(0, 3)
    const rows: Array<{ label: string; value: string | null }> = [
        { label: f.businessName, value: brief.businessName.trim() },
        { label: f.industry, value: brief.industryLabel },
        { label: f.products, value: null },
        { label: f.shortDescription, value: brief.shortDescription.trim() },
    ]
    const layer: CSSProperties = { opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(-8px) scale(.98)', transition: 'opacity .45s, transform .45s' }

    return (
        <div aria-hidden={!visible} className="pointer-events-none absolute inset-0 overflow-hidden" data-testid="builder-generation-brief" style={layer}>
            <div
                className="absolute left-0 top-0 box-border flex items-center justify-center p-3.5"
                style={{ width: width / scale, height: height / scale, transform: `scale(${scale})`, transformOrigin: '0 0' }}
            >
                <div className="grid w-full max-w-[620px] grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-start gap-3">
                    <div className="relative flex min-w-0 flex-col gap-1.5">
                        <p className={HEADING}>{g.stageBrief}</p>
                        {rows.map((row, index) => {
                            const reading = visible && briefRead === index
                            const read = briefRead > index
                            return (
                                <div
                                    className="box-border flex min-w-0 items-center gap-2 rounded-lg border border-solid py-1.5 pl-2.5 pr-2"
                                    data-state={read ? 'read' : reading ? 'reading' : 'waiting'}
                                    key={row.label}
                                    style={{
                                        borderColor: reading ? 'rgba(56,189,248,.5)' : 'rgba(148,163,184,.09)',
                                        backgroundColor: reading ? 'rgba(56,189,248,.08)' : 'rgba(30,41,59,.5)',
                                        boxShadow: reading ? '0 0 16px rgba(56,189,248,.14)' : 'none',
                                        opacity: reading || read ? 1 : 0.35,
                                        transition: 'opacity .35s, border-color .35s, background-color .35s, box-shadow .35s',
                                    }}
                                >
                                    <div className="grid min-w-0 flex-1 gap-0.5">
                                        <span className="text-[10px] leading-[13px] text-[#64748b]">{row.label}</span>
                                        {row.value !== null ? (
                                            <span className="truncate text-xs leading-4 text-[#f1f5f9]">{row.value}</span>
                                        ) : (
                                            <span className="flex min-w-0 gap-1 overflow-hidden">
                                                {(chips.length ? chips : [brief.products.trim()]).map((chip) => (
                                                    <span className="box-border max-w-full flex-none truncate rounded-[5px] border border-solid border-[rgba(56,189,248,.22)] bg-[rgba(56,189,248,.1)] px-1.5 text-[10.5px] leading-[15px] text-[#bae6fd]" key={chip}>{chip}</span>
                                                ))}
                                            </span>
                                        )}
                                    </div>
                                    <span
                                        className={cn('flex size-[18px] flex-none items-center justify-center rounded-full transition-[background-color,color,box-shadow,opacity] duration-300', read ? 'bg-[#2dd4bf] text-[#0b1222] shadow-[0_0_10px_rgba(45,212,191,.45)]' : 'text-[#38bdf8]')}
                                        style={{ opacity: reading || read ? 1 : 0 }}
                                    >
                                        {read ? <Check className="size-[11px]" strokeWidth={3} /> : reading ? <Loader2 className="size-3 animate-spin" strokeWidth={2.5} /> : null}
                                    </span>
                                </div>
                            )
                        })}
                        {visible && briefRead < rows.length ? (
                            <span className="bld-scan pointer-events-none absolute -left-1 -right-1 top-[21px] z-[2] h-0.5 rounded-sm opacity-85 shadow-[0_0_12px_1px_rgba(56,189,248,.55)] [background-image:linear-gradient(90deg,rgba(56,189,248,0),#38bdf8_30%,#5eead4_70%,rgba(45,212,191,0))]" />
                        ) : null}
                    </div>

                    <div className="flex min-w-0 flex-col gap-1.5">
                        <p className={HEADING}>{g.stageInsights}</p>
                        <InsightBox delay={0} label={g.insightStyle} ready={!!palette} skeletonWidth="62%">
                            <span className="box-border whitespace-nowrap rounded-[5px] border border-solid border-[rgba(45,212,191,.3)] bg-[rgba(45,212,191,.12)] px-[7px] text-[11px] font-medium leading-[18px] text-[#99f6e4]">
                                {palette?.dark ? g.insightDarkTheme : g.insightLightTheme}
                            </span>
                        </InsightBox>
                        <InsightBox delay={0.15} label={g.insightPalette} ready={!!palette} skeletonWidth="80%">
                            {palette?.swatches.map((color, i) => (
                                <span className="box-border size-4 flex-none rounded-[5px] border border-solid border-[rgba(255,255,255,.14)]" key={`${color}-${i}`} style={{ backgroundColor: color }} />
                            ))}
                        </InsightBox>
                        <InsightBox delay={0.3} label={g.insightTypography} ready={!!palette} skeletonWidth="55%">
                            {palette ? (
                                <>
                                    <span className="text-[17px] font-bold leading-5 text-[#f1f5f9]" style={{ fontFamily: fontStack(palette.headingFont, 'serif') }}>Aa</span>
                                    <span className="truncate text-[11px] leading-4 text-[#cbd5e1]">{palette.headingFont} + {palette.bodyFont}</span>
                                </>
                            ) : null}
                        </InsightBox>
                    </div>
                </div>
            </div>
        </div>
    )
}
