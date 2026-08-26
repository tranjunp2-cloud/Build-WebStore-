interface DuotoneOverlayProps {
    color1: string
    color2?: string
    className?: string
    opacity?: number
    blendMode?: 'multiply' | 'overlay' | 'soft-light' | 'screen'
}

/**
 * Two-color blend overlay using CSS mix-blend-mode. Sits above content but
 * pointer-events-none so clicks pass through. Falls back to single color if
 * `color2` not given. Used by features/carousel + newsletter/banner.
 */
export function DuotoneOverlay({
    color1,
    color2,
    className = '',
    opacity = 0.5,
    blendMode = 'multiply',
}: DuotoneOverlayProps) {
    const second = color2 ?? color1
    return (
        <div
            className={`absolute inset-0 pointer-events-none ${className}`}
            style={{
                opacity,
                background: `linear-gradient(135deg, ${color1}, ${second})`,
                mixBlendMode: blendMode,
            }}
            aria-hidden="true"
        />
    )
}
