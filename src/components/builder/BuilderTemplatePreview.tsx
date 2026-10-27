'use client'

import type { CSSProperties, ReactNode } from 'react'
import { Image as ImageIcon, Sparkles, type LucideIcon } from 'lucide-react'
import { BuilderMiniBrowser } from '@/components/builder/BuilderMiniBrowser'
import { useI18n } from '@/i18n'

export type BuilderTemplateField = 'businessName' | 'industry' | 'products' | 'shortDescription'

interface BuilderTemplatePreviewProps {
    businessName: string
    shortDescription: string
    products: string
    industryLabel: string
    industryIcon: LucideIcon
    /** The hero shows a hovered (not yet chosen) industry. */
    industryHovered?: boolean
    focus: BuilderTemplateField | null
    /** Fields that failed the last submit and are still missing. */
    missing: Partial<Record<BuilderTemplateField, boolean>>
    urlHost?: string | null
}

const T = 'border-color .2s, background-color .2s, box-shadow .2s, color .2s'
const BOX = 'relative box-border rounded-md border border-dashed border-[rgba(148,163,184,.22)] bg-[rgba(148,163,184,.025)]'
const CLAMP: CSSProperties = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: '100%', boxSizing: 'border-box', overflowWrap: 'anywhere' }

export function splitProducts(products: string): string[] {
    return products.split(/[,\n;]+/).map((item) => item.trim()).filter(Boolean)
}

function slotStyle(on: boolean, error: boolean, extra?: CSSProperties): CSSProperties {
    return {
        display: 'inline-flex', alignItems: 'center', maxWidth: '100%', boxSizing: 'border-box', height: 18, padding: '0 7px', borderRadius: 5,
        borderWidth: 1, borderStyle: on ? 'solid' : 'dashed',
        borderColor: error ? 'rgba(248,113,113,.75)' : on ? '#38bdf8' : 'rgba(56,189,248,.5)',
        backgroundColor: error ? 'rgba(239,68,68,.1)' : on ? 'rgba(56,189,248,.16)' : 'rgba(56,189,248,.06)',
        boxShadow: on ? '0 0 0 3px rgba(56,189,248,.12), 0 0 16px rgba(56,189,248,.3)' : '0 0 0 0 rgba(56,189,248,0)',
        color: error ? '#fca5a5' : on ? '#f0f9ff' : '#7dd3fc',
        fontSize: 10, lineHeight: '14px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: T,
        ...extra,
    }
}

function liveStyle(on: boolean): CSSProperties {
    return {
        borderRadius: 4,
        backgroundColor: on ? 'rgba(56,189,248,.12)' : 'rgba(56,189,248,0)',
        boxShadow: on ? '0 0 0 1px rgba(56,189,248,.65)' : '0 0 0 1px rgba(56,189,248,0)',
        transition: 'background-color .2s, box-shadow .2s',
    }
}

function Caret({ on }: { on: boolean }) {
    if (!on) return null
    return <span aria-hidden className="bld-caret ml-0.5 inline-block h-[0.95em] w-[1.5px] bg-[#38bdf8] align-[-0.1em]" />
}

function Bar({ w, h = 3, o = 0.25, r = 99 }: { w: number | string; h?: number; o?: number; r?: number }) {
    return <span className="block flex-none" style={{ width: w, height: h, borderRadius: r, backgroundColor: `rgba(148,163,184,${o})` }} />
}

function AiChip({ label }: { label: string }) {
    return (
        <span className="absolute right-2 top-0 z-[1] box-border flex h-3.5 -translate-y-1/2 items-center gap-[3px] rounded-full border border-solid border-[rgba(45,212,191,.4)] bg-[#0b1222] px-[5px] text-[8.5px] font-semibold leading-none tracking-[.04em] text-[#5eead4]">
            <Sparkles aria-hidden className="size-2" strokeWidth={2.5} />
            {label}
        </span>
    )
}

