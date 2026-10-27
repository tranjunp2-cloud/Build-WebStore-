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
                    'min-h-20 w-full resize-none rounded-2xl border bg-[rgba(30,41,59,0.6)] px-3 py-3 pr-12 text-base md:text-sm leading-5 text-white outline-none transition-all duration-200 placeholder:text-[rgba(248,250,252,0.5)] shadow-[0px_8px_32px_0px_rgba(0,0,0,0.3),inset_0px_1px_0px_0px_rgba(255,255,255,0.05)]',
                    invalid
                        ? 'border-red-400/60 focus:border-red-400/70 focus:ring-1 focus:ring-red-400/20'
                        : 'border-[rgba(59,130,246,0.15)] focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20',
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
