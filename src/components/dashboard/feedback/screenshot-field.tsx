'use client'

import { useRef } from 'react'
import { Plus, X } from 'lucide-react'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { ACCEPTED_SCREENSHOT_TYPES, MAX_SCREENSHOTS } from './types'
import type { ScreenshotItem } from './use-screenshots'

type Props = {
    items: ScreenshotItem[]
    onAdd: (files: File[]) => void
    onRemove: (id: string) => void
    /** More files were picked than fit: only the first ones were kept. */
    overflow?: boolean
    disabled?: boolean
}

const TILE = 'relative h-16 w-16 shrink-0 rounded-lg'

/** Screenshot tiles + add button (Figma "Screenshots"). Flagged files show a red tile and the error below. */
export function ScreenshotField({ items, onAdd, onRemove, overflow, disabled }: Props) {
    const { t, ti } = useI18n()
    const f = t.dashboard.feedback.fields
    const inputRef = useRef<HTMLInputElement>(null)
    const firstError = items.find((i) => i.error)?.error
    const ERROR_TEXT = { tooLarge: f.screenshotTooLarge, wrongType: f.screenshotWrongType }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
                {items.map((item, idx) => (
                    <div
                        key={item.id}
                        className={cn(TILE, 'border border-solid', item.error ? 'border-[hsl(var(--destructive))]' : 'border-transparent')}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                        <img
                            src={item.previewUrl}
                            alt={ti(f.screenshotAlt, { n: idx + 1 })}
                            className={cn('h-full w-full rounded-[7px] object-cover', item.error && 'opacity-50')}
                        />
                        <button
                            type="button"
                            onClick={() => onRemove(item.id)}
                            disabled={disabled}
                            aria-label={ti(f.removeScreenshot, { n: idx + 1 })}
                            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--dash-text)] text-[var(--dash-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                ))}
                {items.length < MAX_SCREENSHOTS && (
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={disabled}
                        aria-label={f.addScreenshot}
                        className={cn(
                            TILE,
                            'flex items-center justify-center text-[var(--dash-text-muted)] [border:1px_dashed_hsl(var(--input-border))] hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                        )}
                    >
                        <Plus className="h-5 w-5" />
                    </button>
                )}
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    hidden
                    accept={ACCEPTED_SCREENSHOT_TYPES.join(',')}
                    onChange={(e) => {
                        onAdd(Array.from(e.target.files ?? []))
                        e.target.value = ''
                    }}
                />
            </div>
            {firstError && (
                <p role="alert" className="text-xs leading-4 text-[hsl(var(--destructive))]">
                    {ERROR_TEXT[firstError]}
                </p>
            )}
            {overflow && <p role="alert" className="text-xs leading-4 text-[hsl(var(--destructive))]">{f.screenshotTooMany}</p>}
            <p className="text-[11px] leading-4 text-[var(--dash-text-muted)]">{f.screenshotHelper}</p>
        </div>
    )
}
