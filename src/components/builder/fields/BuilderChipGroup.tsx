import { cn } from '@/lib/utils'

interface BuilderChipGroupProps<T extends string> {
    options: ReadonlyArray<{ value: T; label: string }>
    selected: ReadonlyArray<T>
    onToggle: (value: T) => void
    'aria-label': string
}

// Multi-select pills (optional "how do customers buy" answers); each chip is a toggle button.
export function BuilderChipGroup<T extends string>({
    options,
    selected,
    onToggle,
    'aria-label': ariaLabel,
}: BuilderChipGroupProps<T>) {
    return (
        <div aria-label={ariaLabel} className="flex flex-wrap gap-2" role="group">
            {options.map((option) => {
                const isOn = selected.includes(option.value)
                return (
                    <button
                        aria-pressed={isOn}
                        className={cn(
                            'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-[border-color,background-color,color] duration-200',
                            isOn
                                ? 'border-[#22D3EE] bg-[rgba(34,211,238,0.14)] text-white'
                                : 'border-[rgba(51,65,85,0.7)] bg-[rgba(30,41,59,0.6)] text-[#A7B2C3] hover:border-[rgba(56,189,248,0.5)] hover:text-white',
                        )}
                        key={option.value}
                        onClick={() => onToggle(option.value)}
                        type="button"
                    >
                        {option.label}
                    </button>
                )
            })}
        </div>
    )
}
