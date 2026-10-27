'use client'

import type { CSSProperties, ReactElement } from 'react'
import type { ThemeConfig } from '@/blocks/types'
import type { WireframeKind } from './generation-utils'

const SKELETON = 'rgba(148,163,184,.2)'
const FALLBACK = { primary: '#72573d', text: '#282925', muted: '#69675f', surface: '#ebe7de', bg: '#f7f5ef' }

export interface PaintCtx {
    painted: boolean
    /** Section content has been "written" (not the newest section) — bars leave skeleton grey. */
    content: boolean
    /** Seconds of transition delay once painted (index * 0.1). */
    delay: number
    theme: ThemeConfig | null
    reduced: boolean
}

export function paletteOf(theme: ThemeConfig | null) {
    return {
        primary: theme?.primaryColor ?? FALLBACK.primary,
        text: theme?.textColor ?? FALLBACK.text,
        muted: theme?.mutedColor ?? FALLBACK.muted,
        surface: theme?.surfaceColor ?? FALLBACK.surface,
        bg: theme?.backgroundColor ?? FALLBACK.bg,
    }
}

type BarKind = 'h' | 'b' | 'p' | 'f'

function barColor(kind: BarKind, ctx: PaintCtx): string {
    const c = paletteOf(ctx.theme)
    if (ctx.painted) return { h: c.text, b: c.muted, p: c.primary, f: c.bg }[kind]
    if (!ctx.content) return SKELETON
    return { h: 'rgba(241,245,249,.8)', b: 'rgba(148,163,184,.45)', p: 'rgba(56,189,248,.6)', f: 'rgba(148,163,184,.45)' }[kind]
}

export function transition(ctx: PaintCtx, props = 'background-color', dur = 0.5): CSSProperties {
    return ctx.reduced ? {} : { transition: `${props} ${dur}s ${ctx.painted ? ctx.delay : 0}s` }
}

export function Bar({ w, h, kind, ctx, r = 99 }: { w: number | string; h: number; kind: BarKind; ctx: PaintCtx; r?: number }) {
    return <span className="block shrink-0" style={{ width: w, height: h, borderRadius: r, backgroundColor: barColor(kind, ctx), ...transition(ctx) }} />
}

function ImageFill({ ctx, gradient, extra = 0 }: { ctx: PaintCtx; gradient: string; extra?: number }) {
    return (
        <span
            className="absolute inset-0"
            style={{ backgroundImage: gradient, opacity: ctx.painted ? 1 : 0, ...(ctx.reduced ? {} : { transition: `opacity .6s ${(ctx.painted ? ctx.delay : 0) + extra}s` }) }}
        />
    )
}

function themeGradient(theme: ThemeConfig | null, flip = false): string {
    const c = paletteOf(theme)
    return flip ? `linear-gradient(135deg,${c.primary},${c.surface})` : `linear-gradient(135deg,${c.surface},${c.primary})`
}

interface ShapeProps { ctx: PaintCtx; name: string; typed: string; typing: boolean }

function Nav({ ctx, name }: ShapeProps) {
    const c = paletteOf(ctx.theme)
    return (
        <div className="absolute inset-0 flex items-center justify-between gap-2 px-[7px]">
            <div className="flex min-w-0 items-center gap-[5px]">
                <Bar ctx={ctx} h={8} kind="p" r={2} w={8} />
                {ctx.content && name
                    ? <span className="max-w-24 truncate text-[8px] font-bold leading-[10px] transition-colors duration-500" style={{ color: ctx.painted ? c.text : '#f1f5f9', fontFamily: ctx.painted && ctx.theme ? `'${ctx.theme.fontHeading}', serif` : undefined }}>{name}</span>
                    : <Bar ctx={ctx} h={4} kind="h" w={40} />}
            </div>
            <div className="flex items-center gap-1.5"><Bar ctx={ctx} h={3} kind="b" w={14} /><Bar ctx={ctx} h={3} kind="b" w={14} /><Bar ctx={ctx} h={3} kind="b" w={14} /><Bar ctx={ctx} h={8} kind="p" r={3} w={22} /></div>
        </div>
    )
}

