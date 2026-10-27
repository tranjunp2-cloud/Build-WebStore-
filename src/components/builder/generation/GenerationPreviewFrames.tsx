'use client'

import type { ThemeConfig } from '@/blocks/types'
import { cn } from '@/lib/utils'
import { paletteOf } from './GenerationWireframeShapes'

/** Lightweight painted mock of the generated site (no iframes) used in the desktop + phone frames. */
function MockSite({ theme, name, compact }: { theme: ThemeConfig | null; name: string; compact?: boolean }) {
    const c = paletteOf(theme)
    const heading = theme ? `'${theme.fontHeading}', serif` : undefined
    return (
        <div className="flex h-full w-full flex-col gap-2 p-3" style={{ backgroundColor: c.bg }}>
            <div className="flex items-center justify-between">
                <span className="truncate text-[9px] font-bold" style={{ color: c.text, fontFamily: heading }}>{name}</span>
                {!compact && <span className="h-1.5 w-16 rounded-full" style={{ backgroundColor: c.muted, opacity: 0.45 }} />}
            </div>
            <div className={cn('grid flex-1 gap-2', compact ? 'grid-rows-[1fr_auto]' : 'grid-cols-[1.2fr_1fr]')}>
                <div className="flex flex-col justify-center gap-1.5">
                    <span className="h-2 w-[85%] rounded-full" style={{ backgroundColor: c.text }} />
                    <span className="h-1.5 w-[60%] rounded-full" style={{ backgroundColor: c.muted, opacity: 0.45 }} />
                    <span className="mt-1 h-2.5 w-8 rounded" style={{ backgroundColor: c.primary }} />
                </div>
                <div className="min-h-8 rounded-md" style={{ backgroundImage: `linear-gradient(135deg,${c.surface},${c.primary})` }} />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
                {[0, 1, 2].map((i) => <span className="h-5 rounded" key={i} style={{ backgroundColor: c.surface }} />)}
            </div>
        </div>
    )
}

interface PreviewFramesProps {
    theme: ThemeConfig | null
    name: string
    visible: boolean
    reduced: boolean
}

/** Final layer: a phone frame slides in over the painted wireframe (which stays as the desktop view). */
export function GenerationPreviewFrames({ theme, name, visible, reduced }: PreviewFramesProps) {
    return (
        <>
            <div
                className="absolute right-4 top-[18px] h-[236px] w-28 box-border overflow-hidden rounded-[18px] border-[3px] border-[#0b1222] bg-white shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55),0_0_0_1px_rgba(148,163,184,0.3)]"
                data-testid="phone-frame"
                style={{
                    opacity: visible ? 1 : 0,
                    transform: visible ? 'none' : 'translateX(36px) scale(.96)',
                    transition: reduced ? 'none' : 'opacity .5s .35s, transform .6s .35s cubic-bezier(.2,.9,.3,1)',
                }}
            >
                <MockSite compact name={name} theme={theme} />
            </div>
        </>
    )
}
