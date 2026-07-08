'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MY_STATES, MY_STATE_LABELS } from '@/lib/shipping/constants'

interface StateSelectProps {
    value?: string
    onChange: (value: string) => void
    placeholder: string
}

/** F37 US-01 FR-28: MY state/federal-territory dropdown — first shadcn
 *  `<Select>` consumer in `SettingsPanel.tsx`; trigger className hand-matched
 *  to the dark editor theme (mirrors `FontSelect.tsx`'s `TRIGGER_CLS`). */
export function StateSelect({ value, onChange, placeholder }: StateSelectProps) {
    return (
        <Select value={value || undefined} onValueChange={onChange}>
            <SelectTrigger className="mt-1.5 h-9 w-full rounded-lg border border-white/10 bg-[var(--editor-surface-elevated)] px-3 text-sm text-white outline-none">
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent side="bottom" align="start">
                {MY_STATES.map(state => (
                    <SelectItem key={state} value={state}>
                        {MY_STATE_LABELS[state]}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
