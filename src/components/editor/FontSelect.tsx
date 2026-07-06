'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fontNameToCSSVar } from '@/lib/fonts/pairings'

interface FontSelectProps {
    value: string
    onChange: (font: string) => void
    role: 'heading' | 'body'
    label: string
    options: readonly string[]
}

/** <768px = mobile bottom sheet; ≥768px (tablet+desktop) = popover.
 * `useEditorLayoutMode`'s <1280px bucket is too coarse for this split, so this
 * hook mirrors its SSR-safe matchMedia pattern at the 768 breakpoint instead. */
function useIsMobileViewport(): boolean {
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        // jsdom in unit tests doesn't polyfill matchMedia by default — degrade to
        // desktop (popover) rather than crash components that render this incidentally.
        if (typeof window.matchMedia !== 'function') return

        const mediaQuery = window.matchMedia('(max-width: 767px)')
        setIsMobile(mediaQuery.matches)
        const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches)
        mediaQuery.addEventListener('change', handleChange)
        return () => mediaQuery.removeEventListener('change', handleChange)
    }, [])

    return isMobile
}

const TRIGGER_CLS = 'mt-1 flex h-auto w-full items-center justify-between rounded-lg border border-white/10 bg-[var(--editor-surface-elevated)] px-3 py-1.5 text-xs text-white outline-none'

export function FontSelect({ value, onChange, role, label, options }: FontSelectProps) {
    const isMobile = useIsMobileViewport()
    const [sheetOpen, setSheetOpen] = useState(false)

    if (isMobile) {
        return (
            <>
                <button
                    type="button"
                    onClick={() => setSheetOpen(true)}
                    className={TRIGGER_CLS}
                    style={{ fontFamily: fontNameToCSSVar(value, role) }}
                >
                    <span className="truncate">{value}</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                </button>
                {sheetOpen ? (
                    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
                        <div
                            className="absolute inset-0 bg-black/60"
                            onClick={() => setSheetOpen(false)}
                            onKeyDown={e => e.key === 'Escape' && setSheetOpen(false)}
                            role="button"
                            tabIndex={0}
                            aria-label="Close font picker"
                        />
                        <div className="relative flex max-h-[70vh] flex-col overflow-hidden rounded-t-2xl border-t border-[var(--editor-border)] bg-[var(--editor-surface)] pb-[env(safe-area-inset-bottom)]">
                            <div className="flex shrink-0 justify-center pt-2">
                                <span className="h-1 w-9 rounded-full bg-[var(--editor-text-muted)]" style={{ opacity: 0.35 }} aria-hidden />
                            </div>
                            <div className="shrink-0 px-4 pb-2 pt-3 text-sm font-medium text-white">{label}</div>
                            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                                {options.map(font => (
                                    <button
                                        key={font}
                                        type="button"
                                        onClick={() => { onChange(font); setSheetOpen(false) }}
                                        className={cn(
                                            'flex min-h-[44px] w-full items-center justify-between rounded-lg px-3 text-left text-sm',
                                            font === value ? 'bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]' : 'text-white hover:bg-white/5',
                                        )}
                                        style={{ fontFamily: fontNameToCSSVar(font, role) }}
                                    >
                                        <span className="truncate">{font}</span>
                                        {font === value ? <Check className="h-4 w-4 shrink-0" /> : null}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : null}
            </>
        )
    }

    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className={TRIGGER_CLS} style={{ fontFamily: fontNameToCSSVar(value, role) }}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent side="bottom" align="start">
                {options.map(font => (
                    <SelectItem key={font} value={font} style={{ fontFamily: fontNameToCSSVar(font, role) }}>
                        {font}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
