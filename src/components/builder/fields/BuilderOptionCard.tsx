import { cn } from '@/lib/utils'

interface BuilderOptionCardProps {
    label: string
    icon?: string
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
            className={cn(
                'relative flex w-full items-center gap-2 rounded-2xl border text-left transition-all duration-200',
                compact ? 'min-h-11 justify-center px-4 py-3 text-center' : 'min-h-11 px-[9px] py-[9px]',
                selected
                    ? 'border-[#3b82f6] bg-[linear-gradient(90deg,rgba(59,130,246,0.2)_0%,rgba(45,212,191,0.2)_100%)] text-[#f8fafc] shadow-[0px_10px_15px_0px_rgba(59,130,246,0.25),0px_4px_6px_0px_rgba(59,130,246,0.25)]'
                    : 'border-[rgba(59,130,246,0.15)] bg-[rgba(30,41,59,0.6)] text-[#94a3b8] shadow-[0px_8px_32px_0px_rgba(0,0,0,0.3)] hover:border-blue-500/30',
            )}
            onClick={onClick}
            type="button"
        >
            {!selected ? (
                <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_1px_0px_0px_rgba(255,255,255,0.05)]" />
            ) : null}
            <div className={cn('relative flex items-center gap-2', compact && 'justify-center')}>
                {icon ? <span className="text-base leading-6">{icon}</span> : null}
                <span className={cn('text-xs leading-4', selected ? 'font-semibold' : 'font-medium')}>
                    {label}
                </span>
            </div>
        </button>
    )
}
