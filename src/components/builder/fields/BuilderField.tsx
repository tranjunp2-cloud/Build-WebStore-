import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface BuilderFieldProps {
    Icon?: LucideIcon
    label: string
    required?: boolean
    optionalLabel?: string
    error?: string
    hint?: ReactNode
    children: ReactNode
}

export function BuilderField({
    Icon,
    label,
    required,
    optionalLabel,
    error,
    hint,
    children,
}: BuilderFieldProps) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-[#f8fafc]">
                {Icon ? <Icon className="h-4 w-4 shrink-0 text-[#94a3b8]" aria-hidden /> : null}
                <span>{label}</span>
                {required ? <span className="text-[#ef4444]">*</span> : null}
                {optionalLabel ? (
                    <span className="text-xs font-medium text-[#94a3b8]">
                        {optionalLabel}
                    </span>
                ) : null}
            </div>
            {children}
            {hint ? <div className="text-xs leading-4 text-[#94a3b8]">{hint}</div> : null}
            {error ? <p className="text-xs leading-4 text-red-400">{error}</p> : null}
        </div>
    )
}
