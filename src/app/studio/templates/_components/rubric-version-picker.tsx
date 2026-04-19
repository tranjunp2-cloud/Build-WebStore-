'use client'
/**
 * RubricVersionPicker — shadcn-style select for rubric version.
 * Default: v1.3 (latest). Used in QualityTab re-score form.
 */

const VERSIONS = [
    { value: 'v1.3', label: 'v1.3 (latest)' },
    { value: 'v1.2', label: 'v1.2' },
    { value: 'v1.1', label: 'v1.1' },
    { value: 'v1', label: 'v1' },
] as const

export type RubricVersionValue = 'v1' | 'v1.1' | 'v1.2' | 'v1.3'

type Props = {
    value: RubricVersionValue
    onChange: (v: RubricVersionValue) => void
    disabled?: boolean
}

export function RubricVersionPicker({ value, onChange, disabled }: Props) {
    return (
        <select
            value={value}
            disabled={disabled}
            onChange={e => onChange(e.target.value as RubricVersionValue)}
            className="rounded-md border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Rubric version"
        >
            {VERSIONS.map(v => (
                <option key={v.value} value={v.value}>{v.label}</option>
            ))}
        </select>
    )
}
