interface LayeredShapesProps {
    color: string
    className?: string
    opacity?: number
}

/**
 * Three offset shapes (two blurred circles + one rotated rounded square) for
 * an organic, layered feel. Used by testimonials/cards + about/split.
 */
export function LayeredShapes({ color, className = '', opacity = 0.12 }: LayeredShapesProps) {
    return (
        <div
            className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
            aria-hidden="true"
        >
            <div
                className="absolute rounded-full"
                style={{
                    top: '10%',
                    left: '5%',
                    width: 180,
                    height: 180,
                    background: color,
                    opacity: opacity * 1.2,
                    filter: 'blur(20px)',
                }}
            />
            <div
                className="absolute rounded-full"
                style={{
                    top: '60%',
                    right: '10%',
                    width: 240,
                    height: 240,
                    background: color,
                    opacity: opacity * 0.8,
                    filter: 'blur(30px)',
                }}
            />
            <div
                className="absolute"
                style={{
                    top: '30%',
                    right: '30%',
                    width: 100,
                    height: 100,
                    background: color,
                    opacity: opacity * 0.6,
                    transform: 'rotate(45deg)',
                    borderRadius: 24,
                }}
            />
        </div>
    )
}
