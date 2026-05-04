interface AsymmetricGridProps {
    color: string
    className?: string
    opacity?: number
}

/**
 * 4×3 CSS grid with uneven track sizes — color shows through the 1px gaps as a
 * subtle blueprint pattern. Used by features/zigzag where structural asymmetry
 * complements the staggered content layout.
 */
export function AsymmetricGrid({ color, className = '', opacity = 0.06 }: AsymmetricGridProps) {
    return (
        <div
            className={`absolute inset-0 pointer-events-none ${className}`}
            style={{ opacity }}
            aria-hidden="true"
        >
            <div
                className="grid h-full w-full"
                style={{
                    gridTemplateColumns: '1fr 2fr 1fr 3fr',
                    gridTemplateRows: '2fr 1fr 3fr',
                    gap: 1,
                    background: color,
                }}
            >
                {Array.from({ length: 12 }).map((_, i) => (
                    <div
                        key={i}
                        style={{
                            background: 'var(--background, #ffffff)',
                            opacity: i % 2 === 0 ? 0.95 : 0.85,
                        }}
                    />
                ))}
            </div>
        </div>
    )
}
