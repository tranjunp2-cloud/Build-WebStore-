import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface BuilderFieldProps {
    label: string
    required?: boolean
    optionalLabel?: string
    error?: string
    hint?: ReactNode
    children: ReactNode
    /** Gap between label and control — the industry grid uses a roomier 12px. */
    spacious?: boolean
}

export function BuilderField({
    label,
    required,
    optionalLabel,
    error,
    hint,
    children,
    spacious,
}: BuilderFieldProps) {
    return (
        <div className={cn('grid', spacious ? 'gap-3' : 'gap-2')}>
            <div className="flex gap-1.5 text-sm font-medium leading-5 text-[#e2e8f0]">
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
            {error ? <p className="text-xs text-[#f87171]">{error}</p> : null}
        </div>
    )
}
