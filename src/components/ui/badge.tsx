import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

// `border-solid` is explicit: preflight is OFF, so the `border` width alone would
// render invisible (no border-style). With it, the outline variant actually paints.
const badgeVariants = cva(
    'inline-flex items-center gap-1.5 rounded-md border border-solid px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
    {
        variants: {
            // Tinted pill + theme-aware text (light = -700 for contrast on light bg,
            // dark = -300). Matches the F33 design status pills.
            variant: {
                default:
                    'border-transparent bg-blue-600 text-white',
                secondary:
                    'border-transparent bg-slate-400/[0.14] text-slate-600 dark:text-slate-300',
                destructive:
                    'border-transparent bg-red-500/[0.12] text-red-700 dark:text-red-300',
                outline:
                    'border-slate-300 text-slate-600 dark:border-white/20 dark:text-gray-300',
                success:
                    'border-transparent bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-300',
                warning:
                    'border-transparent bg-amber-500/[0.15] text-amber-700 dark:text-amber-300',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
    /** Render a leading status dot (inherits text color) before the label. */
    dot?: boolean
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props}>
            {dot && (
                <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: 'currentColor' }}
                />
            )}
            {children}
        </div>
    )
}

export { Badge, badgeVariants }
