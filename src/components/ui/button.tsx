import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    {
        variants: {
            variant: {
                default:
                    'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-purple-500 focus-visible:ring-blue-500',
                destructive:
                    'bg-red-600 text-white shadow-sm hover:bg-red-500 focus-visible:ring-red-500',
                outline:
                    'border border-white/10 bg-transparent text-white hover:bg-white/5 focus-visible:ring-zinc-400',
                secondary:
                    'bg-white/10 text-white hover:bg-white/20 focus-visible:ring-zinc-400',
                ghost:
                    'text-gray-400 hover:bg-white/5 hover:text-white focus-visible:ring-zinc-400',
                link: 'text-blue-400 underline-offset-4 hover:underline focus-visible:ring-blue-400',
            },
            size: {
                default: 'h-10 px-5 py-2',
                sm: 'h-8 rounded-md px-3 text-xs',
                lg: 'h-12 rounded-xl px-8 text-base',
                icon: 'h-9 w-9',
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
