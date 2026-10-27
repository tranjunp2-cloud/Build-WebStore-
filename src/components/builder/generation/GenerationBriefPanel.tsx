'use client'

import { Check, Loader2 } from 'lucide-react'
import type { ThemeConfig } from '@/blocks/types'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { getPaletteColors, isSerifFont, type BriefRow } from './generation-utils'

const SHIMMER = 'bg-[rgba(148,163,184,0.12)] bg-[linear-gradient(90deg,rgba(148,163,184,0)_0%,rgba(148,163,184,0.3)_50%,rgba(148,163,184,0)_100%)] bg-[length:200%_100%] motion-safe:animate-pw-shimmer motion-reduce:bg-[rgba(148,163,184,0.18)]'
const LABEL = 'm-0 text-[10px] font-semibold uppercase leading-[14px] tracking-[0.08em] text-[#64748b]'

function Chips({ value }: { value: string }) {
    const chips = value.split(/[,\n;]+/).map((c) => c.trim()).filter(Boolean).slice(0, 3)
    return (
        <span className="flex min-w-0 gap-1 overflow-hidden">
            {chips.map((c) => (
                <span className="max-w-full shrink-0 truncate rounded-[5px] border border-[rgba(56,189,248,0.22)] bg-[rgba(56,189,248,0.1)] px-1.5 text-[10.5px] leading-[15px] text-[#bae6fd]" key={c}>{c}</span>
            ))}
        </span>
    )
}

interface InsightProps {
    label: string
    index: number
    ready: boolean
    skeletonWidth: string
    testId: string
    children: React.ReactNode
}

function Insight({ label, index, ready, skeletonWidth, testId, children }: InsightProps) {
    const delay = (extra: number) => ({ transitionDelay: `${index * 0.15 + extra}s` })
    return (
        <div
            className={cn(
                'grid gap-[5px] rounded-lg border px-2.5 py-2 transition-[border-color,background-color] duration-[400ms]',
                ready ? 'border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.06)]' : 'border-[rgba(148,163,184,0.09)] bg-[rgba(30,41,59,0.5)]',
            )}
            data-ready={ready}
            data-testid={testId}
            style={delay(0)}
        >
            <span className="text-[10px] leading-[13px] text-[#64748b]">{label}</span>
            <div className="relative h-5">
                <span
                    aria-hidden
                    className={cn('absolute left-0 top-1.5 h-2 rounded transition-opacity duration-300', SHIMMER, ready ? 'opacity-0' : 'opacity-100')}
                    style={{ width: skeletonWidth, ...delay(0) }}
                />
                <div
                    className={cn('absolute inset-0 flex items-center gap-[5px] transition-[opacity,transform] duration-[400ms]', ready ? 'opacity-100' : 'translate-y-1 opacity-0')}
                    style={delay(0.1)}
                >
                    {children}
                </div>
            </div>
        </div>
    )
}

interface GenerationBriefPanelProps {
    rows: BriefRow[]
    readCount: number
    theme: ThemeConfig | null
    /** Scan line sweeps while the brief is still being read. */
    scanning: boolean
}

