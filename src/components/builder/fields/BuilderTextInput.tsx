import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface BuilderTextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
    invalid?: boolean
}

export function BuilderTextInput({
    invalid,
    ...props
}: BuilderTextInputProps) {
    return (
        <input
            {...props}
            className={cn(
                'h-11 w-full rounded-2xl border bg-[rgba(30,41,59,0.6)] px-3 py-2 text-sm text-white outline-none transition-all duration-200 placeholder:text-[#94a3b8] shadow-[0px_8px_32px_0px_rgba(0,0,0,0.3),inset_0px_1px_0px_0px_rgba(255,255,255,0.05)]',
                invalid
                    ? 'border-red-400/60 focus:border-red-400/70 focus:ring-1 focus:ring-red-400/20'
                    : 'border-[rgba(59,130,246,0.15)] focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20',
            )}
        />
    )
}
