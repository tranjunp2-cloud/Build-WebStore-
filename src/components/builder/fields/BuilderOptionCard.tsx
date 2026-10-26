import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface BuilderOptionCardProps {
    label: string
    icon?: ReactNode
    selected?: boolean
    onClick?: () => void
    compact?: boolean
}

export function BuilderOptionCard({
    label,
    icon,
    selected,
    onClick,
    compact,
}: BuilderOptionCardProps) {
    return (
        <button
            aria-pressed={selected}
            className={cn(
                'relative flex w-full items-center gap-2 rounded-xl border text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
                compact ? 'min-h-11 justify-center px-4 py-3 text-center' : 'min-h-11 px-3 py-[9px]',
                selected
                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)] text-white'
                    : 'border-[rgba(148,163,184,0.18)] bg-[rgba(30,41,59,0.6)] text-[#cbd5e1] hover:border-[rgba(148,163,184,0.35)]',
            )}
            onClick={onClick}
            type="button"
        >
            <div className={cn('relative flex items-center gap-2', compact && 'justify-center')}>
                {icon ? (
                    <span className={cn('flex shrink-0 [&_svg]:size-4', selected ? 'text-[hsl(var(--primary))]' : 'text-[#94a3b8]')} aria-hidden>
                        {icon}
                    </span>
                ) : null}
                <span className={cn('text-xs leading-4', selected ? 'font-semibold' : 'font-medium')}>
                    {label}
                </span>
            </div>
        </button>
    )
}
