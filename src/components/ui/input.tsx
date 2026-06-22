import * as React from 'react'

import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    variant?: 'default' | 'editor'
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, variant = 'default', ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(
                    variant === 'editor'
                        ? 'flex h-9 w-full rounded-[10px] border border-[var(--editor-border)] bg-[var(--editor-surface)] px-3 py-2 text-sm leading-5 text-[var(--editor-text)] shadow-none outline-none placeholder:text-[var(--editor-text-muted)] focus-visible:border-[hsl(var(--ring))] focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 transition-colors'
                        : 'flex h-10 w-full rounded-lg border border-[hsl(var(--input-border))] bg-[hsl(var(--card))] px-3 py-2 text-base md:text-sm text-[hsl(var(--foreground))] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:border-[hsl(var(--ring))] focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
                    className,
                )}
                ref={ref}
                {...props}
            />
        )
    },
)
Input.displayName = 'Input'

export { Input }
