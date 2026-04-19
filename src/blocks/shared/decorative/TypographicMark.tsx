interface TypographicMarkProps {
    text: string
    color?: string
    className?: string
    opacity?: number
    size?: 'md' | 'lg' | 'xl'
}

const TYPO_MARK_SIZE = {
    md: 'text-[clamp(4rem,15vw,8rem)]',
    lg: 'text-[clamp(6rem,20vw,12rem)]',
    xl: 'text-[clamp(8rem,28vw,16rem)]',
} as const

/**
 * Oversized background watermark text — useful as a section "stamp"
 * (e.g. category number, big initial). Uses clamp() so giant font scales down
 * on mobile rather than overflowing the viewport. Used by testimonials/spotlight
 * + about/story.
 */
export function TypographicMark({
    text,
    color = 'currentColor',
    className = '',
    opacity = 0.04,
    size = 'lg',
}: TypographicMarkProps) {
    return (
        <div
            className={`absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center ${className}`}
            aria-hidden="true"
        >
            <span
                className={`font-black leading-none select-none whitespace-nowrap ${TYPO_MARK_SIZE[size]}`}
                style={{ color, opacity }}
            >
                {text}
            </span>
        </div>
    )
}
