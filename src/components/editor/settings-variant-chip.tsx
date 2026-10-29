'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface VariantChipProps {
    active: boolean
    onClick: () => void
    children: ReactNode
    className?: string
}

/**
 * Selectable chip for variant pickers in the editor sidebar
 * (block variant, header/footer style, color mode). GH-2107.
 *
 * Active uses the brand primary (teal). In light mode the text stays
 * --editor-text because light primary (#00D3D4) on white is too low-contrast.
 * Idle background is transparent so the hover tint is actually visible.
 */
export function VariantChip({ active, onClick, children, className }: VariantChipProps) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={cn(
                // border-solid: Tailwind preflight is off in this project, `border` alone sets no border-style
                'rounded-lg border border-solid px-3 py-1.5 text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
                active
                    ? 'border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.12)] text-[var(--editor-text)] dark:text-[hsl(var(--primary))]'
                    : 'border-[var(--editor-border)] bg-transparent text-[var(--editor-text-muted)] hover:bg-[var(--editor-overlay-hover)] hover:text-[var(--editor-text)]',
                className,
            )}
        >
            {children}
        </button>
    )
}
