interface DiscountStatusBadgeProps {
    status: string
}

export function DiscountStatusBadge({ status }: DiscountStatusBadgeProps) {
    const isActive = status === 'active'

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium ${
                isActive
                    ? 'bg-green-100/10 text-green-400'
                    : 'bg-slate-100/10 text-slate-400'
            }`}
        >
            <span
                className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    isActive ? 'bg-green-400' : 'bg-slate-400'
                }`}
            />
            {isActive ? 'Active' : 'Inactive'}
        </span>
    )
}
