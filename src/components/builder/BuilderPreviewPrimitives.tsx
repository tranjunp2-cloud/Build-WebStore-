'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Monitor, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

export type BuilderPreviewMode = 'desktop' | 'mobile'

interface BuilderPreviewModeToggleProps {
    mode: BuilderPreviewMode
    onChange: (mode: BuilderPreviewMode) => void
}

export function BuilderPreviewModeToggle({
    mode,
    onChange,
}: BuilderPreviewModeToggleProps) {
    const { t } = useI18n()
    return (
        <div className="flex h-[42px] w-[206px] items-center gap-2 rounded-2xl border border-[rgba(59,130,246,0.15)] bg-[rgba(30,41,59,0.6)] px-[5px] py-px shadow-[0px_8px_32px_0px_rgba(0,0,0,0.3)]">
            <button
                className={cn(
                    'flex h-8 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all',
                    mode === 'desktop'
                        ? 'bg-[linear-gradient(90deg,#3b82f6_0%,#2dd4bf_100%)] text-white'
                        : 'text-[#f8fafc]'
                )}
                onClick={() => onChange('desktop')}
                type="button"
            >
                <Monitor className="size-4" />
                <span>{t.common.desktop}</span>
            </button>
            <button
                className={cn(
                    'flex h-8 w-[89px] items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all',
                    mode === 'mobile'
                        ? 'bg-[linear-gradient(90deg,#3b82f6_0%,#2dd4bf_100%)] text-white'
                        : 'text-[#f8fafc]'
                )}
                onClick={() => onChange('mobile')}
                type="button"
            >
                <Smartphone className="size-4" />
                <span>{t.common.mobile}</span>
            </button>
        </div>
    )
}

interface BuilderMobilePreviewShellProps {
    children?: ReactNode
    siteId?: string | null
}

function BuilderMobilePreviewShell({ children, siteId }: BuilderMobilePreviewShellProps) {
    // Stable cache-bust stamp — avoids iframe remount on every parent re-render.
    const vRef = useRef(Date.now())
    // Track which siteId the iframe has finished loading for.
    // Overlay LivePreview until iframe is ready → eliminates blank flash on transition.
    const [readySiteId, setReadySiteId] = useState<string | null>(null)
    const iframeReady = readySiteId === siteId && siteId != null

    // Fallback: if iframe never fires onLoad (Vercel 504, CSP block, redirect loop),
    // force-dismiss spinner after 15s so user is not permanently stuck.
    useEffect(() => {
        if (!siteId || iframeReady) return
        const id = setTimeout(() => setReadySiteId(siteId), 15_000)
        return () => clearTimeout(id)
    }, [siteId, iframeReady])

    return (
        <div className="relative h-[812px] w-[375px] rounded-[48px] bg-[linear-gradient(114.79deg,#1e2939_0%,#101828_100%)] shadow-[0px_25px_50px_0px_rgba(0,0,0,0.25)]">
            <div className="absolute inset-[12px] overflow-hidden rounded-[40px] bg-[#0b1120]">
                <div className="absolute inset-x-0 top-0 z-10 flex h-11 items-center justify-between bg-gradient-to-b from-[rgba(0,0,0,0.2)] to-[rgba(0,0,0,0)] px-8">
                    <span className="text-xs font-semibold leading-4 text-white">9:41</span>
                    <div className="flex items-center gap-1">
                        <div className="h-3 w-4 rounded-lg bg-white opacity-80" />
                        <div className="h-3 w-4 rounded-lg bg-white opacity-60" />
                        <div className="h-3 w-4 rounded-lg bg-white opacity-40" />
                    </div>
                </div>
                {siteId ? (
                    <div className="relative h-full w-full">
                        {/* Iframe loads invisibly; spinner shown until ready */}
                        <iframe
                            src={`/preview/${siteId}?v=${vRef.current}&builder=1`}
                            className={cn("absolute inset-0 h-full w-full border-0", !iframeReady && "invisible")}
                            title="Mobile preview"
                            onLoad={() => setReadySiteId(siteId)}
                        />
                        {!iframeReady && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
                            </div>
                        )}
                    </div>
                ) : (
                    <>{children}</>
                )}
            </div>
            <div className="absolute bottom-2 left-1/2 h-1 w-32 -translate-x-1/2 rounded-full bg-white/30" />
            <div className="absolute left-1/2 top-0 h-7 w-40 -translate-x-1/2 rounded-b-[24px] bg-[linear-gradient(170.07deg,#1e2939_0%,#101828_100%)]" />
            <div className="pointer-events-none absolute inset-0 rounded-[48px] shadow-[0px_0px_80px_0px_rgba(59,130,246,0.4)]" />
        </div>
    )
}

