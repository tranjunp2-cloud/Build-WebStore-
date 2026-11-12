'use client'

import { useEffect, useRef } from 'react'
import type { ThemeConfig } from '@/blocks/types'
import { getBlockDisplayName } from '@/components/editor/block-display-name'
import { cn } from '@/lib/utils'
import { useEntered, usePrefersReducedMotion, useTypedText } from './generation-hooks'
import { KIND_HEIGHT, getWireframeKind, type GenerationBlock } from './generation-utils'
import { SHAPES, paletteOf, type PaintCtx } from './GenerationWireframeShapes'

// Friendly section names from the design prototype; other block types fall back to the editor name.
const TAG_LABELS: Record<string, string> = {
    navigation: 'Navigation', hero: 'Hero section', features: 'Features', pricing: 'Pricing / Menu',
    testimonials: 'Testimonials', cta: 'Call to action', contact: 'Contact form', footer: 'Footer',
}

function getWireframeTagLabel(type: string): string {
    const name = TAG_LABELS[type] ?? getBlockDisplayName(type)
    return name.charAt(0).toUpperCase() + name.slice(1)
}

// Height budget of the default nav/hero/features/tiles/testimonials/footer page (KIND_HEIGHT) and its gaps.
const BASE_TOTAL = 218
const GAPS = 30

interface SectionProps {
    block: GenerationBlock
    index: number
    total: number
    painted: boolean
    theme: ThemeConfig | null
    reduced: boolean
    name: string
    typed: string
    typing: boolean
    settled: boolean
}

function WireframeSection({ block, index, total, painted, theme, reduced, name, typed, typing, settled }: SectionProps) {
    const type = block.blockType ?? 'section'
    const kind = getWireframeKind(type)
    const visible = useEntered(reduced)
    const current = index === total - 1 && !painted && !settled
    const height = KIND_HEIGHT[kind]
    const c = paletteOf(theme)
    const ctx: PaintCtx = { painted, content: painted || settled, delay: index * 0.1, theme, reduced }
    const Shape = SHAPES[kind]
    const bg = painted ? (kind === 'footer' ? c.text : index % 2 === 1 ? c.surface : 'transparent') : current ? 'rgba(56,189,248,.08)' : 'rgba(56,189,248,.02)'
    return (
        <div
            className={cn('relative box-border rounded-md border', painted ? 'border-solid border-[rgba(56,189,248,0)]' : current ? 'border-dashed border-[rgba(56,189,248,0.9)]' : 'border-dashed border-[rgba(56,189,248,0.3)]')}
            data-block-type={type}
            data-newest={current ? 'true' : undefined}
            data-visible={visible}
            style={{
                // Sized against the typical 6-section page so a lone section never stretches to fill the stage.
                flex: `0 1 calc((100% - ${GAPS}px) * ${height / BASE_TOTAL})`,
                minHeight: height,
                backgroundColor: bg,
                boxShadow: current ? '0 0 16px rgba(56,189,248,.22)' : '0 0 0 rgba(56,189,248,0)',
                opacity: visible ? 1 : 0,
                transform: visible ? 'none' : 'translateY(8px) scale(.98)',
                transition: reduced ? 'none' : `opacity .4s, transform .4s, border-color .3s, box-shadow .3s, background-color .5s ${painted ? index * 0.1 : 0}s`,
            }}
        >
            <Shape ctx={ctx} name={name} typed={typed} typing={typing} />
            <span
                className="absolute right-2 top-0 z-[2] -translate-y-1/2 whitespace-nowrap rounded border border-[rgba(56,189,248,0.5)] bg-[#0b1222] px-[5px] text-[8.5px] font-semibold leading-[11px] text-[#7dd3fc] transition-opacity duration-300"
                style={{ opacity: visible && !painted ? 1 : 0 }}
            >
                {getWireframeTagLabel(type)}
            </span>
        </div>
    )
}

interface GenerationWireframeProps {
    blocks: GenerationBlock[]
    theme: ThemeConfig | null
    painted: boolean
    businessName: string
    settled: boolean
}

/** One wireframe section per block received from the stream; painted with theme colours at >=95%. */
export function GenerationWireframe({ blocks, theme, painted, businessName, settled }: GenerationWireframeProps) {
    const reduced = usePrefersReducedMotion()
    const scrollRef = useRef<HTMLDivElement>(null)
    const hasHero = blocks.some((b) => b.blockType === 'hero')
    const { text, typing } = useTypedText(businessName, hasHero && (settled || painted || reduced), reduced || painted)

    useEffect(() => {
        const el = scrollRef.current
        if (el) el.scrollTop = el.scrollHeight
    }, [blocks.length])

    return (
        <>
            <div className="absolute inset-0 flex flex-col gap-1.5 overflow-y-auto px-3 py-2.5" ref={scrollRef}>
                {blocks.map((block, i) => (
                    <WireframeSection
                        block={block}
                        index={i}
                        key={block._id ?? `${block.blockType}-${i}`}
                        name={businessName}
                        painted={painted}
                        reduced={reduced}
                        theme={theme}
                        total={blocks.length}
                        settled={settled}
                        typed={text}
                        typing={typing}
                    />
                ))}
            </div>
            {painted && !reduced && (
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-0 z-[3] w-[40%] bg-[linear-gradient(100deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.55)_50%,rgba(255,255,255,0)_100%)] animate-pw-sweep"
                    data-testid="paint-sweep"
                />
            )}
        </>
    )
}
