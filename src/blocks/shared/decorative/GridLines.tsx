interface GridLinesProps {
    color?: string
    className?: string
    spacing?: number
    opacity?: number
    direction?: 'both' | 'horizontal' | 'vertical'
}

/**
 * Repeating linear-gradient grid lines (architecture / blueprint vibe). Single
 * color, configurable spacing + direction. No SVG or images — pure CSS bg.
 * Used by features/grid-3 + pricing/cards + newsletter/inline.
 */
export function GridLines({
    color = 'currentColor',
    className = '',
    spacing = 40,
    opacity = 0.05,
    direction = 'both',
}: GridLinesProps) {
    const lines: string[] = []
    if (direction !== 'vertical') {
        lines.push(`linear-gradient(to right, ${color} 1px, transparent 1px)`)
    }
    if (direction !== 'horizontal') {
        lines.push(`linear-gradient(to bottom, ${color} 1px, transparent 1px)`)
    }
    return (
        <div
            className={`absolute inset-0 pointer-events-none ${className}`}
            style={{
                opacity,
                backgroundImage: lines.join(', '),
                backgroundSize: `${spacing}px ${spacing}px`,
            }}
            aria-hidden="true"
        />
    )
}
