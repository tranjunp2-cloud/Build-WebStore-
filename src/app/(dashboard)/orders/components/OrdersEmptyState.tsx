import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
    icon: LucideIcon
    title: string
    description?: string
    action?: React.ReactNode
    className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
    return (
        <div className={cn("flex flex-col items-center justify-center p-8 text-center min-h-[40vh]", className)}>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1E293B]/50 border border-white/5 mb-4">
                <Icon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
            {description && (
                <p className="text-sm text-gray-400 max-w-sm mb-6 pb-2">
                    {description}
                </p>
            )}
            {action && (
                <div>{action}</div>
            )}
        </div>
    )
}
