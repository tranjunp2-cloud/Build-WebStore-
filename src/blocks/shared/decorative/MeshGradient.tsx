interface MeshGradientProps {
    color: string
    accentColor?: string
    className?: string
    opacity?: number
}

/**
 * Soft "mesh" effect from 4 radial gradients at corners. Falls back to a single
 * color if `accentColor` not provided. Heavy blur smooths overlap into a
 * painterly background. Used by cta/banner + stats/highlight.
 */
export function MeshGradient({ color, accentColor, className = '', opacity = 0.25 }: MeshGradientProps) {
    const accent = accentColor ?? color
    return (
        <div
            className={`absolute inset-0 pointer-events-none ${className}`}
            style={{
                opacity,
                backgroundImage: `
                    radial-gradient(at 20% 30%, ${color} 0px, transparent 50%),
                    radial-gradient(at 80% 20%, ${accent} 0px, transparent 50%),
                    radial-gradient(at 40% 80%, ${color} 0px, transparent 50%),
                    radial-gradient(at 90% 90%, ${accent} 0px, transparent 50%)
                `,
                filter: 'blur(40px)',
            }}
            aria-hidden="true"
        />
    )
}
