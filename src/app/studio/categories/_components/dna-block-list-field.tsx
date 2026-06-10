'use client'
/**
 * DnaBlockListField — comma-separated block slug input with chip preview.
 * Extracted from dna-editor.tsx for file size compliance (≤200 LOC per file).
 * Restyled to bundle .dna-* classes.
 */
import type { LucideIcon } from 'lucide-react'

type Props = {
    label: string
    Icon?: LucideIcon  // optional leading icon (e.g. Star, Plus, Ban)
    hint: string
    value: string
    chipVariant?: 'default' | 'forbidden'
    onChange: (v: string) => void
}

export function DnaBlockListField({
    label,
    Icon,
    hint,
    value,
    chipVariant = 'default',
    onChange,
}: Props) {
    const chips = value.split(',').map((s) => s.trim()).filter(Boolean)

    return (
        <div className="dna-field-group">
            <div className="dna-section-label">
                {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
                <span>{label}</span>
                {hint && (
                    <span className="dna-section-hint">{hint}</span>
                )}
            </div>
            <input
                type="text"
                className="dna-field-input"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="navigation, hero, footer (comma-separated)"
            />
            {chips.length > 0 && (
                <div className="dna-chips-row">
                    {chips.map((c) => (
                        <span
                            key={c}
                            className={`dna-block-chip${chipVariant === 'forbidden' ? ' forbidden' : ''}`}
                        >
                            {c}
                        </span>
                    ))}
                </div>
            )}
        </div>
    )
}
