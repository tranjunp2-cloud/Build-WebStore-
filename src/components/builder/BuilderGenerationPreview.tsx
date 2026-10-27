'use client'

import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { fade, fontStack, type StagePalette } from '@/components/builder/builder-stage-palette'
import { useI18n } from '@/i18n'

interface BuilderGenerationPreviewProps {
    visible: boolean
    /** First moment of the stage — plays the shine sweep. */
    entering: boolean
    phoneShown: boolean
    ready: boolean
    /** The streamed blocks rendered with the generated theme (desktop width). */
    previewContent: ReactNode
    palette: StagePalette | null
    businessName: string
    width: number
    height: number
    scale: number
}

const DESKTOP_WIDTH = 1280

/** Phone-sized layout sketch in the generated theme's colours and heading font. */
function PhoneSketch({ palette, name }: { palette: StagePalette | null; name: string }) {
    const text = palette?.text ?? '#0f172a'
    const muted = palette ? fade(palette.muted, 45) : 'rgba(100,116,139,.45)'
    const primary = palette?.primary ?? '#3b82f6'
    const line = (w: string, h = 3, color = muted) => <span className="block flex-none rounded-full" style={{ width: w, height: h, backgroundColor: color }} />
    return (
        <div className="flex h-full flex-col gap-1.5" style={{ backgroundColor: palette?.background ?? '#ffffff' }}>
            <div className="flex h-6 flex-none items-center justify-between px-2">
                <span className="max-w-[70px] truncate text-[7px] font-bold leading-[9px]" style={{ color: text, fontFamily: palette ? fontStack(palette.headingFont, 'serif') : undefined }}>{name}</span>
                <span className="grid gap-[2px]">{line('8px', 1.5, text)}{line('8px', 1.5, text)}</span>
            </div>
            <div className="mx-1.5 grid gap-1.5 rounded-md p-2" style={{ backgroundColor: palette?.surface ?? '#f1f5f9' }}>
                <span className="text-[11px] font-bold leading-[13px] [overflow-wrap:anywhere]" style={{ color: text, fontFamily: palette ? fontStack(palette.headingFont, 'serif') : undefined }}>{name}</span>
                {line('90%')}{line('70%')}
                <span className="block h-[9px] w-[34px] rounded-[3px]" style={{ backgroundColor: primary }} />
            </div>
            <div className="mx-1.5 h-14 flex-none rounded-md" style={{ backgroundImage: palette ? `linear-gradient(135deg,${palette.accent},${palette.primary})` : undefined, backgroundColor: palette ? undefined : '#e2e8f0' }} />
            <div className="mx-1.5 grid grid-cols-2 gap-1.5">
                {[0, 1].map((k) => (
                    <div className="grid gap-1" key={k}>
                        <span className="block h-9 rounded" style={{ backgroundImage: palette ? `linear-gradient(135deg,${k ? palette.secondary : palette.accent},${k ? palette.primary : palette.secondary})` : undefined, backgroundColor: palette ? undefined : '#e2e8f0' }} />
                        {line('80%', 2.5, text)}{line('40%', 2.5, primary)}
                    </div>
                ))}
            </div>
        </div>
    )
}

/** Stage 3 of the generating panel: the real streamed site (desktop) + a mobile frame, then "Preview ready". */
export function BuilderGenerationPreview({ visible, entering, phoneShown, ready, previewContent, palette, businessName, width, height, scale }: BuilderGenerationPreviewProps) {
    const { t } = useI18n()
    const desktopScale = width / DESKTOP_WIDTH
    const name = businessName.trim() || t.onboarding.completion.yourWebsite

    return (
        <div
            aria-hidden={!visible}
            className="pointer-events-none absolute inset-0 overflow-hidden"
            data-testid="builder-generation-preview"
            style={{ backgroundColor: palette?.background ?? '#f8fafc', opacity: visible ? 1 : 0, transform: visible ? 'none' : 'scale(.985)', transition: 'opacity .6s, transform .6s' }}
        >
            {visible && previewContent ? (
                <div
                    className="absolute left-0 top-0 overflow-hidden bg-white"
                    style={{ width: DESKTOP_WIDTH, height: Math.ceil(height / desktopScale), transform: `scale(${desktopScale})`, transformOrigin: '0 0' }}
                >
                    {previewContent}
                </div>
            ) : null}
            <div className="absolute h-[236px] w-[112px]" style={{ right: Math.round(16 * scale), top: Math.round(18 * scale), transform: `scale(${scale})`, transformOrigin: '100% 0' }}>
                <div
                    className="relative box-border h-[236px] w-[112px] overflow-hidden rounded-[18px] border-[3px] border-solid border-[#0b1222] bg-white shadow-[0_18px_40px_-12px_rgba(0,0,0,.55),0_0_0_1px_rgba(148,163,184,.3)]"
                    data-testid="builder-generation-phone"
                    style={{ opacity: phoneShown ? 1 : 0, transform: phoneShown ? 'none' : 'translateX(36px) scale(.96)', transition: 'opacity .5s, transform .6s cubic-bezier(.2,.9,.3,1)' }}
                >
                    <PhoneSketch name={name} palette={palette} />
                </div>
            </div>
            <div
                className="absolute bottom-3.5 left-3.5 z-[2] box-border flex h-[30px] items-center gap-[7px] whitespace-nowrap rounded-full border border-solid border-[rgba(45,212,191,.45)] bg-[rgba(11,18,34,.92)] pl-1.5 pr-3 text-xs font-semibold text-white shadow-[0_10px_24px_-8px_rgba(0,0,0,.55),0_0_18px_rgba(45,212,191,.25)]"
                style={{ opacity: ready ? 1 : 0, transform: ready ? 'none' : 'translateY(6px) scale(.94)', transition: 'opacity .35s, transform .4s cubic-bezier(.2,.9,.3,1.3)' }}
            >
                <span className="flex size-[18px] items-center justify-center rounded-full bg-[#2dd4bf] text-[#0b1222]">
                    <Check aria-hidden className="size-[11px]" strokeWidth={3} />
                </span>
                {t.onboarding.generating.previewReady}
            </div>
            {visible && entering ? (
                <span className="bld-sweep pointer-events-none absolute inset-y-0 left-0 z-[3] w-[35%] [background-image:linear-gradient(100deg,rgba(255,255,255,0)_0%,rgba(255,255,255,.45)_50%,rgba(255,255,255,0)_100%)]" />
            ) : null}
        </div>
    )
}
