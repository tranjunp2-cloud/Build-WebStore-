import { useId } from 'react'

interface NoiseTextureProps {
    className?: string
    opacity?: number
    baseFrequency?: number
}

/**
 * SVG fractal-noise overlay for grain/film texture. Filter ID is per-instance
 * (useId) so multiple NoiseTextures on one page never collide. Desaturates to
 * keep grain monochrome regardless of bg color.
 */
export function NoiseTexture({ className = '', opacity = 0.08, baseFrequency = 0.9 }: NoiseTextureProps) {
    const reactId = useId()
    const filterId = `noise-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`
    return (
        <svg
            className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <filter id={filterId}>
                <feTurbulence type="fractalNoise" baseFrequency={baseFrequency} numOctaves={2} stitchTiles="stitch" />
                <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter={`url(#${filterId})`} opacity={opacity} />
        </svg>
    )
}
