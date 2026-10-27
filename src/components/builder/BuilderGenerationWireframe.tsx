'use client'

import type { CSSProperties, ReactNode } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import type { GenerationStage } from '@/components/builder/builder-generation-stage'
import { fade, fontStack, type StagePalette } from '@/components/builder/builder-stage-palette'
import { useI18n } from '@/i18n'

interface BuilderGenerationWireframeProps {
    stage: GenerationStage
    visible: boolean
    /** Leaving towards the real preview (slight zoom-out instead of slide). */
    leaving: boolean
    businessName: string
    palette: StagePalette | null
    width: number
    height: number
    scale: number
}

const SKELETON = 'rgba(148,163,184,.2)'
const SECTION_FLEX = [16, 84, 40, 44, 20, 14]
type Tone = 'h' | 'b' | 'p' | 'f'

/** Stage 2 of the generating panel: sections laid out Navigation → Footer, then painted with the real theme. */
export function BuilderGenerationWireframe({ stage, visible, leaving, businessName, palette, width, height, scale }: BuilderGenerationWireframeProps) {
    const { t } = useI18n()
    const g = t.onboarding.generating
    const labels = [g.sectionNavigation, g.sectionHero, g.sectionFeatures, g.sectionPricing, g.sectionTestimonials, g.sectionFooter]
    const { content, sectionsShown, currentSection } = stage
    const paint = stage.painted && palette ? palette : null
    const name = businessName.trim() || t.onboarding.completion.yourWebsite
    const heading = paint ? fontStack(paint.headingFont, 'serif') : 'inherit'
    const delay = (i: number) => (paint ? i * 0.1 : 0)
    const sectionBg = paint ? ['transparent', paint.surface, 'transparent', 'transparent', paint.surface, paint.footer] : []
    const tone: Record<Tone, [string, string]> = {
        h: ['rgba(241,245,249,.8)', paint?.text ?? ''],
        b: ['rgba(148,163,184,.45)', paint ? fade(paint.muted, 45) : ''],
        p: ['rgba(56,189,248,.6)', paint?.primary ?? ''],
        f: ['rgba(148,163,184,.45)', paint ? fade(paint.background, 45) : ''],
    }
    const bar = (w: number | string, h: number, k: Tone, i: number, r = 99): CSSProperties => ({
        display: 'block', flex: 'none', width: w, height: h, borderRadius: r,
        backgroundColor: paint ? tone[k][1] : content ? tone[k][0] : SKELETON,
        transition: `background-color .5s ${delay(i)}s`,
    })
    const fill = (gradient: string, i: number, extra = 0): CSSProperties => ({
        position: 'absolute', inset: 0, backgroundImage: gradient, opacity: paint ? 1 : 0, transition: `opacity .6s ${delay(i) + extra}s`,
    })

    const section = (i: number, children: ReactNode) => {
        const shown = sectionsShown > i
        const current = currentSection === i
        return (
            <div
                className="relative box-border rounded-md border"
                key={i}
                style={{
                    flex: `${SECTION_FLEX[i]} 1 0px`, minHeight: SECTION_FLEX[i],
                    borderStyle: paint ? 'solid' : 'dashed',
                    borderColor: paint ? 'rgba(56,189,248,0)' : current ? 'rgba(56,189,248,.9)' : 'rgba(56,189,248,.3)',
                    backgroundColor: paint ? sectionBg[i] : current ? 'rgba(56,189,248,.08)' : 'rgba(56,189,248,.02)',
                    boxShadow: current ? '0 0 16px rgba(56,189,248,.22)' : '0 0 0 rgba(56,189,248,0)',
                    opacity: shown ? 1 : 0,
                    transform: shown ? 'none' : 'translateY(8px) scale(.98)',
                    transition: `opacity .4s, transform .4s, border-color .3s, box-shadow .3s, background-color .5s ${delay(i)}s`,
                }}
            >
                {children}
                <span
                    className="absolute right-2 top-0 z-[2] -translate-y-1/2 whitespace-nowrap rounded border border-solid border-[rgba(56,189,248,.5)] bg-[#0b1222] px-[5px] text-[8.5px] font-semibold leading-[11px] text-[#7dd3fc] transition-opacity duration-300"
                    style={{ opacity: shown && !paint ? 1 : 0 }}
                >
                    {labels[i]}
                </span>
            </div>
        )
    }

    const typeSteps = Math.max(name.length, 1)
    const typeMs = Math.round(Math.max(28, Math.min(70, 1100 / typeSteps)) * typeSteps)
    const headline = stage.typing && !paint ? (
        <span className="bld-type" style={{ '--bld-type-w': `calc(${typeSteps}ch + 2em)`, '--bld-type-steps': typeSteps, '--bld-type-ms': `${typeMs}ms` } as CSSProperties}>
            {name}
        </span>
    ) : name

    const products = paint ? [
        `linear-gradient(135deg,${paint.accent},${paint.secondary})`,
        `linear-gradient(135deg,${paint.secondary},${paint.primary})`,
        `linear-gradient(135deg,${fade(paint.accent, 60)},${paint.accent})`,
        `linear-gradient(135deg,${paint.primary},${paint.text})`,
    ] : ['', '', '', '']

    return (
        <div
            aria-hidden={!visible}
            className="pointer-events-none absolute inset-0 overflow-hidden"
            data-painted={paint ? 'true' : 'false'}
            data-testid="builder-generation-wireframe"
            style={{
                backgroundColor: paint ? paint.background : 'transparent',
                opacity: visible ? 1 : 0,
                transform: visible ? 'none' : leaving ? 'scale(1.015)' : 'translateY(10px)',
                transition: 'opacity .55s, transform .55s, background-color .6s',
            }}
        >
            <div
                className="absolute left-0 top-0 box-border flex flex-col gap-1.5 px-3 py-2.5"
                style={{ width: width / scale, height: height / scale, transform: `scale(${scale})`, transformOrigin: '0 0' }}
            >
                {section(0, (
                    <div className="absolute inset-0 flex items-center justify-between gap-2 px-[7px]">
                        <div className="flex min-w-0 items-center gap-[5px]">
                            <span style={bar(8, 8, 'p', 0, 2)} />
                            {content ? (
                                <span className="max-w-[96px] truncate text-[8px] font-bold leading-[10px]" style={{ color: paint ? paint.text : '#f1f5f9', fontFamily: heading, transition: 'color .5s' }}>{name}</span>
                            ) : <span style={bar(40, 4, 'h', 0)} />}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span style={bar(14, 3, 'b', 0)} /><span style={bar(14, 3, 'b', 0)} /><span style={bar(14, 3, 'b', 0)} /><span style={bar(22, 8, 'p', 0, 3)} />
                        </div>
                    </div>
                ))}
                {section(1, (
                    <div className="absolute inset-0 grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-2.5 px-[9px] py-2">
                        <div className="flex min-w-0 flex-col justify-center gap-[5px]">
                            {content ? (
                                <div
                                    className="min-h-[15px] font-bold leading-[15px] [overflow-wrap:anywhere]"
                                    data-testid="builder-generation-headline"
                                    style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: paint ? 13 : 12, color: paint ? paint.text : '#f8fafc', fontFamily: heading, transition: `color .5s ${delay(1)}s` }}
                                >
                                    {headline}
                                    {stage.typing && !paint ? <span aria-hidden className="bld-caret ml-px inline-block h-3 w-[1.5px] bg-[#38bdf8] align-[-2px]" /> : null}
                                </div>
                            ) : (
                                <><span style={bar('88%', 7, 'h', 1)} /><span style={bar('62%', 7, 'h', 1)} /></>
                            )}
                            <span style={bar('92%', 3, 'b', 1)} />
                            <span style={bar('70%', 3, 'b', 1)} />
                            <div className="mt-[3px] flex gap-[5px]">
                                <span style={bar(30, 10, 'p', 1, 3)} />
                                <span className="box-border block h-2.5 w-[26px] flex-none rounded-[3px] border border-solid" style={{ borderColor: paint ? paint.primary : content ? 'rgba(56,189,248,.6)' : SKELETON, transition: `border-color .5s ${delay(1)}s` }} />
                            </div>
                        </div>
                        <div className="relative flex min-w-0 items-center justify-center overflow-hidden rounded-md border border-solid bg-[rgba(148,163,184,.1)] text-[#64748b]" style={{ borderColor: paint ? 'rgba(148,163,184,0)' : 'rgba(148,163,184,.14)', transition: 'border-color .5s' }}>
                            <span style={fill(paint ? `linear-gradient(135deg,${fade(paint.accent, 60)} 0%,${paint.secondary} 55%,${paint.primary} 100%)` : '', 1, 0.1)} />
                            <span className="relative flex transition-opacity duration-300" style={{ opacity: paint ? 0 : 1 }}><ImageIcon className="size-3" /></span>
                        </div>
                    </div>
                ))}
                {section(2, (
                    <div className="absolute inset-0 grid grid-cols-3 gap-1.5 px-1.5 py-[5px]">
                        {[0, 1, 2].map((k) => (
                            <div className="flex min-w-0 items-center gap-[5px] rounded-[5px] px-1.5" key={k} style={{ backgroundColor: paint ? paint.surface : 'rgba(148,163,184,.06)', transition: `background-color .5s ${delay(2)}s` }}>
                                <span style={bar(10, 10, 'p', 2)} />
                                <div className="grid min-w-0 flex-1 gap-[3px]"><span style={bar('85%', 3, 'h', 2)} /><span style={bar('60%', 3, 'b', 2)} /></div>
                            </div>
                        ))}
                    </div>
                ))}
                {section(3, (
                    <div className="absolute inset-0 grid grid-cols-4 gap-1.5 px-1.5 py-[5px]">
                        {products.map((gradient, k) => (
                            <div className="flex min-w-0 flex-col gap-[3px]" key={k}>
                                <div className="relative min-h-5 flex-auto overflow-hidden rounded bg-[rgba(148,163,184,.1)]"><span style={fill(gradient, 3, k * 0.08)} /></div>
                                <span style={bar('75%', 3, 'h', 3)} />
                                <span style={bar('35%', 3, 'p', 3)} />
                            </div>
                        ))}
                    </div>
                ))}
                {section(4, (
                    <div className="absolute inset-0 flex items-center justify-center gap-2">
                        <div className="flex">
                            {(paint ? [paint.secondary, paint.accent, paint.primary] : ['', '', '']).map((color, k) => (
                                <span className="box-border block size-[9px] rounded-full border border-solid" key={k} style={{ marginLeft: k ? -3 : 0, borderColor: paint ? paint.surface : '#0b1222', backgroundColor: paint ? color : content ? 'rgba(148,163,184,.45)' : SKELETON, transition: `background-color .5s ${delay(4)}s` }} />
                            ))}
                        </div>
                        <span style={bar('30%', 4, 'b', 4)} />
                    </div>
                ))}
                {section(5, (
                    <div className="absolute inset-0 flex items-center justify-between px-2">
                        <span style={bar(28, 3, 'f', 5)} />
                        <div className="flex gap-[5px]"><span style={bar(12, 3, 'f', 5)} /><span style={bar(12, 3, 'f', 5)} /><span style={bar(12, 3, 'f', 5)} /></div>
                    </div>
                ))}
            </div>
            {stage.justPainted ? (
                <span className="bld-sweep pointer-events-none absolute inset-y-0 left-0 z-[3] w-2/5 [background-image:linear-gradient(100deg,rgba(255,255,255,0)_0%,rgba(255,255,255,.55)_50%,rgba(255,255,255,0)_100%)]" />
            ) : null}
        </div>
    )
}
