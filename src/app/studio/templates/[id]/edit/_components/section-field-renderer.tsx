'use client'
/**
 * section-field-renderer.tsx
 * Renders a single inspector field based on FieldSpec type.
 * Supported: text | textarea | url | array-text
 */
import type { FieldSpec } from '@/lib/admin/section-field-schema'

interface Props {
    spec: FieldSpec
    value: unknown
    onChange: (value: unknown) => void
    readOnly?: boolean
}

function parseArrayText(value: unknown): string {
    if (Array.isArray(value)) return value.join('\n')
    if (typeof value === 'string') return value
    return ''
}

function splitArrayText(raw: string): string[] {
    return raw.split('\n').map((s) => s.trim()).filter(Boolean)
}

export function SectionFieldRenderer({ spec, value, onChange, readOnly = false }: Props) {
    const baseInput = [
        'w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm',
        'placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring',
    ].join(' ')

    if (spec.type === 'text' || spec.type === 'url') {
        return (
            <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">{spec.label}</label>
                <input
                    type={spec.type === 'url' ? 'url' : 'text'}
                    className={baseInput}
                    placeholder={spec.placeholder}
                    value={typeof value === 'string' ? value : ''}
                    readOnly={readOnly}
                    onChange={(e) => onChange(e.target.value)}
                />
            </div>
        )
    }

    if (spec.type === 'textarea') {
        return (
            <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">{spec.label}</label>
                <textarea
                    className={`${baseInput} min-h-[72px] resize-y`}
                    placeholder={spec.placeholder}
                    value={typeof value === 'string' ? value : ''}
                    readOnly={readOnly}
                    onChange={(e) => onChange(e.target.value)}
                />
            </div>
        )
    }

    if (spec.type === 'array-text') {
        return (
            <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">{spec.label}</label>
                <p className="text-xs text-muted-foreground">One entry per line.</p>
                <textarea
                    className={`${baseInput} min-h-[88px] resize-y font-mono text-xs`}
                    placeholder={spec.placeholder ?? 'One item per line'}
                    value={parseArrayText(value)}
                    readOnly={readOnly}
                    onChange={(e) => onChange(splitArrayText(e.target.value))}
                />
            </div>
        )
    }

    return null
}
