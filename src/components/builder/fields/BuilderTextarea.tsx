import type { ReactNode, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { BUILDER_CONTROL_CLASS, builderControlStateClass } from '@/components/builder/fields/BuilderTextInput'

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
                aria-invalid={invalid || undefined}
                className={cn(
                    BUILDER_CONTROL_CLASS,
                    'min-h-16 resize-none py-2.5 pl-2.5 pr-10',
                    builderControlStateClass(invalid),
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