/** Live wireframe of the site template; dashed slots fill in as the form is typed. */
export function BuilderTemplatePreview(props: BuilderTemplatePreviewProps) {
    const { t } = useI18n()
    const f = t.onboarding.form
    const { focus, missing, industryIcon: IndustryIcon, industryHovered } = props
    const name = props.businessName.trim()
    const desc = props.shortDescription.trim()
    const chips = splitProducts(props.products)
    const on = (k: BuilderTemplateField) => focus === k
    const err = (k: BuilderTemplateField) => !!missing[k]

    let productSlot: ReactNode = null
    if (!chips.length) {
        productSlot = (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span style={slotStyle(on('products'), err('products'), { backgroundColor: err('products') ? '#2a1418' : on('products') ? '#0f2a40' : '#0e1a2c' })}>{f.products}</span>
            </div>
        )
    }

    return (
        <BuilderMiniBrowser className="mt-5" urlActive={on('businessName')} urlHost={props.urlHost}>
            <div aria-hidden className="flex flex-col gap-2 p-3" data-testid="builder-template-preview">
                <div className={`${BOX} flex h-[30px] items-center justify-between gap-2.5 px-2`}>
                    <div className="flex min-w-0 items-center gap-1.5">
                        <span className="size-2.5 flex-none rounded-[3px] bg-[rgba(148,163,184,.35)]" />
                        {name ? (
                            <span className="max-w-[150px] truncate px-0.5 text-[10px] font-bold leading-[14px] text-[#f1f5f9]" style={liveStyle(on('businessName'))}>{name}</span>
                        ) : (
                            <span data-slot="businessName" style={slotStyle(on('businessName'), err('businessName'))}>{f.businessName}</span>
                        )}
                    </div>
                    <div className="flex flex-none items-center gap-[7px]">
                        <Bar w={16} /><Bar w={16} /><Bar w={16} /><Bar h={10} o={0.3} r={3} w={26} />
                    </div>
                </div>

                <div className={`${BOX} grid min-h-[116px] grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-3 p-3`}>
                    <div className="flex min-w-0 flex-col items-start justify-center gap-2">
                        {name ? (
                            <div className="-mx-[3px] px-[3px] text-base font-bold leading-5 text-[#f8fafc]" data-testid="builder-template-headline" style={{ ...CLAMP, ...liveStyle(on('businessName')) }}>
                                {name}<Caret on={on('businessName')} />
                            </div>
                        ) : (
                            <span style={slotStyle(on('businessName'), err('businessName'), { height: 26, padding: '0 10px', borderRadius: 6, fontSize: 11.5, lineHeight: '16px' })}>{f.businessName}</span>
                        )}
                        {desc ? (
                            <div className="-mx-[3px] px-[3px] py-px text-[10px] leading-[14px] text-[#cbd5e1]" data-testid="builder-template-description" style={{ ...CLAMP, ...liveStyle(on('shortDescription')) }}>
                                {desc}<Caret on={on('shortDescription')} />
                            </div>
                        ) : (
                            <span data-slot="shortDescription" style={slotStyle(on('shortDescription'), err('shortDescription'), { display: 'flex', alignItems: 'flex-start', width: '100%', height: 34, padding: '5px 8px' })}>{f.shortDescription}</span>
                        )}
                        <div className="mt-0.5 flex gap-1.5">
                            <Bar h={12} o={0.3} r={3} w={38} />
                            <span className="box-border block h-3 w-8 rounded-[3px] border border-solid border-[rgba(148,163,184,.3)]" />
                        </div>
                    </div>
                    <div
                        className="relative box-border flex min-w-0 flex-col items-center justify-center gap-[7px] rounded-md border border-solid p-2"
                        style={{
                            borderStyle: industryHovered ? 'solid' : 'dashed',
                            borderColor: industryHovered ? '#38bdf8' : 'rgba(56,189,248,.5)',
                            backgroundColor: industryHovered ? 'rgba(56,189,248,.12)' : 'rgba(56,189,248,.05)',
                            boxShadow: industryHovered ? '0 0 0 3px rgba(56,189,248,.1), 0 0 18px rgba(56,189,248,.25)' : '0 0 0 0 rgba(56,189,248,0)',
                            transition: T,
                        }}
                    >
                        <span className="box-border flex size-9 items-center justify-center rounded-[10px] border border-solid border-[rgba(56,189,248,.35)] bg-[rgba(56,189,248,.12)] text-[#7dd3fc]">
                            <IndustryIcon className="size-[18px]" />
                        </span>
                        <span className="max-w-full text-center text-[10px] font-medium leading-[13px] text-[#e0f2fe] [text-wrap:balance]">{props.industryLabel}</span>
                    </div>
                </div>

                <div className={`${BOX} grid grid-cols-3 gap-[7px] p-[7px]`}>
                    <AiChip label={f.templateAiChip} />
                    {[0, 1, 2].map((i) => (
                        <div className="box-border flex h-[26px] min-w-0 items-center gap-1.5 rounded-[5px] bg-[rgba(148,163,184,.06)] px-[7px]" key={i}>
                            <span className="block size-2.5 flex-none rounded-full bg-[rgba(148,163,184,.25)]" />
                            <div className="grid min-w-0 flex-1 gap-[3px]"><Bar o={0.3} w="85%" /><Bar o={0.2} w="60%" /></div>
                        </div>
                    ))}
                </div>

                <div className={`${BOX} grid grid-cols-4 gap-[7px] px-[7px] pb-[7px] pt-2`}>
                    {[0, 1, 2, 3].map((i) => (
                        <div className="flex min-w-0 flex-col gap-[5px]" key={i}>
                            <div className="flex h-[30px] items-center justify-center rounded bg-[rgba(148,163,184,.08)] text-[#475569]">
                                <ImageIcon className="size-[11px]" />
                            </div>
                            {chips[i] ? (
                                <span className="-mx-0.5 block truncate px-0.5 text-[9.5px] font-medium leading-3 text-[#f1f5f9]" data-testid="builder-template-product" style={liveStyle(on('products'))}>{chips[i]}</span>
                            ) : (
                                <span className="my-1 block h-1 w-[70%] rounded-full bg-[rgba(148,163,184,.25)]" />
                            )}
                            <span className="block h-1 w-[32%] rounded-full bg-[rgba(148,163,184,.2)]" />
                        </div>
                    ))}
                    {productSlot}
                </div>

                <div className={`${BOX} flex h-6 items-center justify-center gap-2`}>
                    <AiChip label={f.templateAiChip} />
                    <div className="flex">
                        {[0.4, 0.3, 0.22].map((o, i) => (
                            <span className="box-border block size-[9px] rounded-full border border-solid border-[#0b1222]" key={o} style={{ backgroundColor: `rgba(148,163,184,${o})`, marginLeft: i ? -3 : 0 }} />
                        ))}
                    </div>
                    <Bar h={4} w="30%" />
                </div>

                <div className={`${BOX} flex h-5 items-center justify-between px-2`}>
                    <Bar w={28} />
                    <div className="flex gap-[5px]"><Bar w={12} /><Bar w={12} /><Bar w={12} /></div>
                </div>
            </div>
        </BuilderMiniBrowser>
    )
}