function Hero({ ctx, typed, typing }: ShapeProps) {
    const c = paletteOf(ctx.theme)
    return (
        <div className="absolute inset-0 grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-2.5 px-[9px] py-2">
            <div className="flex min-w-0 flex-col justify-center gap-[5px]">
                <div
                    className="min-h-[15px] overflow-hidden text-[12px] font-bold leading-[15px] [overflow-wrap:anywhere] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
                    data-testid="hero-headline"
                    style={{ color: ctx.painted ? c.text : '#f8fafc', fontFamily: ctx.painted && ctx.theme ? `'${ctx.theme.fontHeading}', serif` : undefined, ...transition(ctx, 'color') }}
                >
                    {typed}
                    {typing && <span aria-hidden className="ml-px inline-block h-3 w-[1.5px] align-[-2px] bg-[#38bdf8] motion-safe:animate-pw-caret" data-testid="caret" />}
                </div>
                <Bar ctx={ctx} h={3} kind="b" w="92%" />
                <Bar ctx={ctx} h={3} kind="b" w="70%" />
                <div className="mt-[3px] flex gap-[5px]">
                    <Bar ctx={ctx} h={10} kind="p" r={3} w={30} />
                    <span className="box-border block h-2.5 w-[26px] shrink-0 rounded-[3px] border" style={{ borderColor: ctx.painted ? c.primary : ctx.content ? 'rgba(56,189,248,.6)' : SKELETON, ...transition(ctx, 'border-color') }} />
                </div>
            </div>
            <div className="relative min-w-0 overflow-hidden rounded-md bg-[rgba(148,163,184,0.1)]">
                <ImageFill ctx={ctx} extra={0.1} gradient={themeGradient(ctx.theme)} />
            </div>
        </div>
    )
}

function Features({ ctx }: ShapeProps) {
    const c = paletteOf(ctx.theme)
    return (
        <div className="absolute inset-0 grid grid-cols-3 gap-1.5 px-1.5 py-[5px]">
            {[0, 1, 2].map((i) => (
                <div className="flex min-w-0 items-center gap-[5px] rounded-[5px] px-1.5" key={i} style={{ backgroundColor: ctx.painted ? c.surface : 'rgba(148,163,184,.06)', ...transition(ctx) }}>
                    <Bar ctx={ctx} h={10} kind="p" w={10} />
                    <div className="grid min-w-0 flex-1 gap-[3px]"><Bar ctx={ctx} h={3} kind="h" w="85%" /><Bar ctx={ctx} h={3} kind="b" w="60%" /></div>
                </div>
            ))}
        </div>
    )
}

function Tiles({ ctx }: ShapeProps) {
    return (
        <div className="absolute inset-0 grid grid-cols-4 gap-1.5 px-1.5 py-[5px]">
            {[0, 1, 2, 3].map((j) => (
                <div className="flex min-w-0 flex-col gap-[3px]" key={j}>
                    <div className="relative min-h-5 flex-1 overflow-hidden rounded bg-[rgba(148,163,184,0.1)]"><ImageFill ctx={ctx} extra={j * 0.08} gradient={themeGradient(ctx.theme, j % 2 === 1)} /></div>
                    <Bar ctx={ctx} h={3} kind="h" w="75%" /><Bar ctx={ctx} h={3} kind="p" w="35%" />
                </div>
            ))}
        </div>
    )
}

function Testimonials({ ctx }: ShapeProps) {
    const c = paletteOf(ctx.theme)
    return (
        <div className="absolute inset-0 flex items-center justify-center gap-2">
            <div className="flex">
                {[c.primary, c.surface, c.muted].map((col, j) => (
                    <span className="box-border block size-[9px] rounded-full border" key={j} style={{ marginLeft: j ? -3 : 0, borderColor: ctx.painted ? c.surface : '#0b1222', backgroundColor: ctx.painted ? col : ctx.content ? 'rgba(148,163,184,.45)' : SKELETON, ...transition(ctx, 'background-color, border-color') }} />
                ))}
            </div>
            <Bar ctx={ctx} h={4} kind="b" w="30%" />
        </div>
    )
}

function Footer({ ctx }: ShapeProps) {
    return (
        <div className="absolute inset-0 flex items-center justify-between px-2">
            <Bar ctx={ctx} h={3} kind="f" w={28} />
            <div className="flex gap-[5px]"><Bar ctx={ctx} h={3} kind="f" w={12} /><Bar ctx={ctx} h={3} kind="f" w={12} /><Bar ctx={ctx} h={3} kind="f" w={12} /></div>
        </div>
    )
}

function Generic({ ctx }: ShapeProps) {
    return (
        <div className="absolute inset-0 flex flex-col justify-center gap-1.5 px-2.5">
            <Bar ctx={ctx} h={4} kind="h" w="45%" /><Bar ctx={ctx} h={3} kind="b" w="80%" /><Bar ctx={ctx} h={3} kind="b" w="60%" />
        </div>
    )
}

export const SHAPES: Record<WireframeKind, (p: ShapeProps) => ReactElement> = {
    nav: Nav, hero: Hero, features: Features, tiles: Tiles, testimonials: Testimonials, footer: Footer, generic: Generic,
}
