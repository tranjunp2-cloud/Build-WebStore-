import type { ReactNode } from 'react'

interface BuilderFieldProps {
    label: string
    required?: boolean
    optionalLabel?: string
    error?: string
    hint?: ReactNode
    children: ReactNode
}

export function BuilderField({
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
            {/* role="alert": screen readers announce the message when it appears */}
            {error ? <p className="text-xs leading-4 text-red-400" role="alert">{error}</p> : null}
        </div>
    )
}
