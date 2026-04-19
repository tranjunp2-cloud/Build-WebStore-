'use client'
/**
 * DnaBlockListField — comma-separated block slug input with chip preview.
 * Extracted from dna-editor.tsx for file size compliance (≤200 LOC per file).
 */
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
    label: string
    hint: string
    value: string
    onChange: (v: string) => void
}

export function DnaBlockListField({ label, hint, value, onChange }: Props) {
    const chips = value.split(',').map(s => s.trim()).filter(Boolean)
    return (
        <div className="space-y-1.5">
            <Label>{label}</Label>
            <Input
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder="navigation, hero, footer (comma-separated)"
                className="font-mono text-xs"
            />
            {chips.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                    {chips.map(c => (
                        <span key={c} className="px-2 py-0.5 bg-muted rounded-full text-xs font-mono">
                            {c}
                        </span>
                    ))}
                </div>
            )}
            <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
    )
}
