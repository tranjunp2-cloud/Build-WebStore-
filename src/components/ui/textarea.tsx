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
                        ? 'flex min-h-[88px] w-full rounded-[10px] border border-[rgba(59,130,246,0.2)] bg-[rgba(11,17,32,0.5)] px-3 py-2 text-sm leading-5 text-[#F8FAFC] shadow-none outline-none placeholder:text-[#64748B] focus-visible:border-[rgba(59,130,246,0.45)] focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 transition-colors resize-none'
                        : 'flex min-h-[80px] w-full rounded-lg border border-white/10 bg-[#0F172A] px-3 py-2 text-sm text-white outline-none placeholder:text-gray-600 focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors resize-none',
                    className,
                )}
                {...props}
            />
        )
    },
)

Textarea.displayName = 'Textarea'

export { Textarea }
