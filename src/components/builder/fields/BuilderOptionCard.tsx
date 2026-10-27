import type { LucideIcon } from 'lucide-react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BuilderOptionCardProps {
    label: string
    icon?: LucideIcon
    selected?: boolean
    onClick?: () => void
    onMouseEnter?: () => void
    onMouseLeave?: () => void
}

// Compact horizontal tile: cyan-tinted icon badge left, label right (max 2 lines).
// Top-lit gradient by default, sky-blue on hover, gradient badge + glow + check when selected.
export function BuilderOptionCard({
    label,
    icon: Icon,
    selected,
    onClick,
    onMouseEnter,
    onMouseLeave,
}: BuilderOptionCardProps) {
    return (
        <button
            aria-pressed={!!selected}
            className={cn(
                'group relative flex min-h-[52px] w-full min-w-0 items-center gap-[7px] rounded-xl text-left transition-[border-color,box-shadow] duration-200',
                selected
                    ? 'border-[1.5px] border-[#22D3EE] bg-[linear-gradient(180deg,rgba(34,211,238,0.22)_0%,rgba(6,182,212,0.07)_100%),#0E1826] py-[9.5px] pl-[8.5px] pr-[4.5px] shadow-[0_0_0_3px_rgba(34,211,238,0.1),0_0_22px_rgba(34,211,238,0.25),inset_0_1px_0_rgba(255,255,255,0.1)]'
                    : 'border border-[rgba(51,65,85,0.5)] bg-[linear-gradient(180deg,#151E2D_0%,#0F1622_100%)] py-2.5 pl-[9px] pr-[5px] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-[rgba(56,189,248,0.5)] hover:bg-[linear-gradient(180deg,rgba(56,189,248,0.1)_0%,rgba(56,189,248,0.03)_100%),#121B2A] hover:shadow-[0_0_16px_rgba(56,189,248,0.15),inset_0_1px_0_rgba(255,255,255,0.06)]',
            )}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            type="button"
        >
            {Icon ? (
                <span
                    className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-lg border transition-[transform,color,border-color,box-shadow] duration-200',
                        selected
                            ? 'border-white/[0.18] bg-[linear-gradient(135deg,#3b82f6,#2dd4bf)] text-white shadow-[0_0_14px_rgba(45,212,191,0.45)]'
                            : 'border-[rgba(21,94,117,0.35)] bg-[rgba(6,182,212,0.08)] text-[#67E8F9] group-hover:scale-105 group-hover:border-[rgba(56,189,248,0.45)] group-hover:bg-[rgba(56,189,248,0.14)] group-hover:text-[#7DD3FC] motion-reduce:group-hover:scale-100',
                    )}
                >
                    <Icon aria-hidden className="size-[18px]" />
                </span>
            ) : null}
            <span
                className={cn(
                    'line-clamp-2 min-w-0 flex-1 text-xs leading-4 transition-colors duration-200 [text-wrap:balance]',
                    selected ? 'font-medium text-white' : 'font-normal text-[#A7B2C3] group-hover:text-white',
                )}
            >
                {label}
            </span>
            {selected ? (
                <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-[#22D3EE] text-[#0a0e17] shadow-[0_0_0_2px_#0b1120,0_0_10px_rgba(34,211,238,0.6)]">
                    <Check aria-hidden className="size-2.5" strokeWidth={3.5} />
                </span>
            ) : null}
        </button>
    )
}
