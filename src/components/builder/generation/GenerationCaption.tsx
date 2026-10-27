'use client'

import { Check, Loader2 } from 'lucide-react'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { CAPTION_ORDER, type CaptionKey } from './generation-utils'

interface GenerationCaptionProps {
    caption: CaptionKey
    name: string
    ready: boolean
    percent: number
}

/** Stacked captions crossfade/slide; icon spins until ready, then turns into a check. */
export function GenerationCaption({ caption, name, ready, percent }: GenerationCaptionProps) {
    const { t, ti } = useI18n()
    const g = t.onboarding.generating
    const idx = CAPTION_ORDER.indexOf(caption)
    return (
        <div className="mt-4 flex items-center gap-2.5">
            <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full transition-[background-color,color] duration-300', ready ? 'bg-[#2dd4bf] text-[#0b1222]' : 'bg-[rgba(56,189,248,0.12)] text-[#38bdf8]')}>
                {ready ? <Check className="size-3" strokeWidth={3} /> : <Loader2 className="size-3 motion-safe:animate-spin" strokeWidth={2.5} />}
            </span>
            <div aria-live="polite" className="relative h-5 min-w-0 flex-1">
                {CAPTION_ORDER.map((key, i) => (
                    <span
                        aria-hidden={i !== idx}
                        className={cn(
                            'absolute inset-x-0 top-0 block truncate text-[13px] font-medium leading-5 text-[#f1f5f9] transition-[opacity,transform] duration-[350ms] motion-reduce:transition-none',
                            i === idx ? 'opacity-100' : cn('opacity-0', i < idx ? '-translate-y-1.5' : 'translate-y-1.5'),
                        )}
                        data-caption={i === idx ? key : undefined}
                        key={key}
                    >
                        {ti(g[key], { name: name || '' })}
                    </span>
                ))}
            </div>
            <span className="shrink-0 text-[13px] font-semibold tabular-nums leading-5 text-[#38bdf8]">{percent}%</span>
        </div>
    )
}
