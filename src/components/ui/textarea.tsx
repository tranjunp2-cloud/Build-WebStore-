import * as React from 'react'

import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    variant?: 'default' | 'editor'
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, variant = 'default', ...props }, ref) => {
        return (
            <textarea
                ref={ref}
                className={cn(
                    variant === 'editor'
                        ? 'flex min-h-[88px] w-full rounded-lg border border-[var(--editor-border)] bg-[var(--editor-surface)] px-3 py-2 text-sm leading-5 text-[var(--editor-text)] shadow-none outline-none placeholder:text-[var(--editor-text-muted)] focus-visible:border-[hsl(var(--ring))] focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 transition-colors resize-none'
                        : 'flex min-h-[80px] w-full rounded-lg border border-[hsl(var(--input-border))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground))] focus-visible:border-[hsl(var(--ring))] focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50 transition-colors resize-none',
                    className,
                )}
                {...props}
            />
        )
    },
)

Textarea.displayName = 'Textarea'

export { Textarea }
