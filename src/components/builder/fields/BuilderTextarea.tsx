import type { ReactNode, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface BuilderTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
    invalid?: boolean
    adornment?: ReactNode
}

export function BuilderTextarea({
    invalid,
    adornment,
    ...props
}: BuilderTextareaProps) {
    return (
        <div className="relative">
            <textarea
                {...props}
                className={cn(
                    adornment && 'pr-12',
                    'min-h-20 w-full resize-none rounded-2xl border bg-[rgba(30,41,59,0.6)] px-3 py-3 text-base md:text-sm leading-5 text-white outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[rgba(248,250,252,0.5)] shadow-[0px_8px_32px_0px_rgba(0,0,0,0.3),inset_0px_1px_0px_0px_rgba(255,255,255,0.05)]',
                    invalid
                        ? 'border-red-500/60 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]'
                        : 'border-[#334155] focus:border-[#38BDF8] focus:shadow-[0_0_0_3px_rgba(56,189,248,0.16),0_0_18px_rgba(56,189,248,0.22)]',
                )}
            />
            {adornment ? (
                <div className="pointer-events-none absolute right-3 top-3">
                    {adornment}
                </div>
            ) : null}
        </div>
    )
}
