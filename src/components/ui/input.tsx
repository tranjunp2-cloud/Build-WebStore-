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
                        ? 'flex h-9 w-full rounded-[10px] border border-[rgba(59,130,246,0.2)] bg-[rgba(11,17,32,0.5)] px-3 py-2 text-sm leading-5 text-[#F8FAFC] shadow-none outline-none placeholder:text-[#64748B] focus-visible:border-[rgba(59,130,246,0.45)] focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 transition-colors'
                        : 'flex h-10 w-full rounded-lg border border-white/10 bg-[#0F172A] px-3 py-2 text-sm text-white ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-600 focus-visible:outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
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
