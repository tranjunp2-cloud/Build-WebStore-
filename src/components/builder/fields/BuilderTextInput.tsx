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
                'h-11 w-full rounded-2xl border bg-[rgba(30,41,59,0.6)] px-3 py-2 text-base md:text-sm text-white outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#94a3b8] shadow-[0px_8px_32px_0px_rgba(0,0,0,0.3),inset_0px_1px_0px_0px_rgba(255,255,255,0.05)]',
                invalid
                    ? 'border-red-500/60 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]'
                    : 'border-[#334155] focus:border-[#38BDF8] focus:shadow-[0_0_0_3px_rgba(56,189,248,0.16),0_0_18px_rgba(56,189,248,0.22)]',
            )}
        />
    )
}
