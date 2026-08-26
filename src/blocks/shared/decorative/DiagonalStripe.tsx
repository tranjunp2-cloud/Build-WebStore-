interface DiagonalStripeProps {
    color: string
    className?: string
    opacity?: number
    angle?: number
}

/**
 * Single skewed band sweeping across the section — gives subtle motion to
 * static blocks. `angle` controls the skew (negative = upward-left). Used by
 * cta/inline + about/simple + stats/row.
 */
export function DiagonalStripe({ color, className = '', opacity = 0.08, angle = -6 }: DiagonalStripeProps) {
    return (
        <div
            className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
            aria-hidden="true"
        >
            <div
                className="absolute"
                style={{
                    top: '30%',
                    left: '-20%',
                    width: '140%',
                    height: '40%',
                    background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
                    opacity,
                    transform: `skewY(${angle}deg)`,
                }}
            />
        </div>
    )
}
