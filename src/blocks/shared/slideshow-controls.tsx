'use client'

import { TOUCH_TARGET } from '@/lib/design-tokens'
import { CSS_VARS } from '@/lib/theme/resolve'

export const SlideshowArrow = ({ direction, onClick }: { direction: 'left' | 'right'; onClick: () => void }) => (
        <button
            type="button"
            onClick={onClick}
            className={`absolute top-1/2 -translate-y-1/2 ${TOUCH_TARGET.min} min-w-[44px] md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 z-20 backdrop-blur-sm`}
            style={{
                [direction === 'left' ? 'left' : 'right']: '12px',
                background: `rgba(var(--brand-primary-rgb), 0.188)`,
                color: '#fff',
            }}
            aria-label={direction === 'left' ? 'Previous slide' : 'Next slide'}
        >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d={direction === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
            </svg>
        </button>
    )

type SlideshowDotProps = {
    active: boolean
    onClick: () => void
    label: string
    /** Higher contrast when controls sit directly on photography. */
    onImage?: boolean
    activeColor?: string
    inactiveColor?: string
}

export function SlideshowDot({
    active,
    onClick,
    label,
    onImage = false,
    activeColor = CSS_VARS.primary,
    inactiveColor = 'rgba(var(--brand-primary-rgb), 0.188)',
}: SlideshowDotProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="h-11 w-6 min-w-6 shrink-0 flex items-center justify-center rounded-full transition-all duration-300"
            aria-label={label}
            aria-current={active}
        >
            <span
                className="w-2.5 h-2.5 rounded-full transition-all duration-300"
                style={{
                    background: onImage ? (active ? '#fff' : 'rgba(255,255,255,0.6)') : (active ? activeColor : inactiveColor),
                    boxShadow: onImage ? '0 1px 4px rgba(0,0,0,0.65), 0 0 0 1px rgba(0,0,0,0.2)' : undefined,
                    transform: active ? 'scale(1.3)' : 'scale(1)',
                }}
            />
        </button>
    )
}

