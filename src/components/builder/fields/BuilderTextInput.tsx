import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface BuilderTextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
    invalid?: boolean
}

/** Shared look for builder inputs: slate-700 border, cyan focus glow, red when invalid. */
export const BUILDER_CONTROL_CLASS =
    'block w-full rounded-lg border bg-[#172033] text-base leading-6 text-white outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#a9a9a9] md:text-[11px] md:leading-4'

export function builderControlStateClass(invalid?: boolean) {
    return invalid
        ? 'border-[rgba(239,68,68,.6)] shadow-[0_4px_14px_rgba(0,0,0,.25)] focus:shadow-[0_0_0_3px_rgba(239,68,68,.15)]'
        : 'border-[#334155] shadow-[0_4px_14px_rgba(0,0,0,.25)] focus:border-[#38BDF8] focus:shadow-[0_0_0_3px_rgba(56,189,248,.16),0_0_18px_rgba(56,189,248,.22)]'
}

export function BuilderTextInput({
    invalid,
    ...props
}: BuilderTextInputProps) {
    return (
        <input
            {...props}
            aria-invalid={invalid || undefined}
            className={cn(BUILDER_CONTROL_CLASS, 'min-h-8 px-2.5 py-2', builderControlStateClass(invalid))}
        />
    )
}
