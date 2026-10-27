import type { LucideIcon } from 'lucide-react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BuilderOptionCardProps {
    label: string
    icon: LucideIcon
    selected?: boolean
    onClick?: () => void
    onHoverChange?: (hovered: boolean) => void
}

/**
 * Industry tile: cyan-tinted icon badge on the left, label (max 2 lines) on the
 * right. Hover turns sky blue; selected fills the badge with the primary
 * gradient and adds a check mark.
 */
export function BuilderOptionCard({
    label,
    icon: Icon,
    selected,
    onClick,
    onHoverChange,
}: BuilderOptionCardProps) {
    return (
        <button
            aria-pressed={!!selected}
            className={cn(
                'group relative box-border flex min-h-[52px] min-w-0 items-center gap-[7px] rounded-xl text-left transition-[border-color,box-shadow] duration-200',
                selected
                    ? 'border-[1.5px] border-solid border-[#22D3EE] py-[9.5px] pl-[8.5px] pr-[4.5px] shadow-[0_0_0_3px_rgba(34,211,238,.1),0_0_22px_rgba(34,211,238,.25),inset_0_1px_0_rgba(255,255,255,.1)] [background:linear-gradient(180deg,rgba(34,211,238,.22)_0%,rgba(6,182,212,.07)_100%),#0E1826]'
                    : 'border border-solid border-[rgba(51,65,85,.5)] py-[10px] pl-[9px] pr-[5px] shadow-[inset_0_1px_0_rgba(255,255,255,.04)] [background:linear-gradient(180deg,#151E2D_0%,#0F1622_100%)] hover:border-[rgba(56,189,248,.5)] hover:shadow-[0_0_16px_rgba(56,189,248,.15),inset_0_1px_0_rgba(255,255,255,.06)] hover:[background:linear-gradient(180deg,rgba(56,189,248,.1)_0%,rgba(56,189,248,.03)_100%),#121B2A]',
            )}
            onClick={onClick}
            onMouseEnter={onHoverChange ? () => onHoverChange(true) : undefined}
            onMouseLeave={onHoverChange ? () => onHoverChange(false) : undefined}
            type="button"
        >
            <span
                className={cn(
                    'box-border flex size-7 flex-none items-center justify-center rounded-lg border border-solid transition-[transform,color,border-color,box-shadow] duration-200',
                    selected
                        ? 'border-[rgba(255,255,255,.18)] text-white shadow-[0_0_14px_rgba(45,212,191,.45)] [background:linear-gradient(135deg,#3b82f6,#2dd4bf)]'
                        : 'border-[rgba(21,94,117,.35)] bg-[rgba(6,182,212,.08)] text-[#67E8F9] group-hover:scale-105 group-hover:border-[rgba(56,189,248,.45)] group-hover:bg-[rgba(56,189,248,.14)] group-hover:text-[#7DD3FC]',
                )}
            >
                <Icon aria-hidden className="size-[18px]" strokeWidth={2} />
            </span>
            <span
                className={cn(
                    'min-w-0 flex-auto text-xs leading-4 transition-colors duration-200 [text-wrap:balance]',
                    selected ? 'font-medium text-white' : 'font-normal text-[#A7B2C3] group-hover:text-white',
                )}
            >
                {label}
            </span>
            {selected ? (
                <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-[#22D3EE] text-[#0a0e17] shadow-[0_0_0_2px_#0a0e17,0_0_10px_rgba(34,211,238,.6)]">
                    <Check aria-hidden className="size-2.5" strokeWidth={3.5} />
                </span>
            ) : null}
        </button>
    )
}
