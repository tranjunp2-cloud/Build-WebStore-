'use client'

import type { BlockProps } from '../types'
import type { DividerConfig } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'

export function DividerBlock({ block, theme }: BlockProps<DividerConfig>) {
    const { variant = 'line', height = 40, color } = block

    if (variant === 'spacer') {
        return <div style={{ height: `${height}px` }} aria-hidden="true" />
    }

    if (variant === 'dots') {
        return (
            <AnimatedSection>
                <div className="flex items-center justify-center gap-3" style={{ height: `${height}px` }} role="separator">
                    {[0, 1, 2].map((i) => (
                        <span
                            key={i}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: `rgba(var(--brand-primary-rgb), 0.376)` }}
                        />
                    ))}
                </div>
            </AnimatedSection>
        )
    }

    if (variant === 'wave') {
        return (
            <AnimatedSection>
                <div className="w-full overflow-hidden" style={{ height: `${height}px` }} role="separator">
                    <svg
                        viewBox="0 0 1200 60"
                        preserveAspectRatio="none"
                        className="w-full h-full"
                    >
                        <path
                            d="M0 30 Q150 0 300 30 T600 30 T900 30 T1200 30"
                            fill="none"
                            stroke={`rgba(var(--brand-primary-rgb), 0.251)`}
                            strokeWidth="2"
                        />
                    </svg>
                </div>
            </AnimatedSection>
        )
    }

    // Default: line
    return (
        <AnimatedSection>
            <div className="flex items-center justify-center" style={{ height: `${height}px` }} role="separator">
                <div
                    className="w-full max-w-4xl mx-auto h-px"
                    style={{ backgroundColor: `rgba(var(--brand-primary-rgb), 0.125)` }}
                />
            </div>
        </AnimatedSection>
    )
}