interface BuilderPreviewSurfaceProps {
    mode: BuilderPreviewMode
    /** `dock` — done-state preview: one iframe that narrows to 390px for mobile (no phone shell). */
    variant: 'panel' | 'fullwidth' | 'dock'
    children?: ReactNode
    siteId?: string | null
}

export function BuilderPreviewSurface({
    mode,
    variant,
    children,
    siteId,
}: BuilderPreviewSurfaceProps) {
    // Stable cache-bust stamp — avoids iframe remount on every parent re-render.
    const vRef = useRef(Date.now())
    // Track which siteId the iframe has finished loading for.
    // Overlay LivePreview until iframe is ready → eliminates blank flash on transition.
    const [readySiteId, setReadySiteId] = useState<string | null>(null)
    const iframeReady = readySiteId === siteId && siteId != null

    // Fallback: if iframe never fires onLoad (Vercel 504, CSP block, redirect loop),
    // force-dismiss spinner after 15s so user is not permanently stuck.
    useEffect(() => {
        if ((mode === 'mobile' && variant !== 'dock') || !siteId || iframeReady) return
        const id = setTimeout(() => setReadySiteId(siteId), 15_000)
        return () => clearTimeout(id)
    }, [mode, variant, siteId, iframeReady])

    if (variant === 'dock') {
        if (!siteId) return <div className="h-full w-full overflow-y-auto">{children}</div>
        return (
            <div className="flex h-full justify-center">
                <div
                    className="relative h-full max-w-full flex-none transition-[width] duration-300 ease-out motion-reduce:transition-none"
                    data-mode={mode}
                    style={{ width: mode === 'mobile' ? 390 : '100%' }}
                >
                    <iframe
                        src={`/preview/${siteId}?v=${vRef.current}&builder=1`}
                        className={cn(
                            'block h-full w-full border-0 bg-white',
                            mode === 'mobile' && 'border-x border-solid border-white/[.08]',
                            !iframeReady && 'invisible',
                        )}
                        title="Website preview"
                        onLoad={() => setReadySiteId(siteId)}
                    />
                    {!iframeReady && (
                        <div className="absolute inset-0 flex items-center justify-center bg-[#06090F]">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/50" />
                        </div>
                    )}
                </div>
            </div>
        )
    }

    if (mode === 'mobile') {
        return (
            <div className="flex h-full items-center justify-center">
                <BuilderMobilePreviewShell siteId={siteId}>{children}</BuilderMobilePreviewShell>
            </div>
        )
    }

    // Desktop: iframe loads invisibly; spinner shown until onLoad fires.
    // siteId is always set when this component renders (preview only shows after done).
    const desktopContent = siteId ? (
        <div className="relative h-full w-full overflow-hidden">
            {/* Iframe loads in background; invisible until ready */}
            <iframe
                src={`/preview/${siteId}?v=${vRef.current}&builder=1`}
                className={cn("absolute inset-0 h-full w-full border-0", !iframeReady && "invisible")}
                title="Website preview"
                onLoad={() => setReadySiteId(siteId)}
            />
            {!iframeReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#06090F]">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/50" />
                </div>
            )}
        </div>
    ) : (
        <>{children}</>
    )

    if (variant === 'fullwidth') {
        return (
            <div className="flex h-full items-start justify-center px-10 pt-8">
                <div className="h-full max-h-[5094px] w-full max-w-[1280px] overflow-hidden rounded-2xl border border-[rgba(59,130,246,0.15)] bg-[rgba(30,41,59,0.6)] shadow-[0px_8px_32px_0px_rgba(0,0,0,0.3)]">
                    <div className={cn("h-full rounded-[inherit] border border-transparent shadow-[inset_0px_1px_0px_0px_rgba(255,255,255,0.05)]", siteId ? "overflow-hidden" : "overflow-y-auto")}>
                        {desktopContent}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full overflow-hidden rounded-2xl border border-[rgba(59,130,246,0.15)] bg-[rgba(30,41,59,0.6)] shadow-[0px_8px_32px_0px_rgba(0,0,0,0.3)]">
            <div className="h-full overflow-hidden rounded-[inherit] border border-transparent shadow-[inset_0px_1px_0px_0px_rgba(255,255,255,0.05)]">
                {desktopContent}
            </div>
        </div>
    )
}