export function GenerationBriefPanel({ rows, readCount, theme, scanning }: GenerationBriefPanelProps) {
    const { t } = useI18n()
    const g = t.onboarding.generating
    const palette = getPaletteColors(theme)
    const ready = !!theme

    return (
        <div className="flex h-full items-center justify-center p-3.5">
            <div className="grid w-full max-w-[620px] grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <div className="relative flex min-w-0 flex-col gap-1.5">
                    <p className={LABEL}>{g.stageBrief}</p>
                    {rows.map((row, i) => {
                        const reading = i === readCount
                        const read = i < readCount
                        return (
                            <div
                                className={cn(
                                    'flex min-w-0 items-center gap-2 rounded-lg border py-1.5 pl-2.5 pr-2 transition-[opacity,border-color,background-color,box-shadow] duration-[350ms]',
                                    reading ? 'border-[rgba(56,189,248,0.5)] bg-[rgba(56,189,248,0.08)] shadow-[0_0_16px_rgba(56,189,248,0.14)]' : 'border-[rgba(148,163,184,0.09)] bg-[rgba(30,41,59,0.5)]',
                                    reading || read ? 'opacity-100' : 'opacity-[0.35]',
                                )}
                                data-state={read ? 'read' : reading ? 'reading' : 'queued'}
                                key={row.key}
                            >
                                <div className="grid min-w-0 flex-1 gap-0.5">
                                    <span className="text-[10px] leading-[13px] text-[#64748b]">{row.label}</span>
                                    {row.key === 'products'
                                        ? <Chips value={row.value} />
                                        : <span className="truncate text-xs leading-4 text-[#f1f5f9]">{row.value}</span>}
                                </div>
                                <span
                                    className={cn(
                                        'flex size-[18px] shrink-0 items-center justify-center rounded-full transition-[background-color,color,box-shadow,opacity] duration-300',
                                        read ? 'bg-[#2dd4bf] text-[#0b1222] shadow-[0_0_10px_rgba(45,212,191,0.45)]' : 'bg-[rgba(45,212,191,0)] text-[#38bdf8]',
                                        reading || read ? 'opacity-100' : 'opacity-0',
                                    )}
                                >
                                    {reading && <Loader2 className="size-3 motion-safe:animate-spin" strokeWidth={2.5} />}
                                    {read && <Check className="size-[11px]" strokeWidth={3} />}
                                </span>
                            </div>
                        )
                    })}
                    {scanning && (
                        <span
                            aria-hidden
                            data-testid="scan-line"
                            className="pointer-events-none absolute -inset-x-1 top-[21px] z-[2] h-0.5 rounded-sm bg-[linear-gradient(90deg,rgba(56,189,248,0),#38bdf8_30%,#5eead4_70%,rgba(45,212,191,0))] opacity-85 shadow-[0_0_12px_1px_rgba(56,189,248,0.55)] motion-safe:animate-pw-scan motion-reduce:hidden"
                        />
                    )}
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                    <p className={LABEL}>{g.stageInsights}</p>
                    <Insight index={0} label={g.insightStyle} ready={ready} skeletonWidth="62%" testId="insight-style">
                        {theme && (
                            <span className="rounded-md border border-[rgba(45,212,191,0.35)] bg-[rgba(45,212,191,0.12)] px-2 py-0.5 text-[11px] font-semibold leading-4 text-[#5eead4]">
                                {isSerifFont(theme.fontHeading) ? g.styleClassic : g.styleModern}
                            </span>
                        )}
                    </Insight>
                    <Insight index={1} label={g.insightPalette} ready={ready} skeletonWidth="80%" testId="insight-palette">
                        {palette.map((c, i) => (
                            <span
                                className={cn('box-border size-4 shrink-0 rounded-[5px] border border-white/[0.14] transition-transform duration-[350ms] ease-[cubic-bezier(.2,.9,.3,1.4)]', ready ? 'scale-100' : 'scale-[0.6]')}
                                key={c}
                                style={{ backgroundColor: c, transitionDelay: `${0.25 + i * 0.06}s` }}
                                title={c}
                            />
                        ))}
                    </Insight>
                    <Insight index={2} label={g.insightTypography} ready={ready} skeletonWidth="55%" testId="insight-typography">
                        {theme && (
                            <>
                                <span className="text-[17px] font-bold leading-5 text-[#f1f5f9]" style={{ fontFamily: `'${theme.fontHeading}', Georgia, serif` }}>Aa</span>
                                <span className="truncate text-[11px] leading-4 text-[#cbd5e1]">{theme.fontHeading} + {theme.fontBody}</span>
                            </>
                        )}
                    </Insight>
                </div>
            </div>
        </div>
    )
}
