'use client'

import type { CSSProperties, KeyboardEvent } from 'react'

export type BlockSpacingField = 'paddingTop' | 'paddingBottom'

const MIN = 0
const MAX = 120
const STEP = 4
// Keys that change a native range input's value
const RANGE_NAV_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'])

interface SpacingSliderProps {
    label: string
    /** Local preview value (changes while dragging) */
    value: number
    /** Value currently stored on the block — used to skip no-op saves */
    saved: number
    onChange: (value: number) => void
    onCommit: (value: number) => void
}

/**
 * Range input that previews on drag and saves once the interaction ends:
 * pointer up, keyboard (arrow/home/end/page) key up, or blur.
 * Skips the save only when the value equals what the block already stores
 * (compared against the saved prop, not a local ref: Safari does not focus
 * range inputs on click, so focus-based bookkeeping would go stale).
 */
function SpacingSlider({ label, value, saved, onChange, onCommit }: SpacingSliderProps) {
    const fillRatio = (value - MIN) / (MAX - MIN)

    const commit = (next: number) => {
        if (next === saved) return
        onCommit(next)
    }

    return (
        <div>
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--editor-text-muted)]">{label}</span>
                <span className="text-[10px] text-[var(--editor-text-muted)]">{value}px</span>
            </div>
            <input
                type="range"
                min={MIN}
                max={MAX}
                step={STEP}
                value={value}
                aria-label={label}
                style={{ '--fill-ratio': fillRatio } as CSSProperties}
                className="editor-range mt-2"
                onChange={(e) => onChange(Number(e.target.value))}
                onPointerUp={(e) => commit(Number(e.currentTarget.value))}
                onKeyUp={(e: KeyboardEvent<HTMLInputElement>) => {
                    if (RANGE_NAV_KEYS.has(e.key)) commit(Number(e.currentTarget.value))
                }}
                onBlur={(e) => commit(Number(e.currentTarget.value))}
            />
        </div>
    )
}

interface BlockSpacingControlsProps {
    title: string
    topLabel: string
    bottomLabel: string
    top: number
    bottom: number
    savedTop: number
    savedBottom: number
    onTopChange: (value: number) => void
    onBottomChange: (value: number) => void
    onCommit: (field: BlockSpacingField, value: number) => void
    className?: string
}

/** "Layout & Spacing" section: top/bottom padding sliders for the selected block. GH-2107. */
export function BlockSpacingControls({
    title, topLabel, bottomLabel, top, bottom, savedTop, savedBottom, onTopChange, onBottomChange, onCommit, className,
}: BlockSpacingControlsProps) {
    return (
        <div className={className}>
            <label className="text-xs font-medium uppercase tracking-[0.6px] text-[var(--editor-text-muted)]">{title}</label>
            <div className="mt-3 space-y-3">
                <SpacingSlider label={topLabel} value={top} saved={savedTop} onChange={onTopChange} onCommit={(v) => onCommit('paddingTop', v)} />
                <SpacingSlider label={bottomLabel} value={bottom} saved={savedBottom} onChange={onBottomChange} onCommit={(v) => onCommit('paddingBottom', v)} />
            </div>
        </div>
    )
}
