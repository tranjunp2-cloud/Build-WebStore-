import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    {
        variants: {
            variant: {
                // Unified primary (design-system): blue→teal gradient (was blue→purple).
                // `!text-white` survives the `.dash-shell .text-white` legacy remap so the
                // label stays white on the gradient in both themes.
                default:
                    'bg-[linear-gradient(90deg,#3b82f6_0%,#2dd4bf_100%)] !text-white shadow-lg shadow-blue-500/25 hover:opacity-90 focus-visible:ring-cyan-500',
                // `!text-white` keeps the label white on the red fill in BOTH themes —
                // plain text-white gets remapped to --dash-text (dark) inside .dash-shell (GH-1192).
                destructive:
                    'bg-red-600 !text-white shadow-sm hover:bg-red-500 focus-visible:ring-red-500',
                outline:
                    'border border-white/10 bg-transparent text-white hover:bg-white/5 focus-visible:ring-zinc-400',
                secondary:
                    'bg-white/10 text-white hover:bg-white/20 focus-visible:ring-zinc-400',
                ghost:
                    'text-gray-400 hover:bg-white/5 hover:text-white focus-visible:ring-zinc-400',
                link: 'text-blue-400 underline-offset-4 hover:underline focus-visible:ring-blue-400',
                // GH-1222 F33 page-header action pair (reference: Discounts screen).
                // Theme-token colors via arbitrary values: preflight is OFF, so the border
                // needs the full `[border:1px_solid_…]` shorthand to render. Pair with size="dash".
                // GH-1192: `!text-white` is intentional — the `.dash-shell .text-white` legacy remap
                // (globals.css) rewrites plain text-white to --dash-text (dark in light mode). The `!`
                // keeps white on the blue→teal gradient. Drop the `!` once that remap is removed (Nhánh 2).
                dashPrimary:
                    'bg-[linear-gradient(90deg,#3b82f6_0%,#2dd4bf_100%)] !text-white font-semibold shadow-none hover:opacity-90 focus-visible:ring-cyan-500',
                dashSecondary:
                    '[border:1px_solid_hsl(var(--input-border))] bg-transparent text-[var(--dash-text)] font-medium hover:bg-white/[0.05] focus-visible:ring-zinc-400',
                // GH-1192 dash ghost: subtle action inside .dash-shell (pairs with size="dash"/"sm").
                // Mirrors the revamp `.btn-ghost` (transparent + muted ink, hover surface + full ink).
                // Token colors survive the `.dash-shell` legacy remap, so no `!` needed here.
                dashGhost:
                    'bg-transparent text-[var(--dash-text-muted)] font-medium hover:bg-white/[0.05] hover:text-[var(--dash-text)] focus-visible:ring-zinc-400',
            },
            size: {
                // Unified radius: all sizes inherit base `rounded-lg` (8px). Height scale only.
                default: 'h-10 px-5 py-2',
                sm: 'h-8 px-3 text-xs',
                lg: 'h-12 px-8 text-base',
                icon: 'h-9 w-9',
                // F33 action-button metrics (pairs with dashPrimary / dashSecondary).
                dash: 'h-9 px-4 text-[13px]',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button'
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
