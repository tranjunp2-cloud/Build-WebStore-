'use client'

import type { BlockProps } from '../types'
import type { DividerConfig } from './config'

export function DividerBlock({ block, theme }: BlockProps<DividerConfig>) {
    const { variant = 'line', height = 40, color } = block
    const pc = color || theme.primaryColor

    if (variant === 'spacer') {
        return <div style={{ height: `${height}px` }} aria-hidden="true" />
    }

    if (variant === 'dots') {
        return (
            <div className="flex items-center justify-center gap-3" style={{ height: `${height}px` }} role="separator">
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: `${pc}60` }}
                    />
                ))}
            </div>
        )
    }

    if (variant === 'wave') {
        return (
            <div className="w-full overflow-hidden" style={{ height: `${height}px` }} role="separator">
                <svg
                    viewBox="0 0 1200 60"
                    preserveAspectRatio="none"
                    className="w-full h-full"
                >
                    <path
                        d="M0 30 Q150 0 300 30 T600 30 T900 30 T1200 30"
                        fill="none"
                        stroke={`${pc}40`}
                        strokeWidth="2"
                    />
                </svg>
            </div>
        )
    }

    // Default: line
    return (
        <div className="flex items-center justify-center" style={{ height: `${height}px` }} role="separator">
            <div
                className="w-full max-w-4xl mx-auto h-px"
                style={{ backgroundColor: `${pc}20` }}
            />
        </div>
    )
}
